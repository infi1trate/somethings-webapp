// THE RECORD SCENARIO REGISTRY — axis 2 of the DEV harness.
//
// ═══════════════════════════════════════════════════════════════════════════
// A SCENARIO IS A CURATED POINTER, NOT A DUPLICATE FIXTURE.
//
// Most of these states already exist somewhere in the 26-teen roster — a paused
// mentorship, an overdue review, four flags on one conversation. Building a second
// fixture for each would mean two records that are supposed to exhibit the same
// state and will drift apart the first time one is edited. So a scenario names the
// record that ALREADY exhibits it, plus what it is there to exercise.
//
// EVERY ENTRY DECLARES `data`:
//   "real"   the record genuinely exhibits this today; verified against the
//            fixtures, not assumed.
//   "mocked" the record was shaped to exhibit it, or the state needs data this
//            system cannot produce yet. The `note` says which.
//
// That distinction is the point of the registry. A reviewer looking at a screenshot
// needs to know whether they are looking at behaviour or at a dressed-up fixture.
//
// AXIS INDEPENDENCE. This axis is orthogonal to the role axis. Crossing them is
// the reason the harness exists — "review overdue with an open escalation" ×
// "mentor viewing" is a real permutation, and the mentor must see the same record
// with the action affordances ABSENT rather than disabled.
// ═══════════════════════════════════════════════════════════════════════════

// ═══ THIS FILE IS THE README (brief Part 2 Phase 4) ═══
//
// Every scenario carries `exercises` (what to look at) and `data` ("real" or
// "mocked", with a `note` when mocked) inline, so the index and the fixtures
// cannot drift apart the way a separate document would. The harness renders both
// fields, which is what makes a screenshot self-documenting.
//
//   TEEN RECORDS                 SUBJECT  DATA
//   new                          t1       real
//   intake-complete              t11      real
//   steady                       t18      real    (imperfect — see note)
//   review-intake                t9       real    warning tone at the intake stage
//   review-day30                 t23      real    the Day 30 stage; see below
//   review-90                    t17      real    weighted over the last 3 surveys
//   review-overdue               t19      real
//   single-flag                  t6       real
//   flag-cluster                 t21      real    4 flags, one day, one mark
//   escalation-crisis            t13      real
//   escalation-and-review        t13      real    the two-item ordering case
//   paused                       t3       real
//   deactivated                  t22      real
//   longitudinal                 t17      mocked  206 days, not 8+ months;
//                                                 SHARES t17 with review-90
//   low-data                     t5       real
//   attention-only               t12      mocked  role-dependent — view as mentor
//
//   STAFF RECORDS                SUBJECT  DATA
//   mentor                       m1       real
//   mentor-at-capacity           m2       mocked  capacity is derived, not stored
//   lead-mentor                  s-brandy real
//   supervisor                   s-stephen real
//   admin                        s-stephen mocked  admin is a role, not a subject
//
// FOUR OF TWENTY-ONE ARE MOCKED, and each note says exactly what is missing
// rather than what was invented.
//
// TWO PAIRS SHARE A SUBJECT ON PURPOSE, and both are declared in the entries
// themselves: t13 (escalation-crisis + escalation-and-review) and t17
// (review-90 + longitudinal). `record-scenarios.test.ts` holds that list and
// FAILS on any third pair — an accidental duplicate means two scenarios are one
// screenshot, which is how `review-90` and `review-overdue` were the same screen
// for a while without anyone noticing.

export type ScenarioKind = "teen" | "staff";

export interface RecordScenario {
  /** URL value. Stable — these get pasted into review threads. */
  id: string;
  /** TODO-COPY. Shown in the harness so a screenshot is self-documenting. */
  label: string;
  kind: ScenarioKind;
  /** The record this scenario opens. */
  subjectId: string;
  /** What this scenario is FOR — the thing a reviewer should be looking at. */
  exercises: string;
  data: "real" | "mocked";
  /** Required when `data` is "mocked". */
  note?: string;
}

/** ═══ TEEN RECORD SCENARIOS (brief Part 2 Phase 2) ═══ */
export const TEEN_SCENARIOS: RecordScenario[] = [
  {
    id: "new",
    label: "New — day 1",
    kind: "teen",
    subjectId: "t1",
    exercises:
      "Empty everything: no survey, no presentation, no history. Care summary low-data, pattern block suppressed.",
    data: "real",
  },
  {
    id: "intake-complete",
    label: "Intake complete",
    kind: "teen",
    subjectId: "t11",
    exercises:
      "First survey in, presentation recommended, intake review pending in the action slot.",
    data: "real",
  },
  {
    id: "steady",
    label: "Steady, healthy",
    kind: "teen",
    subjectId: "t18",
    exercises:
      "No flags at all across 188 days. Pattern block renders on trajectory alone — no flag sentence, no clustering sentence.",
    data: "real",
    note:
      "IMPERFECT MATCH, stated rather than hidden: the brief asks for the pattern block thin OR suppressed, and t18 renders it (4 assessments, 3 presentation events). It is the closest healthy long record in the roster. A genuinely suppressed healthy record is `low-data`.",
  },
  {
    /* ═══ THIS ENTRY HAS NOW BEEN WRONG TWICE, IN OPPOSITE DIRECTIONS ═══
       FIRST it read `id: "review-30", label: "30-day review due", subjectId: "t17"`
       while t17 is 196 days in on the QUARTERLY cadence, so the record rendered
       "due in 2 days · 90-day review" under a heading naming a 30-day review.

       THE FIX FOR THAT WAS ALSO WRONG. It concluded that "30-day review" was not a
       state this product has, and repointed the scenario at the INTAKE stage — on
       the reasoning that a review falling due at the 30-day mark happens while a
       teen is still in intake. That arithmetic is right and the conclusion did not
       follow: `STAGE_LABEL` is Intake / **Day 30** / 90-day review, so Day 30 is a
       stage the product names on the chip, and the repoint left it with no scenario
       at all. Reported from the app: "were missing the 30 day review scenario".

       So there are TWO entries, because there are two states and they render
       differently. This one is the intake-stage review, and it moves off t6 —
       `single-flag` already owns t6, and one record answering to two scenario names
       is the duplication this registry exists to prevent. t9 is 16 days past his
       first assessment with the first review 14 days out: intake stage, inside the
       14-day window, so the warning tone this scenario exists to show is live. */
    id: "review-intake",
    label: "Intake review due",
    kind: "teen",
    subjectId: "t9",
    exercises:
      "First review due in 2 weeks — the warning tone on the cadence row at the intake stage. Chip reads \"due in 2 weeks · Intake\".",
    data: "real",
  },
  {
    /* ═══ THE STAGE THE PRODUCT LABELS "Day 30" ═══
       Restored after the repoint above deleted it. This is the stage a teen is in
       between their day-30 review and their day-120 one, and it is the only one of
       the three whose chip and whose `REVIEW_NOUN` disagree in wording ("Day 30" on
       the chip, "day 30 review" in the compose dialog) — worth a scenario of its
       own for that alone.
       t23 is the ONLY day30 record inside the 14-day warning window: t8 is 72 days
       out, t15 80, t24 16 — all neutral. Measured, not assumed. */
    id: "review-day30",
    label: "Day 30 review due",
    kind: "teen",
    subjectId: "t23",
    exercises:
      "Day 30 cadence with the review 8 days out — warning tone, and the one stage whose chip wording differs from the noun the compose dialog uses. Chip reads \"due in 8 days · Day 30\".",
    data: "real",
  },
  {
    /* ═══ REPOINTED FROM t19 TO t17, WHICH ALSO REMOVES A DUPLICATE ═══
       This and `review-overdue` both named t19, in the identical state — "overdue by
       10 days · 90-day review". So the scenario called "90-day review DUE"
       demonstrated a review that was already overdue, and two of the twenty
       scenarios were the same screenshot.
       t17 is the record that genuinely shows a 90-day review coming due: quarterly
       stage, due in 2 days, warning tone. It also has five assessments against t19's
       three, which serves the "multiple contributing surveys" line better. */
    id: "review-90",
    label: "90-day review due",
    kind: "teen",
    subjectId: "t17",
    exercises:
      "Quarterly cadence, due in 2 days, with the review reading a recency-weighted score across the last three of five readings — 10 in the moderate band, expandable to all three surveys and their answers. Chip reads \"due in 2 days · 90-day review\".",
    data: "real",
    note:
      "WAS MOCKED AND IS NOT ANY MORE, which is the only reason this note survives. It used to say the recency-weighted aggregate the brief describes did not exist — `scoreSeriesFor` returns a flat series, and no weighting function existed anywhere in the codebase, so the card showed the latest score under a heading promising a period. `weightedAggregate` now computes it from t17's own readings and the card shows 10 across the last three rather than the newest 8. SHARES t17 WITH `longitudinal`, declared rather than accidental: t17 is the only quarterly record whose review is due-and-not-overdue inside the warning window (t13 and t19 are overdue, t18 and t21 are 80+ days out, and the rest of the quarterly records are closed). The two scenarios read different regions of the same screen — this one the action slot, `longitudinal` the History density.",
  },
  {
    /* KEEPS t19, and is now the ONLY scenario pointing at it — `review-90` used to
       name the same record in the same state. */
    id: "review-overdue",
    label: "Review overdue",
    kind: "teen",
    subjectId: "t19",
    exercises:
      "Overdue by 10 days — the state on the presentation card, the Care tab badge and the cadence row simultaneously.",
    data: "real",
  },
  {
    id: "single-flag",
    label: "Single open risk flag",
    kind: "teen",
    subjectId: "t6",
    exercises:
      "One open flag and nothing else competing — the un-grouped flag card.",
    data: "real",
  },
  {
    id: "flag-cluster",
    label: "Multiple flags, one conversation",
    kind: "teen",
    subjectId: "t21",
    exercises:
      "Four flags on one conversation on one day. The grouping case: one coalesced timeline mark reading '4 flags', and four addressable History rows behind it.",
    data: "real",
  },
  {
    id: "escalation-crisis",
    label: "Open escalation, crisis-elevated",
    kind: "teen",
    subjectId: "t13",
    exercises:
      "Crisis-elevated escalation — the label band gains the word and nothing else changes.",
    data: "real",
  },
  {
    id: "escalation-and-review",
    label: "Escalation + review due",
    kind: "teen",
    subjectId: "t13",
    exercises:
      "Two competing items at once: an open escalation AND a review overdue by 5 days. Multi-item ordering across Overview's attention regions and the Care tab.",
    data: "real",
  },
  {
    id: "paused",
    label: "Paused teen",
    kind: "teen",
    subjectId: "t3",
    exercises:
      "Paused mentorship — ongoing, so cadence continues and the record is not treated as ended.",
    data: "real",
  },
  {
    id: "deactivated",
    label: "Deactivated teen",
    kind: "teen",
    subjectId: "t22",
    exercises:
      "Mentorship ended: no current mentor, next review not scheduled, history intact behind it.",
    data: "real",
  },
  {
    id: "longitudinal",
    label: "Rich longitudinal record",
    kind: "teen",
    subjectId: "t17",
    exercises:
      "13 events across 206 days: three flags, five assessments, three presentation events including a change with an amendment chain. Pattern block and timeline strip fully populated with all three mark classes.",
    data: "mocked",
    note:
      "FALLS SHORT OF THE BRIEF'S 8+ MONTHS. t17 spans 206 days (~6.8 months) and is the longest record in the roster — Phase 0 reported this. Everything else the scenario asks for is real and present. A true 8-month record is net-new fixture data and is NOT invented here.",
  },
  {
    id: "low-data",
    label: "Low data",
    kind: "teen",
    subjectId: "t5",
    exercises:
      "Care summary in its low-data state (0 exchanges across 0 days), pattern block suppressed entirely — no placeholder for either.",
    data: "real",
  },
  {
    id: "attention-only",
    label: "Attention-only",
    kind: "teen",
    subjectId: "t12",
    exercises:
      "A record whose only items are Attention-signal, so Overview renders 'Worth a look' with no 'Action required' region above it.",
    data: "mocked",
    note:
      "NEEDS VERIFYING PER ROLE. Whether a record is attention-only depends on the VIEWER — the same item is action for a supervisor and attention for a mentor. t12 carries a pending presentation review, which is action-tier for a supervisor; view this scenario as MENTOR to see the attention-only shape. That role dependency is exactly what the two axes exist to expose.",
  },
];

/** ═══ STAFF RECORD SCENARIOS (brief Part 2 Phase 3) ═══ */
export const STAFF_SCENARIOS: RecordScenario[] = [
  {
    id: "mentor",
    label: "Mentor",
    kind: "staff",
    subjectId: "m1",
    exercises:
      "Active mentees, a paused mentee, and past mentees across both outcome classes.",
    data: "real",
  },
  {
    id: "mentor-at-capacity",
    label: "Mentor at capacity",
    kind: "staff",
    subjectId: "m2",
    exercises: "No slots open — the capacity caption at its ceiling.",
    data: "mocked",
    note:
      "CAPACITY IS DERIVED FROM THE MENTEE COUNT, so 'at capacity' depends on which mentees the fixture assigns rather than on a stored flag. Verify the caption reads as full rather than assuming the fixture holds it.",
  },
  {
    id: "lead-mentor",
    label: "Lead mentor",
    kind: "staff",
    subjectId: "s-brandy",
    exercises: "Own mentees plus the mentors they lead — two lists, one record.",
    data: "real",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    kind: "staff",
    subjectId: "s-stephen",
    exercises: "Supervision list populated.",
    data: "real",
  },
  {
    id: "admin",
    label: "Admin",
    kind: "staff",
    subjectId: "s-stephen",
    exercises:
      "No practice tab — the tab set itself differs rather than the tab rendering empty.",
    data: "mocked",
    note:
      "There is no admin PERSON in the fixtures — admin is a VIEWER role, not a subject. Select this scenario and switch the role axis to Admin; the subject stays a supervisor record and the tab set changes. Another case the two axes make visible.",
  },
];

export const ALL_SCENARIOS: RecordScenario[] = [
  ...TEEN_SCENARIOS,
  ...STAFF_SCENARIOS,
];

export function scenarioById(id: string | null | undefined): RecordScenario | null {
  if (!id) return null;
  return ALL_SCENARIOS.find((s) => s.id === id) ?? null;
}

/** THE URL PARAMETER. One name, one place — the harness writes it and the record
 *  page reads it, and nothing else invents a spelling. */
export const SCENARIO_PARAM = "scenario";

/** Where a scenario opens. Carries the scenario id forward so the harness can
 *  show which one is active and the link stays shareable. */
export function scenarioHref(s: RecordScenario): string {
  const tab = s.kind === "teen" ? "care" : "overview";
  return `/admin/person/${s.subjectId}?tab=${tab}&${SCENARIO_PARAM}=${s.id}`;
}
