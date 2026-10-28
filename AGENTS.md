<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Responsive work

Before touching any layout, read `docs/responsive/01-CONTEXT.md` — it carries the
standard, the breakpoint situation, and the six known root causes. Hold
`docs/responsive/03-DEFINITION-OF-DONE.md` as the bar for any view you change.
`docs/responsive/02-VIEW-MATRIX.md` is the view inventory;
`docs/responsive/TRACKER.md` is the live status once it exists. Generated audit
artifacts go in `docs/responsive/`.

All three source docs live in `docs/responsive/` alongside the generated
artifacts, so a phase file citing `docs/responsive/01-CONTEXT.md` resolves
directly — there is no path mapping to apply.

The audit in `01-CONTEXT.md` was taken against `main` @ `08c91d1`. Line citations
drift as the code moves; verify one before acting on it, and correct the doc when
it has moved rather than working from the stale number.

## Surface architecture decisions

**The addendum (`supervisor-ia-restructure` + §1–§3.6) supersedes parts of what
follows, and every superseded section says so in place rather than being
deleted** — the reasoning is what makes a removal safe, and a decision with no
recorded argument is one the next person re-litigates from scratch.

Settled, with the reasoning, so they are not re-litigated by the next person who
finds them odd. Each records what was evaluated and what it cost to choose.

### The surface is called Care Reviews — the addendum settled it

The two sections below argued that the surface should be called **Tasks**, and
they are kept because their reasoning is still the reasoning — it just lost its
subject. `/app/tasks` is a retired hop; the destination is **Care Reviews**, and
it holds care reviews alone.

What the argument was FOR is the part that survives: a name must hold across
every role the PRD rolls out to, and naming one structural surface differently
per role trades an imprecision for a coherence failure. That test is what a
future rename has to pass.

### The surface was called Tasks — the original argument

Evaluated against **Reviews**, **Approvals**, **Worklist** and **To-dos**.

Tasks is the only candidate that holds across all three roles in the PRD's
roll-out: supervisor billing reviews, lead-mentor profile and simulator reviews,
and mentor call notes. "Reviews" and "Approvals" are more precise for supervisors
*today* and break on mentors — a call note is not a review and nobody approves it.

Naming the same structural surface differently per role would trade one
imprecision for a coherence failure: a mentor and their supervisor would be
talking about the same page under two names, and every cross-role instruction
would have to carry both.

"Approvals" additionally collides with the Care page's existing `Approve`
control, which acts on a single change request rather than on a queue.

The cost, stated: on a supervisor's screen today, Tasks holds only billing
reviews, so the name is broader than the contents. That is deliberate — the
contents are what will widen.

### It was still called Tasks at arch-E — and the row fix outlived the name

The earlier awkwardness was never the label. **Rows described people while the
label promised work**: the group header said the task type, so the row said only
a name and a deadline. With rows leading with the job and the list grouped by
when work is due, the surface read as a task list.

Of that, the ROW anatomy survives and the grouping does not — see the deadline
section below. The row leads with the teen (arch-F), states its code as
lozenges (§2.9), and carries one temporal fact, which is now its age.

Alternatives stay rejected for the reasons above — chiefly that only "Tasks"
holds across all three roles in the PRD roll-out.

### When chrome returns — the extensibility threshold

Written down because the failure mode runs both ways: chrome added before it is
needed, and chrome forgotten when it is.

| Change | What the surface grows |
|---|---|
| A new task type | **Nothing structural.** The list is flat and holds any mix. (It read "time buckets hold any mix" — the buckets are gone; the flat list holds any mix for the same reason.) |
| More than one task type present | **A filter chip row** above the list (`All · Billing · …`), defaulting to All. |
| A single task type | **No chip row**, and never a tab row. |

**This threshold is live and unmet.** Care Reviews holds one task type, so
there is no chip row — and §2.1 applied the same rule one surface along, taking
the subject filter off Risk Flags when Mentor Practice left it with one value.

**arch-D said "a second domain brings the tab row back". arch-E replaced that.**
The old rule came from the four-domain architecture, where a tab was a DOMAIN
with its own success model — escalations measured by response time, billing by
completion, flags by coverage — so switching tabs changed what "done" meant.
Tasks has one success model now and will have many task types. Tabs would claim
separate surfaces where there is one; chips say "narrow this list", which is both
what a reader wants and a far lighter promise.

A single filter offering no choice is dead chrome, which is the same reasoning
that removed the one-tab row in arch-A — and that reclaimed 150px above the list
(measured at 1280×900: the worklist scroller moved from y=270 to y=120).

The chip row is **built and hidden**: it renders only when more than one task
type is present, so the affordance exists before the second type lands.

### Care Reviews groups by nothing — the deadline is gone (addendum §2.9)

**This replaces "Tasks groups by when, Monitoring groups by tier". Both halves
are superseded, by different instructions, and the reasoning that produced them
is worth keeping because it is what makes the removals safe rather than casual.**

The old section recorded a real defect and a real fix. Tasks' *type* groups
(`Intake` / `Monthly re-review`) did two things wrong at once: they took the
verb off the row, and they **destroyed deadline order across buckets** —
measured, the list ran 15h → 2d and then RESTARTED at 20h → 2d, so finding what
was about to breach meant merging N sorted lists by eye. Deadline buckets
(`Overdue` / `Due today` / `Due tomorrow` / `Later`) fixed it by being a
PARTITION of the one sorted list rather than a re-sort.

**§1 retires `CARE_REVIEW_SLA` and §2.9 removes the deadline concept from the
destination.** So there is no deadline to bucket by, and with one task type
there is nothing else to group by either. The list is flat, in the comparator's
order.

**Oldest-first is not a rule anybody wrote.** With `TASK_SLA_MS` null for both
billing types, `compareTasks` falls through breach (never true), the urgency
ladder (flat within a domain) and `slaRemaining` (Infinity on both sides) to
`openedAt` ascending. Removing the deadline produced the ordering §2.9 asks
for; `sla.ts` says so at the table.

**The claim the buckets protected survives and is checked** — the list is one
sorted sequence with nothing restarting inside it (`e.one-sorted-sequence` in
`row-semantics`).

**Monitoring's half is gone too, and earlier.** arch-mon replaced the tier bands
with the two review subjects; §2.1 removed Mentor Practice, leaving one subject
whose header restated the page title over every row — while counting flags on a
list whose rows are conversations (§3.1). Neither surface has a group header.

`WorklistGroupHeader` is **not deleted**: it is still the one treatment, which
is what makes a second grouping cheap the day one is justified. The
extensibility threshold below says when.

### A row on Risk Flags is a conversation (addendum §3.1)

Not a flag. The list rendered one row per flag while each row read "3 in this
conversation" — un-coalesced and announcing that it was coalesced. Measured on
`flag-repeat-pattern`: nine rows, three of them the same Marcus L. conversation.

`compareGroups` is `compareEvents`' five steps read off a set, in the same
order, with a total tie-break. Three of the five need a rule for WHICH member
answers, and each is a place the queue could stop being ordered while still
looking sorted:

| Step | Member |
|---|---|
| escalation open | any — it is a fact about the teen, so all agree |
| category rank | the **highest-ranking**, or four routine flags bury one self-harm flag |
| repeat pattern | structural — the row **is** the set |
| no mentor reply | any — one courtesy reply must not clear the signal |
| age | the **oldest**, or a busy conversation sinks below a quiet one |

All four derived keys were mutation-tested in `flag-group.test.ts`. **The list,
`flag-group.ts` and its test were deleted in Escalation Exchange v2** — the Risk
Flags dashboard had been unreachable since flags rolled up to Monitoring's teen
row. The table stays as the rule any future flag list has to meet.

### Rows: emphasis follows obligation

Tasks and Monitoring have opposite units of work — on Tasks the unit is the
review and the person is its subject; on Monitoring the unit is the person and
flags are evidence. arch-D made the emphasis say so. The derivation lives in
`src/lib/tasks/row-emphasis.ts` and is keyed on whether the tier coalesces by
teen, so a new tier inherits the right emphasis without a per-surface decision.

**Weight is not an available channel for body text.** Measured: Lausanne renders
identically at 400, 500, 600 and 700 (only the 400 face ships), so every
`font-semibold` on a row is a declaration with no rendering behind it. What does
work, measured by ink density: **Avantt** (`font-display`, Bold-only, +19% ink
over Lausanne 400) and the **mono stack at 700** (+41% over its own 400). Those
are the two emphasis channels.

**arch-F refined the rule to one per ZONE.** A Tasks row has two scan zones —
identity on the left, deadline on the right — and one focal point each: the teen
name in Avantt, the deadline in mono. That is not drift from the per-row rule; it
is the same prohibition applied at the scale the row actually has, and what both
versions forbid is two focal points competing *inside one zone*. arch-E's own
mistake is the reason the rule moved: it emphasised the task NAME, which is
identical on every row while one task type exists, so the strongest element on
nineteen rows carried no information. Emphasis follows what varies.

**arch-E changed which one Tasks spends.** arch-D gave Tasks the mono-bold
countdown and Monitoring the Avantt name, one channel each. With rows leading
with the job, Tasks' emphasis is the job in Avantt — so the countdown gave up
its bold and kept everything else: 14px, primary ink, mono, tabular,
right-aligned. Both surfaces now emphasise in Avantt, which is fine because they
are never on screen together; what matters is the rule that survived both
phases — **one emphasised element per row**. The countdown and the job were
briefly both bold and the row had two places for the eye to land; the probe
counts the emphasised elements per row for exactly that reason. A column of
figures is scannable without winning the weight channel.

### Monitoring is a group label AND a destination (proto/monitoring-merge)

**This supersedes parts of "Monitoring asserts only what it can compute" below,
and that section is kept, because its reasoning is what makes the reversal
legible.** Answered 2026-10-19:

- **Monitoring is both.** The group label stays "Monitoring"; under it, the
  Monitoring page at `/app/monitoring` is a destination again, beside Chats.
- **Escalations and Risk Flags fold into it.** Their dashboards go, the events do
  not: each keeps its data model, notifications, teen-timeline records and badge
  semantics. Escalations surface as the Tier 1 lane and the escalations column;
  flags roll up to the teen row. `/app/escalations` and `/app/risk-flags` hop to
  `/app/monitoring`, carrying `?escalation=` / `?flag=` (the page does not open
  a record yet — `TODO(monitoring)`). The two nav items are removed; this was
  the one case where removing nav items was asked.
- **Tiers are a published model.** The stepped-care tiers come from the
  stepped-care proposal and the Oct escalation flow, and their review cadences
  from those documents — not invented. That answers arch-mon's objection, which
  was that nothing PUBLISHED stated a severity or a deadline. The strings live in
  `lib/monitoring/tiers.ts` (pending the tiering doc's own text), and the exit
  rule is the flow's: Tier 1 and Tier 2 step down to Tier 3. **SUPERSEDED by
  "Tiering & Escalation" below** (2026-10-20): the strings moved to
  `lib/tiering/tiers.ts`, Tier 3 is "Medium risk", and Tier 1 exits to Tier 2
  — to Tier 3 only on a "no longer a threat" crisis note. **SUPERSEDED again
  by Escalation Exchange v2:** closing an escalation moves the teen to
  `CLOSE_OUT_TIER` (Tier 3).
- **Chats stays a separate job.** Monitoring is the global view for actions that
  need taking; Chats is the one-conversation experience. Monitoring points into
  Chats; it does not replace it. **Narrowed by pack v3.0:** for the supervisor
  tier, Monitoring is now the ONLY way into a conversation — Chats left their
  nav, and every Monitoring entry links to its thread.

### Tiering & Escalation (pack v1.0, feat/tiering-escalation)

Answered 2026-10-20. **This supersedes the chat's temporary "Now" tab, the
FCP-2 tier names, and parts of the Monitoring section above, each in place.**

- **One canon, one file.** `lib/tiering/tiers.ts`: Active crisis · High risk ·
  Medium risk · General. "Monitoring" as a tier name collides with the
  supervisor surface and is forbidden; so is FCP-2's "Clinical resources" (the
  tab is **Care**). Tier names, dwell periods and exit documents are BLOCKED
  CONSTANTS — clinical policy, Meg / Dr. Nissan.
- **A tier is the last placement in an append-only log** (`lib/tiering/events.ts`).
  Mentor and system FLAG (`requested`, `step-down-requested` → a "Requested:
  Tier N" chip); only a supervisor SETS (`placed`, `confirmed`,
  `stepped-down`), and `declined` clears a request. The gate is enforced in
  the store's write (`appendable`), not by the UI — a mentor never steps a
  teen down directly, and the reasoning is on `canSetTier`.
- **Movement is asymmetric.** Up anywhere in one tap; down one step on the
  tier's exit document; Tier 1 exits only via the crisis note (the Resolve
  dialog), to Tier 2 — or Tier 3 on "no longer a threat" — never to Tier 4.
  **SUPERSEDED by v2:** the Resolve dialog is deleted; the supervisor's S4
  close is the exit, and it lands on Tier 3.
- **One store, two views (answered: "unify the data").** `useTiering` is the
  only read/write path; fixtures (`lib/tiering/seed.ts`) and session writes
  merge at read time. The chat, the user record and Monitoring's roster all
  read it, and every roster teen with a name is a record teen. Jordan's crisis
  is one fixture raised by either dev axis. The C-SSRS answers stream into the
  same escalation record the supervisor's view renders.
- **Care replaces Now.** Persistent, fixed after Context, for every teen; an
  escalation changes its STATE (and adds a dot), not its existence. **Refined
  by v3.0:** five top tabs (Overview · Safety plan · Emergency info ·
  Resources · History), and an escalation takes over Overview only. Raising
  from any of the three doors opens one flow in it — pick a tier, say what is
  happening, confirm — and Confirm opens the escalation at once (the tier is
  the part that waits for a supervisor).
- **Red only in Tier 1–2 contexts and the 911 call.** The banner, the Care dot
  and Emergency information are red for Tier 1–2 escalations and neutral for
  Tier 3 and Platform safety. Tier is never colour alone. **One named
  exception:** the two "Raise an escalation" entry points (conversation menu,
  message menu) stay alert-red although no tier is chosen yet — neutralised
  once, reversed on instruction (2026-10-21): a mentor reaching for it in a
  hurry is looking for the red one.
- **Platform safety is a category, not a tier.** It routes to review and writes
  no tier event. **SUPERSEDED IN PART by v3.0 (Supersession 3):** it is out of
  the tier picker too — a quiet "Report a platform concern" link below Tiers
  1–3 opens its own flow; the record keeps it as `requested: "platform"`.
- **C-SSRS question text is a placeholder** until the verbatim Columbia wording
  is supplied — and it says so on screen. No paraphrase, ever. **SUPERSEDED by
  v2:** the pack supplied the wording; `ASSESSMENT_QUESTIONS` carries it
  verbatim and the placeholder notice is gone. "No paraphrase" still holds.
- **No tiering page, no tier nav item, no tier dashboard, no flags inbox.**
  Message-level flagging is a separate content-moderation flow (answered).

### Escalation Exchange (pack v2.0, feat/escalation-exchange)

Answered 2026-10-21. **This supersedes pack v1 Phases 2–3 — the checklist, the
mentor safety check, the mentor Resolve dialog — each marked in place above.**

- **Care's active state is a staged, turn-based exchange**
  (`components/chat/escalation/exchange.tsx`). Mentor lens M2 assess → M3 stay
  → M4 wrap; supervisor lens S1 confirm → S2 guide + crisis note → S3 outcome →
  S4 close. A baton strip says whose turn it is; done stages collapse into the
  spine. **SUPERSEDED by v3.0:** one timeline — the baton strip, spine and
  tier line are gone; see the v3.0 section below.
- **Stage is derived, never stored.** `mentorStage`, `supervisorStage` and
  `batonHolder` (`lib/tiering/escalation.ts`) read the record's fields, so no
  stage field can fall out of step with what was actually written.
- **One record, both lenses.** `escalations[teenId]`: `safetyCheck`,
  `mentorSummary`, `confirmedTier`, `confirmedAt`, `meta`, `guidance`,
  `crisisNote`, `outcome`, `followUp`, `wrapSeenAt`, plus `tierEvents[]` and
  `escalationHistory[]`. Every write goes through `useTiering`.
- **The supervisor closes Tier 1–2.** The mentor no longer resolves; a Tier 3–4
  confirmation at S1 closes the escalation as a standard tier update; Platform
  safety is "Mark reviewed".
- **Guidance lives on the escalation record**, not the Support outbox — the
  outbox is in-memory and carries no author. **SUPERSEDED by v3.0
  (Supersession 2):** guidance is deleted from the record; coaching is the
  Support thread, and the cost is the one v2 named — it does not persist.
- **The debrief is a fake AI draft** (`draftDebrief`), templated from the
  record and badged "AI draft · edit before saving". It writes narrative only:
  never a tier, never a subtype.
- **Time-to-confirm is recorded, never shown.** `meta.timeToConfirmMs` is on
  the record for the response-time metric and is absent from every rendered
  surface — a supervisor is not timed on screen. **SUPERSEDED IN PART by
  Monitoring v4:** the Tier 1 queue's Response cell shows it ("Confirmed by
  Sarah · 0:48"); the chat and the record still never do.
- **`REFERRAL_TYPE` is the pack's list** (988 · mobile crisis · ED · therapist
  / psychiatrist · PCP · school counselor). It replaced the old list on every
  host.
- **Close-out lands on Tier 3, with the copy "Tier 3 Monitoring".**
  `CLOSE_OUT_TIER` / `CLOSE_OUT_TIER_COPY` are BLOCKED CONSTANTS. The copy
  collides with the "Monitoring" forbidden-as-a-tier-name rule above. It ships
  as-is on instruction ("We can address the naming later"); this is the one
  named exception to that rule, and the conflict is stated at the constant.
- **Deleted, not orphaned:** the checklist (`lib/chat/assessment.ts`,
  `assessment-panel.tsx`), `safety-check.tsx`, `resolve-dialog.tsx`, and the
  unreachable escalation/flag dashboard chain (`monitoring-page`,
  `event-list`, `event-pane`, `escalation-region`, `escalation-timeline`,
  `escalation-note-module`, `tasks/chips`, `tasks/domain-tabs`,
  `lib/monitoring/{disposition,flag-group,surfacing,timeline,timeline-fixtures}`,
  `lib/record/escalation-note`, `lib/tasks/obligations`) with their tests.

### Care Panel & Escalation Timeline (pack v3.0, feat/care-timeline)

Answered 2026-10-21 ("go" on the Phase 0 defaults). **Supersedes the v2
exchange's presentation and five v1/v2 rules, each marked in place above.**

- **One timeline, two lenses** (`escalation/exchange.tsx`). A header states
  every status once — title + tier, "Opened · notified", the confirmation (or,
  closed, the movement "Tier 1 → Tier 3 Medium risk"), the Support link — and
  nothing below restates it. Then upcoming (ghosted, locked: the NEXT step and
  the EXIT only, each with its condition), exactly one current node (pulsing in
  the Bloom ink, its action card inside), completed (newest first, one line,
  expandable). Orientation is one constant, `TIMELINE_ORDER`.
- **Nodes are derived, never stored** (`lib/tiering/timeline.ts`), and "exactly
  one current node per lens" is a unit test over the whole arc. The baton
  MODEL survives (`batonHolder`); its banner does not.
- **The crisis note assembles as nodes**, a section at a time, each stamped
  once (`crisisNote.sectionAt`); **outcome and debrief are two nodes**
  (`chooseOutcome` → `saveDebrief`). **SUPERSEDED by v6.1 — a named
  reversal:** one Crisis note node holds an accordion of the sections,
  Outcome and Debrief; `sectionAt` still stamps each section.
- **Supervisor S0:** while the mentor assesses, the current node is the count
  only, and Confirm waits for the assessment — the pack's sequence.
  **SUPERSEDED IN PART by v6.1:** the count is the read-only accordion,
  filling in live; Confirm still waits. THE COST,
  STATED: v2 let a supervisor confirm early; now a mentor who never submits
  holds the supervisor at S0.
- **Neutral until confirmed** (blocked constant): the tier picker and Confirm
  carry no alert colour; red arrives with the confirmation, in the header.
  **SUPERSEDED IN PART by v10.0 / v10.1:** the picker is `TierSelect` — its
  Tier 1–2 lozenges carry their inks and every card its tier's legend wash
  (the scoped exception); Confirm and the record stay neutral until the
  confirmation.
- **Red in the mentor's escalation view** is the banner, the two escalation
  dots (rail and Overview tab), Tier 1–2 lozenges, and the live raise chip in
  the thread (Workstream E2: alert family while open; clay once closed; the
  close is sage). The risk chip is neutral. Counted in `care-timeline.mjs`;
  avatar identity tints are excluded by `data-record-avatar`.
- **Add to escalation:** a message action while one is open; an append-only
  `moments[]` entry with a quote snapshot, both lenses; a corner glyph on the
  message.
- **Actors are named by id** (`lib/chat/actor-name.ts`): "{teen} resolved the
  escalation" was the defect — the teen never closes one; a supervisor does.
- **Supervisor navigation:** no Chats (the phone bar's cell is Monitoring);
  the chat route has no conversation list and a "← Monitoring" way back;
  entries link to the thread, else the record, else nothing.
- **One emergency door:** the banner's "Emergency info" opens Care on its
  Emergency info tab, 911 first; the crisis dialog and the in-panel red button
  are deleted, and "Open Care" with them.
- **Send sends.** The composer was never wired (Phase 1 shell); `chatMessages`
  is append-only and merged at read time.

### Monitoring v2 — Events, and the Watch tab elevated (proto/monitoring-v2)

Answered 2026-10-22 ("go" on the context report). **Supersedes the
proto/monitoring-merge signifier — rings, the long lozenge, mono secondary
lines — in place in the code; the tier rule itself (alert colour on 1–2 only,
never colour alone) is unchanged.**

- **Watch · Events.** A tablist in the title row, deep-linked as
  `?tab=events`. **Named Events, not Activity:** `/app/activity` is the bell's
  ledger, a different feed on its own fixture cast; a second "Activity" would
  collide with it.
- **Events is one derived list** (`lib/monitoring/events.ts`) from the store
  the Watch tab reads — escalation records and the tier log — plus the
  roster's flag counts expanded to one event per flag, seeded reviews/notes
  (document fields TBD), and ~40 generated events over 90 days. Newest first:
  it is a log, unlike the per-teen timeline. Tier changes are immutable and
  wear the audit lozenge. The export is exactly the filtered set.
- **Links:** an open escalation opens the live chat timeline; anything else
  opens the record's Care history; a generated teen has neither.
- **Zero is `text-muted`, not Bloom's text/disabled** (~1.5:1) — a "0" is
  content and must pass AA (answered).
- **Weight is still not a channel.** The prompt asked for semibold names; the
  measured Lausanne fact above means that renders as 400, so names and group
  names use Avantt (`font-display`) at the specified sizes.
- **New tokens, Bloom-named, no new colours:** `--el-soft` /
  `--el-soft-hover`, `--border-strong`, `--border-focus` (+ `-soft`), and the
  `.mon-focus` / `.mon-lift` utilities.
- **Cards are the default view** for a session with no saved choice.
- **Whole-row and whole-card links** are the name's link stretched over the
  surface (`after:inset-0`), so the list's row/cell semantics survive.
- **Sticky list header** works from a 960 canvas up; below it the table must
  scroll sideways, and a sideways scroller cannot pin to the page.

### Monitoring v3 — parity, stability, calmer cards, cleaner Events (proto/monitoring-v3)

Answered 2026-10-23 ("go" after §4 and §5). **Supersedes Monitoring v2's
title row, the unmounting toggle, the cadence sub-line, the tinted cards and
Tier 4 cards, the Events chip rows and the dismissing alert, each in place in
the code.**

- **Header parity is structural.** Monitoring uses the shared `PageHeader`
  (32/40 title, 16/24 sans date line) and its new toolbar slot, 40px below
  the rule — where Care Reviews' toolbar sits (both measured at y=213).
  **SUPERSEDED IN PART by Monitoring v4:** the rule is gone from both pages
  (`PageHeader rule={false}`); the toolbar holds its y. Watch
  · Events IS Care Reviews' Open/Closed, extracted to `ui/pill-segments.tsx`
  (a tablist here, a radiogroup there). Care Reviews' own markup is unchanged.
- **A tab switch moves nothing.** The toggle hides in place on Events
  (`visibility`), the hero keeps ONE label set (the range rides in the
  detail), cells are a fixed 120. Only the content cross-fades (120ms).
- **Tier headers are one line** (dot · name · count); the cadence is an ⓘ
  tooltip (hover AND focus, Esc dismisses, `aria-describedby`), anchored to
  the line's left and out of layout while closed — centred, an invisible box
  widened a 320 canvas by 31px.
- **Cards: tier by contour, not fill.** White cards; Tier 1 the t1 hue at
  50%, Tier 2 the t2 hue at 45%, Tier 3 border-default, Tier 4 border-subtle.
  Fill only in the live Tier 1 lane. **SUPERSEDED by Monitoring v4:** no
  amber or red fill on the page but the Tier 1 queue's 40% container and
  Join; Tier 2 LIST rows are contoured too. `--t2` is unchanged — as a contour it
  does not read muddy, and Bloom has no cooler warm to move to.
- **Tier 4 is a registry:** the list's 64px rows inside the card view.
- **Events is a log:** one toolbar row, filters in a popover with a count
  badge, applied filters as removable chips only when active; a teen's flags
  in a day collapse into one row (per teen, not only adjacent — measured);
  windowed by day section with an observer ROOTED ON THE SCROLLER (the
  viewport is clipped by the shell) and derived visibility.
- **Token gap, stated:** `--surface-sunken` equals the page canvas, so the
  Events glyph circles use `--surface-sunken-strong` and row hover uses
  `--tint-hover`. `--text-disabled` does not exist; zero counts stay
  `text-muted` (AA), as v2 answered.
- **The alert's answer is a state:** acknowledged keeps the strip with the
  clock stopped; joined is a slim bar and the lane says "You in session";
  held by another supervisor offers Observe · Hand to me. **SUPERSEDED by
  Monitoring v4:** the strips are deleted; the queue's Holder and Action
  (Join · Observe · Resume) and the tray's Needs you now carry it.
- **Scenarios are data** (`lib/monitoring/monitoring.mock.ts`), twenty, in
  the dev bar's "Monitoring · Watch" / "Monitoring · Events" groups, each a
  transform of the real derived data. `monitoring-scenarios.mjs` picks all
  twenty through the bar and asserts each. **SUPERSEDED IN PART by
  Monitoring v4:** still twenty, but the five strip scenarios are the
  queue's five states now, and `AlertMock` is deleted.

### Monitoring v4 — no strips, a real Tier 1 queue, the tray (proto/monitoring-v4)

Answered 2026-10-28 ("go" on the context report, "go" after §2). Local
only. **Supersedes v3's alert states, v3's lane fill, the scenario set, the
page rule, v2's unclickable hero (a code-level rule), and pack v2.0's
"time-to-confirm never shown" on this one surface, each marked in place.**

- **No strips.** `tier1-alert-strip.tsx` and `alert-clock.ts` are deleted,
  not orphaned. What was the strip's: the response state (the queue), the
  announcement (one polite `Tier1Arrivals` line per arrival, never
  `role="alert"` for a state that persists), the sound (the tray).
- **The queue is one derivation, two hosts** (`lib/monitoring/t1-queue.ts`,
  `t1Rows`): the Monitoring queue and the bell's Needs you now read the same
  rows in the same order. A soft 20px container at `t1-soft` 40%, white
  rows with a 50% t1 contour, six columns (Teen · Stage · Signals ·
  Response · Holder · Action). Tier 1 is never cards.
- **The stepper is the product's order** — Requested → Assessment →
  Confirmed → Note — not the brief's (the mentor assesses before a
  supervisor confirms, pack v3.0).
- **A response is a state, never a countdown past zero:** "0:42 to
  confirm" · "Overdue 14m" · "Confirmed by Sarah · 0:48". "0:00 left"
  cannot be produced (unit-tested). The sort is by that state: overdue
  longest first, then least time left, then confirmed oldest first.
- **Holder is derived, never invented:** you (joined this session, or
  confirmed), the confirmer, a scenario's holder, or nobody — and Join ·
  Observe · Resume follow from it. Joined is presence, session-only.
- **The hero's counted cells are buttons** (In crisis → the queue's first
  row, focused; High risk → Tier 2; Risk flags and Escalations → Events,
  `?tab=events&type=…`). Active teens has nowhere to go, so it is a figure.
  The In-crisis dot exists only above zero.
- **Fills, defined:** a surface at least 24px on both axes. The only warm
  fills on the page are the queue container and Join (measured in both
  themes and both views); dots and lozenges are marks.
- **Needs you now** heads the tray for a supervisor: every unconfirmed
  Tier 1, from the record, never from a seen state — a look cannot clear
  one, confirmation does. Counted in the badge; the matching "raised Tier 1"
  notice steps aside so it is said once. One target per row (the action,
  stretched).
- **The cue** (`lib/monitoring/t1-cue.ts`): Web Audio, two soft sine notes,
  no asset, no dependency, on an arrival after the baseline — what was
  waiting at load is not news. The browser allows audio only after a
  gesture; an arrival before one is silent, and said so. The mute is the
  tray header's pressed toggle, per persona (`t1CueMuted`, store v58).
- **`--t1-text`** is a text-only token: in light it is `--t1-ink`; in dark
  blush/500, because the board's dark ink measured 4.36:1 on the queue row.
  Fills, glyphs and lozenges keep `--t1-ink`; the chat is untouched.

### Care Panel & Escalation — Elevation (pack v4.0, feat/care-elevation)

Answered 2026-10-22 ("go" on the Phase 0 defaults). A craft pass: the
information architecture is v3.0's. **Supersedes v3's header, tab chips,
upcoming ghosts and the bare waiting line, each in place below.**

- **Surfaces are a ladder.** The thread on the base (`surface-card`), the Care
  body one step deeper (`surface-s1`), cards lightest (`surface-raised` on
  `--el-soft`). No whole-card tints: a tier's colour lives in its lozenge.
  (**One scoped exception, v10.1:** `TierSelect`'s cards — the picker is a
  legend. Nowhere else.)
- **Exactly one emphasis.** The current node is the only element that is
  raised AND ringed; the ring is `--alert-critical-border` on Tiers 1–2,
  `--border-default` otherwise. One filled button per panel state at most.
  THE COST, STATED: the rings measure 1.3–1.7:1 against the card, so they are
  never the only cue — the ink glyph, the surface and the live announcement
  also mark the step.
- **A hero above the tabs, on every tab.** Steady: the Teen Status card
  (`rail/teen-status-card.tsx` — Clinical diagnosis · Risk tier; the record's
  `TierCard` is unchanged, answered). Escalation: `EscalationHero` — lozenge,
  holder ("— Brandy has this" / "— with {mentor}"), a quiet meta line, one
  Support link. **SUPERSEDED by v5.0:** the holder left the hero for the
  waiting node; the link is a ghost button; the mentor's card has no
  Clinical diagnosis cell.
- **Single homes.** (**v11.0:** "Notified" now links to History, and while
  the mentor waits the post-submit card's filled button is the one Support
  door.) "Notified" is the banner's alone; presence ("Brandy is
  here") is the hero's alone; the holder is the hero's alone. While the
  mentor waits, the one Support door is the waiting module's Open Support and
  the hero hides its own. **SUPERSEDED by v5.0:** the holder's home is the
  waiting node, and the hero's ghost button is the one door in every state.
- **Care is a labelled control** at the left of the rail row, behind a
  divider; the Care tabs are one underlined row that scrolls sideways under an
  edge fade (answered: never wraps).
- **The future is one row:** "Up next: … → Close", collapsed, reading
  forwards. **SUPERSEDED by v5.0:** "Up next: …, then Close & follow-up" —
  arrow chains are retired, and one label set names each step. A current node is an ACTION (pulse) or WAITING (a 6s breath).
  Completed rows never truncate: short labels that wrap; long text on expand.
- **The question card has two zones:** Ask {teen} (verbatim, "Ask in chat"
  fills the box and sends nothing) and {Teen}'s answer (never disabled).
  Answered rows are `assesses` labels; the question verbatim on expand.
  **SUPERSEDED IN PART by v5.0:** the question comes first, the answered rows
  collapse below it, and a review ledger replaces the full-text review.
- **While you're with them** (`escalation/waiting-module.tsx`): the
  supervisor's latest Support message, quote-framed; 2–3 Ava nudges from
  `lib/chat/stay-close.ts` — grounded in the thread, dropped by a `CLINICAL`
  guard, never sent, never persisted ("used" is component state); a rotating
  steadying line. **SUPERSEDED by v11.0 (Supersession 6):** the module, the
  quote and the steadying line are deleted for the post-submit card.
- **History, both hosts:** date groups, one gutter-time anatomy, a compressed
  escalation card (lozenge title row + ONE interpuncted stage line — the
  arrow chain is retired), two-line clamps with Show more. **SUPERSEDED IN
  PART by v5.0:** the stage line is at most three outcome-led fragments.
- **The close arc's toast is the surface's only toast**
  (`escalation/close-toast.ts`): the supervisor on close, the mentor once on
  first seeing the summary. It names the tier from `TIER_NAME` ("Tier 3
  Medium risk"), which differs from the blocked `CLOSE_OUT_TIER_COPY`
  ("Tier 3 Monitoring") — the pack's wording, flagged, not resolved.
- **A sent assessment question carries `origin`** on `chatMessages`
  (append-only) and a corner glyph that opens the assessment. A nudge carries
  none.

### Care Panel & Escalation — Refinement (pack v5.0, feat/care-v5)

Answered 2026-10-23 ("let's do care v5.0", on the Phase 0 audit). Stacked on
v4. **Supersedes six v4 rules, each marked in the v4 section above by this
one:** the hero's holder line, the underlined Support link and the waiting
module's own Support door, answered-rows-above, the full-text review, the
mentor's Clinical diagnosis cell, the tier cell's sentences.

- **Bug 1 was data, not render.** `setMonitoringScenarioId` dropped the
  escalation records but kept `chatEvents`, so the fixture's escalation came
  back open under a stale close chip; closing again wrote a second. It now
  clears the chat writes too (as Reset and the chat switch always did), and
  the thread reads one open and one close per escalation id.
- **Bug 2:** 405px of Care tabs in a 327px row under an always-on fade. Fades
  render only on a side with more; tabs snap; the bar is sticky on s1.
- **The hero owns state only:** ESCALATION overline, the request in words or
  the confirmed lozenge as headline, one meta line, the Support ghost button
  last — the one Support door in every state. The holder's single home is
  the waiting node ("Brandy has this. Stay with Jordan.").
- **The Teen Status card is role-gated in the component:** Clinical diagnosis
  for supervisor and lead mentor only. The tier cell is lozenge · ⓘ (the
  description, the dwell rule, the mentor's step-down request) · a slim "Day
  N of 14" line · one outline action; a pending request is one status line.
  **SUPERSEDED IN PART by v7.0:** the card is the `CareHero` now, and the
  mentor's Zone 2 is the Mentorship — the tier cell and the gate are as here.
- **One label set for the future:** the timeline carries "after …" clauses;
  the view names each step once. No arrow chains on any escalation surface —
  the path is "A, then B", movements say "moved to", lozenge pairs say "to".
- **Question first:** the card holds a fixed position ("Question n of 6");
  answered questions collapse below it and amend in place; the review ledger
  leads with the live risk chip and never shows full text by default.
  **SUPERSEDED by v6.1:** all six rows always, one open, bounded movement in
  place of the fixed position; the risk chip is live from the first answer.
- **Notices are derived, never stored** (`lib/tiering/notifications.ts`, one
  hook for the bell and Today): only `noticesSeenAt` per persona persists
  (store v56). A Support notice belongs to an OPEN escalation only — a thread
  is about no one teen. Deep links are `?care=overview`, read into the
  default tab, never an effect.
- **List shields:** Tier 1–2 ink only for Tiers 1–2; neutral otherwise;
  named in the row's label. The red census counts them as "list shield".
- **History v3:** the Escalation lozenge + tier, ONE summary line of ≤3
  fragments, timeline rows on expand. The card has no date of its own — the
  gutter and the day header already say when (single home).
- **The mentor's Safety plan** is three conversation starters with Ask in
  chat; documenting the plan stays the supervisor's crisis-note section.
- **Known, not fixed here:** Today's Escalations destination card still reads
  `monitoringData()` fixtures, so it can disagree with the new tiering-store
  list above it; `monitoring-tiers` hard-codes a weekday ("closed Tue") that
  drifts with the date.

### Care Hero (micro-pack v7.0, feat/care-v7)

Answered 2026-10-23 ("go monitoring s6 first, then v7, then v6.1"; the Phase 0
defaults stood). Stacked on v5. **Supersedes v5's Teen Status card (marked in
place above) and the Profile tab's Matched row.**

- **Three zones, two configurations** (`rail/care-hero.tsx`). Zone 1, the
  identity strip — initials avatar, name, age, pronouns, "View their
  profile →" — in both lenses and every state. Zone 2 anchors: Clinical
  diagnosis for supervisor and lead; THE MENTORSHIP for a mentor (tenure as
  the headline, then facts). Zone 3 is v5's tier cell, unchanged. An open
  escalation's hero replaces Zones 2–3; the strip stays, so the page never
  loses its subject. **SUPERSEDED by v8.0:** the identity strip is removed
  (Profile is the rail's person-icon tab), and the anchor cells persist above
  the tabs in EVERY state — the escalation hero moved into the Escalation
  review tab.
- **The role gate is at the source:** `care.tsx` never computes the
  mentorship for a supervisor, and a mentor's DOM holds no diagnosis, ICD
  code or care-record link (probe). **SUPERSEDED IN PART by v11.0:** both
  lenses read the mentorship now (facts about the pair); the diagnosis gate
  stands.
- **Facts only, never a characterisation** (a blocked constant). The
  Mentorship meta is "Last spoke {when} · {n} check-ins this window", then
  "Supervised by {name}" on its own line — the pack's one line overran the
  cell and stranded a "·" (measured), so the split is deliberate.
- **Tenure has one home**, in the mentee table's own phrasing (`relLength`,
  via `lib/record/mentorship-vitals.ts`) — two roundings of one fact is the
  failure the chat page's old note warned about. The Profile tab's Matched
  row is gone. It settles once on the day it ticks over.
- **The sanctioned repetition is the strip** (name and pronouns repeat the
  chat header — the strip is the document title of a surface also reached
  from Monitoring and the record). "Last spoke" near the list's last-activity
  time is the second, named exception. **SUPERSEDED by v8.0:** the strip and
  its exception are deleted from canon; "Last spoke" remains the one named
  exception.
- **`?rail=profile`** opens the Profile tab, derived like `?care=overview`,
  never pinned. The supervisor link opens their Support thread when one
  exists, else the name is plain text.
- **Fixture rows are TODO-DATA:** `VITALS` carries age and check-ins per
  record teen; the avatar is a placeholder (no teen photography by design).
  **SUPERSEDED IN PART by v8.0:** age and `teenIdentity` left with the strip;
  `CHECK_INS_30D` holds the check-ins.
- **Deferred:** the Profile ↔ Care avatar crossfade — Profile has no avatar
  to hand off to, and adding one for the motion alone is decoration.

### Assessment & Crisis Note Accordions (pack v6.1, feat/care-v6.1)

Answered 2026-10-23 ("go, finish v6.1"; the Phase 0 defaults stood). Stacked
on v7. **Supersedes v5's question-first card and v3's note-as-nodes and S0
count, each marked in place above.**

- **Why, on both components:** crisis information arrives non-linearly, so
  guided sequential use and random-access capture get equal grace.
- **`AssessmentAccordion`** (`escalation/assessment-accordion.tsx`): six
  fixed-height rows (short label, "—" / Yes / No), exactly one open — on load
  the first unanswered; a record collapses the row and opens the next
  unanswered TOP-DOWN after a 180ms breath (none under reduced motion), with
  focus on its first control. The two-zone card is unchanged; Q6 nests its
  follow-up. Modes: holder, observer (read-only, live, one soft tick per
  arrival), read-only after Submit. **SUPERSEDED by v8.0:** the accordion is
  deleted for the assessment deck — a zero-open state can no longer render.
- **`CrisisNoteAccordion`** (**SUPERSEDED by v11.0, Supersession 5:**
  deleted for the deck — one card per section, an atomic submit with a
  session draft) (`escalation/crisis-note-accordion.tsx`, rows
  from `lib/tiering/note-rows.ts`): the chart's sections (Emergency for
  Tier 1 only), then Outcome, then Debrief, in one timeline node titled
  "Crisis note · n of N". "Save section" records, collapses and opens the
  next untouched row top-down. Close & follow-up stays its own node.
- **Dependencies are honoured, not enforced by order.** Outcome's suggestion
  is `autoOutcome(note)`, live. A saved outcome records its `basis`; when the
  note later suggests something else, a quiet neutral review dot marks the
  row — never a silent edit.
- **Amendments are appended** (`noteAmendments`: row, time, what it said
  before). Choosing an outcome no longer resets a saved debrief.
- **Close is gated on the note** in the store's write as well as the node —
  a blocked constant.
- **Blocked constants unchanged:** verbatim C-SSRS wording in expanded cards
  only (**SUPERSEDED by v9.0:** in full for every question, always); all six answerable in any order (any gating is Meg / Dr. Nissan's);
  the risk computation; the chart's section labels; no Emergency at Tier 2.
- **No cross-tab sync:** the store has none and the role lives in it, so
  "live" for the observer means the record changing while the page is open.

### Assessment Deck & Care Tab Restructure (pack v8.0, feat/care-v8)

Answered 2026-10-23 ("Dont stop anymore to ask me for permissions, just work
continuously" — the Phase 0 audit is recorded in the report, not a stop).
**Supersedes v6.1's intake accordion, v7's identity strip, and the Overview
tab, each marked in place above.**

- **`AssessmentDeck` + `CoverageRail`** (`escalation/assessment-deck.tsx`,
  rules in `lib/tiering/deck.ts`). The rail is six tappable segments in
  instrument order — empty · Y · N · skipped (struck, its own mark, never
  colour alone) — a tablist; the current one wears a 2px ink border (a
  border, not a box-shadow ring, so the timeline node stays the only element
  raised AND ringed). The deck ALWAYS has exactly one active card: the next
  required question, or the review card once complete. Zero-expanded cannot
  render. **SUPERSEDED by v9.0:** the deck, the rail and the review card are
  deleted for the `GuidedAssessment` form — every question in full, always;
  the rules module (`lib/tiering/deck.ts`) is unchanged.
- **The skip rule is clinical policy, supplied** (a blocked constant): Q1 No
  ∧ Q2 No → UNANSWERED Q3–Q5 skip and the deck goes to Q6. A recorded Q3–Q5
  answer is never discarded and still counts; amending Q1 or Q2 to Yes
  un-skips. Progress counts the required set ("3 of 3 needed answered"); the
  ledger reads a skipped row "Not asked — no ideation indicated"; the risk is
  unchanged and reads recorded answers only. The skip is announced once.
- **Care tabs:** [Escalation review] · Emergency info (THE DEFAULT, a blocked
  constant) · Safety plan · Resources · History. Overview and its Recent
  preview are deleted. The temporary Escalation review tab exists while an
  escalation is raised, open, or closed and not yet dismissed IN THIS LENS
  (`wrapSeenAt` / `supervisorWrapSeenAt`); it is auto-selected once per open
  event (the pick is held with its epoch); its dot means this lens's move
  (`batonHolder`) or an undismissed closed summary. It holds the raise flow,
  the escalation hero, the timeline, the deck, the note and the close.
- **Closed is a summary in BOTH lenses** — the supervisor's timeline now
  draws a closed record (steps that never happened are not drawn) — with one
  Dismiss; dismissing, or leaving it after viewing, removes the tab, which
  exits toward History. The close toast is unchanged.
- **The panel header** is the anchor cells (v7 Zones 2–3) above the tabs in
  every state; nothing renders above them. The tier cell's own actions step
  aside while an escalation is raised or open. **SUPERSEDED IN PART by v9.0
  (Supersession 3):** "every state" is now steady, raising and closed — while
  an escalation is OPEN the cells yield.
- **Deep links:** `?care=escalation` (the retired `overview` is an alias).

### Escalation Focus Mode & Guided Assessment (pack v9.0, feat/escalation-focus)

Answered 2026-10-26 ("go" on the Phase 0 audit — the chat floor at 480).
**Supersedes v8's deck, coverage rail and review ledger, and the "header in
every state" rule, each marked in place above.**

- **Focus Mode** (`chat-page.tsx`, `data-chat-focus`). While THIS
  conversation has an OPEN escalation (not the raise flow, not a closed
  summary) the columns equalize: list · chat · Care trend to thirds, and
  restore on close. **SUPERSEDED by v9.1:** the list no longer shares the
  room — the Escalation Focus View below; v9's floors and Care ≤ chat apply
  inside it. The floors, from the 8pt grid: **chat 480** (a bubble of
  349px beside a full composer), list 256 (it yields first), and Care never
  wider than chat. Measured: mentor 1512 `300·744·360 → 444·480·480`; 1280
  `→ 256·480·436`; supervisor 50/50. THE COST, STATED: a supervisor at 1280
  with Support open gets Care as the drawer — 664 of canvas cannot hold 480
  plus a 320 Care.
- **One motion.** The focus tracks are LENGTHS (`max()`/`min()` over
  percentages, in `--focus-list` / `--focus-care`) with the chat's
  `minmax(0,1fr)` the same in both states, so `grid-template-columns`
  interpolates — `fr ↔ px` would jump. The Care header's yield shares the
  beat (`--focus-dur`, `--focus-ease`). Reduced motion: an instant swap.
- **The hero yields** (`rail/care.tsx` `Yield`): collapsed by grid row, inert,
  never unmounted. The mentor's header hides; supervisor and lead get the
  one-line `DiagnosisStrip` (diagnosis + ICD chip; a long one wraps, never
  ellipsised). The Escalation review status block is the working header.
  **SUPERSEDED by v11.0 (Supersession 1):** the hero holds its ground in
  every state; `Yield` and `DiagnosisStrip` are deleted.
- **`GuidedAssessment`** (`escalation/guided-assessment.tsx`): six question
  groups, each its number, the FULL verbatim text and an answer chip (— · Yes
  · No · Not needed). **Exactly one focused question in every capture
  state** (the ring is a 2px ink border, never a raised shadow); **review is
  the only zero-focus state** — the form with every answer, then the risk
  chip, the note and Submit rising in. A record advances focus to the next
  required unanswered; a tap moves it; amending from review re-enters capture
  and the chip recomputes. Observer: the same form read-only, arrivals tick.
- **No labels as questions, anywhere** (a blocked constant): the supervisor's
  `assesses` labels render on no assessment surface. `draftDebrief`'s
  narrative still names findings by them — a description, not a question.
- **Deleted, not orphaned:** `assessment-deck.tsx` (deck, rail, read card,
  review ledger) and the `seg-skip` / `deck-settle` CSS. `care-v8.mjs` keeps
  its tab-lifecycle claims; its deck sections are `care-v9.mjs`'s.

### Escalation Focus View (amendment pack v9.1, feat/escalation-focus-view)

Answered 2026-10-26 ("go" on the light audit — 50/50 inside the view).
**Supersedes v9.0's in-place equalization (list 444/256 beside the room)
and the Support auto-collapse inside it, each marked in place above.**

- **A room, entered.** A conversation is IN the view while this lens holds
  its escalation record (`roomFor`): open, or closed with the summary not
  yet dismissed. In it the list's track is 0 and the list inert; chat and
  Care are v9's equalized proportions — 50/50, chat ≥ 480 (mentor 1512 702 ·
  702; 1280 586 · 586; the supervisor's unchanged). **SUPERSEDED by v11.0:**
  Care clamps 480–680 with chat ≥ 520 — mentor 1512 724 · 680. THE COST, STATED: at 702
  the compact question rows run ~85 characters, past the 75 ceiling — the
  pack's "proportions carry forward" won over the measure (560 was offered).
- **"← Chats · N"** is the supervisor's "← Monitoring" bar, at every width:
  both lenses land in the same room and only the label differs. N is the
  OTHER conversations with unreads; it ticks on change, hidden at 0. It
  closes nothing; the pinned row re-enters.
- **A default is never the room.** With no conversation in the route, `md`
  and up still selects one beside the list — and an escalated default would
  have turned ← Chats into a loop back in. The default skips the room; a
  ROUTE (a row, a notification) always lands in it.
- **The Active escalation group** is a partition of the filtered rows, open
  escalations first, under one quiet header that exists only when non-empty
  (a blocked constant); no new filter tab. A section labelled by its h3.
- **Motion follows an action.** The grid transitions only after the reader
  has pressed something on the page (`data-chat-motion`, armed on the first
  pointerdown/keydown): the mid-chat open (Confirm) and the dismiss exit
  compose in ONE motion — the list track slides 300 ↔ 0 as the list fades,
  the same beat as the Care header's yield — and anything a LOAD brings in
  lands. A frame count could not promise that: the records arrive after two
  frames (measured), and v9.0's deep link animated 43 frames from steady.
  Duration and easing live INSIDE the variant — unscoped, `transition-
  property: all` timed every change (measured).
- **Route entries land, they do not travel** (deferred): a row and ← Chats
  are navigations, which remount the page — a CSS transition cannot span
  them, and React's `<ViewTransition>` needs `experimental.viewTransition`,
  which cross-fades every navigation in the app.

### TierSelect — one tier decision, one component (pack v10.0 + amendment v10.1, feat/tier-select)

Answered 2026-10-27 ("go" on the Phase 0 defaults; v10.1 arrived mid-build
and was folded in). **Supersedes the three per-role tier controls, v1's
red-on-T1–2 Confirm escalation, and — inside this component only — v4's
no-whole-card-tints rule and v3's neutral picker, each marked in place above.**

- **One component, two modes** (`components/tiering/tier-select.tsx`). Raise
  (mentor): Tiers 1–3, the plain-language lines, empty on load, the platform
  escape below and outside the group, a required 280-character note,
  Confirm escalation + Cancel. **SUPERSEDED IN PART by v11.0:** no platform
  escape and no "Current" tag in raise, every card choosable; the check
  glyph is gone — selected is ring + deepened wash + filled lozenge. Review (supervisor): Tiers 1–4, the clinical
  criteria, the request arriving checked and tagged "Requested by {mentor} ·
  {time}", a reason seeded from the mentor's note, and a CTA that spells the
  consequence out ("Confirm Tier 2 · High risk"), relabelled live and
  announced. Review serves the confirm-tier step (`exchange.tsx`
  ConfirmCard) and the Update tier flow (`TierUpdateModule`). Deleted, not
  orphaned: the raise flow's radio list, the confirm grid, the update grid,
  "Adjust to Tier n", "Post update".
- **Copy is one file** (`lib/tiering/tiers.ts`), all blocked constants:
  `TIER_NAME` (T1 Active crisis · T2 High risk · T3 Medium risk · T4
  General), `RAISE_DESCRIPTION` (the pack's mentor table, verbatim) and
  `TIER_CRITERIA`. **Provenance, stated:** the tier matrix is not in this
  repo; the criteria are the pack's words, comma-joined, the first letter
  capitalised — replace with the matrix's own text when supplied, never
  paraphrase. The CTA's words are `lib/tiering/tier-cta.ts`, unit-tested.
- **The lozenge is the selector (v10.1).** A card: lozenge · name ·
  description, no radio glyph; a native radio per card, visually hidden,
  the card its label — arrows, one Tab stop and disabled-skipping are the
  platform's. Selected = FILLED lozenge + 2px ink ring + trailing check;
  never colour alone, never wash alone. The ring is a border, not a shadow
  (the timeline node stays the only element raised AND ringed). The
  accessible name is "Tier n, Name"; the request (or "Current tier"), the
  description and any refusal are its description.
- **The scoped wash exception (v10.1).** Each card wears its tier's legend
  wash — the picker is a legend, so every tier shows its identity at the
  moment it is chosen. Only here: status cards, rows, History and every
  ambient surface keep the no-wash rule and alert colour on Tiers 1–2 only.
  The tokens are scoped by name (`--tier-legend-{n}-wash` / `-wash-hover` /
  `-ink`, `settings-tokens.css`) and `tier-select.mjs` greps that nothing
  else reads them. **The hues, answered ("keep the proposed tiers",
  2026-10-27):** T1 blush, T2 apricot (Bloom steps; `--t1-soft` /
  `--t2-soft` are concept-board values, not ramp steps), T3 sunshine and T4
  forest — proposed because the mock's hues never arrived as tokens; dark
  washes are hand-derived (the band triad's precedent).
- **Confirm escalation is never red.** Alert inks live on the Tier 1–2
  lozenges; the two red "Raise an escalation" menu entries remain the named
  exception, outside this component.
- **Movement rules still bind in update mode.** All four cards show; the
  ones `placementsFrom` refuses are disabled with their reason. With the
  current tier checked the CTA reads "Choose a new tier" and, pressed, names
  the gap — never a no-op "Update to Tier 3".
- **An unnamed mentor is "the mentor"**, said once (`mentorFirstName`): a
  first-name split of the fallback read "Requested by The" (measured).
- **Motion:** the request settles in one beat (ring + tag); selecting fills
  the lozenge and lands the check in one beat. Reduced motion: an instant
  swap. v10's CTA crossfade was replaced by v10.1's card beat.

### Chat Escalation Experience (pack v11.0, feat/chat-escalation-v11)

Answered 2026-10-28 (the Phase 0 conflicts, one by one). **Authoritative over
every earlier pack where they disagree; eight supersessions, each marked in
place above.**

- **Layout (§3).** Steady: list 300, Care 420 (yielding to 360 below a
  480 chat), chat the fluid column — NOT the Figma's 544, which assumes a
  232 rail; mentors keep the 92 icon rail and staff the 248 (answered: leave
  the nav). Room: Care `min(680, max(480, 50%), 100% − 520)` — mentor 1512
  724 · 680, supervisor 624 · 624. Room + Support: chat 520 · Care 480 ·
  Support the remainder (348–420), the card read as `--chat-card` off
  `data-chat-room`. **Other elements give way before Support** (answered):
  on chat the staff rail collapses to 72 up to 1680 (`data-support-chat`).
- **The banner is the shell's** (`app-shell/shell-banner.tsx`): at `md`+ it
  portals into a slot above the canvas-and-Support row, sidebar edge to
  gutter, 64 high, over Support too; the surfaces beneath square their top
  corners. "Supervisor notified" opens Care's History.
- **The list header** is 64 ("Teens", no chevron — answered: nothing to
  switch to) with a REAL name search (a search button that searched nothing
  would be dead chrome); pills 54 under a rule; rows inset, 68, 2 apart.
- **The Care hero persists** (`rail/care-hero.tsx`), both lenses, every
  state: identity (v7's ages, restored) · the mentorship ("Supervised by"
  → the supervisor's record, mentor lens only) · risk tier (action right,
  suppressed while an escalation is open — Brandon to confirm) · six
  metrics (`record/metric.tsx`, the Care Record stat, extracted) · the
  diagnosis last, supervisor and lead only. It scrolls away under the
  sticky tab bar; an opening scrolls the panel to the top once.
- **Metrics never fabricate** (`lib/record/hero-metrics.ts`): days in
  mentorship, messages sent (the thread's mentor lines, 30d), flags
  (`careFlagsFor` risk flags, 30d), escalations (the tiering store, 30d),
  notes (this thread's chat notes — answered default; definition Meg).
  ENGAGED DAYS IS BLOCKED (Meg): the slot renders "not available yet",
  never a number — absent is not zero, and zero renders `0`.
- **TierSelect (§5):** mentors keep the plain language — **the clinical
  criteria are for supervisors only** (answered, reversing the pack's §1.3);
  `TIER_CRITERIA` is §5.2 verbatim. No check glyph; selected = ring +
  `--tier-legend-{n}-wash-deep` + filled lozenge; hover = border-strong.
  Raise: no "Current" tag, every card choosable (answered), no platform
  link (`PlatformReport` deleted), "What's happening?" with a required
  marker, a footer sticky to the panel's bottom; validation on submit or
  blur-after-input only.
- **The assessment** keeps v9's behaviour and gains the Figma's anatomy:
  "Question n of 6", the quote, Ask in chat →, one-line record row,
  numbered collapsed rows with a filled Y/N pill.
- **The crisis note is a deck** (`escalation/crisis-note-deck.tsx`): one
  section card at a time, explicit "Record section" (outline), any row
  re-opens intact, "n of N sections recorded", "Draft saved {time}", and
  ONE atomic "Submit crisis note" (`submitCrisisNote`, refused unless
  complete). The draft is sessionStorage (`lib/tiering/crisis-draft.ts`, the
  `review-draft` precedent: clinical prose never in localStorage), keyed by
  escalation; it survives reload, navigation and tab switches. Required
  sections: BLOCKED (Dr. Nissan) — all required until then.
- **Post-submit** (`escalation/post-submit-card.tsx`, copy in
  `lib/tiering/post-submit-copy.ts`, Nicole): "Assessment sent." · "{Sup}
  has it and is reviewing." · one orienting line · Ava's paths with a quiet
  Use · "Message {sup} in Support", the card's one filled button (the hero's
  door steps aside). A sent suggestion records `ChatMessage.provenance` —
  the three-state model reused: `ai_inserted` unedited, `ai_assisted` edited
  (answered: the model's distinction stands).

### Monitoring asserts only what it can compute (arch-mon)

**SUPERSEDED IN PART by the section above**: the tiers and their cadences now
have a published source. What still holds: nothing on the page may manufacture a
breach state from a deadline nobody published, and nothing is AI-ordered.

The page grouped flags into **Imminent / Clinical review / Routine review** and
counted each tier's SLA down to a breach. Neither half was computable: the
classifier emits CATEGORIES, not severity, and nothing published states a review
deadline for a flag. So the surface was asserting clinical severity and
manufacturing breach states from it — a supervisor reading "overdue by 2h" on a
flag was reading a number this system invented.

**Flags carry age.** Elapsed time since the flagged message, mono and tabular.
`FLAG_REVIEW_SLA` is `null` and blocked on Meg, and while it is null nothing on
the page may derive a flag deadline. `TaskItem.slaDeadline` was populated
upstream for the flag type and deliberately never read here; since §2.9 it is
null for the billing types too, so **the only published clocks left anywhere on
this surface are the escalation pair.**

**Breach treatment belongs to escalation obligations alone** — the 5-minute
acknowledgement SLA and the 24-hour escalation note. That is the whole point of
removing it from flags, so reintroducing it there would undo the phase.

**One comparator, ONE review subject.** It was two — teen safety flags and
mentor practice breaches as one event primitive in one queue, filterable by
subject with chips. §2.1 removed Mentor Practice, and the shape argument was
never what was withdrawn: the comparator's five steps (escalation → category
rank → repeat pattern → no mentor reply → age) never read `subject`, so removing
a subject removed no ordering. The chips went with it, on the extensibility
threshold's own rule. Two of the five steps are still no-ops with named owners;
`lib/monitoring/constants.ts` says which and why. No secondary ordering exists
anywhere else, and nothing is AI-ordered.

**Coverage was the floor, and it is Chat now (§2.2).** The argument stands and
is worth keeping: a surface that can only show what a model noticed cannot
answer "have I looked at my teens". What served it was a roster of supervised
conversations as progress against the shift — and §2.2 renames that destination
to Chat, which is where a conversation is read. `lib/monitoring/coverage.ts` is
dormant, not deleted. **The rule that outlived it: progress is never expressed
as a count of what is left.**

**The disposition is two axes, and escalating is neither (§2.8).** *(The
disposition model and its pane were deleted in Escalation Exchange v2, along
with the unreachable flag dashboard. The rule below is kept for the day flag
review returns.)* A required
clinical disposition is the only thing that can close an event; an optional,
never-primary, never-pre-selected note about the classifier resolves nothing.
`Escalate now` used to be a fourth value of the first axis — it is a secondary
BUTTON now, never gated on the radiogroup, because a disposition is a statement
about the teen and escalating is a thing a supervisor does.

**Axis 2 renders where a classifier ran.** Suppressed on a user-reported flag,
for the same reason Phase 5 suppressed it on a deterministic rule: a question
about a producer that did not produce this.

**`Mark reviewed` is the commit, and the keyboard keeps the cost at one.**
`1`/`2`/`3` select AND commit; `e` escalates. The mouse path is two steps on a
123-item queue, which is why the keyboard path is one.

**Monitoring had its own list and pane** — deleted in Escalation Exchange v2,
since the tiered overview replaced them; kept as the record of why a second
list was justified. `event-list.tsx` and `event-pane.tsx` were used
rather than Tasks' `Worklist`/`TaskPane`, because after this phase the two
surfaces share no row anatomy, no grouping, no ordering and no footer. What is
still shared is what should be: the identity disc and the conversation excerpt,
which gained a host-scroller mode (§2.7) rather than a fourth transcript
implementation. §2.4 took that further — the escalation timeline renders its
messages through the same `TranscriptBubble`, so one conversation reads the
same way on both surfaces. The cost is a second list, stated plainly: that is
how silent per-screen forks start, so it is written down here.
