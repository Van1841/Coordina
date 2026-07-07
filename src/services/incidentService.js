// ============================================================
// src/services/incidentService.js
// Business logic for incidents: classification -> dedup check
// via RTS -> create-or-merge -> score -> publish signal.
//
// This is where "We now need 200 blankets" gets folded into an
// existing open request instead of spawning a duplicate: RTS
// search finds the semantically similar open incident in the
// same category, and if it's a strong match we update people
// affected / summary on the ORIGINAL incident rather than
// inserting a new row.
// ============================================================
import {
  createIncident,
  updateIncident,
  getIncident,
  listIncidents,
  findOpenIncidentsByCategory,
} from '../db/queries.js';
import { classifyMessage } from '../llm/classifier.js';
import { scoreIncident } from '../scoring/priorityEngine.js';
import { rts } from '../rts/realtimeSearch.js';
import { getAllOrganizations } from './organizationService.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('incident-service');

const DUPLICATE_RELEVANCE_THRESHOLD = 0.35;

/**
 * Ingest a raw Slack message: classify it, decide create-vs-merge,
 * score it, and publish an RTS signal for downstream watchers
 * (proactive loop, dashboard live feed).
 */
export async function ingestMessage({ organizationId, text, channel, messageTs }) {
  const classification = await classifyMessage(text);

  if (classification.kind === 'chatter') {
    log.debug('message classified as chatter, ignoring:', text.slice(0, 60));
    return null;
  }

  // 1. Duplicate / continuation detection via RTS semantic search
  const similar = await rts.search(classification.summary, { category: classification.category, limit: 3 });
  const strongMatch = similar.find((s) => s.relevance >= DUPLICATE_RELEVANCE_THRESHOLD && s.incidentId);

  let incidentId;
  let merged = false;

  if (strongMatch) {
    const existing = await getIncident(strongMatch.incidentId);
    if (existing && existing.status !== 'resolved' && existing.status !== 'merged') {
      // Fold the new signal into the existing incident: bump people
      // affected (never double count blindly — take the max, since
      // messages like "we now need 200" typically restate the total
      // rather than add to it) and refresh the summary/timestamp.
      const nextPeopleAffected = Math.max(existing.people_affected, classification.peopleAffected);
      await updateIncident(existing.id, {
        summary: classification.summary,
        peopleAffected: nextPeopleAffected,
        status: existing.status === 'resolved' ? 'open' : existing.status,
      });
      incidentId = existing.id;
      merged = true;
      log.info(`merged message into existing incident #${existing.id} (relevance ${strongMatch.relevance.toFixed(2)})`);
    }
  }

  if (!incidentId) {
    incidentId = await createIncident({
      organizationId,
      kind: classification.kind === 'urgent' ? 'urgent' : classification.kind,
      category: classification.category,
      summary: classification.summary,
      peopleAffected: classification.peopleAffected,
      sourceChannel: channel,
      sourceMessageTs: messageTs,
      rawText: text,
    });
    log.info(`created incident #${incidentId} (${classification.category}/${classification.kind})`);
  }

  const incident = await getIncident(incidentId);
  await rescoreIncident(incident);

  const finalIncident = await getIncident(incidentId);

  rts.publish({
    text: classification.summary,
    category: classification.category,
    organizationId,
    incidentId,
    kind: merged ? 'merge' : 'new_incident',
  });

  return { incident: finalIncident, merged, classification };
}

export async function rescoreIncident(incident) {
  const orgs = await getAllOrganizations();
  const candidateOrgIds = orgs.map((o) => o.id).filter((id) => id !== incident.organization_id);
  const { score, breakdown } = await scoreIncident(incident, { candidateOrgIds });
  await updateIncident(incident.id, { priorityScore: score, scoreBreakdown: breakdown });
  return { score, breakdown };
}

export async function rescoreAllOpenIncidents() {
  const open = await listIncidents({ status: 'open' });
  const results = [];
  for (const incident of open) {
    results.push({ incidentId: incident.id, ...(await rescoreIncident(incident)) });
  }
  return results;
}

export async function markResolved(incidentId) {
  await updateIncident(incidentId, { status: 'resolved' });
}

export async function findDuplicateCandidates(category, excludeId) {
  return findOpenIncidentsByCategory(category, excludeId);
}

export { listIncidents, getIncident, updateIncident };
