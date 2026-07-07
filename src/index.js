// ============================================================
// src/index.js
// Application entrypoint. Boots, in order:
//   1. Dashboard API + Socket.IO server (works even with zero
//      Slack apps configured — useful for judges/demo-only runs)
//   2. Per-organization Slack Bolt apps (Socket Mode)
//   3. The proactive agent loop, wired to actually post into
//      Slack via the now-running app instances
// ============================================================
import { startServer } from './routes/server.js';
import { initializeSlackApps, postToOrganization } from './apps/slackApps.js';
import { startProactiveLoop, setNotifier } from './agents/proactiveLoop.js';
import { getIncident } from './db/queries.js';
import { listRecommendations } from './services/recommendationService.js';
import { recommendationBlocks, escalationBlocks } from './utils/blockKit.js';
import { getOrgById, getOrgMap } from './services/organizationService.js';
import { pingDatabase } from './db/pool.js';
import makeLogger from './utils/logger.js';

const log = makeLogger('index');
// Known upstream bug workaround: @slack/socket-mode's internal state
// machine occasionally crashes the whole process during a reconnect
// race condition. We log it and keep running instead of crashing.
process.on('uncaughtException', (err) => {
  if (err?.message?.includes('server explicit disconnect')) {
    log.warn('Recovered from a known @slack/socket-mode reconnect race condition. Continuing normally.');
    return;
  }
  log.error('Uncaught exception:', err);
  process.exit(1);
});

async function main() {
  log.info('Coordina booting...');

  const dbOk = await pingDatabase();
  if (!dbOk) {
    log.error('Database unreachable. Run `npm run migrate` (and check .env) before starting. Continuing in degraded mode.');
  }

  startServer();

  const slackInstances = await initializeSlackApps();

  // Wire the proactive loop's notifier to actually post Block Kit
  // messages into the right workspace, using the shared builders.
  setNotifier(async (organizationId, payload) => {
    const orgById = await getOrgMap();

    if (payload.kind === 'escalation') {
      const incident = await getIncident(payload.incidentId);
      if (!incident) return;
      await postToOrganization(slackInstances, organizationId, {
        text: `Escalation: incident #${incident.id}`,
        blocks: escalationBlocks(incident, payload.hoursOpen),
      });
      return;
    }

    if (payload.kind === 'recommendation') {
      const incident = await getIncident(payload.incidentId);
      const recs = await listRecommendations({ incidentId: payload.incidentId, limit: 1 });
      const rec = recs[0];
      if (!incident || !rec) return;
      const org = orgById[incident.organization_id];
      const targetOrg = rec.target_org_id ? orgById[rec.target_org_id] : null;
      await postToOrganization(slackInstances, organizationId, {
        text: `New recommendation for incident #${incident.id}`,
        blocks: recommendationBlocks({ incident, recommendation: rec, org, targetOrg }),
      });
      return;
    }

    if (payload.kind === 'incoming_request') {
      await postToOrganization(slackInstances, organizationId, { text: payload.text });
      return;
    }

    if (payload.text) {
      await postToOrganization(slackInstances, organizationId, { text: payload.text });
    }
  });

  startProactiveLoop();

  log.info(`Coordina is running. ${slackInstances.size} Slack workspace(s) connected. Dashboard API on port ${process.env.PORT || 4000}.`);
}

main().catch((err) => {
  log.error('fatal startup error:', err);
  process.exit(1);
});
