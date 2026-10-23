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
  surface — a supervisor is not timed on screen.
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
  the rule — where Care Reviews' toolbar sits (both measured at y=213). Watch
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
  Fill only in the live Tier 1 lane. `--t2` is unchanged — as a contour it
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
  held by another supervisor offers Observe · Hand to me.
- **Scenarios are data** (`lib/monitoring/monitoring.mock.ts`), twenty, in
  the dev bar's "Monitoring · Watch" / "Monitoring · Events" groups, each a
  transform of the real derived data. `monitoring-scenarios.mjs` picks all
  twenty through the bar and asserts each.

### Care Panel & Escalation — Elevation (pack v4.0, feat/care-elevation)

Answered 2026-10-22 ("go" on the Phase 0 defaults). A craft pass: the
information architecture is v3.0's. **Supersedes v3's header, tab chips,
upcoming ghosts and the bare waiting line, each in place below.**

- **Surfaces are a ladder.** The thread on the base (`surface-card`), the Care
  body one step deeper (`surface-s1`), cards lightest (`surface-raised` on
  `--el-soft`). No whole-card tints: a tier's colour lives in its lozenge.
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
- **Single homes.** "Notified" is the banner's alone; presence ("Brandy is
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
  steadying line.
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
  loses its subject.
- **The role gate is at the source:** `care.tsx` never computes the
  mentorship for a supervisor, and a mentor's DOM holds no diagnosis, ICD
  code or care-record link (probe).
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
  time is the second, named exception.
- **`?rail=profile`** opens the Profile tab, derived like `?care=overview`,
  never pinned. The supervisor link opens their Support thread when one
  exists, else the name is plain text.
- **Fixture rows are TODO-DATA:** `VITALS` carries age and check-ins per
  record teen; the avatar is a placeholder (no teen photography by design).
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
  arrival), read-only after Submit.
- **`CrisisNoteAccordion`** (`escalation/crisis-note-accordion.tsx`, rows
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
  only; all six answerable in any order (any gating is Meg / Dr. Nissan's);
  the risk computation; the chart's section labels; no Emergency at Tier 2.
- **No cross-tab sync:** the store has none and the role lives in it, so
  "live" for the observer means the record changing while the page is open.

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
