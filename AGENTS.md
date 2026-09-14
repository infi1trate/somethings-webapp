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

### When chrome returns — the extensibility threshold

Written down because the failure mode runs both ways: chrome added before it is
needed, and chrome forgotten when it is.

| Change | What the surface grows |
|---|---|
| A new task type inside an existing domain | **A new group header.** No structural change. |
| A second domain on Tasks | **The tab row returns**, with group headers nesting beneath the tabs. |
| A single domain | **Never a tab row.** |

One tab advertises an absence and adds a control that offers no choice. That is
why arch-A removed it when Tasks was scoped to billing, and it reclaimed 150px
above the list doing so (measured at 1280×900: the worklist scroller moved from
y=270 to y=120). A tab row reintroduced for one domain would spend that space to
say "there is nothing else here".

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
are the two emphasis channels, and the two emphasised elements on these surfaces
use one each so they never compete.
