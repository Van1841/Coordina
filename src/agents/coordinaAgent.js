// ============================================================
// src/agents/coordinaAgent.js
// Reactive agent behaviour: handles @Coordina mentions across
// every connected workspace with the same logic, regardless of
// which Bolt app instance received the event.
//
// Commands:
//   @Coordina status          -> situation report (Block Kit)
//   @Coordina summary         -> same, condensed text summary
//   @Coordina explain <id>    -> deterministic score breakdown
//   @Coordina recommendations -> latest pending recommendations
//   @Coordina <anything else> -> natural language Q&A via LLM,
//                                 grounded in live incident data
// ============================================================
import { listIncidents, getIncident } from '../db/queries.js';
import { listRecommendations, getTargetOrgForRecommendation } from '../services/recommendationService.js';
import { getOrgMap, getOrgById } from '../services/organizationService.js';
import { generate } from '../llm/llmRouter.js';
import { situationReportBlocks, recommendationBlocks, explainBlocks } from '../utils/blockKit.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('agent');

function parseCommand(text) {
  const cleaned = text.replace(/<@[^>]+>/g, '').trim().toLowerCase();
  if (/^status\b/.test(cleaned)) return { command: 'status' };
  if (/^summary\b/.test(cleaned)) return { command: 'summary' };
  if (/^recommendations?\b/.test(cleaned)) return { command: 'recommendations' };
  const explainMatch = cleaned.match(/^explain\s+#?(\d+)/);
  if (explainMatch) return { command: 'explain', incidentId: Number(explainMatch[1]) };
  return { command: 'freeform', text: cleaned };
}

async function handleStatus() {
  const incidents = await listIncidents({ status: 'open', limit: 20 });
  const orgById = await getOrgMap();
  return { blocks: situationReportBlocks({ incidents, orgById }) };
}

async function handleSummary() {
  const incidents = await listIncidents({ status: 'open', limit: 100 });
  if (!incidents.length) return { text: '✅ All clear — no open incidents across connected organizations right now.' };

  const byCategory = incidents.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});
  const critical = incidents.filter((i) => (i.priority_score ?? 0) >= 70).length;
  const lines = Object.entries(byCategory).map(([cat, count]) => `• ${cat}: ${count} open`).join('\n');

  return {
    text: `*Coordina Summary*\n${incidents.length} open incidents across connected organizations (${critical} critical).\n${lines}`,
  };
}

async function handleRecommendations() {
  const recs = await listRecommendations({ status: 'pending', limit: 5 });
  if (!recs.length) return { text: 'No pending recommendations right now.' };

  const blocks = [];
  for (const rec of recs) {
    const incident = await getIncident(rec.incident_id);
    if (!incident) continue;
    const org = await getOrgById(incident.organization_id);
    const targetOrg = await getTargetOrgForRecommendation(rec);
    blocks.push(...recommendationBlocks({ incident, recommendation: rec, org, targetOrg }));
  }
  return { blocks };
}

async function handleExplain(incidentId) {
  const incident = await getIncident(incidentId);
  if (!incident) return { text: `I couldn't find incident #${incidentId}.` };
  return { blocks: explainBlocks(incident, incident.score_breakdown) };
}

async function handleFreeform(text) {
  const incidents = await listIncidents({ status: 'open', limit: 15 });
  const context = incidents
    .map((i) => `#${i.id} [${i.category}/${i.status}] score=${i.priority_score ?? 'n/a'} — ${i.summary} (org: ${i.organization_id}, people: ${i.people_affected})`)
    .join('\n');

  const prompt = `You are Coordina, an AI coordination assistant embedded in Slack across several disaster-relief organizations. Answer the coordinator's question using ONLY the incident data below — do not invent incidents, numbers, or organizations not listed. If the data doesn't answer the question, say so plainly. Keep the answer under 6 sentences, no markdown headers.

Open incidents:
${context || '(none currently open)'}

Question: ${text}`;

  const { text: answer, error } = await generate(prompt, { maxOutputTokens: 300 });
  if (!answer) {
    log.warn('freeform Q&A failed:', error);
    return { text: "I'm having trouble reaching my reasoning providers right now, but here's the raw data:\n" + (context || 'No open incidents.') };
  }
  return { text: answer };
}

/** Main entry point called by every Slack app's app_mention handler. */
export async function handleMention({ text }) {
  const parsed = parseCommand(text);
  log.debug('handling command:', parsed.command);

  switch (parsed.command) {
    case 'status': return handleStatus();
    case 'summary': return handleSummary();
    case 'recommendations': return handleRecommendations();
    case 'explain': return handleExplain(parsed.incidentId);
    default: return handleFreeform(parsed.text);
  }
}
