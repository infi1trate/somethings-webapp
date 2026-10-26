# Pack v9.1 — Phase 0 light audit (Escalation Focus View)

The branch is `feat/escalation-focus-view`, cut from `main` @ `194af77`. That commit is the merge of PR #66 (v9.0), so **v9 Part 1 shipped, and this pack migrates it.** No code has changed yet.

## 1 · What v9 Part 1 is today, and how it migrates

Focus Mode lives entirely in `chat-page.tsx`:
- `focus = !!escalation`
- the `--focus-list` / `--focus-care` tracks
- the Support-beside `max(480px,50%)` split and its 800 drawer threshold

**The list stays on screen**, narrowed to 444 or 256.

| v9 piece | v9.1 |
|---|---|
| `--focus-list` (list 256–⅓) | **Removed.** In the view the list is absent: its track animates to `0px` and the list goes inert. One grid, so entry is still ONE interpolated motion. |
| `--focus-care` (Care ≤ chat, chat ≥ 480) | **Kept**, with list = 0. Chat and Care equalize to 50/50, capped so chat ≥ 480. That is v9's supervisor rule, so both lenses land in the same room. |
| `focus = !!escalation` | **Widened to the review record** (`careEscalation`): open, OR closed with this lens's summary not yet dismissed. Dismiss exits the view (Part 4). |
| The Support-beside floor split | **Kept** as is: chat · Care · Support, chat ≥ 480, the drawer below an 800 canvas. |
| The auto-collapse of the list on Support (`beside && "!hidden"`) | **Retired inside the view** (Supersession 2), where the list is already gone. It stays for a non-escalated conversation. |
| Hero yield (`care.tsx` `Yield`, `DiagnosisStrip`) | **Unchanged.** |

### Widths inside the view (projected)

| | chat · Care | + Support |
|---|---|---|
| mentor 1512 | 702 · 702 | 490 · 490 |
| mentor 1280 | 586 · 586 | 480 · 340 |
| supervisor 1512 | 624 · 624 (unchanged) | 480 · 360 |
| supervisor 1280 | 508 · 508 (unchanged) | 664 + Care as the drawer (unchanged) |

**⚠ Measure.** At 702, the compact question rows run about 85 characters, past the 75 ceiling. The pack carries v9's proportions ("the panel width it depends on carry forward"), so I keep 50/50. The other option is capping Care at 560 (70 × 8), which gives mentor 1512 `844 · 560` and keeps the measure under 75, but breaks "equalized" and lens parity. **Default: 50/50.**

## 2 · List grouping and pinning

`ConversationList` (`list/conversation-list.tsx`) is a flat `<ul>` of filtered rows, with no group support. It already receives `escalations` (the open ones by thread, pack v5 C1), and the rows already draw the shield and the tier-coloured indicator.

**Feasible as a partition, not a re-sort.** Rows with an open escalation go under one quiet `Active escalation` header, rendered only when the group is non-empty; the rest follow in their existing order.
- No new filter tab.
- Each filter (All · Unread · Check-in) partitions the same way.

**Markup.** Two `<ul>`s, each labelled by its header. The header gets the row shield's one soft pulse (Magic 2), and the pulse is stilled under reduced motion.

## 3 · The back affordance and its count

**The control exists.** `Thread` takes `onBackToChats` and renders a 40px ← button first in the header. Today it is wired only to *close Support*.

**The data exists.** Each thread carries `unreadCount`, and the list's Unread segment already counts threads with unreads.

**In the view:** "← Chats · N", where N counts the OTHER conversations with unreads (the current one excluded).
- It navigates to `/app/chat`. Nothing closes, and the row re-enters the view.
- It is first in tab order.
- It is a link, like "← Monitoring", so the destination is named.
- The count ticks when N changes (Magic 3).

**Supervisor lens.** It keeps its existing "← Monitoring", which is the only difference between the lenses.

## 4 · Support inside a list-less layout

Already wired: the supervisor lens is list-less today, and `beside` gives chat · Care · Support with the floor. The mentor's focus view uses the same branch. Closing Support returns to chat · Care, because the list is absent in the view, not collapsed.

## 5 · Deep links must land in the view: ⚠ a v9 defect, measured

Notifications link to `escalationHref` = `/app/chat/{teen}?care=escalation`.

**Measured on `main`:** a deep link's first frame is the steady `300 · 744 · 360`, then **43 frames animate** into focus. The tiering store hydrates on the client after the first paint, and the CSS transition plays the change. The pack forbids this: a deep link "must land directly in the focus view."

**Fix (Phase 1).** The grid's column transition is enabled only once the page has painted with its real state:
- a `data-chat-motion` attribute, set in an effect after the first commit (a DOM write, not state)
- so a deep link or a fresh load swaps without motion
- and every in-session change still composes in one motion: a mid-chat open, entering from the list, ← Chats

## 6 · Entering and leaving the view

All of these are one grid on one mounted page, so each is one interpolated motion.

- **Entering from the list.** A row click is a client navigation, so `ChatPage` stays mounted and the tracks animate:
  - the list slides to 0
  - Care breathes wider
  - the banner arrives in the same beat
- **Mid-chat open.** The same tracks, triggered by the record changing.
- **← Chats.** The exact reverse.
- **Reduced motion:** an instant swap everywhere.

## Defaults for Phases 1–2 (they hold unless you redirect)

- 50/50 inside the view.
- Focus = open escalation OR this lens's undismissed closed summary.
- Pinning reads OPEN escalations only. A resolved escalation unpins at close, which is invisible inside the view; dismissing returns a list it is already out of.
- "← Chats · N" counts the other conversations with unreads, and N is hidden at 0.
- The deep-link no-motion fix above.
