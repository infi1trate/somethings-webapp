# Assessment & Crisis Note Accordions — Pack v6.1: report

Branch `feat/care-v6.1`, stacked on `feat/care-v7` at `2da884f`. Local only. v6.1 supersedes v6.0 in full; v6.0 was never run.

- **Probe** `scripts/responsive/care-v61.mjs`: 49 checks, all passing.
- **Unit tests:** `accordion-rows.test.ts` has 10 tests; `timeline.test.ts` is retargeted. The full suite passes (1,179).
- **Retargeted probes:** `tiering` (128), `care-v5` (59: §6–7 were retired and moved here), `care-elevation` (85), `care-timeline` (55), `chat-escalation` (56) and `chat-shell` all pass. `chat-shell`'s two failures came from v4's rail order and predate this pack; they are fixed here. Every other escalation-adjacent probe passes unchanged.
- **Mutation testing:** 14 of 14 killed (§9).

## 1. Branch, files, retired patterns

| File | Change |
|---|---|
| `components/chat/escalation/assessment-accordion.tsx` | **New.** `AssessmentAccordion`: holder, observer and read-only modes |
| `components/chat/escalation/crisis-note-accordion.tsx` | **New.** `CrisisNoteAccordion`. The section, Outcome and Debrief forms moved here unchanged, with "Save section" |
| `components/chat/escalation/controls.tsx` | **New.** The shared form primitives, moved unchanged out of `exchange.tsx` |
| `lib/tiering/note-rows.ts` | **New.** The rows, `rowDone`, `noteProgress`, `firstUntouched` (top-down), `outcomeNeedsReview`, summaries |
| `lib/tiering/assessment-rows.ts` | **New.** `questionComplete`, `firstOpenQuestion` (top-down), `afterAnswer` |
| `lib/tiering/timeline.ts` | One `note` node, completed when every row is done. The `outcome`/`debrief` kinds, `section`, `assessmentProgress` and `liveSection` are deleted |
| `lib/tiering/use-tiering.ts` | `saveCrisisNote(…, section)` appends amendments. `chooseOutcome` keeps a saved debrief and records `basis`. `saveDebrief` no longer needs an outcome first. `close` is gated on note completeness in the write |
| `lib/chat/types.ts` | `EscalationOutcome.basis`, `EscalationState.noteAmendments`, `NoteAmendment` |
| `components/chat/escalation/exchange.tsx` | Composes both accordions |

**Deleted rather than orphaned:**
- `AssessmentCard`, which held the sequential reveal and the "Question n of 6" header
- `AnsweredRow` and the collapsed answered group
- `AnswersList`
- the supervisor's `data-s0-progress` count row
- `SectionCard`, `SectionDone`, `OutcomeCard`, `DebriefCard`
- `noteSummary`, now `sectionSummary`
- the per-section, outcome and debrief timeline nodes

The probe asserts the old hooks are absent.

**Store version:** unchanged (v56). The new fields are optional and additive, so a record from before v6.1 reads as it did, and its outcome is never flagged for review (no `basis`).

## 2. Bounded movement

| Component | Row height, every state | Expanded card fully in view |
|---|---|---|
| Assessment | 48px, constant across 9 transitions | After every transition, measured below the sticky Care tab bar |
| Crisis note | 52px, constant across 9 saves | After every save, same measure |

**Caught during the build:**
- **Q6's follow-up overran the view.** A Yes grows the open card, and nothing re-scrolled it. The scroll effect now re-runs when the follow-up appears.
- **A card scrolled up from below could land under the sticky Care tab bar.** Panels carry a 64px top scroll margin. The probe's in-view check now measures against the bar's bottom edge, not the viewport.

## 3. Out-of-order walkthroughs (probe-driven, real UI)

**Intake: Q3 → Q1 → Q6 (Yes + follow-up) → the rest**

| Step | Opens next | Risk chip |
|---|---|---|
| Q3 Yes | Q1 (top-down) | Moderate |
| Q1 No | Q2 | Moderate |
| Q6 Yes | stays on Q6, follow-up nested | High |
| Q6 follow-up No | Q2 | High |
| Q2, Q4, Q5 No | then none; focus goes to the summary | High |
| Q6 re-opened, shown pressed, changed to No | none | Moderate; the follow-up is dropped from the record |

**Note: Referral → Subtype → Emergency services → Outcome, then Emergency services amended**

1. **Referral:** saved as "Primary care provider (PCP)". The next row to open is Clinical subtype, the first gap from the top.
2. **Subtype:** opens Safety plan next.
3. **Emergency services:** saved as "Contact not engaged · No services".
4. **Outcome:** pre-selected as "Referred on for care", from the Referral, and labelled a suggestion.
5. **Emergency services amended** to services contacted, mobile crisis:
   - Outcome shows the review dot.
   - The record still says `referred`; it was never silently edited.
   - The amendment is appended with what it replaced.
   - Opened, the Outcome row says "The note changed since you saved this. It now suggests: Mobile crisis responded."
6. **Re-saving the Outcome** clears the dot.

## 4. Tier 2

- Six rows. The Emergency row never renders: it is not in the DOM, and `noteRows(2)` excludes it (unit test).
- The title counts six: "Crisis note · 1 of 6" on the fixture.
- Close is gated the same way as at Tier 1.

## 5. Observer mode

- The supervisor's current node is the read-only accordion: nothing open and **zero** interactive controls (no Yes/No, no Ask in chat, no fields, no primary button).
- An unanswered row is not expandable.
- An answered row expands to the question **verbatim** with its answer.
- **Live arrival:** an answer recorded while the page is open lands with one soft tick. Answers that were already there stay still. The chip follows.
  - **Stated plainly:** the prototype's store has no cross-tab sync, and the viewer role lives in the same store. So "live" means the record changing while the page is open. The probe drives this by answering as the mentor, then switching to Supervisor through the real dev bar with no reload.

## 6. Keyboard and screen reader

`KEYBOARD-TRANSCRIPT.md` in this folder is generated by the probe. It holds one full non-linear, keyboard-only run per component.

- Rows are buttons with `aria-expanded`.
- Answer and section state are part of each row's accessible name ("Plan and intent, not answered").
- Auto-advance moves focus to the new row's first control. After the sixth answer, focus goes to the summary.
- Each record is announced in a polite live region, for example "Plan and intent recorded · 3 of 6 answered" and "Referral saved · 2 of 6 sections".
- The note's radiogroups keep their arrow-key behaviour.
- Reduced motion: no breath, so the next row opens at once (probe).
- `chat-report`'s axe pass reports **0 violations** on the escalation view.

## 7. Squint test

| Shot | State |
|---|---|
| `10-intake-mentor-partial` | intake, mentor, partial |
| `02-intake-complete` | intake, complete with the review ledger |
| `11-intake-supervisor-observer` | intake, supervisor, observer |
| `01-q6-followup` | intake, Q6 with its follow-up |
| `12-note-tier2-partial` / `05-tier2-partial` | note, partial |
| `04-note-review-dot` | note, the review dot |

At a squint:
- The rows read as one quiet list on the sunken well.
- The open row is the one raised white surface, and its filled button is the panel's only one.
- Answered rows recede one ink step, so the gaps read first.

## 8. Decisions and deviations (answers welcome)

- **The risk chip is live from the first answer.** The pack's walkthrough asks for it "verified per step". This supersedes v3's "the risk arrives once sent" and v5's "the ledger leads with the risk chip" (marked in AGENTS.md). What holds: no score, no percentage, and no risk word anywhere but the one advisory chip.
- **The review ledger's rows are not listed twice.** The accordion's rows are the ledger's rows. The footer is the progress line, the chip, the note and Submit.
- **The note's summary line may truncate.** A long free-text answer, such as "Which resources", is cut at the fixed-height row's edge. It is the one place on this surface that may be cut: the full text is the `title`, the row's accessible name and the open row.
- **The Referral summary** uses the chart's label ("Primary care provider (PCP)"), not the pack's shorthand "PCP".
- **The Outcome and Debrief labels** are TODO-COPY. The chart names them as steps, not sections.
- **A supervisor holder** (post–take-over) is supported by the component's `holder` mode, but take-over is still disabled (carried from v5).
- **Close is gated in the store as well as the node.** The store gate is defensive and cannot be reached from the UI, so mutation testing covers the node gate (§9).

## 9. Mutation testing

`scratchpad/mut/run-v61.py`. Each mutant was applied to source, the dev server rebuilt, and the probe or unit tests were run. Result: **14 of 14 killed, none equivalent, none crashed.**

| Mutant | Caught by |
|---|---|
| The intake advances next-after, not top-down | the Q3 → Q1 step (2 checks) |
| A grown Q6 card is not re-scrolled | Q6 Yes, card in view |
| Focus does not follow the advance | focus checks, mouse and keyboard (2) |
| The observer gets the answer controls | the verbatim read view |
| Every answer ticks, not only arrivals | live arrival, "earlier answers stay still" |
| The six done, focus falls to the page | summary focus, mouse and keyboard (2) |
| A saved outcome silently follows the note | the saved choice stands until re-saved |
| The review dot never shows | the dot, and the open row's notice (2) |
| Emergency renders at Tier 2 | Tier 2 rows and count |
| The note node completes early | the note node and its rows (2) |
| An amendment overwrites, nothing appended | the amendment log |
| Choosing an outcome resets the debrief | amending the Outcome keeps the note complete |
| The note advances from the saved row | unit test, top-down (2) |
| Q6 complete without its follow-up | unit test (2) |
