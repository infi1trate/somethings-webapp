# Care Panel & Escalation — Elevation (pack v4.0): report

Branch `feat/care-elevation`, from `main` @ 5bc6caa. Local commits only, nothing pushed.

| Commit | Phase |
|---|---|
| 9b47415, ddfe65c | 1: hero, Teen Status card, one emphasis, underline tabs |
| 2f9e91d | 2: Up next row, node grammar, the two-zone question card |
| 5606c8d | 3: While you're with them |
| 3bd277c | 4: History (both hosts), close arc, asked-question glyph, AGENTS.md |

## 1. Files

**New**
- `chat/rail/teen-status-card.tsx`
- `chat/escalation/waiting-module.tsx`
- `chat/escalation/quote.tsx` (moved out of the exchange)
- `chat/escalation/close-toast.ts`
- `lib/chat/stay-close.ts`, with tests
- `scripts/responsive/care-elevation.mjs`

**Changed**
- `chat/rail/care.tsx`
- `chat/rail/rail.tsx`
- `chat/escalation/exchange.tsx`
- `chat/chat-page.tsx`
- `chat/thread/{thread,message-bubble}.tsx`
- `tiering/tier-history.tsx`
- `tiering/tier-card.tsx` (`timeInTier` exported)
- `record/record-tier.tsx`
- `lib/chat/types.ts` (`MessageOrigin`)
- `globals.css` (`.tier-cell-arrive`, `.node-breath`)

**Retired, and deleted rather than hidden**
- the timeline header (`TimelineHeader`)
- the rail presence strip
- the Care pill chips
- per-row upcoming ghosts in `Node`
- the History arrow chain
- truncation on completed rows and answered rows
- the nested question card

## 2. Surface tokens and contrast (WCAG)

| Pair | Light | Dark |
|---|---|---|
| text-primary on card / s1 | 16.64 / 15.14 | 13.30 / 15.43 |
| text-secondary on card / s1 | 7.63 / 6.94 | 6.16 / 7.15 |
| text-muted on card / s1 | 5.30 / 4.82 | 4.71 / 5.47 |
| card vs s1 (the surface step) | 1.10 | 1.16 |
| current ring, alert (`--alert-critical-border`) vs card | 1.34 | 1.50 |
| current ring, neutral (`--border-default`) vs card | 1.70 | 1.74 |

The surface ladder is:
- the thread on `surface-card`
- the Care body on `surface-s1`
- the cards on `surface-raised` (`--el-soft`)

The rings fall below 3:1. They are never the only cue: the ink glyph (16:1), the raised surface and the live "Now: …" announcement also mark the current step.

## 3. Filled buttons per state (measured by `care-elevation.mjs`)

| State | Mentor | Supervisor |
|---|---|---|
| Steady | 0 | 0 |
| Raising | 1 (Confirm escalation) | — |
| Assessing, mid-question | 0 | 0 (S0, waiting) |
| Assessment complete | 1 (Submit to supervisor) | — |
| Waiting (M3) | 0 | — |
| Confirm (S1) | — | 1 (Confirm Tier N) |
| Note sections, outcome, debrief, close | — | 1 each (Continue / …) |
| Closed summary (M4) | 1 (Back to Care) | — |

The Emergency info tab's Call 911 is the canon's primary. It sits on its own tab and is not counted against Overview.

## 4. Single homes

| Fact | Its one home |
|---|---|
| Supervisor notified | the banner |
| Who holds it ("— Brandy has this" / "— with {mentor}") | the hero |
| Presence ("Brandy is here") | the hero |
| Tier, request, confirmation, close movement | the hero (lozenge and meta line) |
| The Support door | the hero; the waiting module's Open Support while the mentor waits (the hero hides its own) |
| Platform concern | the hero chip (the state reads "In review", not "Platform concern · in review") |
| What comes next | the Up next row |

## 5. Truncation audit

- **Timeline:** `care-elevation` asserts that nothing in it has `text-overflow: ellipsis` with overflow, at the assessment, waiting and note stages.
- **Completed rows:** they wrap.
- **Answered rows:** they show the `assesses` label, with the question verbatim on expand.
- **Note sections:** a section's summary is a whole second line.
- **Moments:** a moment's quote moved to its expansion.
- **History:** stages are unbreakable phrases, and long reasons clamp to two lines with Show more (the one sanctioned clamp).

## 6. Keyboard and screen reader

- **Care tabs:** a single tab stop. ←/→/Home/End move the selection and scroll it into view.
- **Up next:** a button with `aria-expanded` and `aria-controls`. The steps stay in the DOM, `hidden` while collapsed.
- **Answered rows:** buttons with `aria-expanded`.
- **Question:** the question is a polite atomic live region, and its label carries "· Question n of 6" for screen readers.
- **Yes / No:** a labelled group of buttons, never radios.
- **Corner glyph:** a named button ("Assessment question 5 — open the assessment").
- **Nudges:** buttons; their used state is announced through the label change to "In message box".
- **Motion:** the breath, the arrival and the settle are all off under reduced motion.

## 7. Squint test

`squint-{light,dark}-{steady,requested,confirmed}-{mentor,supervisor}.png` are in this folder. Each state has one dominant element: the hero card while steady, and the ringed current node during an escalation.

## 8. Mutation testing

| Phase | Killed |
|---|---|
| 1 | 10/10 |
| 2 | 12/12 (CSS mutants need the watcher to settle) |
| 3 | 9/9 (the clinical-guard mutant is also killed by the unit test) |
| 4 | 11/12 |

The Phase 4 survivor is "no settle to Overview". It is effectively equivalent: every close control lives on Overview, so the tab switch is a no-op on every reachable path.

## 9. Deferred, with reasons

- **The record's `TierCard`:** it is unchanged (answered: chat only), and still tints its whole card for Tiers 1–2.
- **Toast copy vs the blocked constant:** the toast says "Tier 3 Medium risk" (the pack's words, from `TIER_NAME`), while the blocked `CLOSE_OUT_TIER_COPY` says "Tier 3 Monitoring". This is flagged, not resolved.
- **The `CLINICAL` guard:** it is a wordlist and is not a clinical review. Nudge copy is TODO-COPY.
- **Toast memory:** the mentor's "once" is per browser session (sessionStorage). It is not on the record, by design.
