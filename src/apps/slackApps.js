// ============================================================
// src/apps/slackApps.js
// Creates one Bolt App (Socket Mode) per configured organization
// workspace. All instances share the same handler logic —
// registerHandlers.js — parameterized by orgId, so behaviour is
// identical across NGO / Hospital / Volunteer / Food Bank
// workspaces connected via Slack Connect.
// ============================================================
import pkg from '@slack/bolt';
const { App } = pkg;
import { configuredOrganizations } from '../config/index.js';
import { registerHandlers } from './registerHandlers.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('slack-apps');

/**
 * @returns {Map<string, { app: App, orgId: string, orgName: string }>}
 */
export async function initializeSlackApps() {
  const orgs = configuredOrganizations();
  const instances = new Map();

  if (!orgs.length) {
    log.warn('No Slack organizations have credentials configured — running in dashboard-only mode. Set tokens in .env to enable Slack.');
    return instances;
  }

  for (const org of orgs) {
    const app = new App({
      token: org.botToken,
      appToken: org.appToken,
      signingSecret: org.signingSecret,
      socketMode: true,
    });

    registerHandlers(app, { orgId: org.orgId, orgName: org.name });
    instances.set(org.orgId, { app, orgId: org.orgId, orgName: org.name });
    log.info(`configured Slack app for ${org.name} (${org.orgId})`);
  }

  await Promise.all([...instances.values()].map(({ app, orgName }) =>
    app.start().then(() => log.info(`⚡️ Slack app started: ${orgName}`))
  ));

  return instances;
}

/** Send a message (text or Block Kit) into an org's default channel or DM. */
export async function postToOrganization(instances, orgId, { channel, text, blocks }) {
  const instance = instances.get(orgId);
  if (!instance) {
    log.warn(`postToOrganization: no Slack app configured for org '${orgId}', skipping.`);
    return null;
  }
  const targetChannel = channel || process.env[`${orgId.toUpperCase()}_DEFAULT_CHANNEL`] || 'general';
  try {
    return await instance.app.client.chat.postMessage({ channel: targetChannel, text: text || 'Coordina update', blocks });
  } catch (err) {
    log.warn(`failed to post to ${orgId}#${targetChannel}:`, err.message);
    return null;
  }
}
