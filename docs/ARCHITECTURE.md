# Coordina — Architecture Diagram

## System overview

```
                         ┌──────────────────────────────────────────────────────┐
                         │                     SLACK CONNECT                     │
                         │   NGO  ⇄  Hospital  ⇄  Volunteer Corps  ⇄  Food Bank  │
                         └───────┬───────────┬───────────┬───────────┬──────────┘
                                 │ Socket Mode│           │           │
                          ┌──────▼─────┐┌─────▼─────┐┌────▼──────┐┌───▼───────┐
                          │ Bolt App:  ││ Bolt App: ││ Bolt App: ││ Bolt App: │
                          │   NGO      ││ Hospital  ││ Volunteer ││ Food Bank │
                          └──────┬─────┘└─────┬─────┘└────┬──────┘└───┬───────┘
                                 │             │            │           │
                                 └─────────────┴─────┬──────┴───────────┘
                                                      │  (same handler logic,
                                                      │   parameterized by orgId)
                                          ┌───────────▼────────────┐
                                          │  registerHandlers.js   │
                                          │  message / mention /   │
                                          │  block-action events   │
                                          └───────────┬────────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────────────────────┐
                    │                                   │                                  │
          ┌─────────▼─────────┐              ┌──────────▼──────────┐            ┌──────────▼─────────┐
          │  incidentService   │              │   coordinaAgent      │            │  proactiveLoop      │
          │  (ingest, dedup,   │◄────────────►│  (reactive commands, │◄──────────►│  (observe→reason→   │
          │   merge, score)    │   RTS event   │   NL Q&A)            │   RTS event │  plan→recommend→    │
          └─────────┬──────────┘   bus         └──────────┬──────────┘   bus       │  coordinate→escalate)│
                    │                                      │                        └──────────┬──────────┘
                    │                                      │                                   │
       ┌────────────▼────────────┐           ┌─────────────▼────────────┐         ┌────────────▼────────────┐
       │  llm/classifier.js       │           │ recommendationService.js  │         │   rts/realtimeSearch.js  │
       │  (Gemini→Groq NLP,       │           │ (deterministic action +   │         │   event bus + semantic   │
       │   keyword fallback)      │           │  LLM explanation only)    │         │   dedup search           │
       └────────────┬──────────────┘         └─────────────┬──────────────┘        └──────────────────────────┘
                     │                                       │
                     │                          ┌────────────▼─────────────┐
                     │                          │ scoring/priorityEngine.js │
                     │                          │  DETERMINISTIC SCORE      │
                     │                          │  (never LLM-generated)    │
                     │                          └────────────┬──────────────┘
                     │                                       │
                     └───────────────┬───────────────────────┘
                                      │
                          ┌───────────▼────────────┐
                          │     mcp/mcpClient.js     │
                          │  unified tool registry    │
                          └───────────┬────────────┘
             ┌───────────┬────────────┼────────────┬────────────┐
      ┌──────▼─────┐┌────▼─────┐┌─────▼──────┐┌─────▼──────┐┌────▼──────┐
      │ inventory  ││ shelter  ││ volunteer  ││ logistics  ││ routing   │
      │  server    ││  server  ││  server    ││  server    ││  server   │
      └──────┬─────┘└────┬─────┘└─────┬──────┘└─────┬──────┘└────┬──────┘
             └───────────┴─────────────┴─────────────┴────────────┘
                                      │
                            ┌─────────▼─────────┐
                            │   MySQL (shared)   │
                            │ organizations       │
                            │ resources           │
                            │ incidents           │
                            │ recommendations     │
                            └─────────┬───────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │  routes/server.js          │
                         │  Express API + Socket.IO   │
                         └────────────┬─────────────┘
                                      │  REST + live signal stream
                            ┌─────────▼─────────┐
                            │  React Dashboard    │
                            │  (Vite + Tailwind,  │
                            │   observer view)    │
                            └─────────────────────┘
```

## Data flow: a message becomes a recommendation

1. **Observe** — a Slack message lands in any connected workspace. `registerHandlers.js` receives it and hands it to `incidentService.ingestMessage`.
2. **Understand** — `llm/classifier.js` asks Gemini (falling back to Groq, falling back to keyword heuristics) to classify the message into `{kind, category, peopleAffected, summary}`.
3. **Deduplicate** — `rts.search()` checks the live semantic index for a similar open incident. A strong match updates the existing incident (e.g. "we now need 200 blankets" restates rather than duplicates); otherwise a new incident row is created.
4. **Score (deterministic)** — `scoring/priorityEngine.js` pulls live data from every MCP server (inventory shortages, shelter occupancy, volunteer availability, travel time) and computes a weighted 0–100 score. This step never calls an LLM.
5. **Publish** — the incident emits an RTS signal. `agents/proactiveLoop.js`, subscribed to the event bus, picks it up immediately (no polling).
6. **Plan** — `recommendationService.decideAction` deterministically picks an action (`dispatch` / `reallocate` / `escalate` / `monitor`) using MCP data, then asks the LLM router only to explain that decision in prose.
7. **Coordinate** — if the action targets another organization, Coordina DMs that workspace directly via its own Bolt app instance — proactively, without a human asking.
8. **Escalate** — a periodic sweep checks for incidents open past the escalation threshold and posts an escalation card, buttons and all, back into the originating workspace.
9. **Observe (dashboard)** — every step above also emits into the same RTS event bus, which the Express/Socket.IO server rebroadcasts to the React dashboard's live activity stream — the exact same event-driven mechanism, reused for humans watching rather than the agent itself.
