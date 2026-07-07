# Sample Slack Conversations

These are representative message flows Coordina handles, shown as they'd
appear in Slack. Use these as a script when recording a demo video, or to
sanity-check behavior after `npm run demo`.

---

## 1. Urgent need → proactive cross-org coordination

**#general (City General Hospital workspace)**

> **@dr.mehra**: We are running out of insulin urgently, only a few vials left for 34 registered diabetic patients

*(No human called Coordina — it reacts to the raw message.)*

**Coordina (thread reply, posted automatically ~2s later):**

> 🔗 New incident #1 logged — `medical / urgent`, priority score computed.

**Coordina (proactive DM into Regional Food Bank workspace, since it holds spare capacity nearby — illustrative; in this scenario it would target whichever org's MCP data shows available medical stock):**

> 📨 **Incoming coordination request from City General Hospital**
> Insulin stock critically low, running out within hours
> Suggested action: **reallocate** — Hospital inventory for insulin is at 9% of capacity with 34 patients affected and no nearby MCP-reported surplus; recommend escalating to district relief office for emergency procurement given the criticality of the shortage.

---

## 2. Restated need → automatic merge, not a duplicate

**#general (Regional Food Bank workspace)**

> **@ops.food_bank**: Food stocks almost finished, especially drinking water crates, serving around 300 people daily

Coordina creates incident #3 (`food`, 300 people affected).

Two hours later:

> **@ops.food_bank**: We now need 200 dry ration kits, more families arrived than expected this morning

**Coordina (thread reply):**

> 🔗 Linked to existing incident #3 — updated to 300 people affected.

No duplicate incident is created — RTS semantic search matched the second message to the first at a relevance above threshold, and `incidentService` folded it in.

---

## 3. Reactive command: `@Coordina status`

**#coordination (any connected workspace)**

> **@coordinator**: @Coordina status

**Coordina:**

> 📊 **Coordina Situation Report**
> Generated Jul 4, 2026, 9:14 AM · 4 active incidents
>
> 🆘 **#1 — Insulin stock critically low, running out within hours**
> 🏥 medical · 🏢 City General Hospital · 👥 34 affected
> 🟡 open · 🔴 Critical · 78 · 🕐 opened 7h ago
>
> 🆘 **#2 — Flood-displaced families need shelter beds tonight**
> 🏠 shelter · 🏢 NGO Relief Trust · 👥 120 affected
> 🟡 open · 🟠 High · 52 · 🕐 opened 3h ago
>
> _(…and 2 more)_

---

## 4. Reactive command: `@Coordina explain #1`

> **@coordinator**: @Coordina explain 1

**Coordina:**

> 🔍 **Score breakdown for #1** — total *78.4*
> • category: 22 pts
> • inventoryGap: 14.6 pts
> • peopleAffected: 11.4 pts
> • timeWaiting: 8.1 pts
> • travelTime: 5 pts
> • volunteerAvailability: 3.3 pts
>
> _Scores are always computed deterministically. The AI only explains them in prose — never generates or overrides the number._

---

## 5. Natural-language Q&A

> **@coordinator**: @Coordina which organization needs help the most right now and why?

**Coordina:**

> Based on current open incidents, City General Hospital's insulin shortage (#1) is the most urgent — it has the highest priority score at 78, driven by a critical inventory gap (9% of capacity remaining) affecting 34 patients, and it's been open over 7 hours without resolution. The flood shelter situation at NGO Relief Trust (#2) is the next highest priority at 52.

---

## 6. Escalation (proactive, no human trigger)

*(Six hours after an incident remains `open`)*

**Coordina (posted automatically into the originating workspace):**

> 🚨 **Escalation: incident #1 has been open 6h with no resolution.**
> Insulin stock critically low, running out within hours
>
> 🔴 Critical · 78
>
> [👀 View in dashboard]
