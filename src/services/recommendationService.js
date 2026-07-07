// ============================================================
// src/services/recommendationService.js
// Decides WHAT action to recommend for a scored incident (pure
// rule-based, deterministic — matching resources/orgs), then
// asks the LLM router ONLY to explain/rank/phrase that decision
// in human language. The action itself is never chosen by the LLM.
// ============================================================
import { createRecommendation, listRecommendations, updateRecommendationStatus, getIncident } from '../db/queries.js';
import { mcpClient } from '../mcp/mcpClient.js';
import { getAllOrganizations, getOrgById } from './organizationService.js';
import { generate } from '../llm/llmRouter.js';
import { configuredOrganizations } from '../config/index.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('recommendation-service');

/**
 * Deterministically decide the best action + target org for an
 * incident, using live MCP data (never guessed).
 */

// Which organization type is best suited to help with each incident
// category — a food shortage should route to a food bank, a medical
// shortage to a hospital, and so on. Checked BEFORE distance.
const CATEGORY_PREFERRED_ORG_TYPE = {
  medical: 'hospital',
  food: 'foodbank',
  logistics: 'volunteer',
};

async function decideAction(incident) {
  const reachableOrgIds = new Set(configuredOrganizations().map((o) => o.orgId));
const orgs = (await getAllOrganizations()).filter((o) => reachableOrgIds.has(o.id));
const otherOrgIds = orgs.map((o) => o.id).filter((id) => id !== incident.organization_id);

  if (incident.category === 'shelter') {
    const available = (await mcpClient.call('shelter.find_available', { minFreeBeds: Math.max(1, incident.people_affected) }))
  .filter((s) => reachableOrgIds.has(s.organization_id));
    if (available.length) {
      return { action: 'dispatch', targetOrgId: available[0].organization_id, mcpEvidence: { availableShelters: available.slice(0, 3) } };
    }
    return { action: 'escalate', targetOrgId: null, mcpEvidence: { reason: 'no shelter has sufficient free capacity' } };
  }

  if (incident.category === 'medical' || incident.category === 'food' || incident.category === 'logistics') {
    const shortages = await mcpClient.call('inventory.find_shortages', { thresholdRatio: 0.4 });
    const isShort = shortages.some((s) => s.organization_id === incident.organization_id);
    if (isShort) {
      const preferredType = CATEGORY_PREFERRED_ORG_TYPE[incident.category];
      const specialized = orgs.filter((o) => o.type === preferredType && o.id !== incident.organization_id).map((o) => o.id);
      const candidateOrgIds = specialized.length ? specialized : otherOrgIds;

      const ranked = candidateOrgIds.length
        ? await mcpClient.call('routing.nearest', { targetOrgId: incident.organization_id, candidateOrgIds })
        : [];
      const nearest = ranked[0];
      return {
        action: 'reallocate',
        targetOrgId: nearest?.orgId || null,
        mcpEvidence: {
          shortages: shortages.slice(0, 3),
          nearestResponder: nearest || null,
          matchedBySpecialization: specialized.length > 0,
        },
      };
    }
  }

  if (incident.priority_score != null && incident.priority_score >= 70) {
    return { action: 'escalate', targetOrgId: null, mcpEvidence: { reason: 'critical priority score with no clear resource match' } };
  }

  return { action: 'monitor', targetOrgId: null, mcpEvidence: {} };
}

// function explanationPrompt(incident, decision) {
//   return `You are Coordina, an AI coordination assistant for cross-organization disaster relief.
// A deterministic scoring engine (NOT you) has already computed this incident's priority score and chosen the recommended action below. Your ONLY job is to explain the reasoning in 2-3 clear, human sentences for coordinators reading this in Slack. Do NOT invent numbers, statistics, or confidence percentages that are not given to you. Do NOT change the action or score.

// Incident: ${incident.summary}
// Category: ${incident.category}
// People affected: ${incident.people_affected}
// Priority score (0-100, deterministic): ${incident.priority_score}
// Score breakdown (top factors): ${JSON.stringify(incident.score_breakdown?.contributions || {})}
// Chosen action: ${decision.action}
// Supporting data used for this decision: ${JSON.stringify(decision.mcpEvidence)}

// Write the explanation now, as plain text, no markdown headers, no JSON:`;
// }

function tierLabel(score) {
  if (score == null) return 'unscored';
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'moderate';
  return 'low';
}

function topFactorNames(breakdown, count = 2) {
  const contributions = breakdown?.contributions || {};
  return Object.entries(contributions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase().trim());
}

function explanationPrompt(incident, decision) {
  const tier = tierLabel(incident.priority_score);
  const factors = topFactorNames(incident.score_breakdown).join(' and ') || 'overall situation severity';

  return `You are Coordina, an AI coordination assistant for cross-organization disaster relief.
A deterministic scoring engine (NOT you) has already assessed this incident's urgency and chosen the recommended action below. Your ONLY job is to explain the reasoning in 2-3 clear, human sentences for coordinators reading this in Slack.

STRICT RULES — follow exactly:
- Never state or invent any numeric score, percentage, point value, or decimal number anywhere in your response, even if one appears in the data below.
- Never say things like "a score of X" or "X points" — describe urgency only in plain words (e.g. "urgent", "a significant shortage", "moderate concern").
- Do not invent confidence percentages or statistics.
- Do not change the chosen action.

Incident: ${incident.summary}
Category: ${incident.category}
People affected: ${incident.people_affected}
Urgency level (qualitative only): ${tier}
Most significant contributing factors: ${factors}
Chosen action: ${decision.action}
Supporting data used for this decision: ${JSON.stringify(decision.mcpEvidence)}

Write the explanation now, as plain text, no markdown headers, no JSON, and with absolutely no numbers of any kind:`;
}

export async function generateRecommendation(incidentId) {
  const incident = await getIncident(incidentId);
  if (!incident) throw new Error(`No such incident #${incidentId}`);

  const decision = await decideAction(incident);
  const { text: explanation, provider, error } = await generate(explanationPrompt(incident, decision), { maxOutputTokens: 220 });

  const recId = await createRecommendation({
    incidentId: incident.id,
    action: decision.action,
    targetOrgId: decision.targetOrgId,
    explanation: explanation || null,
    llmProvider: provider,
    confidenceNote: explanation ? null : 'LLM explanation unavailable; action derived purely from deterministic score + live MCP data.',
  });

  if (error) log.warn(`recommendation #${recId} created without explanation:`, error);

  return {
    id: recId,
    incidentId: incident.id,
    action: decision.action,
    targetOrgId: decision.targetOrgId,
    explanation,
    llmProvider: provider,
  };
}

export async function acknowledgeRecommendation(id) {
  await updateRecommendationStatus(id, 'acknowledged');
}

export async function dismissRecommendation(id) {
  await updateRecommendationStatus(id, 'dismissed');
}

export { listRecommendations };

export async function getTargetOrgForRecommendation(rec) {
  return rec.target_org_id ? getOrgById(rec.target_org_id) : null;
}
