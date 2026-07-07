// ============================================================
// src/utils/blockKit.js
// Reusable Block Kit builders so Slack handlers stay declarative.
// Every surface (status, summary, recommendations, alerts) uses
// these — one place to keep the visual language consistent.
// ============================================================

const STATUS_EMOJI = {
  open: '🟡',
  matched: '🔵',
  in_progress: '🟠',
  resolved: '🟢',
  merged: '⚪',
};

const CATEGORY_EMOJI = {
  medical: '🏥',
  shelter: '🏠',
  food: '🍲',
  logistics: '🚚',
  other: '📌',
};

const KIND_EMOJI = { need: '🆘', offer: '🤝', urgent: '🚨' };

function priorityPill(score) {
  if (score == null) return '⬜ *Unscored*';
  if (score >= 70) return `🔴 *Critical *`;
  if (score >= 45) return `🟠 *High *`;
  if (score >= 20) return `🟡 *Moderate *`;
  return `🟢 *Low *`;
}

export function incidentCard(incident, org) {
  const emoji = KIND_EMOJI[incident.kind] || '📋';
  const catEmoji = CATEGORY_EMOJI[incident.category] || '📌';
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *#${incident.id} — ${incident.summary}*\n${catEmoji} ${incident.category} · 🏢 ${org?.name || incident.organization_id} · 👥 ${incident.people_affected || 0} affected`,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `${STATUS_EMOJI[incident.status] || '⚪'} ${incident.status}` },
        { type: 'mrkdwn', text: priorityPill(incident.priority_score) },
        { type: 'mrkdwn', text: `🕐 opened ${new Date(incident.created_at).toLocaleString()}` },
      ],
    },
    { type: 'divider' },
  ];
}

export function situationReportBlocks({ incidents, orgById, generatedAt = new Date() }) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Coordina Situation Report', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Generated ${generatedAt.toLocaleString()} · ${incidents.length} active incidents` }],
    },
    { type: 'divider' },
  ];

  if (!incidents.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '✅ No open incidents right now. All coordinated networks report steady state.' },
    });
    return blocks;
  }

  for (const incident of incidents.slice(0, 10)) {
    blocks.push(...incidentCard(incident, orgById?.[incident.organization_id]));
  }

  if (incidents.length > 10) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `…and ${incidents.length - 10} more. Use \`@Coordina status\` to filter, or check the dashboard.` }],
    });
  }

  return blocks;
}

export function recommendationBlocks({ incident, recommendation, org, targetOrg }) {
  const actionLabel = {
    dispatch: '🚀 Dispatch',
    reallocate: '🔁 Reallocate',
    escalate: '📣 Escalate',
    merge: '🔗 Merge duplicate',
    monitor: '👀 Monitor',
  }[recommendation.action] || recommendation.action;

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Recommendation for #${incident.id} — ${incident.summary}*\n${priorityPill(incident.priority_score)}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Action*\n${actionLabel}` },
        { type: 'mrkdwn', text: `*From*\n${org?.name || incident.organization_id}` },
        ...(targetOrg ? [{ type: 'mrkdwn', text: `*Suggested partner*\n${targetOrg.name}` }] : []),
      ],
    },
    ...(recommendation.explanation
      ? [{ type: 'section', text: { type: 'mrkdwn', text: `💡 ${recommendation.explanation}` } }]
      : [{ type: 'context', elements: [{ type: 'mrkdwn', text: '_Explanation unavailable — LLM providers offline. Score-based recommendation shown as-is._' }] }]),
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: recommendation.llm_provider ? `Explained by ${recommendation.llm_provider}` : 'Deterministic scoring only' },
      ],
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: '✅ Acknowledge' }, style: 'primary', action_id: 'coordina_ack', value: String(recommendation.id) },
        { type: 'button', text: { type: 'plain_text', text: '✋ Dismiss' }, action_id: 'coordina_dismiss', value: String(recommendation.id) },
      ],
    },
    { type: 'divider' },
  ];
}

export function escalationBlocks(incident, hoursOpen) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚨 *Escalation: incident #${incident.id} has been open ${Math.round(hoursOpen)}h with no resolution.*\n${incident.summary}`,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: priorityPill(incident.priority_score) }],
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: '👀 View in dashboard' }, url: `${process.env.DASHBOARD_ORIGIN || 'http://localhost:5173'}/incidents/${incident.id}`, action_id: 'coordina_view_dashboard' },
      ],
    },
  ];
}

export function explainBlocks(incident, breakdown) {
  const rows = Object.entries(breakdown?.contributions || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `• *${k}*: ${v} pts`)
    .join('\n');

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🔍 *Score breakdown for #${incident.id}* — total *${incident.priority_score}*` },
    },
    { type: 'section', text: { type: 'mrkdwn', text: rows || '_No breakdown available yet — incident not yet scored._' } },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'Scores are always computed deterministically. The AI only explains them in prose — never generates or overrides the number.' }],
    },
  ];
}
