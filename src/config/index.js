// ============================================================
// src/config/index.js
// Single source of truth for environment configuration.
// Every other module reads config from here — never from
// process.env directly — so tests and future providers only
// need to change one file.
// ============================================================
import 'dotenv/config';

function required(name, fallback = undefined) {
  const val = process.env[name] ?? fallback;
  return val;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  port: Number(process.env.PORT || 4000),
  dashboardOrigin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5173',

  mysql: {
    host: required('MYSQL_HOST', '127.0.0.1'),
    port: Number(required('MYSQL_PORT', 3306)),
    user: required('MYSQL_USER', 'root'),
    password: required('MYSQL_PASSWORD', ''),
    database: required('MYSQL_DATABASE', 'coordina'),
  },

  llm: {
    gemini: {
      apiKey: required('GEMINI_API_KEY', ''),
      model: required('GEMINI_MODEL', 'gemini-1.5-flash'),
    },
    groq: {
      apiKey: required('GROQ_API_KEY', ''),
      model: required('GROQ_MODEL', 'llama-3.1-70b-versatile'),
    },
  },

  rts: {
    providerApiKey: required('RTS_PROVIDER_API_KEY', ''),
  },

  // One entry per connected Slack workspace. Add/remove orgs here
  // and in .env — everything downstream (apps/slackApps.js,
  // demo seeding) reads this array, nothing is hardcoded elsewhere.
  organizations: [
    {
      orgId: required('NGO_ORG_ID', 'ngo_relief_trust'),
      name: 'NGO Relief Trust',
      type: 'ngo',
      botToken: required('NGO_SLACK_BOT_TOKEN', ''),
      appToken: required('NGO_SLACK_APP_TOKEN', ''),
      signingSecret: required('NGO_SLACK_SIGNING_SECRET', ''),
    },
    {
      orgId: required('HOSPITAL_ORG_ID', 'city_general_hospital'),
      name: 'City General Hospital',
      type: 'hospital',
      botToken: required('HOSPITAL_SLACK_BOT_TOKEN', ''),
      appToken: required('HOSPITAL_SLACK_APP_TOKEN', ''),
      signingSecret: required('HOSPITAL_SLACK_SIGNING_SECRET', ''),
    },
    {
      orgId: required('VOLUNTEER_ORG_ID', 'volunteer_corps'),
      name: 'Volunteer Corps',
      type: 'volunteer',
      botToken: required('VOLUNTEER_SLACK_BOT_TOKEN', ''),
      appToken: required('VOLUNTEER_SLACK_APP_TOKEN', ''),
      signingSecret: required('VOLUNTEER_SLACK_SIGNING_SECRET', ''),
    },
    {
      orgId: required('FOODBANK_ORG_ID', 'regional_food_bank'),
      name: 'Regional Food Bank',
      type: 'foodbank',
      botToken: required('FOODBANK_SLACK_BOT_TOKEN', ''),
      appToken: required('FOODBANK_SLACK_APP_TOKEN', ''),
      signingSecret: required('FOODBANK_SLACK_SIGNING_SECRET', ''),
    },
    {
      orgId: required('SANDBOX_ORG_ID', 'coordina_sandbox'),
      name: 'Coordina Sandbox (Judges)',
      type: 'ngo',
      botToken: required('SANDBOX_SLACK_BOT_TOKEN', ''),
      appToken: required('SANDBOX_SLACK_APP_TOKEN', ''),
      signingSecret: required('SANDBOX_SLACK_SIGNING_SECRET', ''),
    },
  ],
};

// Orgs that actually have credentials set — lets the app boot in
// demo/dashboard-only mode even with zero Slack apps configured.
export function configuredOrganizations() {
  return config.organizations.filter((o) => o.botToken && o.appToken);
}
