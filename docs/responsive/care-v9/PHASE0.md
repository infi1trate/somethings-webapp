# Pack v9.0 — Phase 0 audit (Escalation Focus Mode & Guided Assessment)

Branch `feat/escalation-focus`, cut from `main` @ `f44e0a6`. No code changed yet.

## 1 · The column system today

There is one mechanism: a CSS grid in `src/components/chat/chat-page.tsx:741–758` (`data-chat-layout`). It uses named areas (list · banner · thread · rail). Each tier is gated twice: on a viewport breakpoint, and on the `@container/canvas` floor that `AppShell` provides (`app-shell.tsx:323`). The rail/hub is one element that is always mounted (`data-chat-hub`, `:1045`). It is a grid track at `xl` and an absolute 360px drawer below that.

| State (measured, Playwright) | canvas | tracks (computed) |
|---|---|---|
| mentor, steady or escalation, 1512 | 1404 | `300 · 744 · 360` |
| mentor, 1280 | 1172 | `300 · 512 · 360` |
| supervisor (listless), 1512 | 1248 | `888 · 360` |
| supervisor, 1280 | 1016 | `656 · 360` |
| mentor + Support, 1512 | 980 (Support 420) | `490 · 490`, list gone |
| mentor + Support, 1280 | 820 (Support 348) | `410 · 410` |
| supervisor + Support, 1512 | 840 | `420 · 420` |
| supervisor + Support, 1280 | 664 | `332 · 332` |

- **An escalation changes nothing today.** The widths are static. The Care header (`CareHero`) is **215px** tall above the tabs in both lenses.
- **The Support list-collapse hook already exists.** `beside = supportOpen && !!thread` (`chat-page.tsx:397`) gives the list `!hidden` and swaps to `1fr 1fr`. Part 1.2 needs no new hook: Support during an escalation already yields chat · Care · Support.
- **Width sources:**
  - the message bubble is `max-w-[min(78%,420px)]` (`message-bubble.tsx:204`)
  - the transcript row has 16px of padding on each side
  - a bubble reaches its 420 cap at a 571px thread

## 2 · Feasibility of equalize/restore as ONE motion

`grid-template-columns` interpolates (Chrome 107, Safari 16, Firefox 66) when the track count matches and each track is a length or percentage, so `px ↔ calc()` works. It **does not** interpolate `px ↔ fr` or `minmax ↔ px`. So the focus tracks are written as lengths, with the middle track the same in both states:

```
steady  300px                 minmax(0,1fr)  360px
focus   var(--focus-list)     minmax(0,1fr)  var(--focus-care)

--focus-list: max(256px, min(33.333%, 100% - 2·F))        /* thirds once the canvas ≥ 3F */
--focus-care: min((100% - list) / 2, 100% - list - F)     /* never wider than chat; chat ≥ F */
```

- **One transition:** `transition: grid-template-columns`. Reduced motion (the media query or `data-motion="reduce"`) means no transition, an instant swap.
- **Where it applies:** canvas ≥ list floor + F + 360, which is 1096 at F = 480. Below that, the current layout stands.
- **Supervisor:** the list term is 0, so chat and Care split the canvas 50/50, capped so that chat ≥ F.
- **Support open:** this goes from 3 tracks to 2, which stays a swap, as it is today (documented at `:737`). The 1fr/1fr split gets the chat floor: chat is `max(F, 50%)`.

### Projected widths at F = 480

| | before | during | after |
|---|---|---|---|
| mentor 1512 | 300 · 744 · 360 | **444 · 480 · 480** | restored |
| mentor 1280 | 300 · 512 · 360 | **256 · 480 · 436** | restored |
| supervisor 1512 | 888 · 360 | **624 · 624** | restored |
| supervisor 1280 | 656 · 360 | **508 · 508** | restored |
| mentor + Support 1512 | 490 · 490 | 490 · 490 | — |
| mentor + Support 1280 | 410 · 410 | **480 · 340** | — |
| supervisor + Support 1280 | 332 · 332 | **chat 480 + Care as the drawer** (664 can't fit 480 + 320) | — |

### ⚠ Decision: the chat floor `F`

The pack says to set this from Bloom spacing. My recommendation is **480px (60 × 8)**. At that width the bubble cap is 349px (about 46ch) and the composer stays at full width.

- **Cost:** with Support open at 1280, a **supervisor's** Care falls back to the existing drawer toggle, where today it sits side by side at 332/332, under the floor.
- **The alternative:** F = 336 (42 × 8) keeps that side-by-side at 1280, but the bubble drops to 237px (about 31ch).

## 3 · Hero render paths (Supersession 3)

There is one path. `CarePanel` (`rail/care.tsx:437`) renders `CareHero` above `CareTabs` in **every** state (`panelState`: steady · raising · active · closed).

- The lens split is inside `CareHero` (`rail/care-hero.tsx`): `DiagnosisCell` (supervisor or lead) or `MentorshipCell` (mentor), plus `TierCell`.
- **The yield attaches at one spot,** `panelState === "active"`:
  - **mentor:** render nothing
  - **supervisor or lead:** a new one-line `DiagnosisStrip`, built from the same `CareBrief` (`presentation` + `code`)
- **Raising** keeps the cells (no escalation is open yet). **Closed** returns them, and the layout restores with them.
- **Already in place:** the Escalation review tab's status block (`EscalationHero`, `escalation/exchange.tsx`) carries the requested or confirmed tier, so it becomes the working header with no change.
- The Emergency info chip and tab are untouched.

## 4 · Deck, rail and ledger consumers

**What gets deleted.** The whole file `escalation/assessment-deck.tsx`:
- `AssessmentDeck`
- `CoverageRail` (the chip rail)
- `ReadCard`
- `ReviewCard` (the standalone ledger)

The CSS for `seg-skip` and `deck-settle` goes too (`globals.css:847–877`, including the reduced-motion entries).

**What moves into `GuidedAssessment`:** `AskInChat` and `AnswerZone`, the two zones of the focused question.

**Consumers.** All three are in `escalation/exchange.tsx`:
- `:658`: holder (mentor, current node)
- `:667`: observer (supervisor, current node, S0)
- `:766`: read-only (completed node's expand)

**Rules module.** `lib/tiering/deck.ts` **stays**. It holds the skip rule (a blocked constant), completeness and progress, and `notifications.ts` reads `deckProgress`. `nextCard`'s `"review"` sentinel becomes the review state, which is the one zero-focus state. Its tests in `deck.test.ts` stay unchanged.

**Probes that read deck selectors** (`data-deck-card`, `data-coverage-rail`, `data-ledger-row`, `data-segment`) and will migrate:
- `care-v8.mjs` (deck sections superseded)
- `tiering.mjs:384,419,462,476`
- `care-elevation.mjs:299,410`
- `care-v61.mjs:72,95`

## 5 · Truncation and labels-as-questions, today

- **No line-clamp exists on question text.**
- **The rail and the ledger render `q.assesses` labels instead of questions**, in the chip tooltip, the `ReadCard` overline and the ledger rows. Both are deleted.
- **One other `assesses` use:** `draftDebrief` (`lib/tiering/escalation.ts:271`) puts the lower-cased labels into the AI debrief's narrative ("yes answers on wish to be dead (passive)…"). That is a finding description, not a question rendering, so it is left as is and flagged here.
- **Record shape:** no store change and no migration. Answers, skip and risk are unchanged.

## Phase 1 and 2 defaults (they hold unless you redirect)

- **F = 480.**
- **Focus mode triggers on an OPEN escalation** in the active conversation, not on the raise flow. It restores on close.
- **The supervisor strip** is one line: the diagnosis, then its ICD chip, with ellipsis and a `title` on overflow. The diagnosis is not clinical copy that must stay whole. Only the C-SSRS text is unclampable.
- **The progress line "n of m needed answered" stays** in the form's footer. The announcements carry it too.
