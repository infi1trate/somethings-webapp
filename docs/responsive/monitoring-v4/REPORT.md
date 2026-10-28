# Monitoring v4 — report

Branch `proto/monitoring-v4`, local only: no push, no remote, no PR. Five local commits, one per section. The dev server on :3000 served this branch throughout. Nothing under `/app/chat` changed.

| § | Commit | What |
|---|---|---|
| 1 | `d27632c` | The alert strips are deleted. The In-crisis cell is a button. One polite arrival line. |
| 2 | `cd95f7a` | Tier 1 is a structured queue. |
| 3 | `f59994d` | The elevation pass. |
| 4 | `d22e626` | Tier 1 rows in the tray, the cue, and its mute. |
| 5 | this commit (the last) | The scenarios, the probes, a contrast fix and the docs. |

## Acceptance, measured

Every line below is a check in `scripts/responsive/monitoring-v4.mjs`, which passes 47 of 47. The full regression set is in the last section.

| Acceptance line | Result |
|---|---|
| No alert strip in the codebase | ✓ A grep of `src` finds no strip component, no clock import and no `data-alert-*` hooks. Across all six Tier 1 scenarios the page has no strip and no `role="alert"`. |
| The audible cue and its mute live with the tray | ✓ The cue plays on an arrival after the baseline, as 2 oscillators, which is one chime. The baseline is silent. Muted, new arrivals are silent. The toggle sits in the tray header: 40px, `aria-pressed`, persisted as `{supervisor: true}`, and it survives a reload. A mentor's tray has no mute and no Needs you now. |
| The hero In-crisis cell is a button | ✓ It is a `<button>` named for the Tier 1 queue. Its detail reads "4 awaiting · oldest 14m overdue" and the cell has no fill. Enter focuses `t13`, the longest-overdue row. |
| A soft container, six columns, a stepper, a response state | ✓ The container is 20px at `t1-soft` 40%. It has six headers, and every row has six cells and a four-step stepper. |
| "0:00 left" cannot appear | ✓ 11 responses across the six scenarios. The shapes are `n:nn to confirm`, `Overdue nm`, `Overdue nnm` and `Confirmed by … · n:nn`. Unit tests cover 60s, 61s, 119s, 15m, 3h and 2d. |
| The sort is correct | ✓ t13 Overdue 14m · t17 Overdue 2m · t22 0:19 to confirm · t15 0:41 to confirm · t19 Confirmed by Sarah · 0:48 · t21 Confirmed by you · 0:36. |
| Join/Observe/Resume follow the holder | ✓ Rows Sarah holds offer Observe, rows nobody holds offer Join, and confirmed-by-you rows show You. After Join and back, the row offers Resume. The tray follows the same rule. |
| Tier 1 renders as rows in card view | ✓ The card view shows the same 6 rows and 0 Tier 1 cards. |
| No amber or red fills except the 40% container and Join | ✓ Light and dark, list and cards: the warm surfaces are the container and the four Join pills, nothing else. A fill means a surface at least 24px on both axes; dots and lozenges are marks. |
| AA throughout | ✓ 137 texts on the page in each theme and view. The queue's lowest is 4.65:1, with its headers on the 40% container included. The tray has 93 texts: lowest 4.86:1 in light and 4.71:1 in dark. |
| Zero layout shift on tab switch | ✓ Going Watch → Events → Watch with the queue present, the title, tabs, hero and all five cells stay put to the pixel. |
| Reduced motion respected | ✓ The In-crisis dot stops pulsing, the tab content stops fading, and a hovered hero cell no longer lifts. |

## Found and fixed in §5

- **"Overdue" was 4.36:1 in dark.** `--t1-ink` in dark is the board's `#f0695c`, not a ramp step. Changing it would restyle the chat's dark lozenges, so this adds a text-only token instead: `--t1-text`. It equals `--t1-ink` in light and is blush/500 `#fe8391` in dark (5.62:1 on the row, 6.16:1 on `t1-soft`). It is used by the queue's Response cell, the tray's response, and the row signal ink. Fills, glyphs and lozenges are unchanged.
- **At 375 the card view scrolled sideways (753/375).** The queue rows' `sr-only` spans are absolutely positioned, and their containing block sat outside the queue's scroller, so they escaped its clip. The queue container is `relative` now.
- **"· 24h" was set in mono.** It is a word, not a figure, so it is now in the sans, as on the list rows.
- **A stale exemption.** `billing-code-lozenge.test.ts` still allowlisted the deleted strip file. The allowlist is empty now: an exemption for a missing path would cover whatever is created there next.
- **The Join comment was wrong about dark.** It said the dark fill switches to `--t1-ink` because white fails. In dark, `--t1-ink` equals `--t1`, and what changes is `--text-inverse`, which turns near-black: 6.3:1, measured. The comment now says that.

## Scenarios (twenty)

**Watch:**
- Quiet shift
- **Alert · unconfirmed (1)**
- **Alert · overdue**
- **Confirmed by you**
- Six Tier 1s
- **Held by Sarah**
- Recommended tier pending
- Empty Tier 2 and Tier 3
- Tier 4 expanded
- Long names and many presence chips
- Reduced motion
- Dark mode

**Events:** unchanged, eight scenarios.

**Removed with the strips:** Alert · unacknowledged, Alert · acknowledged, Alert · joined, Two Tier 1s, and Alert · other supervisor. `AlertMock` went with them. A session whose stored scenario is one of the removed ids falls back to the derived default.

## Decisions to review

All of these were defaults from the context report; none is new.

- **The stepper's order** is Requested → Assessment → Confirmed → Note, the product's sequence, not the brief's.
- **The cue needs a gesture first.** Browsers start audio only after the user interacts with the page, so an arrival before any click is silent. The badge and the live region still announce it.
- **Time-to-confirm is shown on the queue only.** This supersedes pack v2.0 in that one place.
- **The flagged line** says what the mentor has sent so far: "note" once the raise note exists, "+ C-SSRS" once submitted. An unnamed mentor reads "the mentor", lower-case.
- **The record's `TierCard`** still fills Tiers 1–2. It is outside this scope, as stated in Phase 0.

## Regression

- `npx tsc --noEmit`: clean.
- `npx eslint src/`: 0 errors, plus 1 old warning in `mock-api.ts`.
- `npx vitest run`: 99 files, 1214 tests passed, 1 skipped.

| Probe | Result |
|---|---|
| monitoring-v4 | 47 / 47 |
| monitoring-tiers | 110 / 110 (retargeted: hero buttons, the queue replacing the lane, step 5 as "no strip", the v4 sparkline, Tier 2's contour) |
| monitoring-scenarios | 41 / 41 (retargeted to the queue's states) |
| monitoring-v3 | 81 / 81 (the dot only above zero) |
| monitoring-watch | 20 / 20 (header gap 16, per §3) |
| monitoring-events | 31 / 31 |
| monitoring-axe | 32 / 32 |
| activity-bell | 26 / 26 |
| care-v5 | 59 / 59 (retargeted: an unconfirmed Tier 1's "opened" notice steps aside for its Needs you now row; the stage line is the queue's Stage cell) |
| today-mirror · home-states · console-top-bar | 21 · 30 · 43, all passing |
| tier-select · chat-escalation-v11 · care-timeline | 81 · 70 · 55, all passing — the chat is untouched |

`monitoring-contrast` and `monitoring-states` were already blocked before v4: their subject, `/app/risk-flags`, has redirected to Monitoring since monitoring-merge. They are unchanged.
