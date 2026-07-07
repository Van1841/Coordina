// ============================================================
// src/agents/proactiveLoop.js
// This is what makes Coordina an AGENT rather than a chatbot:
// it runs continuously, without being asked, cycling through
// Observe -> Reason -> Plan -> Recommend -> Coordinate -> Escalate.
//
// Two triggers drive it:
//   1. RTS event subscription — reacts immediately when a new
//      incident signal is published (event-driven, no polling).
//   2. A coarse periodic sweep (default 60s) for time-based
//      concerns that no single event captures: overdue
//      escalation and periodic re-scoring as context changes
//      (inventory drains, volunteers get dispatched, etc).
// ============================================================
import { rts } from '../rts/realtimeSearch.js';
import { listIncidents, updateIncident } from '../db/queries.js';
import { rescoreIncident } from '../services/incidentService.js';
import { generateRecommendation } from '../services/recommendationService.js';
import { getOrgById } from '../services/organizationService.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('proactive-loop');

// const ESCALATION_HOURS = 6;
// const SWEEP_INTERVAL_MS = 60_000;

// let notifyFn = null;
// let sweepTimer = null;

const ESCALATION_HOURS = 6;
const SWEEP_INTERVAL_MS = 60_000;
const ESCALATION_REPEAT_INTERVAL_MS = 3 * 60 * 60 * 1000; // re-notify at most once every 3 hours per incident

let notifyFn = null;
let sweepTimer = null;
const lastEscalatedAt = new Map(); // incidentId -> timestamp of last escalation notification

/** Injected by index.js once Slack apps are ready, so the loop can post proactively. */
export function setNotifier(fn) {
  notifyFn = fn;
}

async function notify(organizationId, payload) {
  if (!notifyFn) {
    log.debug('notifier not yet wired, skipping proactive post:', payload.kind || payload.text?.slice(0, 40));
    return;
  }
  try {
    await notifyFn(organizationId, payload);
  } catch (err) {
    log.warn('proactive notify failed:', err.message);
  }
}

// ---------------------------------------------------------------
// Event-driven reaction: a new/merged incident signal arrives.
// ---------------------------------------------------------------

export async function notifyRecommendationOutcome(incident, rec) {
  if (rec.targetOrgId) {
    const targetOrg = await getOrgById(rec.targetOrgId);
    const sourceOrg = await getOrgById(incident.organization_id);
    await notify(rec.targetOrgId, {
      kind: 'incoming_request',
      text: `📨 *Incoming coordination request from ${sourceOrg?.name || incident.organization_id}*\n${incident.summary}\nSuggested action: *${rec.action}* — ${rec.explanation || 'see priority score for details.'}`,
    });
  }
  await notify(incident.organization_id, {
    kind: 'recommendation',
    incidentId: incident.id,
    recommendationId: rec.id,
  });
}

async function onSignal(signal) {
  if (!signal.incidentId) return;

  const { getIncident } = await import('../db/queries.js');
  const incident = await getIncident(signal.incidentId);
  if (!incident || incident.status === 'resolved' || incident.status === 'merged') return;

  // REASON + PLAN: rescore with fresh MCP context, then decide + explain
  await rescoreIncident(incident);
  const refreshed = await getIncident(signal.incidentId);

  const rec = await generateRecommendation(signal.incidentId);
  log.info(`proactive recommendation #${rec.id} for incident #${signal.incidentId}: ${rec.action}`);

  // COORDINATE: if the recommendation targets another org, DM them directly
  // instead of waiting for a human to notice the Slack thread.
  // if (rec.targetOrgId) {
  //   const targetOrg = await getOrgById(rec.targetOrgId);
  //   const sourceOrg = await getOrgById(incident.organization_id);
  //   await notify(rec.targetOrgId, {
  //     kind: 'incoming_request',
  //     text: `📨 *Incoming coordination request from ${sourceOrg?.name || incident.organization_id}*\n${refreshed.summary}\nSuggested action: *${rec.action}* — ${rec.explanation || 'see priority score for details.'}`,
  //   });
  // }

  await notifyRecommendationOutcome(refreshed, rec);

  // Always post the recommendation back into the originating org too.
  await notify(incident.organization_id, {
    kind: 'recommendation',
    incidentId: signal.incidentId,
    recommendationId: rec.id,
  });
}

// ---------------------------------------------------------------
// Periodic sweep: escalate overdue incidents, refresh scores.
// ---------------------------------------------------------------
async function sweep() {
  try {
    const open = await listIncidents({ status: 'open', limit: 200 });
    const now = Date.now();

    for (const incident of open) {
      const hoursOpen = (now - new Date(incident.created_at).getTime()) / 36e5;

      // ESCALATE: overdue + unresolved + not already escalated recently
      // if (hoursOpen >= ESCALATION_HOURS && incident.status === 'open') {
      //   log.info(`escalating overdue incident #${incident.id} (${hoursOpen.toFixed(1)}h open)`);
      //   await notify(incident.organization_id, { kind: 'escalation', incidentId: incident.id, hoursOpen });
      // }

      // ESCALATE: overdue + unresolved + not already escalated recently
      if (hoursOpen >= ESCALATION_HOURS && incident.status === 'open') {
        const lastNotified = lastEscalatedAt.get(incident.id) || 0;
        if (Date.now() - lastNotified >= ESCALATION_REPEAT_INTERVAL_MS) {
          log.info(`escalating overdue incident #${incident.id} (${hoursOpen.toFixed(1)}h open)`);
          await notify(incident.organization_id, { kind: 'escalation', incidentId: incident.id, hoursOpen });
          lastEscalatedAt.set(incident.id, Date.now());
        }
      }

      // Periodic rescoring keeps priority current as MCP-backed
      // resources/context change even without a new message.
      await rescoreIncident(incident);
    }
  } catch (err) {
    log.error('sweep failed:', err.message);
  }
}

export function startProactiveLoop() {
  rts.watch(onSignal);
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
  log.info(`proactive loop started (event-driven + ${SWEEP_INTERVAL_MS / 1000}s sweep)`);
}

export function stopProactiveLoop() {
  if (sweepTimer) clearInterval(sweepTimer);
}
