# Care Panel & Escalation — Refinement (pack v5.0): report

Branch `feat/care-v5`, stacked on `feat/care-elevation` (v4).

| Commit | Phase |
|---|---|
| 07b48a4 | 1: hero v2, the tier-cell diet, sticky tabs, both bugs |
| 426d2ee | 2: question first, the review ledger, amend in place |
| 5d775e8 | 3: list shields, notices, deep links, the Monitoring stage line |
| 34287ef | 4: History v3, arrow chains retired, safety-plan starters, AGENTS.md |

Probe `scripts/responsive/care-v5.mjs`: 68 checks, all passing. Mutation testing killed 13 of 13; the run initially caught two gaps, each fixed in the probe.

## 1. Bugs

**Bug 1: duplicate "closed the escalation" chips.**
- **Root cause (data, not render):** `setMonitoringScenarioId` dropped the escalation records but kept `chatEvents`. That brought the fixture's escalation back open under a stale close chip, and closing it again wrote a second chip.
- **Fix:**
  - The switch now clears the chat writes along with the records, as Reset and the chat switch already did.
  - A read-time guard shows one open and one close per escalation, which covers browsers that already persisted a duplicate.
- **Regression checks:**
  - driven through the real dev-bar switch
  - a persisted duplicate renders once

**Bug 2: the tab bar.**
- **Root cause:** 405px of tabs in a 327px row, under a fade that was always on.
- **Fix:**
  - Each side fades only while there is more to scroll that way.
  - The tabs snap.
  - The bar is sticky on the panel's surface.
- **Measured at 1512 and 1280:** a tab cut at an edge is always under a fade, and both ends are whole when scrolled there.

## 2. Single homes (updated)

| Fact | Its one home |
|---|---|
| Supervisor notified | the banner |
| Who holds it ("Brandy has this. Stay with Jordan.") | the waiting node's title |
| Tier, request, confirmation, close movement | the hero: the headline (request in words, or the confirmed lozenge) and the meta line |
| Presence ("Brandy is here") | the hero's meta line |
| The Support door | the hero's ghost button, in every state |
| What comes next | the Up next row ("A, then B") |
| When a History entry happened | the row's time gutter and the day header (the card carries no date) |
| The risk the assessment suggests | the risk chip (it carries "Assessment suggests:" itself) |

## 3. Assessment node

The question card sits 78px from the top of the node at 0, 3 and 6 answers. At 6 answers, Q6's Yes has opened its follow-up.

## 4. Notification matrix

| Event | Supervisor | Mentor |
|---|---|---|
| Escalation opened | bell, plus Today's urgent item | — |
| Assessment submitted | bell, with the risk; Monitoring's stage line | — |
| Tier confirmed / adjusted | — | bell ("… confirmed Tier 1 for Jordan" / "… set Jordan to Tier 2") |
| Supervisor Support message | — | bell, for open escalations only, plus the existing Support unread |
| Escalation closed | Today: follow-up scheduled or due | bell ("… closed the escalation · Jordan moves to Tier 3") |

**Deep links:**
- Every notice opens `/app/chat/{teen}?care=overview`.
- Mentor notices also offer Open Support.
- Arriving by a link, the current node traces its ring once.

## 5. List indicator contrast

| Shield | Light | Dark |
|---|---|---|
| Tier 1 ink | 6.82:1 | 4.36:1 |
| Tier 3 (neutral, `text-secondary` on the selected row) | 5.78:1 | — |

No alert colour appears on Tier 3–4 rows.

## 6. History

- Each summary line has 1–3 fragments, checked on both hosts.
- No arrow chain remains on any escalation surface (DOM check). The remaining `→` characters in source are code comments, billing-code diffs on Care Reviews, and link affordances such as "View history →".

## 7. Keyboard and screen reader

- **Sticky tabs:** a single tab stop; Home/End and the arrows scroll the focused tab into view.
- **Answered group and ledger rows:** `aria-expanded` buttons. Amend is a labelled group of `aria-pressed` buttons.
- **The bell:** Radix popover focus handling. Unread rows say ", unread", and Open Support is its own target above the row's link.

## 8. Squint test

Screenshots `01`–`12` are in this folder: hero requested, status card per role, question first, ledger, list, Today, both bells, History v3, safety-plan starters.

## 9. Deferred, with reasons

- **Today's Escalations card:** it still reads the `monitoringData()` fixtures, so it can disagree with the new tiering-store list above it.
- **`monitoring-tiers`:** it hard-codes a weekday ("closed Tue") that drifts with the date. It will be fixed in Monitoring v3.
- **Supervisor take-over:** it is still disabled, so no supervisor can hold an assessment.
- **Probe naming:** the probe's supervisor has no draft name, so notices name it "Supervisor". A signed-in supervisor gets their own name.
