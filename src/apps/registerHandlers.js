// ============================================================
// src/apps/registerHandlers.js
// Registers the same handler set on every per-org Bolt app:
//   - message events   -> ingest into incident pipeline
//   - app_mention      -> reactive agent commands / Q&A
//   - block actions     -> acknowledge / dismiss recommendations
// Parameterized by { orgId, orgName } so one function serves
// every workspace identically.
// ============================================================
import { ingestMessage } from '../services/incidentService.js';
import { handleMention } from '../agents/coordinaAgent.js';
import { acknowledgeRecommendation, dismissRecommendation } from '../services/recommendationService.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('handlers');

export function registerHandlers(app, { orgId, orgName }) {
  const scopedLog = makeLogger(`handlers:${orgId}`);

  // ---- Passive observation: every non-bot message is a
  // candidate incident signal, classified by the NLP layer.
  app.message(async ({ message, say }) => {
    if (message.subtype || message.bot_id) return; // ignore bot/system messages
    if (!message.text || message.text.trim().length < 3) return;

    try {
      const result = await ingestMessage({
        organizationId: orgId,
        text: message.text,
        channel: message.channel,
        messageTs: message.ts,
      });

      if (result?.merged) {
        await say({
          thread_ts: message.ts,
          text: `🔗 Linked to existing incident #${result.incident.id} — updated to ${result.incident.people_affected} people affected.`,
        });
      }
    } catch (err) {
      scopedLog.error('message ingestion failed:', err.message);
    }
  });

  // ---- Reactive commands: @Coordina status/summary/explain/recommendations/Q&A
  app.event('app_mention', async ({ event, say }) => {
    try {
      const response = await handleMention({ text: event.text, orgId });
      await say({
        thread_ts: event.ts,
        text: response.text || 'Here you go:',
        blocks: response.blocks,
      });
    } catch (err) {
      scopedLog.error('app_mention handling failed:', err.message);
      await say({ thread_ts: event.ts, text: '⚠️ Something went wrong processing that — the team has been notified in logs.' });
    }
  });

  // ---- Block Kit action buttons on recommendation cards
  app.action('coordina_ack', async ({ ack, action, respond }) => {
    await ack();
    await acknowledgeRecommendation(Number(action.value));
    await respond({ text: `✅ Recommendation #${action.value} acknowledged by a coordinator at ${orgName}.`, replace_original: false });
  });

  app.action('coordina_dismiss', async ({ ack, action, respond }) => {
    await ack();
    await dismissRecommendation(Number(action.value));
    await respond({ text: `✋ Recommendation #${action.value} dismissed by a coordinator at ${orgName}.`, replace_original: false });
  });

  app.action('coordina_view_dashboard', async ({ ack }) => {
    await ack(); // link button — no further action needed server-side
  });

  app.error((error) => {
    log.error(`[${orgId}] Bolt app error:`, error.message);
  });
}
