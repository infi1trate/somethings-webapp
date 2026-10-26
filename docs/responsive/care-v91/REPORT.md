# Escalation Focus View — Amendment Pack v9.1: report

The branch is `feat/escalation-focus-view`, cut from `main` at `194af77` (v9.0, merged). The light audit is in [PHASE0.md](PHASE0.md); the answer was "go" on 50/50.

- **Probe:** `scripts/responsive/care-v91.mjs`, 48 checks, all passing. Its measures are in `measures.json`, and it writes `KEYBOARD-TRANSCRIPT.md`.
- **Retargeted and passing:**
  - `care-v9`: the close holds the room, and Dismiss restores it
  - `support-beside-hub`: now 89 checks, including a new §1b that measures the list-collapse rule outside the view
  - `chat-escalation`, `chat-thread` and `chat-chrome`: the escalation scenarios open the thread by route, because a default is never the room
- **Unchanged and passing:** `care-v8` 13 · `care-v7` 46 · `care-elevation` 83 · `tiering` 128 · `care-timeline` 55 · `chat-shell` 41 · `care-v61` 26 · `care-v5` 59 · `support-thread` 50 · `activity-bell` 26.
- **Retargeted counts:** `care-v9` 61 · `support-beside-hub` 89 · `chat-escalation` 57 · `chat-chrome` 32.
- **`chat-thread`: 27 of 28.** "Hovering reveals exactly one" fails on **`main` too** (measured with this branch stashed), so it is not from this pack. It is most likely the clock-relative fixture: the probe hovers the list's third item, which drifts onto a day divider with the time of day. Flagged, not fixed here.
- **Gates:**
  - typecheck clean
  - lint: one warning, `mock-api` `_token`, which is also on `main`
  - vitest: 1,194 passing
- **Mutation testing:** 8 of 8 killed (§9).

## 1. Branch and files

| File | Change |
|---|---|
| `src/components/chat/chat-page.tsx` | The view, plus `roomFor`, the default-is-never-the-room rule, the raise-held default, the "← Chats · N" bar, the entry announcement, and the first-action motion gate |
| `src/components/chat/list/conversation-list.tsx` | The Active escalation partition, and `away` (inert, out of the accessibility tree) |
| `AGENTS.md` | The v9.1 section, with v9.0's Focus Mode bullet marked superseded |

**v9.0's in-place equalization was migrated, not orphaned.** `--focus-list` (the list at 256–⅓) and the 1096 guard were deleted, and a probe checks the source for them. `--focus-care` stays, simplified to `min(50%, 100% − 480px)`. The Support-beside floor split and the 800 drawer threshold are unchanged. The list's Support auto-collapse now acts only outside the view.

## 2. Entry paths

- **From the list.** A pinned row navigates to `/app/chat/{teen}`. The route remounts the page, so it **lands** directly:
  - list away
  - "← Chats · 4" first in the conversation
  - chat and Care at 50/50
  - the hero yielded
  - entry announced
- **Notification deep link** (`?care=escalation`). It **lands** with no in-between frames: one pre-data frame, then the room.
  - v9.0 measured 43 frames of motion here.
  - The fix: motion is armed only by the reader's first press (`data-chat-motion`).
  - Duration and easing moved inside that variant, because unscoped they timed `transition-property: all` (measured).
- **Mid-chat open.** One composed motion:
  - The banner arrives, the list's track slides 300 → 0 over about 42 frames (settled at about 415ms), and the list fades in the same frames.
  - Care breathes from 360 to 702, and the Care header yields on the same beat (`--focus-dur`).
  - **Reduced motion:** 0 frames, an instant swap.
- **A raise on `/app/chat`'s default conversation.** A defect found and fixed in this pack. The default would have jumped to the next row mid-raise. Now the raise holds the default, and the view composes around it.

## 3. Exit paths

- **← Chats.** Goes to `/app/chat`. The list returns, nothing closes, and the escalation is still pinned. The selected default is not the escalated conversation, which would otherwise loop back in. The pinned row re-enters the view.
- **Close → summary → dismiss.**
  - Close leaves the closed summary **in** the room; the banner goes.
  - Dismiss is the exit: the list track goes 0 → 300 over about 43 frames as the list fades back in, the exact reverse of the entry.
  - The conversation unpins (no group left), and the panel lands on History.
  - The toast and History are unchanged.
  - Both lenses dismiss their own summary.

## 4. Widths inside the view (floor: chat 480)

| | chat · Care | + Support |
|---|---|---|
| Mentor 1512 | 702 · 702 | 490 · 490 |
| Mentor 1280 | 586 · 586 | 480 · 340 |
| Supervisor 1512 | 624 · 624 | 480 · 360 |
| Supervisor 1280 | 508 · 508 | chat 664, with Care as the drawer (the v9 cost) |

Closing Support restores chat · Care, never the list.

## 5. Lens parity

Screenshots: `03-room-mentor.png` and `04-room-supervisor.png`.

- Both lenses are chat · Care, equalized.
- The first element in the conversation is the same back bar: "← Chats · 4" for the mentor, "← Monitoring" for the supervisor.
- The hero yields per lens: the mentor's is hidden, the supervisor's becomes the strip.

## 6. Keyboard and screen reader

See [KEYBOARD-TRANSCRIPT.md](KEYBOARD-TRANSCRIPT.md).

- **Entry** is announced politely: "Escalation focus view. The conversation list is hidden; Back to chats returns to it." The supervisor hears "Escalation focus view."
- **The back link** is the conversation's first tab stop, named "Back to chats, 4 with unread messages".
- **The away list** is inert: nothing in it takes focus.
- **The list group** is a section labelled by its h3, "Active escalation". The row says "escalation open" in words.

## 7. Squint test

| Screenshot | What it shows |
|---|---|
| `01-list-with-group.png` | One quiet overline, the pinned row with its shield, a hairline, then the rest. Findable in a scan, never shouting. |
| `02-list-without-group.png` | No header at all. |
| `05-room-without-support.png` and `06-room-with-support.png` | The room reads as two equal panes. With Support, three surfaces, and the chat at least 480. |

## 8. Deferred, with reasons

- **The route entries land; they do not travel** (Magic 1 holds for the in-place open and the dismiss only). A row and "← Chats" are navigations that remount the page, so no CSS transition can span them. React's `<ViewTransition>` would need `experimental.viewTransition`, which cross-fades **every** navigation in the app. The thread data is also mount-gated, so a snapshot would capture an empty pane.
- **The measure at 702.** The compact question rows run about 85 characters, past 75. 50/50 was chosen over a 560 cap; this is the cost, stated.
- **The pre-data frame on a deep link.** The page's existing mount gate paints one empty frame before the room. That is a swap, not motion, and it predates this pack.
- **TODO-COPY:** "Active escalation", "Chats", the entry announcement, and the back link's label.

## 9. Mutation testing (8 of 8 killed)

| Mutant | Killed by |
|---|---|
| the list keeps its 300 track in the room | §1: "the list's track is 0" |
| motion ungated (transitions on load) | §3: "a deep link LANDS" (45 distinct frames) |
| the default can be the room | §3: "two rooms open: … a THIRD conversation" |
| no held default on a raise | §3: "a raise on the list's default conversation composes…" |
| the room exits on close, not on dismiss | §4: "closed — still in the room on its summary" |
| the group header always rendered | §2: "the header only with rows" |
| no pinning (a flat list) | §2: "pins to the top" |
| no count on the back link | §3: "← Chats · 4" |

**"The default can be the room" survived the first pass.** The rule has two guards: the scenario's focus thread, then the most recent row. Only a state with both in a room reaches the second guard. The probe now raises a second escalation on the most recent row (t14) beside t13, and asserts that `/app/chat` defaults to a third conversation with both pinned.
