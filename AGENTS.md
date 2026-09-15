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

Settled, with the reasoning, so they are not re-litigated by the next person who
finds them odd. Each records what was evaluated and what it cost to choose.

### The surface is called Tasks — decided, keep

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

### The surface is still called Tasks — confirmed at arch-E

The earlier awkwardness was never the label. **Rows described people while the
label promised work**: the group header said the task type, so the row said only
a name and a deadline. With rows leading with the job and the list grouped by
when work is due, the surface is a task list in the plainest sense and the name
stops being a stretch.

Alternatives stay rejected for the reasons above — chiefly that only "Tasks"
holds across all three roles in the PRD roll-out.

### When chrome returns — the extensibility threshold

Written down because the failure mode runs both ways: chrome added before it is
needed, and chrome forgotten when it is.

| Change | What the surface grows |
|---|---|
| A new task type | **Nothing structural.** Rows state their own type and time buckets hold any mix. |
| More than one task type present | **A filter chip row** above the list (`All · Billing · …`), defaulting to All. |
| A single task type | **No chip row**, and never a tab row. |

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

### Tasks groups by when, Monitoring groups by tier

Not a style difference — the two surfaces have opposite units of work, and the
grouping follows.

Tasks' type groups (`Intake` / `Monthly re-review`) did two things wrong at once.
They took the verb off the row, so a row said only a name and a clock. And they
**destroyed deadline order across buckets** — measured, the list ran 15h → 2d and
then RESTARTED at 20h → 2d, so finding what was about to breach meant merging N
sorted lists by eye, on the surface whose entire job is deadline awareness.

Deadline buckets (`Overdue` / `Due today` / `Due tomorrow` / `Later`) are a
PARTITION of the one sorted list, not a re-sort: `slaRemaining` is the
comparator's fourth key and is monotonic down the list, so each bucket is a
contiguous run of it. Empty buckets do not render — unlike the old tab cards,
which kept their position for navigational stability; a bucket is a content
grouping and "Overdue — 0" is noise claiming a shape the list does not have.

Monitoring keeps its tier bands, because there the tier IS the kind of work and
its rows are person-forward. Band retirement (`{Tier} — cleared · {n} today`)
stays tier-only for the same reason: a tier clearing is information, while a
deadline bucket can empty because the work was done *or* because the clock moved.

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
