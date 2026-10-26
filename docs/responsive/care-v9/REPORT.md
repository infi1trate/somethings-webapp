# Escalation Focus Mode & Guided Assessment — Pack v9.0: report

The branch is `feat/escalation-focus`, cut from `main` at `f44e0a6`. The Phase 0 audit is in [PHASE0.md](PHASE0.md); the answer was "go", with the chat floor at 480.

- **Probe:** `scripts/responsive/care-v9.mjs`, 61 checks, all passing. Its measures are in `measures.json`, and it writes `KEYBOARD-TRANSCRIPT.md`.
- **Retargeted and passing:**
  - `care-v8`: the deck sections retired, the tab lifecycle kept
  - `care-v61`, `care-elevation` (83), `tiering` and `care-v7` (46)
  - `chat-escalation` (56) and `support-beside-hub` (86): the static widths became Focus Mode widths, and the supervisor at 1280 with Support open is now the drawer case
- **Unchanged and passing:** `care-timeline` 55 · `care-v5` 59 · `chat-shell` 41 · `chat-thread` 28 · `chat-chrome` 32 · `support-thread` 50 · `activity-bell` 26.
- **Gates:**
  - typecheck clean
  - lint: one warning, `mock-api` `_token`, which is also on `main`
  - vitest: 1,194 passing
- **Mutation testing:** 8 of 8 killed (§10).

## 1. Branch and files

| File | Change |
|---|---|
| `src/components/chat/escalation/guided-assessment.tsx` | **new**: `GuidedAssessment` |
| `src/components/chat/escalation/assessment-deck.tsx` | **deleted**: `AssessmentDeck`, `CoverageRail`, `ReadCard`, and `ReviewCard` (the standalone ledger) |
| `src/app/globals.css` | `seg-skip` and `deck-settle` **deleted**; added `--focus-dur`, `--focus-ease` and `ga-rise` |
| `src/components/chat/chat-page.tsx` | Focus Mode tracks, the floors, the Support-beside split, the drawer threshold |
| `src/components/chat/rail/care.tsx` | `Yield`, the header yield |
| `src/components/chat/rail/care-hero.tsx` | `DiagnosisStrip` |
| `src/components/chat/escalation/exchange.tsx` | Three consumers moved to the form: holder, observer, read-only |
| `src/lib/tiering/deck.ts` | Header comment only. The rules, the skip, completeness and risk are unchanged. |

**The static-width assumption is gone.** `300 · flex · 360` is now the *steady* layout only, and the focus tracks replace it while an escalation is open. No other file assumed the hub was 360 wide; the drawer width (360 below `xl`) is unchanged.

## 2. Layout proof (measured, Playwright)

| State | Before | During | After |
|---|---|---|---|
| mentor 1512 | `300 · 744 · 360` | `444 · 480 · 480` | restored |
| mentor 1280 | `300 · 512 · 360` | `256 · 480 · 436` | restored |
| supervisor 1512 | `888 · 360` | `624 · 624` | `888 · 360`, measured at close |
| supervisor 1280 | `656 · 360` | `508 · 508` | restored |
| mentor 1512 + Support | `490 · 490` | `490 · 490` | — |
| mentor 1280 + Support | `410 · 410` | `480 · 340` | — |
| supervisor 1512 + Support | `420 · 420` | `480 · 360` | — |
| supervisor 1280 + Support | `332 · 332` | chat 664, with **Care as the drawer** | — |

- **Chat floor: 480px** (60 × 8). It holds in every state with a pane beside it. The one drawer case is the cost stated in Phase 0.
- **Care is never wider than chat.** The formula caps Care at half of what the list leaves, and at what keeps chat ≥ 480.
- **One motion.** Sampled every frame across the raise:
  - the first track moves monotonically 300 → 444, with 43 in-between frames, settled at 423ms (1512)
  - at 1280: 40 frames, settled at 402ms
  - the close is one motion too (42 frames)
  - the header's yield runs in the same frames
- **Reduced motion:** 0 in-between frames.

## 3. Truncation grep

The source of `guided-assessment.tsx` has no `line-clamp`, `truncate` or `text-ellipsis`.

At runtime, every `[data-question-text]` was checked against three things:
- it matches `ASSESSMENT_QUESTIONS` verbatim
- `-webkit-line-clamp` is `none` and `text-overflow` is not `ellipsis`
- it is not `nowrap`, and has no hidden overflow

**Zero clamps** in each state tested:
- capture, fresh
- capture, skip
- capture, with the Q6 follow-up open
- review
- observer

## 4. Focus-state proof

The probe records every interactive transition across the walkthroughs: **16 capture states, each with exactly one `[data-ga-focused]`**, and **3 review states, each with zero**. Review is the only zero-focus state. `measures.json → states` lists each one.

## 5. Walkthroughs (all passing)

- **Linear.** Q1 Y, Q2 Y, then No through Q6. Focus releases into review, with "Assessment suggests: Low risk".
- **Out of order, Q6 → Q3 → Q1.**
  - Tapping Q6 focuses it.
  - Recording it sends focus to Q1, the first required unanswered question.
  - Q3 is tapped and recorded, then Q1.
  - Result: `Y·N··N`, focus at Q2, "3 of 6 needed answered".
- **Skip, No/No.**
  - Q3–5 read "Not needed" and keep their full text (45, 69 and 103 characters).
  - Focus moves to Q6, and progress reads "2 of 3".
  - The state line reads "Q3–5 not needed — no ideation indicated", and the skip is announced once.
- **Conflict.** Q3 Yes is recorded first, then No/No. Q3 is retained and counted; Q4–5 are skipped; progress reads "3 of 4".
- **Amend-unskip.** From the skip, tapping Q2 and recording Yes un-skips Q3–5, moves focus to Q3, and announces "Questions 3 to 5 are needed again".
- **Review-amend-recompute.** From review, tapping Q4 re-enters capture on Q4. Recording Yes returns to review, and the chip goes Low → **High risk**.

## 6. Hero yield

| Lens | Open escalation | Closed or steady |
|---|---|---|
| Mentor | The cells collapse to 0px and go inert. No diagnosis datum is anywhere in the DOM. | The cells return. |
| Supervisor or lead | One line, the 40px strip: the diagnosis, then its ICD chip | The cells return and the strip yields (measured at close). |

The Escalation review status block is the working header in both lenses. The Emergency info chip and tab are unchanged.

**Strip contrast:**

| | Diagnosis | ICD chip |
|---|---|---|
| Light | 16.64:1 | 7.63:1 |
| Dark | 13.3:1 | 6.16:1 |

## 7. Keyboard and screen reader

See [KEYBOARD-TRANSCRIPT.md](KEYBOARD-TRANSCRIPT.md), which the probe generates.

- **Recording** announces, for example, "Question 1: No · 1 of 6 needed answered. Question 2 of 6." Keyboard focus moves to Q2's first control.
- **The skip** is announced once: "Questions 3 to 5 not needed — no ideation indicated. Question 6 of 6." Focus moves to Q6.
- **Review entry** announces "All needed questions answered. Assessment suggests: Low risk." Focus lands on the note.
- **Submit:** Tab reaches it from the note, and Enter submits.
- **Structure:** an ordered list, "Assessment questions", of six groups. The focused group is `aria-current="step"`, labelled "Question n of 6". Each compact row is a button named "Question n: {full text} {answer}".

## 8. Squint test, at escalation-mode width

| | Capture | Review / complete |
|---|---|---|
| Mentor (Care 480) | `04-squint-mentor-capture.png` | `05-squint-mentor-review.png` |
| Supervisor (Care 624) | `06-squint-supervisor-capture.png` | `07-squint-supervisor-complete.png` |

**Capture.** At a squint, the one ringed question is the only dark-bordered block. The compact rows read as a quiet column of text with chips on the right.

**Review.** The ring is gone, the chips line up in a single column, and the eye drops to the filled Submit: the one filled button.

## 9. Deferred, with reasons

- **True live arrival across tabs.** The store has no cross-tab sync (v6.1's note), so "answers arriving in place" means the record changing while the page is open. The tick is verified by seeding an answer stamped after mount.
- **The supervisor at 1280 with Support open gets the drawer.** This is the cost of the 480 floor, stated in Phase 0.
- **`draftDebrief` still names findings by their `assesses` labels**, in the AI draft's narrative. That describes findings; it does not render a question. Flagged for copy review, not changed.
- **TODO-COPY on every new string:** "Not needed", "Question n of 6", the announcements, and the state line.

## 10. Mutation testing (8 of 8 killed)

| Mutant | Killed by |
|---|---|
| the hero never yields | mentor: "the header hides entirely" |
| focus tracks in `fr` | mentor 1512: "chat ≥ 480 … Care wider" (`fr` gives 466) |
| no chat floor | mentor 1280: Care 301, not wider than before |
| question text `line-clamp-1` | truncation, capture |
| the `assesses` label in place of the question | truncation: the text is not verbatim |
| zero focus during capture | §1: "exactly one focused question" on load |
| the skip not announced | "the quiet state line, and the skip announced" |
| no restore on close | "close: the columns restore" |

**One mutant crashed the probe on its first run.** "Zero focus during capture" crashed the probe instead of failing a check: the setup tried to click into a focused question that did not exist. The probe was hardened. A named load check now catches it, and the setup taps a question first.

**One stale-CSS pass.** One run after an edit reported zero in-between frames. This is the known dev-server CSS watcher lag after a change: forcing a rebuild restored 43 frames. The probe does catch it.
