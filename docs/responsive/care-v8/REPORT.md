# Assessment Deck & Care Tab Restructure — Pack v8.0: report

Branch `feat/care-v8`, cut from `main` at `7eddab1`, after Monitoring v3 merged.

- **Probe** `scripts/responsive/care-v8.mjs`: 51 checks, all passing.
- **Retargeted and passing:**
  - `care-v61` (26): its crisis-note claims; the intake moved to `care-v8`
  - `care-v7` (46): the strip-only claims retired
  - `care-v5` (59) and `care-elevation` (83): the Overview claims retired
  - `care-timeline` (55), `tiering` (128) and `chat-escalation` (56)
- **Unchanged and passing:** `chat-shell` 41 · `chat-thread` 28 · `chat-chrome` 32 · `activity-bell` 26 · `monitoring-v3` 81 · `-scenarios` 41 · `-tiers` 120 · `-watch` 20 · `-events` 31 · `support-beside-hub` 86 · `support-thread` 50.
- **Static checks:** typecheck clean; lint shows one warning, which is also on `main`.
- **Unit tests:** `deck.test.ts` has 7 tests. `timeline.test.ts` and `notifications.test.ts` are retargeted. The full suite passes (1,188).
- **Mutation testing:** 17 of 17 killed. One first crashed the probe instead of failing a check, and the probe was strengthened (§9).

## 0. Phase 0 audit, as recorded

The pack ends Phase 0 in a hard stop. The standing instruction ("Dont stop anymore to ask me for permissions, just work continuously") overrode it, so the audit is recorded here instead.

**Accordion consumers, all migrated to the deck**

| Consumer | Where it went |
|---|---|
| Holder (the mentor's current assessment node) | `AssessmentDeck mode="holder"` |
| Observer (the supervisor's S0 node) | `mode="observer"` |
| Review ledger | the deck's review card |
| Post-submit read-only (the completed node's expansion) | `mode="readonly"` |
| Monitoring's stage line (`notifications.ts`) | the required count ("Assessment in · 2 of 3") |

**The tab registry.** `CARE_TABS` was Overview · Safety plan · Emergency info · Resources · History, defaulting to Overview. Overview's contents, and what happened to each:

| Overview content | Fate |
|---|---|
| Steady: two Recent History rows and "View history →" | **Retired.** History is the record. |
| Raising: the raise flow | **Relocated** to the Escalation review tab (§8: a decision the pack did not cover) |
| Active: the escalation exchange | **Relocated** to the Escalation review tab |
| The escalation dot | **Relocated** to the Escalation review tab, now "this lens's attention" |

**Lifecycle hooks available:**
- The open escalation (`tiering.escalationFor`), with its open and close fields.
- The mentor's `wrapSeenAt`.
- The page's derived tab state, a picked tab held per thread.
- **Gap:** there was no supervisor equivalent of `wrapSeenAt`, so I added `supervisorWrapSeenAt`.

**Skip inputs:** `safetyCheck.answers.q1` and `.q2` on the record. They are already observable live in both lenses.

## 1. Files

| File | Change |
|---|---|
| `components/chat/escalation/assessment-deck.tsx` | **New.** `AssessmentDeck`, `CoverageRail`, the active card, the read card and the review card |
| `lib/tiering/deck.ts` | **New.** The skip rule, the required set, `nextCard` (never null), progress, segment state, skip transitions |
| `lib/tiering/__tests__/deck.test.ts` | **New** |
| `components/chat/rail/care.tsx` | The tab registry and the temporary tab. The panel header persists; Overview is removed. |
| `components/chat/rail/care-hero.tsx` | The identity strip and the escalation-hero slot are removed. The anchor cells are the header. |
| `components/chat/chat-page.tsx` | The tab lifecycle: per-epoch picks, the dot, dismiss, leave-after-viewing, `?care=escalation` |
| `components/chat/escalation/exchange.tsx` | Uses the deck. One Dismiss on the closed summary, a supervisor "what happens next", and a past-tense completed close step |
| `lib/tiering/timeline.ts` | The supervisor's closed summary node. A closed record draws only what happened. |
| `lib/tiering/use-tiering.ts`, `lib/chat/types.ts`, `lib/tiering/seed.ts` | `seeWrap(teenId, lens)` and `supervisorWrapSeenAt`; the one fixture close carries it |
| `lib/record/mentorship-vitals.ts` | `teenIdentity` and the age fixture are deleted with the strip |
| `lib/tiering/notifications.ts` | `?care=escalation`, and the stage line's required count |
| `app/globals.css` | `seg-skip`, `deck-settle`, `care-tab-in` / `-out`, all stilled under reduced motion |

**Deleted, not orphaned:**
- `assessment-accordion.tsx` and `lib/tiering/assessment-rows.ts`
- the Overview tab, its Recent preview and "View history →"
- the identity strip (`IdentityStrip`, `teenIdentity`, `TeenIdentity`, the age fixture)
- the `onOpenProfile` prop chain

The probe asserts that every retired hook is absent from the DOM.

## 2. Deck walkthroughs

All of these are probe-driven through the real UI, starting from a fresh record.

| Path | Measured |
|---|---|
| Linear | Each record advances to the next: Q1 → Q2 → … → Q6 → review. 6 of 6. |
| Out of order: Q6 → Q3 → Q1 | Tapping a segment opens it. After Q6 the deck goes to Q1, the first required question. After Q1, Q2 is next. Q3 Yes holds the chip at Moderate. |
| Skip: Q1 No → Q2 No | Q1 alone skips nothing. Then Q3–5 are skipped, the deck is at Q6, and progress reads **2 of 3 needed answered**. The quiet line reads "Q3–5 not needed — no ideation indicated". The skip is announced once, and the next record does not repeat it. Ledger: three rows of "Not asked — no ideation indicated", Low risk. |
| Conflict: Q3 Yes, then Q1 No, Q2 No | **Q3 is retained on the record and counted** (4 of 4). Only Q4–5 skip, and the line names just them. |
| Amend: Q2 No → Yes | The segment re-opens with No pressed. Changing it to Yes un-skips Q3–5, sends the deck to Q3, and progress reads 3 of 6. |

## 3. Zero-expanded proof

**By construction:** `nextCard` returns a question id or `"review"`, never null. An interactive deck's active card is the picked segment or `nextCard`.

**Measured:** the probe records the deck after every interactive transition in §2, and an active card is present in all of them. States enumerated:

- fresh
- each of the linear steps
- out of order, after Q6 and after Q1
- conflict
- skip
- skip complete
- amend

The observer is not interactive. Before the first answer it shows a waiting card; after that, the latest arrival or the tapped segment.

## 4. Tab lifecycle, per lens

| Step | Mentor | Supervisor |
|---|---|---|
| Steady | No review tab; **Emergency info** selected | Same |
| Open | Leftmost, auto-selected, alert dot (the assessment is the mentor's move) | Auto-selected. No dot while the mentor assesses; the dot arrives once the assessment is in. |
| Away and back | The pick holds; the tab stays | Same |
| Close (here, a Tier 3 confirm at S1) | The closed summary waits in the mentor's own tab | The tab converts to the closed summary, with one Dismiss (the panel's only filled button) |
| Dismiss | Leaving the viewed summary also removes it, recorded as `wrapSeenAt` | Removed and announced; lands on **History**, which holds the one-card record |

The two lenses' dismissals are independent: a supervisor's Dismiss leaves the mentor's summary in place.

## 5. Rail contrast (AA 4.5:1 text, measured on the card)

| Segment state | Light | Dark | Mark |
|---|---|---|---|
| Empty | 7.63:1 | 6.16:1 | "·", dashed border |
| No (Yes uses the same ink and fill) | 12.62:1 | 19.42:1 | "N" / "Y", solid border |
| Skipped | 4.82:1 | 5.47:1 | "–", struck label, subtle border |

Skipped is distinguishable without colour. Its label is struck through, and it has its own mark ("–"). An empty segment shows "·" on a dashed border. A filled segment shows "Y" or "N" on a solid border.

## 6. Keyboard and screen reader

`KEYBOARD-TRANSCRIPT.md` in this folder is generated by the probe.

- **The rail:** a tablist with one tab stop. The arrows, Home and End move within it. Each segment announces "Question n, {label}: {state}".
- **Recording** announces "{label}: No · 2 of 3 needed answered".
- **The skip** announces once: "Questions 3 to 5 skipped — no ideation indicated".
- **Focus** follows the advance to the next card's first control. At review it goes to the summary field.
- **The tab's creation and removal** are announced politely.

## 7. Squint test

| Shot | State |
|---|---|
| `01` | deck complete, linear |
| `02` | deck skipped, mid-ripple |
| `03` | review with skipped rows |
| `04` | observer |
| `05` | tab bar, steady, no Escalation review |
| `06` | tab bar with Escalation review, mentor open |
| `07` | supervisor's closed summary |

At a squint:
- The anchor cells read first.
- The tab bar carries one red dot while it is your move.
- On the deck, the current segment's ink border and the card's question are the two heaviest marks.
- Skipped segments recede.

## 8. Decisions and deviations

- **The raise flow lives in the Escalation review tab.** Overview hosted it, and the pack did not say where it goes. The tab exists while raising, and cancelling removes it.
- **Per-lens dismissal.** I added `supervisorWrapSeenAt` (append-only, written once), and the fixture's historic close carries it so it never resurfaces.
- **The supervisor's timeline now draws a closed record.** Steps that never happened are not drawn, such as an unsent assessment or a note a Tier 3 exit never needed. A completed close step reads "Closed" or "Closed · follow-up scheduled".
- **The tier cell's actions step aside** while an escalation is raised or open. "Escalate" next to an open escalation is meaningless; the timeline is how the tier moves.
- **The current segment's emphasis ring is a 2px ink border,** not a box-shadow ring. This keeps v4's "only the current node is raised and ringed" true (measured by `care-elevation`).
- **"Navigating away after viewing"** means choosing another Care tab. Switching threads or leaving the page does not dismiss the summary (deferred).
- **The tab arrives** with a CSS beat on mount. That is the same render as the banner, not a choreographed shared motion.
- **`?care=overview`** stays as an alias for `?care=escalation`. **`?rail=profile`** is kept.
- **Live arrival** for the observer is within one tab, as in v6.1 (the store has no cross-tab sync).

## 9. Mutation testing

`scratchpad/mut/run-v8.py`. Each mutant was applied to source, the dev server rebuilt, and the probe or unit tests were run. Result: **17 of 17 killed.**

| Mutant | Caught by |
|---|---|
| Skip on Q1 **or** Q2 | out-of-order, and "Q1 No alone skips nothing" (5 checks) |
| Skip overrides a recorded answer | the conflict path: Q3 retained and counted (2) |
| The deck ignores the skip | the skip path: deck at Q6 |
| Progress counts all six | "of 3" and "of 4" (4) |
| A complete deck has no card | the review card, linear and skip (3) |
| The skip is announced on every record | "announced ONCE" |
| Skipped rows read as blanks | the ledger's "Not asked — no ideation indicated" |
| The ripple fires all at once | the left-to-right delays |
| The observer can answer | zero affordances (3) |
| Every segment ticks, not only arrivals | "earlier ones stay still" |
| Steady opens on History | Emergency info is the default |
| **An open escalation is not auto-selected** | **crashed the probe at first, which is not a kill.** Without the auto-select the deck never rendered and the walkthrough timed out. I added an explicit auto-select check before any deck interaction, re-ran the mutant, and it is now killed. |
| The dot shows whoever holds it | the mentor's dot clears once submitted |
| Leaving a viewed summary keeps it | leave-after-viewing removes it |
| Dismiss lands on Emergency info | lands on History |
| No closed summary for the supervisor | the closed summary with one Dismiss |
| Q6 complete without its follow-up | unit test (2) |

