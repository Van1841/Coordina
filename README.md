# Coordina

**Cross-Organization Decision Intelligence Agent for Slack**
Built for the **Slack Agent Builder Challenge** — *Agent for Good* track.

Coordina watches activity across several Slack workspaces connected via Slack
Connect — an NGO, a hospital, a volunteer organization, a food bank, a
government relief office — and instead of dumping raw information on
coordinators, it recommends what should happen first. A human always makes
the final call. Coordina never performs a life-critical action automatically.

---
## 🔗 Quick Links

🎥 Demo Video: https://youtu.be/6C4yFuIXW_s

🌐 Live Dashboard: https://coordina-psi.vercel.app/

💻 GitHub Repository: https://github.com/Van1841/Coordina


## Table of contents

- [Why this exists](#why-this-exists)
- [What makes this an agent, not a chatbot](#what-makes-this-an-agent-not-a-chatbot)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [The decision engine](#the-decision-engine)
- [MCP](#mcp)
- [Real-Time Search (RTS)](#real-time-search-rts)
- [Local setup](#local-setup)
- [Slack setup](#slack-setup)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Demo mode](#demo-mode)
- [Testing guide](#testing-guide)
- [Future improvements](#future-improvements)

---

## Why this exists

During a real crisis, the bottleneck usually isn't a lack of willing
organizations — it's that each one is heads-down in its own Slack workspace,
with no shared picture of who needs what, who has spare capacity, and what's
actually urgent versus merely loud. Coordina sits across those workspaces and
does the boring-but-critical coordination work continuously, so humans can
spend their attention on decisions instead of information-gathering.

## What makes this an agent, not a chatbot

A chatbot waits to be asked. Coordina runs a continuous
**Observe → Reason → Plan → Recommend → Coordinate → Escalate** cycle on its
own (`src/agents/proactiveLoop.js`), triggered by live events rather than
commands:

| Behavior | Where |
|---|---|
| Observes every message across every connected workspace | `src/apps/registerHandlers.js` |
| Reasons about what a message means (NLP, not just keywords) | `src/llm/classifier.js` |
| Plans deterministically what should happen | `src/scoring/priorityEngine.js`, `src/services/recommendationService.js` |
| Recommends with a human-readable explanation | LLM router, never the score itself |
| Coordinates by DMing the relevant organization directly | `src/agents/proactiveLoop.js` → `postToOrganization` |
| Escalates incidents that have sat too long | periodic sweep in `proactiveLoop.js` |

It also supports **reactive** commands for when a human wants to ask directly:
`@Coordina status`, `@Coordina summary`, `@Coordina explain <id>`,
`@Coordina recommendations`, and free-form natural language questions.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full diagram and a
step-by-step trace of a message becoming a recommendation.

At a glance: one Node process runs a separate `@slack/bolt` App instance (Socket
Mode) per connected organization workspace, all sharing one service layer, one
MySQL database, and one MCP tool registry. An Express + Socket.IO server
exposes a REST API and a live signal stream to a React dashboard.

Although the demo focuses on disaster relief, Coordina's architecture is completely domain-agnostic.

The same coordination engine can be applied to:

- 🚑 Disaster Relief
- 🏥 Healthcare Networks
- 💼 Enterprise IT Operations
- 📞 Customer Support
- 💰 Sales & Customer Success
- 📦 Supply Chain
- 🏛 Government Operations

Nothing about the coordination engine changes.

Only the connected Slack workspaces do.

## Folder structure

```
coordina/
├── package.json                  backend deps + scripts
├── .env.example                  environment template
├── sql/
│   ├── schema.sql                the entire DB schema (4 tables)
│   └── migrate.js                applies schema.sql, supports --fresh
├── src/
│   ├── config/index.js           single source of truth for env config
│   ├── db/                       connection pool + all raw SQL
│   ├── apps/                     per-workspace Bolt app instances + shared handlers
│   ├── services/                 organization / incident / recommendation business logic
│   ├── agents/                   reactive command agent + proactive autonomous loop
│   ├── scoring/priorityEngine.js DETERMINISTIC priority scoring — the core
│   ├── mcp/                      MCP client + 5 mock servers (inventory, shelter,
│   │                             volunteer, logistics, routing)
│   ├── rts/realtimeSearch.js     Real-Time Search abstraction (event bus + search)
│   ├── llm/                      Gemini client, Groq client, automatic failover router,
│   │                             message classifier
│   ├── routes/                   Express API + Socket.IO server
│   ├── utils/                    logger, Block Kit builders
│   ├── demo/seed.js              `npm run demo` data seeding
│   └── index.js                  entrypoint — wires everything together
├── frontend/                     React + Vite + Tailwind + shadcn/ui dashboard
│   └── src/
│       ├── components/
│       │   ├── ui/                shadcn/ui primitives: button.jsx, badge.jsx,
│       │   │                      card.jsx (canonical cva-based variant API,
│       │   │                      re-themed to Coordina's dark/glass tokens)
│       │   ├── Card.jsx           thin convenience wrapper over ui/card for
│       │   │                      the single-slot usage used throughout
│       │   ├── PriorityPill.jsx   built on ui/badge.jsx
│       │   ├── IncidentFeed.jsx, IncidentDetail.jsx, OrgCards.jsx,
│       │   └── ResourceTimeline.jsx, RecommendationPanel.jsx,
│       │       ActivityStream.jsx, StatsBar.jsx
│       └── lib/
│           ├── api.js             REST + Socket.IO client
│           └── utils.js           shadcn/ui's canonical `cn()` class-merge helper
└── docs/
    ├── ARCHITECTURE.md
    ├── DASHBOARD_WIREFRAME.md
    ├── SAMPLE_CONVERSATIONS.md
    └── SAMPLE_BLOCK_KIT_PAYLOADS.md
```

## The decision engine

**Priority scores are never generated by an LLM.** `src/scoring/priorityEngine.js`
computes a deterministic 0–100 score from seven weighted, normalized factors:

| Factor | Weight | Source |
|---|---|---|
| Category severity (medical > shelter > food > logistics > other) | 22 | static table |
| People affected (log-scaled) | 20 | incident record |
| Time waiting | 18 | incident `created_at` |
| Inventory gap | 16 | MCP `inventory.find_shortages` |
| Travel time to nearest responder | 10 | MCP `routing.nearest` |
| Shelter occupancy | 8 | MCP `shelter.get_occupancy` |
| Volunteer availability | 6 | MCP `volunteer.get_availability` |

Only *after* the score and its full breakdown are computed does the pipeline
call Gemini (falling back to Groq) — and only to **explain, rank, and phrase**
the decision in prose. The prompt in `recommendationService.js` explicitly
instructs the model not to invent numbers or confidence percentages, and the
UI/Slack cards always show "deterministic scoring only" when no LLM
explanation is available. If both LLM providers are down, the score and the
recommended action are completely unaffected — only the prose explanation
disappears.

## MCP

Five mock MCP servers live in `src/mcp/servers/`, each with a real `tools`
list and a `call(name, args)` implementation backed by the shared MySQL
`resources`/`organizations` tables:

- **inventory** — stock levels, shortage detection, consumption
- **shelter** — occupancy, availability search, admission
- **volunteer** — availability, dispatch
- **logistics** — transport capacity, load-fit estimation
- **routing** — haversine-based ETA and nearest-responder ranking

`src/mcp/mcpClient.js` is the single chokepoint every other module calls
through (`mcpClient.call('inventory.find_shortages', {...})`). Swapping any
mock server for a real one — e.g. a hospital's actual inventory system
speaking real MCP over stdio/SSE — means replacing that one server file's
export shape; nothing in the agent, scoring engine, or dashboard needs to
change, since they only ever see `(tools, call)`.

## Real-Time Search (RTS)

`src/rts/realtimeSearch.js` is deliberately **not** a polling loop. See the
comment block at the top of that file for the full reasoning; in short:
polling forces a latency-vs-cost tradeoff, gives you rows instead of semantic
matches (so it can't detect "is this the same shortage worded differently"),
and can't surface anything that isn't already in your own database. RTS here
is event-driven (`publish`/`watch`, no interval needed for reaction) and
adds a `search()` operation used specifically for **duplicate/continuation
detection** — this is what lets "We now need 200 blankets" update an existing
incident instead of spawning a new one. A real external RTS/websearch
provider can be plugged in via `RTS_PROVIDER_API_KEY` without changing any
caller.

## Local setup

Requirements: Node.js ≥ 18.17, MySQL ≥ 8.0, a Gemini API key (free tier), a
Groq API key (free tier, fallback only).

```bash
git clone <this-repo>
cd coordina
npm install
cp .env.example .env    # fill in MySQL + Gemini + Groq credentials
npm run migrate          # creates the coordina database + schema
```

## Slack setup

Coordina needs **one Slack app per organization workspace** (NGO, Hospital,
Volunteer Corps, Food Bank — or however many you're demoing with), connected
to each other via [Slack Connect](https://slack.com/help/articles/360003534892-Distribute-your-app-to-other-workspaces-with-Slack-Connect)
channels so they can see each other's shared channels if you want that; the
bots themselves only need to be installed in their *own* workspace.

For each organization:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From scratch.
2. **Socket Mode** → enable it → generate an **App-Level Token** with the
   `connections:write` scope → this is your `xapp-...` token.
3. **OAuth & Permissions** → add Bot Token Scopes:
   - `app_mentions:read`
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `groups:history` (if using private channels)
   - `im:write` (for direct coordination DMs)
4. **Install to Workspace** → copy the **Bot User OAuth Token** (`xoxb-...`).
5. **Basic Information** → copy the **Signing Secret**.
6. **Event Subscriptions** → enable → subscribe to bot events: `message.channels`, `app_mention`.
7. **Interactivity & Shortcuts** → enable (for the Acknowledge/Dismiss buttons — Socket Mode handles delivery, no public URL needed).
8. Invite the bot to the relevant channel(s) in that workspace: `/invite @Coordina`.

Repeat for each org, then fill the four token/secret/org-id blocks in `.env`
(see `.env.example` — one block per org, already labeled).

You do **not** need all four orgs configured to run the app — orgs without
credentials are simply skipped (`configuredOrganizations()` in
`src/config/index.js`), and the dashboard + demo mode work with zero Slack
apps connected at all.

## Environment variables

All variables are documented inline in [`.env.example`](.env.example),
grouped by MySQL, Gemini, Groq, dashboard, per-organization Slack credentials,
and RTS. Copy it to `.env` and fill in real values — never commit `.env`.

## Running locally

```bash
# Terminal 1 — backend (Slack apps + API + proactive loop)
npm start

# Terminal 2 — dashboard
npm run dashboard
# opens on http://localhost:5173, talking to the API on http://localhost:4000
```

`npm run dev` runs the backend with `node --watch` for iteration.

## Demo mode

```bash
npm run demo
```

This runs `sql/migrate.js --fresh` (drops and recreates the schema) followed
by `src/demo/seed.js`, which seeds:

- 5 organizations (NGO, Hospital, Volunteer Corps, Food Bank, District Relief Office) with real Indore-area coordinates for realistic routing/ETA math
- Inventory, shelter, volunteer, and logistics resources across those orgs
- 6 incidents spanning medical/shelter/food/logistics, backdated by realistic hours-open values so escalation and time-based scoring have something to show
- A worked example of the merge-on-restated-need behavior (see incident #3/#6 in the seed data)
- Every incident pre-scored through the real deterministic engine

After seeding, start the backend and dashboard as above — everything is
populated immediately, no manual data entry needed before recording.

## Deployment guide

This project is built to run comfortably on free/low-cost tiers for a
hackathon demo. A reasonable production-lean path:

**Backend (`src/`)**
- Deploy as a long-running Node process — Socket Mode means **no public HTTPS
  endpoint or Slack Request URL is required** for the Bolt apps themselves,
  which simplifies hosting considerably (no webhook signature verification,
  no inbound firewall rules). Suitable targets: Railway, Render (background
  worker), Fly.io, or a small always-on VM.
- Set every variable from `.env.example` in the host's environment/secrets
  manager — never bake `.env` into the image.
- Run `npm run migrate` once against the production MySQL instance as part of
  your release step, before starting the app.
- The Express/Socket.IO API (`src/routes/server.js`) does need to be
  reachable by the dashboard's origin — expose `PORT` behind HTTPS (most
  PaaS providers handle TLS termination automatically) and set
  `DASHBOARD_ORIGIN` to the deployed dashboard's real URL (CORS is locked to
  this one origin by design).

**Database**
- Any managed MySQL 8+ works (PlanetScale, Railway MySQL, RDS, Aiven). No
  MySQL-specific features are used beyond `ON DUPLICATE KEY UPDATE` and
  `JSON` columns — see the portability note in `src/db/pool.js` for what a
  Postgres swap would involve.

**Frontend (`frontend/`)**
- `npm run build` inside `frontend/` produces a static `dist/` — deploy it
  anywhere static (Vercel, Netlify, Cloudflare Pages, or served directly by
  the backend's Express app via `express.static` if you'd rather run one
  process).
- Set `VITE_API_BASE` at build time to the deployed backend's public URL.

**Slack apps**
- Socket Mode connections are outbound from your server to Slack, so nothing
  else is required on Slack's side beyond the tokens already configured —
  no ngrok, no public URL, even in production.

**Secrets**
- Rotate the Gemini/Groq keys and all Slack tokens before/after a public demo
  if the repository or `.env` was ever shared — they're bearer credentials.

## Testing guide

There's no separate test framework dependency (kept the footprint small for
judging), but every core module is designed to be exercised directly:

```bash
# Sanity-check every backend file parses
find src sql -name "*.js" -exec node --check {} \;

# Exercise the deterministic scoring engine directly, no DB needed
node -e "
import('./src/scoring/priorityEngine.js').then(async (m) => {
  const incident = { id: 1, category: 'medical', people_affected: 34,
    created_at: new Date(Date.now() - 7.5*3600*1000), organization_id: 'hospital' };
  const ctx = { shortages: [{ organization_id: 'hospital', quantity: 18, capacity: 200 }],
    candidateOrgIds: [], shelters: [], volunteers: [{ quantity: 4 }] };
  console.log(await m.scoreIncident(incident, ctx));
});
"

# Exercise Block Kit builders directly, no Slack connection needed
node -e "
import('./src/utils/blockKit.js').then(bk => {
  console.log(JSON.stringify(bk.situationReportBlocks({ incidents: [], orgById: {} }), null, 2));
});
"

# Full end-to-end: run npm run demo, then hit the API directly
curl http://localhost:4000/api/health
curl http://localhost:4000/api/incidents
curl http://localhost:4000/api/stats
```

To test Slack behavior live, send a message like *"We are running out of
insulin urgently, 34 patients affected"* in a channel the bot is in, then try
`@Coordina status`, `@Coordina explain 1`, and `@Coordina recommendations`.

## Future improvements

- Replace the in-memory RTS index with a real vector/embedding-based
  similarity search for more robust duplicate detection at scale.
- Swap mock MCP servers for real integrations (hospital EHR/inventory
  systems, municipal shelter management systems, a real routing/maps API).
- Add role-based acknowledgement (only a coordinator role can dismiss a
  critical recommendation).
- Persist RTS's index to MySQL so it survives restarts (currently in-memory,
  bounded to the last 2000 signals — a deliberate hackathon-scope tradeoff).
- Multi-language classification for regions where relief messages aren't in
  English.
- Push notifications / SMS fallback for organizations without reliable Slack
  access during a crisis.

---

Built with `@slack/bolt`, Express, MySQL, React, Tailwind, and — deliberately
minimally — Gemini and Groq for the parts that genuinely need language
understanding, and nothing else.
