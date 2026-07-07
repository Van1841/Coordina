# Dashboard Wireframe

No live browser was available to capture real screenshots while building
this, so here is an accurate ASCII wireframe of the actual rendered layout
(`frontend/src/App.jsx`) — every panel named below is a real, working
component in `frontend/src/components/`, not a mockup.

## Full dashboard (desktop, ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🌊 Coordina                              [open][in_progress][resolved][all] [⟳]  │
│  Cross-organization decision intelligence, observed live                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │ Open incidents│ │   Critical    │ │ Organizations │ │ Total tracked │          │
│  │      4      🔵│ │      1      ⚠️│ │      5      🏢│ │      6      📋│          │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘          │
│                                                                                    │
│  ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐│
│  │ INCIDENT FEED           │ │ #1 — Insulin critical   │ │ LIVE ACTIVITY  ● stream││
│  │                         │ │                    🔴78 │ │                        ││
│  │ 🆘 Insulin critical  🔴78│ │ ┌────────────────────┐ │ │┃ New incident #6 logged││
│  │  Hospital · 34 · 7h ago │ │ │ category      ████22│ │ │┃ 2m ago · food         ││
│  │                         │ │ │ inventoryGap  ███ 14│ │ │                        ││
│  │ 🆘 Shelter beds need 🟠52│ │ │ peopleAffected██  11│ │ │┃ Merged into #3        ││
│  │  NGO · 120 · 3h ago     │ │ │ timeWaiting   █    8│ │ │┃ 5m ago · food         ││
│  │                         │ │ │ travelTime    █    5│ │ │                        ││
│  │ 🆘 Water shortage    🟡31│ │ │ volunteerAvail▌    3│ │ │┃ Escalation #1         ││
│  │  Food Bank · 300 · 1h   │ │ └────────────────────┘ │ │┃ 9m ago · medical      ││
│  │                         │ │                         │ │                        ││
│  │ 🤝 Vans offered      🟢12│ │ [✓ Mark resolved]       │ │                        ││
│  │  NGO · 0 · 30m ago      │ │ [✨ Generate recommend.] │ │                        ││
│  └────────────────────────┘ └────────────────────────┘ └────────────────────────┘│
│                                                                                    │
│  ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐│
│  │ CONNECTED ORGANIZATIONS │ │ RESOURCE LEVELS         │ │ RECOMMENDATIONS   ✨   ││
│  │                         │ │                         │ │                        ││
│  │ 🏥 City General Hosp. 2 │ │ insulin        ▓░░░  9% │ │ [reallocate] pending   ││
│  │ 🏠 NGO Relief Trust   2 │ │ blankets       ▓▓░░  9% │ │ #1 → District Relief   ││
│  │ 🏢 Volunteer Corps    0 │ │ drinking_water ▓▓░░ 11% │ │ Hospital inventory at  ││
│  │ 🍲 Regional Food Bank 1 │ │ dry_rations    ▓▓▓▓ 62% │ │ 9% capacity, 34 pts... ││
│  │ 🏛️ District Relief    0 │ │ community_hall ▓▓▓▓ 82% │ │ explained by gemini    ││
│  │                         │ │                         │ │                        ││
│  └────────────────────────┘ └────────────────────────┘ └────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Visual language

- **Background**: near-black (`#0a0b0d`) with two faint radial accent glows,
  fixed — never scrolls with content.
- **Cards**: `.glass` utility — `rgba(21,23,27,0.6)` fill, 1px hairline
  border at 6% white opacity, 16px backdrop blur, rounded `1.25rem` corners.
- **Accent**: `#6c8cff` (a cool blue-violet, distinct from Slack's own purple
  and from generic AI-tool green/orange) — used sparingly for the logo mark,
  active filter pill, and the "Generate recommendation" action.
- **Priority tiers**: critical `#ff5c5c` / high `#ff9f43` / moderate `#f4d35e`
  / low `#5fd88f` — same four colors used consistently across the incident
  feed, detail panel, and resource bars so the eye learns the language once.
- **Motion**: incident cards animate in with a small horizontal slide
  (`framer-motion`, 8px, 0.2s), stat tiles fade up on load with a slight
  stagger, live activity entries collapse/expand height on arrival/removal.
  Nothing loops or auto-plays — motion only ever responds to a state change.

## Responsive behavior (< 1024px)

The three-column grids (`lg:grid-cols-3`) collapse to a single column
(`grid-cols-1`), stacking in this order: stats → incident feed → incident
detail → live activity → organizations → resource levels → recommendations.
The top filter bar and header wrap onto a second line via `flex-wrap` rather
than truncating.
