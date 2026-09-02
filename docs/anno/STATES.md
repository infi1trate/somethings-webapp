# `anno` — State sweep

Every cell of the §6 state table plus the edge-case list, exercised and recorded.
**Measured, not asserted**: each row says what was observed, and every value came
from a live DOM measurement rather than from reading the source.

**Taken against** `main` (uncommitted), dev server on `localhost:3000`, store
driver `file` (see [GAPS.md](GAPS.md) anno-01), viewport 1280×860 unless noted.

---

## A note on evidence

Screenshots in this feature are **partial evidence by necessity**. The Browser
pane's screenshot pipeline renders inconsistently — the same viewport comes back
at 45% or 89% scale, sometimes stale, sometimes erroring — and it does not support
region cropping. So:

- states marked **`shot`** have a legible screenshot in the phase transcript that
  shows the state;
- states marked **`dom`** are confirmed by attribute + computed-style measurement
  only. That is *stronger* evidence for geometry and colour and *weaker* evidence
  for "does it look right", and it is labelled rather than blurred.

Anything a reader would want to eyeball before shipping is flagged in the last
column.

---

## §6 · Drawer

| State | Exists | Evidence | Observed | Pass |
|---|---|---|---|---|
| Empty | designed | `shot` (anno-05) | `data-anno-drawer-state="empty"` · "No comments yet / Switch the layer to **Place** and click anything in the prototype to leave the first one." Badge correctly absent at zero. | ✅ |
| Filtered-empty | designed | `shot` (anno-05) | `filtered-empty` · "Nothing matches Unresolved / There are 4 comments, but the **Unresolved** filter is hiding them." + **Show all comments** | ✅ |
| Loading | designed | `dom` | `loading` · "Loading comments…" plus three pulse skeletons. Only observable in the gap before the first `list()` resolves. | ✅ |
| Populated | designed | `shot` (anno-05, greyscale) | `populated` · grouped by page, newest-first, orphan group last | ✅ |
| Store unreachable | designed | `shot` (anno-05) | `unreachable` · "Can't reach the comment store" + the store's own sentence + **Try again**. Verified by forcing the API to 503. | ✅ |

## §6 · Composer

| State | Exists | Evidence | Observed | Pass |
|---|---|---|---|---|
| Empty / focused | designed | `dom` (anno-04) | 1 field, `Cancel` / `Save comment`, field auto-focused, **0** extra controls | ✅ |
| Typing | designed | `dom` | Save enables on first non-space character | ✅ |
| Saving | designed | `dom` | Button label → `Saving…`, disabled | ✅ |
| Save failed (retry, draft preserved) | designed | `dom` (anno-05) | Editor stays open, `draftPreserved: true`, error beneath the retained text. **Was a defect** — see Fixed, below. | ✅ |
| Discard confirm | designed | `dom` (anno-04) | Only for a dirty field. "Discard this comment?" · **Keep writing** / **Discard comment** | ✅ |

## §6 · Comment row

| State | Exists | Evidence | Observed | Pass |
|---|---|---|---|---|
| Open | designed | `shot` | `data-anno-row-state="open"` · filled chip + number | ✅ |
| Resolved | designed | `shot` (greyscale) | `resolved` · ring + check, opacity 0.7 | ✅ |
| Deleted (undo window) | designed | `dom` (anno-05) | `pending-delete` · struck through, opacity 0.6, **Undo delete** in the tab order, 10s toast | ✅ |
| Edited-by-author | designed | `shot` | "edited by Copper Kestrel" — named, not a bare "edited" | ✅ |
| Deleted-by-someone-else | designed | `dom` (anno-05) | `removed-elsewhere` · "Comment 79 was deleted by another reviewer", body struck, **actions removed**. Appears at the next read, not instantly — no cross-tab channel. | ✅ |

## §6 · Mode control

| State | Exists | Evidence | Observed | Pass |
|---|---|---|---|---|
| Off | designed | `dom` | **Layer absent from the DOM entirely** — not a transparent overlay | ✅ |
| View | designed | `shot` | Root `pointer-events: none`, `z-index: 60`, no capture surface | ✅ |
| Place | designed | `shot` (anno-04) | Capture surface `pointer-events: auto`, `cursor: crosshair`, persistent "Placing a comment · Esc to cancel" | ✅ |
| Disabled (store unreachable) | designed | `shot` (anno-05) | View + Place `disabled`, titled "Comment store unreachable — the layer can't load or save." **Off stays enabled**; drawer toggle stays enabled so the error is reachable | ✅ |

## §6 · Identity popover

| State | Exists | Evidence | Observed | Pass |
|---|---|---|---|---|
| Default generated name | designed | `dom` (anno-05) | `idle` · "Quiet Sparrow · generated for you" — says it was generated | ✅ |
| Editing | designed | `dom` | `editing` · input + **Save name** | ✅ |
| Saved | designed | `dom` | `saved` · "Slate Heron  Saved", auto-clears after 2.2s | ✅ |
| Name conflict | designed | `dom` | "Another reviewer is already called Slate Heron. You can still use it — your comments are told apart by the colour dot, not the name." **Save not blocked** (`saveStillEnabled: true`) | ✅ |

## Pin states (Appendix B)

| State | Exists | Evidence | Observed | Pass |
|---|---|---|---|---|
| Unresolved | designed | `dom` | Filled `#7b5bd6`, number, **30×30 hit / 26×26 dot**, 12px numeral | ✅ |
| Resolved | designed | `shot` (greyscale) | Ring + check SVG, opacity 0.7 | ✅ |
| Selected | designed | `dom` | 3-layer boxShadow ring, distinct from the 1px edge | ✅ |
| Hovered | designed | `dom` | Dot scales 1.1; **hit area unchanged** (scale is on the inner span) | ✅ |
| Anchor lost | designed | `shot` (anno-06) | `2px dashed`, `aria-label: "Comment 81 — anchor lost"`, deletable | ✅ |
| Ghost (being placed) | designed | `dom` | opacity 0.6, no number | ✅ |
| Pending (optimistic echo) | designed | `dom` (anno-04) | Renders as ghost — **was a defect** showing "comment 0" | ✅ |
| Clustered (collapsed) | built | `dom` | 36×36 badge, count, second disc behind it for a stacked silhouette; contributes **0** pins | ✅ |
| Clustered (expanded) | built | `dom` | Members fan onto a ring; **min gap 34px** to each other and to the collapse control (24px floor) | ✅ |
| Drop shadow (all states) | built | `dom` | Hard `0 0 0 1px #6e6b67` contrast ring **first**, then two blurred layers — the 1.4.11 edge is not replaced by the shadow | ✅ |

---

## Edge cases

### 1. Two people comment on the same element simultaneously

Both persist. Two `POST`s fired in one tick → numbers **83** and **84**,
`createdAt` 1ms apart, `bothPersisted: true`.

**The sort key is total and explicit:**

```
createdAt DESC, then number DESC
```

`createdAt` alone leaves ties, and a tie is exactly what simultaneous comments
produce. Relying on `Array.sort` stability would make the order depend on the
server's return order — which is `number` **ascending**, so a tied pair would come
out oldest-first inside a newest-first list. `number` is server-allocated by an
atomic `INCR` (anno-01) and therefore can never tie, which makes the order the
same for every reviewer, every browser, any arrival order.

Rendered order verified monotonic: `[85, 84, 83, 79, 77, 76, 75]`. **Was a
defect** — see Fixed.

### 2. Body at exactly 1000 chars, and 1001

| | Result |
|---|---|
| 1000 chars | `201`, accepted, `storedLength: 1000` |
| 1001 chars | `400` · `invalid` · "A comment can be at most 1000 characters." |
| Client guard | `textarea maxLength={1000}` — the 1001st cannot be typed |

**Clamp in the row:** 4 lines (`line-clamp: 4`), row height **154px**.
**Full text on expand:** row height **660px**, `line-clamp: none`.
Unclamped it measured **554px — 81% of the drawer's scroller**, so one comment
hid the whole review. **Was a defect** — see Fixed.

All 1000 characters are in the DOM in both states, so a screen reader loses
nothing to the visual clamp.

### 3. Pin inside a scrolling container, then scrolled

`main > div` (max scroll 1071px). Pin anchored at `offsetY 0.5` of
`care-summary-panel`:

| scrollTop | pin viewport Y | anchor viewport Y | offset within anchor |
|---|---|---|---|
| 0 | 475 | 303 | **0.5000** |
| 250 | 225 | 53 | **0.5000** |
| 600 | −125 | −297 | **0.5000** |
| back to 0 | 475 | 303 | **0.5000** |

**Max deviation 0.0000.** The pin tracks its element exactly.

At scrollTop 700 the anchor is fully above the viewport and **its pins are gone
from the DOM** (`anyPaintedOutsideViewport: false`); only the pin anchored
elsewhere remains, inside the viewport.

*Observed nuance, not a failure:* visibility is computed from the **anchor's**
rect, so a pin whose point falls just outside the viewport while its anchor is
still partly inside stays mounted. The `position: fixed` layer clips it, so
nothing is mispainted.

### 4. Pins are page-specific

8 comments across 2 routes. On `/app/tasks`: **0 pins rendered**, and 0 comments
belong to that route. Nothing leaks between pages — the layer filters on
`context.route === location.pathname`.

### 5. Route that no longer exists

Deeplink to a comment on `/legacy/onboarding-step-4`: Next serves its **404**, the
app **does not crash or blank**, the drawer **opens**, the notice explains, and the
comment appears in **Page no longer exists** where it is still readable and
**deletable**.

*Known limit:* the "does this route exist" test is a prefix allowlist, not a route
registry — Next exposes none client-side. A new top-level route would be a false
positive until the list is updated. Logged in GAPS.md (anno-05).

---

## Guardrail metrics (PRD §3)

### Interaction latency unchanged in View mode

Representative interaction: tab switch on the Care page (Overview ⇄ Care),
measured click → second `requestAnimationFrame`, 10 samples each.

| | samples (ms) | mean |
|---|---|---|
| Layer **Off** (not in DOM) | 6.4, 16.0, 1.8, 8.5, 8.4, 8.5, 15.9, 9.5, 8.4, 8.4 | **9.18ms** |
| Layer **View** (7 pins on page) | 7.0, 6.5, 9.3, 8.3, 16.8, 9.2, 9.4, 9.4, 8.4, 8.9 | **9.32ms** |

**Delta +0.14ms** — inside the 1.8–16.8ms within-condition spread, i.e. not
distinguishable from noise at n=10. ✅

### Zero comment loss

30 comments created, then: nav → `/app/tasks`, nav → `/app/chat`, resize
1280→900, role → Lead mentor, load `error`→`ready`, resize 900→1280, nav back to
the record, **full reload**.

```
createdProbes: 30   probesStillPresent: 30
totalLiveBefore: 8  totalLiveNow: 38   expected: 38   lost: 0
```
✅

### Existing tasks still completable (layer in View)

| Flow | Steps verified | Result |
|---|---|---|
| Care review (`/admin/person/t23`, `review-90`) | Review CTA → workspace opens → decision options present (`Change presentation`, `Change code`) → commit CTA `Save & close` | **PASS** |
| Chat (`/app/chat`) | conversation row → navigates to thread → composer reachable → typed → Send enabled | **PASS** |
| Tasks (`/app/tasks`, supervisor) | task row → task pane opens → pane actions present → domain tab switched → rows intact | **PASS** |

*Two of these initially read FAIL because of my own harness, not the app:* the
care flow's card was already expanded from earlier testing so there was no
`Review` CTA to click, and the tasks flow was run while the persona was still
**Lead mentor** from the zero-loss gauntlet — `/app/tasks` is a supervisor-tier
surface and correctly showed "Nothing here yet". Both re-ran clean.

---

## Fixed in this phase

1. **Sort was not a total order.** Ties on `createdAt` fell through to
   `Array.sort` stability, which would have ordered a simultaneous pair
   oldest-first inside a newest-first list. Now `createdAt DESC, number DESC`,
   named in one function.
2. **A 1000-char body swallowed the drawer** — 554px, 81% of the scroller. Now
   `line-clamp-4` in the row, full text on the existing expansion; the disclosure
   control is renamed to say so ("Show full comment and details").
3. **SC 2.5.8: row body was 299×20.** Now `py-1` → **28px**. Padding rather than
   `touchTarget()` because the box's height varies with the clamp and that
   helper's insets are keyed to fixed heights.
4. **SC 2.5.8: "Change name" was 92×22.** Now **26px**.

Carried in from the phases either side, both found by measurement:
the edit path's **draft loss on a failed save** (anno-05) and the pin's **missing
focus ring** (anno-06).
