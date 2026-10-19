# `bar-00` — Dev bar recon

Written 2026-09-30. No application code was changed in this phase.

**Method note.** Every cell in the matrix is marked with how it was established:
**[op]** operated in the browser, **[code]** established from consumer analysis.
The pack asks for operation over reading; where I used consumer analysis it is
because the axis has *no importer* in that route's component tree, which is a
stronger negative than a single observation, and it is labelled so you can
discount it.

---

## 1 · The applicability matrix

Five axes: **Role**, **Scenario**, **Load**, **Clock**, **Annotation**.

`live` = affects what renders · `enabled` = the control is operable.
Every control is operable on every route: **there are zero `disabled`
attributes in `dev-bar.tsx`.**

| Route | Role | Scenario | Load | Clock | Anno | Enabled-but-inert cells |
|---|---|---|---|---|---|---|
| `/app/care-reviews` | live | live (Care Reviews) | **live** [op] | **inert** [code] | live | **Clock** |
| `/app/risk-flags` | live | live (Monitoring) | **live** [op] | live [code] | live | — |
| `/app/escalations` | live | live (Monitoring) | live [code] | live [code] | live | — |
| `/app/today` | live | live (Today) | **live** [op] | **live** [op] | live | — |
| `/app/activity` | live | live (Activity) | **live** [op] | **inert** [code] | live | **Clock** |
| `/app/chat` | live | live (Mentor chat) | inert [code] | inert [code] | live | **Load, Clock** |
| `/app/mentees` | live | inert | inert [code] | inert [code] | live | **Scenario, Load, Clock** |
| `/app/team` | live | inert | inert [code] | inert [code] | live | **Scenario, Load, Clock** |
| `/app/people` | live | inert | inert [code] | inert [code] | live | **Scenario, Load, Clock** |
| `/app/profile` | live | inert | inert [code] | inert [code] | live | **Scenario, Load, Clock** |
| `/app/settings` | live | inert | inert [code] | inert [code] | live | **Scenario, Load, Clock** |
| `/admin/person/[id]` | live | live (Teen/Staff record) | inert [code] | inert [code] | live | **Load, Clock** |
| `/app/{tasks,home,monitoring,coverage,mentor-practice}` | — | — | — | — | — | retired hops (`RetiredRoute`) |
| `/app/teens`, `/app/mentors` | — | — | — | — | — | redirects |

**Enabled-but-inert count: 26 cells** across 11 live routes.

### The nuance that changes `bar-01`'s design

**Load is never fully inert.** `anno-layer.tsx` reads `devLoadState` to capture
it into a comment's `context`, and `deeplink.ts` writes it to the URL and
compares it in `restoreCommentContext`. So a cell can be **render-inert but
context-live**. Measured: a stored comment's context is
`{route, role, scenario, loadState, viewportWidth}`.

Disabling the Load control per-route would therefore make a *capturable* axis
unsettable on the routes where a reviewer is most likely to be annotating. `bar-01`
needs a third state — "does not change this page, still recorded on a comment" —
rather than a binary enabled/disabled.

### Coverage holes (S1's second half)

**There is no coverage hole on Care Reviews.** S1 supposed that if the controls
were inert there, the route would have no reachable loading/error state. Operated:
Load=`error` on `/app/care-reviews` renders **"Care Reviews didn't load — try
again."** with a retry control. The control is live; the *label* is stale.

Verified error copy by operation:

| Route | Load=`error` renders |
|---|---|
| `/app/care-reviews` | "Care Reviews didn't load — try again." + retry |
| `/app/risk-flags` | "Events couldn't be loaded, so this page can't say what is waiting." + retry |
| `/app/today` | "The destinations couldn't be summarised, so this page can't say what each one holds." + retry |
| `/app/activity` | "This feed did not load. Nothing is lost — try again, and the ledger will catch up." |

The real coverage holes are the seven routes with **no load states at all**:
`chat`, `mentees`, `team`, `people`, `profile`, `settings`, `admin/person`. Naming
them is worth more than disabling a control on them.

---

## 2 · Axis inventory

| Axis | Stored as | Options | Default | Survives reload | In URL |
|---|---|---|---|---|---|
| Role | `persona` | 4 in bar (5 in type) | `supervisor` | **yes** | **yes** (`role`) |
| Scenario | five separate ids | **83 options / 12 groups** [op] | per family | **4 of 5** | partial (`scenario`, one key) |
| Load | `devLoadState` | 4 (`ready/loading/error/partial`) | `ready` | **yes** | **yes** (`load`) |
| Clock | `devClockKey` | 11 in select (13 positions) | `null` (live) | **NO** | **no** |
| Annotation | `anno.*` (4 keys) | 3 modes + drawer | `Off` | **yes** | via `comment` |

### Two axes do not survive a reload — measured

`store.ts`'s persist `partialize` carries `persona`, `activityScenarioId`,
`tasksScenarioId`, `monitoringScenarioId`, `chatScenarioId`, `devLoadState`.

It does **not** carry `devClockKey` or `todayScenarioId`.

Operated: set Clock to `mon-overlap` on `/app/today` — greeting changed to
"Good evening", now-row to 5:00–5:30 PM People Operations. Navigated to
`/app/activity` and back: the control reads `— live clock —` and the key is
absent from storage. **A pinned clock is lost on any full navigation**, which is
also every annotation deeplink. This directly blocks `bar-04`'s round-trip
requirement.

---

## 3 · Measured geometry

### The axis row already clips — at every width tested

Intrinsic content width **1006px**; cluster widths Scenario **278**, Load **303**,
Clock **408**, gap 8.

| Viewport | Row client width | Clipped | Clusters overflowing |
|---|---|---|---|
| 1600 | 931 | **75px** | Clock |
| 1280 | 596 | **410px** | Clock |
| 1024 | 340 | **666px** | Load, Clock |

Row height is **constant at 25px** — it never wraps, because it clips instead.
S3 is confirmed and is worse than stated: this is not a future scaling problem,
the bar is losing content now at the widest width in the pack.

### The scenario select

**83 options across 12 optgroups.** A native select's popup is rendered by the OS
and is not measurable from the DOM, so I cannot report its pixel height or %vh
honestly — that is a real limitation of the method, not an omission. What is
measurable: at 83 options plus 12 group headers the list cannot fit any viewport,
so the browser clamps it to the available height and scrolls. S2 stands on the
option count alone.

### Contrast — no failures

Bar ground `rgb(255,255,255)`. All at 12px.

| Element | Ratio |
|---|---|
| `DEV`, `Scenario`, both parentheticals | **5.30** |
| `Hide`, `Reset` | **5.30** |
| `View`, `Place` (inactive) | **7.63** |
| `Off` (active) | **16.64** |
| select values | **15.14** |

**Nothing measures under 4.5:1.** `bar-01`'s "fix label contrast" item has no
work in it — stated so it is not "fixed" by changing something that already passes.

### Hit areas — one failure

| Control | Measured | ≥24×24 |
|---|---|---|
| Role buttons | 59–88 × 26 | ✓ |
| Scenario / Load / Clock selects | 224/83/264 × 25 | ✓ |
| `Off` / `View` / `Place` | 33–46 × 26 | ✓ |
| **Comments (drawer) toggle** | **26 × 22** | **✗** |
| `Hide` | 61 × 26 | ✓ |
| `Reset` | 28 × 28 | ✓ |

The single failure is the drawer toggle — which `bar-03` names as the one control
that must never collapse. All controls clear 24×24 but **none reaches 44×44**.

---

## 4 · Annotation cluster — what is actually wired

More is built than the pack assumes.

| Requirement | State |
|---|---|
| Mode control | **wired.** Real `radiogroup`; `aria-checked` moves Off/View/Place. |
| Store | **wired.** `localStorage`, 4 keys (`comments`, `counter`, `display-name`, `client-id`), plus a `store-shared.ts` and `configuredStoreKind()`. |
| Comments persist | **yes.** One comment present, full shape: `id, number, authorClientId, authorIpHint, body, status, createdAt, updatedAt, deletedAt, anchor, context, replies`. |
| Drawer opens | **yes.** `role="dialog"`, `aria-expanded` false→true, with Unresolved / All / Mine filters. |
| Context capture | **wired**, and carries 4 of 5 axes: `{route, role, scenario, loadState, viewportWidth}`. **No clock.** |
| **Unresolved count badge** | **NOT BUILT.** The toggle's inner HTML is a bare `[svg]`. `bar-03` requires this badge never collapse; it does not exist to collapse. |

The drawer read "No comments yet" while one comment was stored — **not a bug**:
that comment's `context.route` is `/x` (a test fixture) and the drawer is
route-scoped. Working as designed.

---

## 5 · Axis overlap

**S6 is not confirmed — there is no role conflict to resolve.** `setPersona` has
exactly three callers: the landing page's entry, the bar's Reset (→ `new-mentor`),
and the bar's role control. The `Staff record` scenario group does not set the
role: `scenarioHref` returns `/admin/person/{id}?tab=…&scenario={id}` — it
**navigates**, and the record page only *reads* `persona` to branch. Two axes that
look coupled are not. `bar-01`'s "resolve the role conflict" item has no work in it.

**Clock × Load do not interact.** `today-page.tsx` reads both independently —
`devClockAt(devClockKey)` for the clock, a separate `forState` progression for
load. Neither overrides the other; a pinned clock survives `loading` and vice versa.

**Scenario never sets load or clock implicitly.** `setDevLoadState` and
`setDevClockKey` have exactly one call site each, both the controls' own
`onChange`. Scenario selection writes only its own family's id — plus, since the
Care Reviews rework, the two care traces it invalidates.

---

## 6 · Findings triage against the pack

| Pack finding | Verdict |
|---|---|
| **S1** controls live where they don't apply | **Confirmed** — 26 enabled-but-inert cells. But its second half is **wrong**: Care Reviews has a working error state; the label is stale, the control is not inert. And Load is never fully inert — it is always captured into comment context. |
| **S2** select taller than viewport | **Confirmed** on count (83/12). Pixel height not honestly measurable — OS-rendered popup. |
| **S3** row doesn't scale | **Confirmed and understated** — already clipping 75px at 1600, 666px at 1024. |
| **S4** scope encoded in labels | **Confirmed, and two of four names are wrong**: `LOAD_STATE_SCREENS` = `Activity, Tasks, Monitoring, Home`. "Tasks" is the retired destination; "Home" is the loader domain for Today. |
| **S5** duplicate labels | Not re-audited here — `scen-01`/`scen-02` scope. Measured count for context: 83 options / 12 groups. |
| **S6** role set from two places | **Not confirmed.** See §5. |
| **M1** no grouping | Confirmed by inspection. |
| **M2** "pins" collision | Confirmed: `Pins — three` / `Pins — at cap` in `TODAY_SCENARIOS` vs annotation pins. |
| **M3** clock mixes fixtures and copy variants | Confirmed: 3 of 11 entries are greeting variants differing only by time. |
| **M4** value truncates unreadably | Confirmed; no `title` on any select. |

### Not in the pack, found here

1. **`devClockKey` and `todayScenarioId` are not persisted.** Clock is lost on
   every reload and deeplink. Blocks `bar-04`.
2. **No unresolved-count badge exists.** `bar-03` protects a thing that is unbuilt.
3. **The drawer toggle is 26×22** — the only sub-24 target, on the control
   `bar-03` says must survive every width.
4. **The URL carries 3 of 5 axes** (`role`, `scenario`, `load`) and `scenario` is
   a single key against five scenario families, so it cannot express a full fixture.
5. **Seven routes have no load states at all** — the real coverage hole.

---

## Gate

Two decisions are yours before `bar-01`:

1. **Panel vs. flat row.**
2. **What "inert" should mean for Load**, given it is always captured into
   annotation context even where it changes nothing on screen.

Two `bar-01` items have no work in them as written — label contrast (nothing
fails) and the role conflict (does not exist). Flagging rather than inventing
work to fill them.
