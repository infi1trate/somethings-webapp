# `anno` — Gap log

Things that were required to proceed and were not available, what was done
instead, and how reversible it is. Format is PRD Appendix C. Append; do not
rewrite — a gap that later closes keeps its entry and gains a resolution, so the
reasoning stays readable.

---

## [anno-01] No KV store is provisioned for Path A

**Needed:** A hosted key-value store for the shared comment data. Path A was
chosen, and "shared" is the whole point of it.

**Missing:** anno-00 found no store wired and nothing has changed since: no
`.vercel/` linkage, no Vercel CLI installed, and no `KV_*`, `UPSTASH_*`,
`REDIS_*`, `POSTGRES_*` or `DATABASE_*` variable in `.env.local`, `.env.example`
or anywhere in `src/`. The Vercel dashboard was not reachable from here, so
whether an integration exists on the project side is still unconfirmed.

**Interim:** `src/lib/anno/server/kv.ts` is a two-driver port.

- **Upstash REST driver** — plain `fetch`, no new dependency, reads
  `UPSTASH_REDIS_REST_URL`/`_TOKEN` or the `KV_REST_API_*` aliases Vercel KV
  sets. It is written and typechecked but **has never been run against a live
  instance**, because there is no instance.
- **File driver** — `.anno-data/store.json` (gitignored), used when those
  variables are absent. Genuinely shared across browsers and devices hitting the
  same dev server, which is what makes this phase testable today.

**Fully reversible, and the reversal is an env var, not a code change.** Setting
the two Upstash variables switches the driver at next boot; nothing above the
port knows which one is live. `/api/anno` returns the active `driver` in its GET
payload so the UI can state it rather than assume.

**Two things that must happen before this ships anywhere real:** the file driver
does not work on Vercel (read-only filesystem outside `/tmp`, and serverless
instances do not share one — writes would fail or fragment per instance), and the
Upstash path needs one live round-trip before anyone trusts it.

**UPDATE — the second half is now largely closed.**
`src/lib/anno/server/upstash-driver.test.ts` runs the REAL `UpstashDriver` and the
REAL `repo.ts` against an in-process HTTP stub of Upstash's REST contract: 20
tests covering all six commands the driver issues, the bearer header, the
`{result}` envelope, `set` as a POST body rather than a URL, the empty-scan case,
and the repo's numbering, soft delete, restore, patch surface and reviewer upsert.

Mutation-tested rather than trusted: sending `set` as a GET with the value in the
URL fails 15 of 20; dropping the `{result}` unwrap fails 16; numbering from a
count instead of `incr` fails exactly 1 — the soft-delete case, which is the only
condition where a count diverges from a counter.

**UPDATE 2 — CLOSED. Provisioned, and exercised against the live service.**

Upstash is provisioned and the preview reports `driver: "upstash"` with both env
vars visible to the runtime. `/api/anno` now returns a presence-only `env` block
(booleans, never values) so a future fallback says WHY rather than just that it
fell back — diagnosing that from outside cost several blind redeploys.

Exercised end-to-end against the real service, not the stub:

| Check | Result |
|---|---|
| **6 genuinely concurrent creates** across separate serverless invocations | numbers **1–7 distinct and contiguous** — Upstash's `INCR` holds |
| Update with a spoofed `number: 999` | patched; **999 ignored**, number preserved |
| Soft delete → restore | `deletedAt` set then cleared, **number kept** |
| Reviewer upsert twice | **1 row**, latest name — a rename touches no comment |
| 1001-char body | **400** · `"A comment can be at most 1000 characters."` |

The concurrency result is the one worth keeping: those were parallel HTTP requests
that Vercel may have routed to different instances, all sharing one atomic
counter. That is the guarantee "comment 7" rests on, now measured on the real
service rather than argued from a stub.

`authorIpHint` also populates for the first time — Vercel supplies
`x-forwarded-for`, which localhost does not — and it stores truncated to /24 as
designed.

7 probe comments were retired afterwards; the store is empty and ready.

**Decision needed from:** Brandon / eng — provision Upstash or Vercel KV on the
project, or accept single-dev-server sharing for the demo cycle.

---

## [anno-01] `Reviewer.colorChip` has no design-system token to draw from

**Needed:** A per-reviewer colour value. `Reviewer.colorChip` is required by
Appendix A.

**Missing:** Bloom has no per-identity palette, and anno-00 established that
**every** high-visibility hue in the token set already carries meaning — red is
reserved for the alarm budget, tangelo is brand/focus/chart-1, blush is
escalation, apricot is risk, periwinkle is billing, forest/emerald is
monitoring, sky is info. There is no unclaimed ramp to allocate from.

**Interim:** Eight hard-coded hex literals in `identity.ts` (`CHIPS`),
deliberately **not** exposed as `--anno-*` custom properties, so nothing
downstream can mistake them for a sanctioned ramp. They are only ever a small
chip beside a name. They are **not** the pin fill — Appendix B specifies that
separately, and anno-04 measures its contrast.

**Reversible:** one array. Replacing it with real tokens touches one file.

**Decision needed from:** Brandon / design — either mint an `--anno-*` identity
ramp in `settings-tokens.css`, or confirm that reviewer chips stay outside the
design system as prototype-only chrome.

---

## [anno-01] Role spelling differs between Appendix A and the codebase

**Needed:** To write `context.role` on every comment.

**Missing:** Nothing was missing — the two spellings simply disagree. Appendix A
specifies `'mentor' | 'lead_mentor' | 'supervisor' | 'admin'` with an
**underscore**; the codebase has used `lead-mentor` with a **hyphen** since the
role migration (`src/lib/types.ts`, the dev bar's `PERSONAS`, `roleForPersona`).
Appendix A also has no counterpart for the fifth persona, `new-mentor`.

**Interim:** Appendix A is implemented verbatim — no renaming — and the
conversion is an explicit named function, `annoRoleFromPersona()` in
`types.ts`, rather than a cast at each call site. `new-mentor` maps to `mentor`,
which is what it is: a mentor who has not finished onboarding.

**Reversible:** one function, one file. If Appendix A should adopt the hyphen the
function disappears.

**Decision needed from:** Brandon — confirm the underscore is intended in the
stored data (a reasonable choice: it keeps the annotation record independent of
the product's own churn), or align Appendix A to the codebase spelling.

---

## [anno-01] "Failures return a typed error" — rejection vs. `Result`

**Needed:** An unambiguous failure convention before anno-02 builds call sites on
top of it.

**Missing:** The brief says failures must "return a typed error the UI can
render, not a thrown string," but the interface it specifies types every method
as `Promise<T>` — which has no room for a `Result` without changing signatures
the gate is meant to approve.

**Interim:** Signatures are exactly as specified, and failures **reject** with an
`AnnoError` — a real `Error` subclass carrying `code`, `retryable` and a
ready-to-render `userMessage`. Every adapter body funnels through
`normalize()`, so a thrown string, a `DOMException`, a `TypeError` from `fetch`
and a 500 all arrive as the same type. Verified: all 7 methods on both paths,
under both failure modes, reject with `AnnoError` and nothing else escapes.

**Reversible:** mechanically. Switching to `Promise<Result<T, AnnoError>>` is one
line per signature plus the call sites, and there are no call sites yet — which
is why it is cheap now and will not be after anno-02.

**Decision needed from:** Brandon — confirm typed rejection, or say `Result` and
I change it before anchoring lands.

---

## [anno-01] `AnnotationStore` needed four members the brief's interface does not have

**Needed:** Optimistic local echo with reconciliation, and a failed save that is
"recoverable with the draft intact" — both required by the brief.

**Missing:** Neither is expressible through the given interface. `create()`
resolves only after the round trip, so nothing can render sooner than the
network; and a rejected promise leaves the reviewer's text nowhere.

**Interim:** `AnnotationStoreExtras` — `subscribe()`, `pending()`, `retry()`,
`discard()` — declared **alongside** `AnnotationStore` rather than merged into
it, so the approved contract is untouched and visibly separate. Both
implementations satisfy it. Verified: a save that failed while the store was
unreachable kept its body, and `retry()` after recovery allocated number 10.

**Reversible:** the extras are additive; deleting them costs the optimistic path,
not the contract.

**Decision needed from:** Brandon — fold the extras into `AnnotationStore`, keep
them as a separate interface, or drop optimistic echo.

---

## [anno-01] Local-path comment numbers are not stable across reviewers

**Needed:** Numbering that supports verbal reference — "comment 7" meaning one
thing.

**Missing:** Nothing is missing on Path A, which was chosen: the server allocates
via an atomic counter and the numbers are global. **This entry documents the
fallback**, because the local store ships as the configured alternative and is
what runs if the shared store is unreachable.

**Interim:** `LocalAnnotationStore` allocates from a counter in that browser's
own `localStorage`. Two reviewers each writing three comments both produce 1, 2,
3 — so on the local path "comment 7" means **different comments to different
people**, and a verbal reference across a table is simply wrong. This is not a
defect in the implementation; it is what device-local numbering is.

**Reversible:** n/a — it is inherent to the path. The mitigation is that
`kind === 'local'` is readonly and cannot be configured to report `'shared'`, so
the UI is structurally prevented from presenting local comments as shared.

**Decision needed from:** Brandon — confirm the drawer copy for the local case
(anno-05), which must say the comments are on this device only, that clearing
browser data destroys them, and that numbers are not shared.

---

## [anno-02] The three tiers had to be interpreted, not just implemented

**Needed:** An unambiguous rule for which tier a resolution lands in.

**Missing:** The brief says to try `elementRef` → structural path → coordinates
"in order", which reads as three independent lookups. But the structural path is
specified as "a bounded CSS path **from the nearest tagged ancestor**" — it cannot
be attempted when that ancestor is missing, so the three are not alternatives.

**Interim:** Implemented as a degradation ladder, which is the only arrangement
where all three tiers can fire. `elementRef` surviving separates tiers 1–2 from 3;
`structuralPath` surviving separates 1 from 2. Both forced and observed in the
verification run: removing a descendant produced tier 2, removing the region
produced tier 3.

**Reversible:** one function (`resolveAnchor`).

**Decision needed from:** Brandon — confirm the ladder, or state the intended
independent-lookup semantics.

---

## [anno-02] A repeated tag name resolved four pins onto the same row

**Needed:** An `elementRef` that identifies one element.

**Missing:** Nothing was missing — the first implementation was wrong. Names were
recorded as a chain of tagged ancestors, and `data-anno-ref="task-row"` repeats on
every mounted row of the worklist. `querySelector` returns the first match, so
**four pins placed on four different tasks all captured
`app-main/tasks-worklist-scroller/task-row` and all resolved to the same row**,
three of them at identical coordinates — while reporting **tier 1**. A confident
pin on the wrong task, with nothing on screen to show it.

**Interim:** Two fixes, both landed and re-verified.

1. `captureAnchor` now walks inward to the **deepest prefix of the chain that
   matches exactly one element**, and describes everything below it with the
   structural path. If no prefix is unique, capture is refused rather than
   producing an anchor that resolves to an arbitrary sibling.
2. `resolveAnchor` treats a multi-match as an **orphan**, never index 0.
3. Rows that repeat now carry per-instance identity — `task-row:${item.id}`,
   `conversation-row:${thread.id}`.

After the fix the same four pins resolve exactly while mounted and orphan
honestly when the virtualizer unmounts them: 4 tier-3, 0 misattachments.

**Not reversible, and should not be** — this is a correctness floor.

**Decision needed from:** nobody. Recorded because the failure is invisible by
construction, and any future tag added to a repeating element will reintroduce it
unless it carries an id.

---

## [anno-02] Orphan rate exceeds the PRD kill criterion — 11.2%

**Needed:** A whole-exercise orphan rate at or below 10%.

**Missing:** It measured **11.2%** (13 orphans / 116 evaluations). The criterion
fires. The number decomposes sharply, and the decomposition is the finding:

| Condition | Evaluated | Orphans | Rate |
|---|---|---|---|
| Structural — placement, resize, reload, route change | 66 | 0 | **0.0%** |
| Content change — scenario switch, load state, virtualized scroll | 42 | 12 | **28.6%** |
| Forced destruction — element deleted by hand | 8 | 1 | 12.5% |

Anchoring is not failing structurally: across 66 evaluations spanning two
breakpoints, four routes and a full reload, **zero** pins orphaned and **zero**
drifted. Every orphan came from the annotated content genuinely no longer being
on the page — a task row the virtualizer unmounted, a worklist replaced by an
error state, a scenario whose task ids differ.

**Interim:** None. This is the gate; no interim was applied and no scope was
narrowed unilaterally.

**Decision needed from:** Brandon — this is the anno-02 gate call. The options
that the measurement supports are (a) restrict placement to stable regions, where
the measured rate is 0.0%, (b) accept high orphan rates on data-bound elements as
correct behaviour and revise the criterion to exclude content change, or (c)
rethink anchoring for data-bound content — which would mean anchoring to a
DOMAIN id (task id, thread id) rather than to the DOM, a different mechanism from
the one this phase built.

---

## [anno-02] A tag on a component boundary is silently dropped

**Needed:** `data-anno-ref="app-rail"` on the sidebar.

**Missing:** It was applied to `<SettingsSidebar …>`, which takes named props only
and does not spread rest props — so the attribute never reached the DOM and the
tag simply did not exist. Caught only because the tag inventory on `/app/chat`
came back without it.

**Interim:** Moved onto the `<aside>` inside `sidebar.tsx`. Every other tag was
verified present by inventory rather than assumed.

**Reversible:** n/a — fixed.

**Decision needed from:** nobody. Recorded because it fails silently and will
recur: a tag must go on a DOM element, never on a component, unless that
component is known to forward unknown props.

---

## [anno-02] The pin hue is not a design-system token

**Needed:** A bright annotation hue for the pin fill, per Appendix B — "not red,
not any semantic color already claimed".

**Missing:** anno-00 established that no high-visibility hue in Bloom is
unclaimed. Violet is the least conflicted: its only claims (`--doodle-purple`,
`--preview-accent`) never appear on staff console chrome.

**Interim:** `#7b5bd6` as a literal in `anno-spike-layer.tsx`, deliberately not a
`--anno-*` custom property so nothing downstream mistakes it for a sanctioned
token. Contrast against light and dark content is **not yet measured** — Appendix B
assigns that to anno-04.

**Reversible:** one constant.

**Decision needed from:** Brandon / design — mint an `--anno-pin-*` token trio
(fill, stroke, edge), or confirm the pin stays outside the system as prototype
chrome.

---

## [anno-02] Screenshot evidence is only obtainable at small viewports

**Needed:** A screenshot of the anchor-lost treatment, per the verification list.

**Missing:** The Browser pane does not support region cropping (`zoom` returns the
full frame), and a 1440×900 viewport renders at roughly 235px of content — far
below legibility. This has been true in every phase of this session.

**Interim:** The screenshot was taken at **560×420**, where the pane renders
800×599 and the treatment is legible: dashed violet ring, the label "Anchor lost —
showing last known position", and the Delete control. Everything else in this
phase is reported as DOM measurement rather than as an image.

**Reversible:** n/a — an environment limit, not a code decision.

**Decision needed from:** nobody. Recorded so that "screenshot at 560×420" is
understood as the available evidence, not a chosen framing.

---

## [anno-02] RESOLUTION — gate answered (a): placement restricted to stable regions

**Needed:** A decision on the 11.2% orphan rate. Brandon chose **(a) restrict
placement to stable regions**.

**Missing:** A definition of "stable" that was measured rather than asserted. It
was obtained empirically: every tagged region on `/app/tasks` was probed across
`ready` / `error` / `loading` and two scenarios. Result — only the shell
(`app-main`, `app-rail`, `app-topbar`, `app-bottom-nav`) survives **all** of them;
`tasks-worklist-scroller`, `task-pane` and `task-row:*` all vanish in the error
state. That is why load→error orphaned 5 of 7 and not the 4 row pins alone.

**Interim — implemented, not interim:** placement is refused inside any element
that is record-bound, i.e. carries `data-anno-volatile` **or** whose name contains
a per-instance id (`task-row:task-2`). `whyRefused()` distinguishes "volatile"
from "untagged" so the anno-03 placement UI can say which.

**Refusal rather than a fallback, and that was the load-bearing choice.** Both
degradations lie. Anchoring to the stable ancestor via a structural path gives
`div:nth-of-type(k)`, and in a virtualized list k addresses a *window position*,
not a row — scroll and the same path resolves to a different task, which is the
misattachment defect reintroduced by another route. Dropping the path and pinning
at a fraction of the container is no better: the container's box is fixed while
rows scroll underneath, so the pin sits still while its subject moves away.

**Measured outcome — the identical exercise, re-run from a clean store:**

| Condition | Before | After |
|---|---|---|
| Whole exercise | **11.2%** (13/116) | **3.1%** (3/98) |
| Structural (placement, resize, reload) | 0.0% | **0.0%** (0/52) |
| Content change | 28.6% | **5.6%** (2/36) |
| Virtualizer scrolled away | 57.1% | **0.0%** |
| Scenario switch | 42.9% | **0.0%** |
| Load state → error | 71.4% | 33.3% |

Row placement is refused 7/7 attempts (4 task rows, 3 conversation rows) and no
record-bound anchor exists in the store. Drift remains **0** across every resize.

**The kill criterion no longer fires. Two orphan sources remain, both correct:**

1. **Load state → error, 2 of 6.** The worklist container itself is removed in
   that state, so a pin anchored to it has nothing to hold. No placement rule can
   prevent this, and the pin reporting "anchor lost" is the truthful outcome. It
   is also a dev-harness state, not something a reviewer sits in.
2. **Forced deletion, 1 of 5.** The element was deleted by hand to prove tier 3
   renders. By design.

**What this costs, and it is not small:** **an individual task or conversation can
no longer be annotated.** A reviewer can pin the worklist, the task pane, the
conversation list or the composer — but not "this row". For a review tool whose
subject is often a specific record, that is a real limitation and it should be a
conscious trade rather than a discovered one.

**Decision needed from:** Brandon, before anno-03 — accept that limitation, or
schedule the domain-id anchoring from option (c) as a later phase so that
record-level annotation becomes possible without going through the DOM.

---

## [anno-02] CLOSED — the row-annotation limitation is accepted

**Needed:** A call on the one cost the (a) restriction carries: an individual task
row or conversation row cannot be annotated.

**Missing:** Nothing. The decision was outstanding; it no longer is.

**Resolution:** Brandon accepted it. Pins attach to stable regions only — the
worklist, the task pane, the conversation list, the composer, the record's
sections and the shell. Annotating "this row" is out of scope for the DOM-based
mechanism and is not a defect to be worked around.

**Consequence for anyone picking this up later:** the refusal in `captureAnchor`
is load-bearing and must not be softened into a fallback. Both fallbacks were
measured and both misattach — a structural path into a virtualized list addresses
a window position rather than a row, and a container-fraction pin holds still
while its subject scrolls away. The one route to record-level annotation is
option (c), domain-id anchoring, which does not resolve through the DOM. It is
**not scheduled**; it would be a new phase, not a patch to this one.

**Decision needed from:** nobody. Closed.

---

## [anno-04] The layer sits above dialogs, and the PRD did not decide that

**Needed:** A z-index for the layer, and a rule for what happens when a modal is
open.

**Missing:** anno-00 flagged this as Risk 5 and asked the PRD to settle it; it
did not. `z-50` is a crowded FLOOR shared by six component families (dialog,
popover, select, dropdown-menu, the survey tooltip, the dev bar) with nothing
above it, and Radix portals append to `document.body` in mount order — so equal
z-index would make the winner depend on when a menu happened to open.

**Interim:** the layer is `z-60`, above all of them. Chosen deliberately: a modal
is exactly where a reviewer most wants to leave a comment, and suppressing the
layer beneath one would make dialogs the only part of the product that cannot be
annotated.

**The cost, stated:** while Place mode is armed the capture surface also covers an
open dialog, so the dialog is unclickable until Esc. In View mode nothing is
covered — the root is `pointer-events: none`.

**Reversible:** one constant, plus a rule if suppression is wanted.

**Decision needed from:** Brandon — confirm the layer stays above modals, or
specify suppression (which would need a way to detect an open dialog, since
Radix does not expose one globally).

---

## [anno-04] Appendix B says "dark outer edge"; a dark edge fails its own contrast bar

**Needed:** An outer edge clearing 3:1 (SC 1.4.11) against both `#FFFFFF` and
`#000000`, per the verification list.

**Missing:** Those two requirements are incompatible with "dark". Measured,
`#1f1e1d` — the token a dark edge would use — is **1.26:1 against black**. No
dark value can pass: the arithmetic requires relative luminance between 0.10 and
0.30, which is a mid-tone.

**Interim:** the outer edge is **`--text-muted` `#6e6b67`**, an existing Bloom
token with luminance 0.148 — **5.30:1 on white, 3.96:1 on black**, both passing.
The 2px light stroke is retained inside it, so the dark-background case still has
a 21:1 boundary with far more margin than the requirement.

**Reversible:** one constant. But reverting to a dark edge reintroduces a
measured 1.26:1 failure, so it should not be reverted without changing the
requirement.

**Decision needed from:** Brandon / design — amend Appendix B's wording from
"thin dark outer edge" to "thin mid-tone outer edge", or drop the both-backgrounds
requirement and accept the light stroke as the dark-background boundary.

---

## [anno-04] The pin's fill and edge are still not design-system tokens

**Needed:** Tokens for the annotation hue.

**Missing:** Unchanged from anno-01 and anno-02 — no high-visibility hue in Bloom
is unclaimed, and minting `--anno-*` is a design decision.

**Interim:** literals in `pin.tsx`, now with measured values behind them: fill
`#7b5bd6` (violet, the least-conflicted hue — its only claims are the doodle ramp
and the teen phone-preview accent, neither adjacent to staff chrome), light stroke
`#ffffff`, outer edge `#6e6b67` (a real token, used as a literal here so the trio
lives in one place).

**Reversible:** three constants, one file.

**Decision needed from:** Brandon / design — mint `--anno-pin-fill`,
`--anno-pin-stroke`, `--anno-pin-edge`, or confirm the pin stays outside the
system as prototype chrome.

---

## [anno-04] anno-03's slot reservation was 46px short

**Needed:** A reservation that fits the real annotation cluster.

**Missing:** anno-03 reserved 132px/60px from an estimate ("two 28px controls, a
count badge and the gaps"). The real cluster is a three-option radiogroup plus the
badge: measured **155px expanded, 106px collapsed**. At 900px the badge visibly
overlapped group 4's divider.

**Interim — resolved, not interim:** set to **168/120** from the measurement, in
both the constants and the literal class. `devBarSlotWidthsAgree()` guards the
two against drifting apart. Verified: no overflow at 1440 or 900, and the other
three groups keep their positions.

**Cost:** the status line loses ~36px at 1440. It still cuts at a word boundary
and still expands on click.

**Decision needed from:** nobody. Recorded because the estimate was wrong and the
exports existed to force exactly this conversation.

---

## [anno-04] A read that notified turned two subscribers into a fetch loop

**Needed:** Subscribers that react to store changes.

**Missing:** Nothing — the anno-01 contract had a defect that only a second
subscriber exposed. `SharedAnnotationStore.list()` called `#emit()`, and both of
anno-04's subscribers (the layer and the mode control's count) responded to a
change by calling `list()`. list → emit → list → emit, one HTTP request per turn.

It exhausted the browser's socket pool in seconds: `net::ERR_INSUFFICIENT_RESOURCES`
on every request in the tab, including page navigation. The symptom presented as
"Couldn't reach the comment store" — the store's own honest error message, for a
cause that was entirely client-side. It cost two failed save attempts and a
browser tab before the console errors named it.

**Interim — fixed:** `list()` no longer emits (a read has no business notifying,
and it returns its data to the caller anyway), only writes do; `snapshot()` was
added to `AnnotationStoreExtras` and both implementations provide it; both
subscribers now read the cache synchronously.

**Not reversible, and should not be** — restoring the emit re-creates the loop.

**Decision needed from:** nobody. Recorded because the failure mode was
self-disguising: an unbounded client loop that reports itself as a server outage.

---

## [anno-05] The focus trap and "tab through the prototype underneath" cannot both hold

**Needed:** Two things the brief asks for together — a focus trap while the drawer
is open (R6), and a focus-not-obscured check (SC 2.4.11) performed by "tabbing
through the prototype underneath".

**Missing:** They are mutually exclusive. A trap exists precisely to stop Tab
reaching the prototype, so the second test cannot be run while the first
requirement is met.

**Interim:** the trap ships, and 2.4.11 is verified the only way that is
meaningful for a modal panel — by measuring what a forced focus WOULD hit.
Measured with the drawer open at 1280×860: **6 interactive controls sit
geometrically behind the 352px panel** (two provenance triggers, three timeline
entries, one flag row), and **none is reachable by Tab** — the tab order wraps
inside the drawer, confirmed with 16 real key presses.

So obscuration is prevented by the trap rather than by geometry. If the trap were
ever removed or defeated, those six would be focusable behind the panel.

**Reversible:** n/a — a reporting decision, not a code one.

**Decision needed from:** Brandon — confirm this reading, or state that the
drawer should be non-modal (no trap), in which case those six controls need
either `inert` on the prototype or a scroll-into-view offset.

---

## [anno-05] Undo is keyboard-reachable from the row, not from the toast

**Needed:** Every action available on a pin reachable without a pointer, and a
10s undo on delete.

**Missing:** sonner renders its toast outside the drawer's DOM subtree, so the
toast's own Undo button is **outside the focus trap** — a keyboard reviewer
cannot Tab to it. Building undo only into the toast would have made delete the
one lifecycle action with no keyboard recovery.

**Interim — by design, not a workaround:** the row itself carries an **"Undo
delete"** button while the comment is inside its undo window, and it is in the
drawer's tab order (verified). The toast is the pointer affordance; the row is
the keyboard one. Both call the same `restore`.

**Reversible:** the row button is the accessible path and should not be removed.

**Decision needed from:** nobody. Recorded because the toast looks like the undo
affordance and is not the accessible one.

---

## [anno-05] Another tab's delete is seen at the next read, not immediately

**Needed:** "Delete a comment in one tab while it's open in another. It must not
crash or blank."

**Missing:** There is no cross-tab channel — no `BroadcastChannel`, no polling,
no server push. The store is HTTP request/response.

**Interim:** the drawer diffs on every `load()`, which runs at open and after any
lifecycle action. Measured across two tabs: tab B deleted comment 79; tab A
**did not crash and did not blank** — it kept showing 79 as `open` (stale) until
its next read, at which point the row rendered the **`removed-elsewhere`** state:
"Comment 79 was deleted by another reviewer", body struck through, actions
removed so nothing can be acted on that no longer exists.

A filter change is local state and triggers no read, so it does not surface the
change — which is honest but means staleness can persist while a reviewer only
scrolls and filters.

**Reversible:** adding `BroadcastChannel` (same-origin, no server) or a poll would
close the window; both are additive.

**Decision needed from:** Brandon — accept read-triggered detection, or schedule
`BroadcastChannel` so two reviewers on one machine see each other live.

---

## [anno-05] "Page no longer exists" is decided by a prefix list, not a route registry

**Needed:** To group comments whose route the app no longer serves.

**Missing:** Next exposes no client-side registry of served routes, so "does this
path still exist" cannot be asked at runtime.

**Interim:** a prefix allowlist in `anno-drawer.tsx` (`/app`, `/admin`,
`/onboarding`, `/hub`, `/invite`, `/gate`, `/dev`, and `/`). Anything else is
grouped as gone. Correct for a genuinely deleted page; it would produce a **false
positive for a new top-level route added after this list**, which is the failure
mode to watch.

**Reversible:** one array. A generated list from the `src/app` tree would be
exact and is a build-step change, not a runtime one.

**Decision needed from:** Brandon / eng — leave the list hand-maintained, or
generate it at build time from the route tree.

---

## [anno-05] An edit's draft was thrown away by a failed save

**Needed:** "Confirm the draft body is still in the field after the error
renders."

**Missing:** Nothing was missing — the first implementation was wrong. `CommentRow`
called `onAction(...)` and then `setEditing(false)` unconditionally, so the editor
closed the instant Save was pressed. When the store rejected the write, the error
rendered against a row that had already discarded the text. Measured:
`draftPreserved: false`.

**Interim — fixed:** `onAction` now returns `Promise<boolean>` and the row closes
its editor **only on a committed save**. Re-measured under a forced write failure:
editor still open, `draftPreserved: true`, error rendered beneath the retained
text.

**Not reversible** — returning to fire-and-forget re-creates the data loss.

**Decision needed from:** nobody. Recorded because the composer (anno-04) already
preserved its draft on failure, and the edit path is separate code that did not —
the same requirement, missed once per surface.

---

## [anno-06] "Set state before the route renders" is only achievable client-side — measured flash remains

**Needed:** Dev bar state applied before the route renders, so the reviewer never
watches the wrong screen become the right one.

**Missing:** The server cannot know any of it. The role lives in a
`localStorage`-backed zustand store, so SSR has no access, and the app already
guards every read behind `useMounted()` for that reason —
`mentor-shell.tsx:70` renders `mounted ? persona : "mentor"`. So the first paint
is always the default persona's screen, deeplink or not.

**Interim:** `deeplink.ts` applies role/scenario/load as a **module side effect at
import**, before React renders. That removes the SECOND correction — an
effect-based version would land a commit later and show two transitions.

**Measured, with a temporary in-`<head>` rAF sampler (since removed):**

| Link | FCP | corrected at | visible flash | rail changed? |
|---|---|---|---|---|
| `role=admin` | 200ms | 301.4ms | **101.4ms** | yes (activity badge) |
| `role=lead-mentor` | 376ms | 454.7ms | **78.7ms** | **yes — Mentees present, then gone** |

Only **two** distinct states were sampled in each run, confirming a single
correction rather than a cascade. But the `lead-mentor` case is unambiguous: the
**mentor rail paints first** and the reviewer sees Mentees disappear ~79ms later.
So the requirement is **not fully met**, and the residue is the app's existing
mount-gate, not the deeplink mechanism.

**Reversible / closable:** removing the flash requires the persona to be known at
render time — a cookie the server can read, or suppressing the shell until
mounted. The first changes the store's architecture; the second trades a flash for
a blank.

**Decision needed from:** Brandon — accept ~80–100ms, or schedule a
cookie-mirrored persona so SSR can render the right rail.

---

## [anno-06] An invalid param left the previous value standing

**Needed:** "Scenario/load values no longer valid → fall back to defaults."

**Missing:** Nothing — the first implementation was wrong in a way only the test
exposed. It skipped an unrecognised value, leaving the axis as the store had it.
Measured: a link carrying `load=sideways` landed showing **`error`**, because an
earlier session had persisted `error`. The same link would have produced a
different screen for a different person, which is precisely what a deeplink
exists to prevent.

**Interim — fixed:** an unrecognised value now RESETS its axis to the documented
default and is still reported. Re-measured: `load=sideways` → `ready`, notice
reads "2 link settings were ignored. load=sideways — not a load state this
prototype has; scenario=not-a-real-scenario — not a scenario this screen has."

The record scenario axis is the exception: it lives in the URL, which cannot be
rewritten without a navigation. The dev bar already renders an unknown value as
"— none —", which is that axis's default.

**Decision needed from:** nobody.

---

## [anno-06] The pin shipped with no focus ring at all

**Needed:** "Reduced motion gets a static focus ring, not a pulse."

**Missing:** There was no ring to fall back to. The pin built in anno-04 carried
no focus treatment — measured `outlineStyle: "none"`, no `focus-visible` class —
so a keyboard reviewer focusing a pin saw **nothing** (SC 2.4.7). anno-04's own
verification measured hit area and contrast and never focused a pin, which is how
it got through.

A second measurement compounded it: `.focus()` called from script does **not** set
`:focus-visible` (`matchesFocusVisible: false`), so adding a focus-ring class
alone would still draw nothing for an arriving reviewer.

**Interim — fixed, both halves:** the pin now carries the repo's `RING` classes
for keyboard focus, and the deeplink target is **selected** on arrival, which
draws a real 3-layer boxShadow ring that does not depend on the browser's
heuristic. Verified: 3 ring layers present, `animationsRunning: 0` under the
reduced-motion predicate.

**Decision needed from:** nobody. Recorded because it was a WCAG failure shipped
in a phase whose verification list did not ask about focus.

---

## [anno-06] The pulse borrows a duration because there is no motion module

**Needed:** "Use existing motion constants."

**Missing:** There are none. anno-00 established the repo has no `lib/motion.ts`;
durations are written inline per component.

**Interim:** the pulse is 800ms with `cubic-bezier(0.4, 0, 0.2, 1)`, taken from
`care-timeline.tsx`'s targeted-row flash — the closest existing precedent, and
the same job. Driven through the **Web Animations API** rather than a new
keyframe, which also avoids the risk that an appended `globals.css` rule never
reaches the served bundle (a failure this codebase has already had).

**Decision needed from:** Brandon / design — mint `lib/motion.ts`, or leave motion
per-component as the repo does today.

---

## [anno-06] The copy-link SUCCESS path could not be verified

**Needed:** A copy affordance whose confirmation says `Link copied`.

**Missing:** The Clipboard API requires transient user activation. A programmatic
`.click()` does not provide it, so every scripted attempt returned
`NotAllowedError`, and I could not land a reliable real pointer click at the
Browser pane's scaled coordinates.

**Interim:** the FAILURE path is verified and is the half that matters — the
control reports **"Couldn't copy — select the link and copy it manually"** rather
than a false "Link copied", because the confirmation is driven by the clipboard's
own result and not by the click. The success branch is one line from the same
boolean.

The substantive requirement — **what the link contains** — was verified directly:
`role`, `scenario`, `load`, `comment` only. No client id, no display name, no
`authorIpHint`. The route carries its own record id (`/admin/person/t19`), which
is the page's URL rather than anything the link adds.

**Decision needed from:** nobody — but "Link copied" should be confirmed by hand
before anyone relies on it.

---

## [anno-07] Two pins on one anchor sit at a 0px gap — R17 is load-bearing, not polish

**Needed:** Adjacent pins distinguishable and individually reachable.

**Missing:** Clustering (R17), which the brief scopes to anno-08.

**Measured:** with 37 pins on one page, the closest pair (83 / 84) has a
**0px centre-to-centre gap** — placed on the same anchor at the same fraction,
they are exactly co-located and **one is unreachable by pointer**.

Both pins satisfy SC 2.5.8's 24×24 size clause, and its spacing clause applies to
*undersized* targets, so this is not strictly a 2.5.8 failure. It is a usability
failure regardless of which clause it falls under.

**Interim:** none. The drawer is the mitigation — every comment is reachable there
by keyboard and pointer regardless of pin overlap, which is why the drawer is P0.

**Decision needed from:** Brandon — this is the measured case for anno-08. Worth
knowing before the review cycle: two reviewers commenting on the same element will
produce a pin only one of them can click, and they will have to use the drawer.

---

## [anno-07] Appendix B's "dark outer edge" needs amending, not implementing

**Needed:** A wording change, so the code and the spec agree.

**Missing:** Appendix B says "thin **dark** outer edge" and the verification list
requires the outer edge to clear 3:1 against **both** `#FFFFFF` and `#000000`.
Those are incompatible: `#1f1e1d` measures **1.26:1 against black**. Only
luminances between 0.10 and 0.30 satisfy both.

**Interim — shipped:** the edge is `--text-muted` `#6e6b67` (luminance 0.148) —
**5.30:1 on white, 3.96:1 on black**. An existing Bloom token, not an invented
value.

**Decision needed from:** Brandon / design — amend Appendix B to "thin mid-tone
outer edge", or drop the both-backgrounds requirement and accept the light stroke
as the dark-background boundary. The code is correct either way; the spec is what
is now wrong.

---

## [anno-07] Screenshot evidence remains partial across the whole feature

**Needed:** "One screenshot per state", across anno-04, -05 and -07.

**Missing:** The Browser pane's screenshot pipeline is unreliable in a way that
got worse as the session ran: the same viewport renders at 45% or 89% scale
between consecutive calls, returns stale frames, and errors intermittently
(`UnknownVizError`). It does not support region cropping, so a 24px pin cannot be
enlarged.

**Interim:** `STATES.md` labels every row `shot` or `dom`, so a reader can see
which states have an image behind them and which rest on attribute and
computed-style measurement. Legible screenshots exist for the drawer populated
(including greyscale), empty, filtered-empty, store-unreachable, the deeplink
arrival, the anchor-lost pin, and pins over a white surface.

**Not obtained legibly:** pins over a dark surface, over a photo, and over a busy
data table; the composer's five states; the row's deleted-by-someone-else state.

**Decision needed from:** Brandon — if any of those need visual sign-off before
the review cycle, they need a human to look at the running app. The states
themselves are verified; what is missing is the picture.

---

## [anno-mvp-1] FIXED — pins from one page stayed painted on the next

**Found by:** Brandon, first review cycle, on the deployed preview. A comment
written on `/app/mentees` was visible on `/app/activity`.

**What was wrong:** `AnnoLayer` is mounted once in the ROOT layout and is not
remounted by a client-side navigation. Its load-and-position effect was keyed on
`[mode]` alone, and the route was read imperatively inside the projection as
`window.location.pathname`. That value is live at the moment it is read — but on a
navigation nothing re-read it, because nothing re-ran.

**Measured before the fix:** four pins written on `/admin/person/t13` stayed
painted on `/app/mentees` at IDENTICAL viewport coordinates — `270/341`,
`360/411`, `460/491`, `115/89`. Not re-anchored to the new page; frozen.

**The second half, same root cause:** `reposition` re-projected from `prev` — the
already-filtered on-screen set — which made the route filter ONE-WAY. The first
scroll or resize after a navigation correctly dropped the previous page's pins,
and every later reposition started from that emptied list, so they could never
come back. Measured: leaving `/admin/person/t13`, scrolling once, then navigating
back showed **0 of its 4 comments**. The one page guaranteed not to show a comment
was the page it was written on.

**Fixed:** the route comes from `usePathname()` (already the layout-level idiom —
the sibling `DevBar` reads it the same way) and is a dependency of the effect;
`reposition` re-projects from `store.snapshot()`, so the filter is reversible.
`create` records `route: pathname` too, so the value stored is the same one pins
are filtered against.

**Verified:** t13 → mentees → tasks → t13 shows 4 → 0 → 0 → 4, returning to the
identical coordinates; a fresh comment placed on `/app/mentees` stores
`route: "/app/mentees"`, renders there, and renders nowhere else.

**Still open — no component test covers this.** `vitest.config.ts` is node-only by
an explicit decision ("a component-testing stack is a separate decision"), so
there is no DOM to navigate. The bug is a React dependency bug plus a state-
narrowing bug; a pure `comment.context.route === pathname` predicate test would
pass against the BROKEN code, so it would be theatre rather than a guard. Adding
jsdom + testing-library would make this class of bug testable and would cover the
layer's other DOM-dependent behaviour (Esc ladder, focus trap, capture surface).

**Decision needed from:** Brandon — whether a component-testing stack is in scope
for anno-08. It is the only way this regression gets a real guard.

---

## [anno-mvp-2] The drawer lists every page's comments — by design, now questioned

**Raised by:** Brandon, same report. The drawer on `/app/activity` shows a
`/app/mentees` group.

**Current behaviour, deliberate:** the drawer is a cross-page review list, grouped
by route with the path as a sticky header, live routes alphabetical and
`Page no longer exists` last. It is also the keyboard-accessible half of the
feature (SC 2.1.1) and the surface a deeplink lands on, so a comment on a route
that is not the current one still has to be reachable and readable there.

**What scoping it to the current page would cost:** the `Page no longer exists`
group becomes unreachable; the `total` count and the filtered-empty copy
("There are N comments, but the Unresolved filter is hiding them") start counting
only one page; and a reviewer loses the one view that answers "what has been said
about this prototype".

**Decision needed from:** Brandon — leave as is, or add a `This page / All pages`
scope to the filter row. The latter is a feature, so it belongs in anno-08 with
the rest of the fast-follow set, not in this fix.

---

## [anno-mvp-3] FIXED — every comment anchored to the whole content area

**Found by:** reading the production store after the first (aborted) review cycle.
**All 10 comments ever placed on production** — across two routes and two
reviewers — carried `elementRef: "app-main"`. Not one landed on a card, panel or
control.

**Why:** the anchor vocabulary was 20 names, and 14 of them were on Chat, Tasks
and the Care tab. Measured per route, under the SUPERVISOR persona (the mentor
branch renders different components, and an earlier count taken under `mentor`
understated Tasks by two):

| Route | Stable content tags, before |
|---|---|
| `/app/chat` | 4 |
| `/app/tasks` | 2 |
| `/admin/person/[id]?tab=care` | 3 |
| `/app/mentees` · `/app/activity` · `/app/team` · `/admin/person/[id]` other tabs | **0** |

With nothing tagged between the page root and the leaf, `captureAnchor`'s
deepest-unique-prefix walk had exactly one candidate on those routes: `app-main`.

**What that cost, in the reviewers' own data:** comment 9's `structuralPath` is
`… > table > thead > tr > th:nth-of-type(5) > button` — the reviewer was pointing
at a column-sort button. Comment 8, the only substantive one ("This is bad"), has
`structuralPath: null`, so there is no record at all of what "this" was. It points
at a 1302×700 rectangle.

**Fixed:** 15 new region names on the untagged surfaces —
`roster` / `roster-filters` / `roster-table`, `review-queues`,
`team-directory` / `team-filters` / `team-table`,
`activity-ledger` / `activity-view-rail` / `activity-feed`,
`tasks-header` / `tasks-domain-tabs`,
`record-tabs` / `record-panel`, `record-overview` / `record-account`.
Vocabulary 20 → 35. Every name is a plain `data-anno-ref` on a real DOM element,
inert: no styling, no layout, no behaviour.

**`DataView` needed a prop, not an attribute.** It destructures a closed prop list
and spreads nothing, so `data-anno-ref` written at the call site would have been
SILENTLY DROPPED — the same component-boundary failure anno-02 measured. It now
takes an optional `annoRef`, written onto its real root. Absent by default, so its
one other consumer is byte-identical.

**Rows are still deliberately untagged.** No new name contains `":"`, and no feed
row, roster row or directory row was given one. Annotating a record-bound row
stays refused per the accepted anno-02 trade — this phase widens the vocabulary of
PLACES, not of records.

**Verified** by placing 13 comments through the real capture path and reading back
what the store recorded:

| Clicked | Region captured | Element inside it |
|---|---|---|
| mentees filter bar | `app-main/roster/roster-filters` | `select:nth-of-type(1)` |
| mentees table header | `app-main/roster/roster-table` | `tr > th:nth-of-type(4)` |
| mentees table cell | `app-main/roster/roster-table` | `tr:nth-of-type(2) > td:nth-of-type(4)` |
| mentees heading | `app-main/roster` | `h1` |
| activity view rail | `app-main/activity-ledger/activity-view-rail` | `button:nth-of-type(1) > span` |
| activity feed | `app-main/activity-ledger/activity-feed` | `li:nth-of-type(3) > button` |
| team filters | `app-main/team-directory/team-filters` | `button:nth-of-type(1)` |
| team table | `app-main/team-directory/team-table` | `th:nth-of-type(3) > button` |
| tasks header | `app-main/tasks-header` | `div > h1` |
| tasks domain tabs | `app-main/tasks-domain-tabs` | `button > span:nth-of-type(2)` |
| record tab row | `app-main/record-tabs` | `nav > button:nth-of-type(1)` |
| record panel | `app-main/record-panel` | `div > section:nth-of-type(1)` |
| care summary panel | `app-main/record-panel/care-summary-panel` | `div > div:nth-of-type(1)` |

**12 of 12 on a specific region; 0 fell back to `app-main`.**

**No regression on existing anchors.** `record-panel` now sits between `app-main`
and the Care sections, but resolve uses a DESCENDANT selector, so the old chain
`app-main/care-summary-panel` still matches exactly one element — measured, and
all 7 pins on `/admin/person/t13?tab=care` resolve with 0 orphans. The Care tab
also still wins as the deeper unique prefix, so it gained precision rather than
losing it.

**Not measured:** whether a wider vocabulary changes the orphan RATE over time.
anno-02's spike measured 3.1% against the old vocabulary; the new regions are
structural containers rather than leaf content, which should hold or improve it,
but that is reasoning and not a measurement. Worth re-running the spike after a
real cycle.

---

## [anno-08] R17 clustering built — and it is the 2.5.8 mitigation, not polish

**Authorised by:** Brandon, with the framing that settled the priority —
"clustering is the mitigation for [the 24px spacing requirement], so it's an
accessibility item, not just polish."

**Built:** `src/lib/anno/cluster.ts`, pure, with `cluster.test.ts` (17 tests).
Pins whose centres are within `CLUSTER_RADIUS` (30px, the pin's own width — closer
than that and the discs overlap) collapse into one badge; the badge expands to fan
its members onto a ring.

**The guarantee is arithmetic, not observed.** `fanOut` derives the ring radius
from the separation the caller requires — for `n` points on a circle the closest
pair is adjacent at `2·r·sin(π/n)`, so `r ≥ (sep/2)/sin(π/n)`, floored at `sep` to
keep the centre's collapse control clear. The test sweeps `n` from 2 to 12 at both
the 34px the layer asks for and the 24px criterion floor. **Three mutations were
run against it** — removing the radius floor, `sin`→`tan`, and the boundary
`<=`→`<` — and each was caught, so the tests are guards rather than decoration.

**Measured live**, three comments on `/app/team` expanded: minimum gap **34.0px**
(badge↔member) and 58.9px (member↔member) against a 24px floor. Collapsed: **0**
pins and one 36×36 badge, so there is nothing to occlude. The live DOM matched
`fanOut(3, 34)` exactly.

**Told apart from a pin without colour (SC 1.4.1):** a cluster shows a COUNT and a
pin shows a NUMBER, and both are small integers — so three non-colour signals
separate them. The badge is larger (36 vs 30), it carries a second disc behind it
so the silhouette is a stack, and its accessible name says "3 comments here" in
words.

**Discovered while testing, worth recording:** you cannot stack a comment on an
existing pin by clicking. The pin intercepts the hit test, so `elementFromPoint`
returns the pin, which is untagged, and Place refuses with "Nothing to anchor to
here". The exact 0px case anno-07 measured therefore arises from *simultaneous*
placement or from later layout movement, not from clicking twice — and the
realistic overlap is near-misses inside one pin's width, which is what the radius
is set to catch.

**Not done:** clusters do not merge across a scroll container boundary, and a
cluster is not re-derived while a fan is open — expanding, then scrolling, leaves
the fan at its original centre until the next reposition. Neither was observed to
matter at review scale; both are cheap to fix if the cycle says otherwise.

---

## [anno-08] The pin got larger and gained a drop shadow

**Asked for by:** Brandon — "more visually appealing, larger, with a drop shadow."

**Geometry:** 20/24 → **26/30** (dot/hit), numeral 11px → 12px, check glyph
11 → 13. Appendix B specified 24 as the hit area, which sat exactly on the SC
2.5.8 floor with no margin; 30 gives the criterion room and makes three-digit
numbers legible, which matters now the prototype's counter is past 100.

**The shadow is additive, and that is the load-bearing detail.** The hard
`0 0 0 1px #6e6b67` ring is the SC 1.4.11 guarantee and a blur cannot replace it —
a blurred edge has no measurable boundary, so it cannot be said to clear 3:1
against anything. Measured after the change, the computed `box-shadow` is:

```
rgb(110,107,103) 0 0 0 1px,            ← the contrast ring, FIRST
rgba(31,30,29,0.24) 0 1px 2px,         ← contact
rgba(31,30,29,0.30) 0 4px 10px -2px    ← ambient
```

Rings first because `box-shadow` paints the first layer on top, so the crisp edge
is never washed out by the soft one.

**Deliberately NOT `var(--shadow-card)`:** at `0 10px 28px` that token is wider
than the pin and reads as a smudge under it. The two-layer *structure* is borrowed;
the scale is the pin's own.

**Open decision, unchanged from anno-04:** the pin's fill, edge and now its shadow
are module constants rather than `--anno-pin-*` tokens. Minting them is a design
call. The shadow is additionally theme-agnostic — a neutral black-based shadow is
right on a light surface and simply does less on a dark one, where the 2px light
stroke already carries the separation.

---

## [anno-08] The drawer row is a link to its comment

**Asked for by:** Brandon — "clicking a comment in the comment drawer (the entire
list item/panel) should direct me straight to the page or view where the comment
is located."

**Built as a real `<a href>`**, an overlay covering the row — the pattern
`ui/data-view.tsx` already uses for a navigable row. So middle-click, cmd-click and
"copy link address" behave the way a link should, and the destination shows in the
status bar before the reader commits. A `div` with an `onClick` would have none of
that. `z-[1]` on the link and `z-[2]` on every control means the body text is part
of the target and the action buttons are not, without either knowing about the
other.

**The href is `buildCommentLink()`, so a full navigation is correct rather than
lazy.** `arrival` is computed at module import (R7's ordering requirement), so a
client-side push would carry the route and silently drop the role, scenario and
load state — the reviewer would land on the right page in the wrong state, which
is the failure R13's context capture exists to prevent.

**One interception, for the case where following the link would be worse:**
`linkMatchesCurrentState()` checks route AND all three harness axes; if they all
match and the pin is on screen, the click scrolls and focuses it in place instead
of reloading. Modified clicks are never hijacked.

**Verified both paths.** From `/app/team`, clicking comment 131 — same page, same
state, but its pin inside a *collapsed cluster*, so no pin element — correctly fell
through to the link: full navigation, drawer reopened, filter switched to All,
**cluster auto-expanded**, and pin 131 alone carried the two selection rings. Then
clicking 132 with its pin now on screen was handled in page: URL unchanged, no
unload, focus on pin 132, row highlighted.

**The body is no longer a button.** It was one, and what it did — toggle the
drawer's selection — was invisible and redundant: the chevron beside it already
discloses the full text, and selection now happens by arriving. `A11Y.md`'s 2.5.8
table is updated: the row body's 299×28 measurement is retired because it is no
longer a target, and the row itself measures 351×101.

**Deliberately not navigable:** a comment on a route that no longer exists (nowhere
to go) and a row inside its delete-undo window (leaving would strand the undo).
