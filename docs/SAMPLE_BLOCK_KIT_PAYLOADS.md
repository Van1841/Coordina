# Sample Block Kit Payloads

Actual JSON emitted by `src/utils/blockKit.js`, useful for testing in Slack's
[Block Kit Builder](https://app.slack.com/block-kit-builder) without running the
full app.

## Situation report (`situationReportBlocks`)

```json
[
  {
    "type": "header",
    "text": { "type": "plain_text", "text": "📊 Coordina Situation Report", "emoji": true }
  },
  {
    "type": "context",
    "elements": [
      { "type": "mrkdwn", "text": "Generated 7/4/2026, 9:14:00 AM · 2 active incidents" }
    ]
  },
  { "type": "divider" },
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "🆘 *#1 — Insulin stock critically low, running out within hours*\n🏥 medical · 🏢 City General Hospital · 👥 34 affected"
    }
  },
  {
    "type": "context",
    "elements": [
      { "type": "mrkdwn", "text": "🟡 open" },
      { "type": "mrkdwn", "text": "🔴 *Critical · 78*" },
      { "type": "mrkdwn", "text": "🕐 opened 7/4/2026, 2:14:00 AM" }
    ]
  },
  { "type": "divider" }
]
```

## Recommendation card with action buttons (`recommendationBlocks`)

```json
[
  {
    "type": "section",
    "text": { "type": "mrkdwn", "text": "*Recommendation for #1 — Insulin stock critically low*\n🔴 *Critical · 78*" }
  },
  {
    "type": "section",
    "fields": [
      { "type": "mrkdwn", "text": "*Action*\n🔁 Reallocate" },
      { "type": "mrkdwn", "text": "*From*\nCity General Hospital" },
      { "type": "mrkdwn", "text": "*Suggested partner*\nDistrict Relief Office" }
    ]
  },
  {
    "type": "section",
    "text": { "type": "mrkdwn", "text": "💡 Hospital inventory for insulin is at 9% of capacity with 34 patients affected; recommend escalating to district relief office for emergency procurement." }
  },
  {
    "type": "context",
    "elements": [{ "type": "mrkdwn", "text": "Explained by gemini" }]
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": { "type": "plain_text", "text": "✅ Acknowledge" },
        "style": "primary",
        "action_id": "coordina_ack",
        "value": "12"
      },
      {
        "type": "button",
        "text": { "type": "plain_text", "text": "✋ Dismiss" },
        "action_id": "coordina_dismiss",
        "value": "12"
      }
    ]
  },
  { "type": "divider" }
]
```

## Escalation alert (`escalationBlocks`)

```json
[
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "🚨 *Escalation: incident #1 has been open 6h with no resolution.*\nInsulin stock critically low, running out within hours"
    }
  },
  {
    "type": "context",
    "elements": [{ "type": "mrkdwn", "text": "🔴 *Critical · 78*" }]
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": { "type": "plain_text", "text": "👀 View in dashboard" },
        "url": "http://localhost:5173/incidents/1",
        "action_id": "coordina_view_dashboard"
      }
    ]
  }
]
```

## Score explanation (`explainBlocks`)

```json
[
  {
    "type": "section",
    "text": { "type": "mrkdwn", "text": "🔍 *Score breakdown for #1* — total *78.4*" }
  },
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "• *category*: 22 pts\n• *inventoryGap*: 14.6 pts\n• *peopleAffected*: 11.4 pts\n• *timeWaiting*: 8.1 pts\n• *travelTime*: 5 pts\n• *volunteerAvailability*: 3.3 pts"
    }
  },
  {
    "type": "context",
    "elements": [
      { "type": "mrkdwn", "text": "Scores are always computed deterministically. The AI only explains them in prose — never generates or overrides the number." }
    ]
  }
]
```
