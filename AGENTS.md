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
  (`chooseOutcome` → `saveDebrief`).
- **Supervisor S0:** while the mentor assesses, the current node is the count
  only, and Confirm waits for the assessment — the pack's sequence. THE COST,
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
