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
//   review-intake                t6       real    was review-30 → t17; see below
//   review-90                    t17      mocked  no weighted aggregate exists
//   review-overdue               t19      real
//   single-flag                  t6       real
//   flag-cluster                 t21      real    4 flags, one day, one mark
//   escalation-crisis            t13      real
//   escalation-and-review        t13      real    the two-item ordering case
//   paused                       t3       real
//   deactivated                  t22      real
//   longitudinal                 t17      mocked  206 days, not 8+ months
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
// FOUR OF TWENTY ARE MOCKED, and each note says exactly what is missing rather
// than what was invented.

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
    /* ═══ THIS ENTRY WAS WRONG ON TWO COUNTS, AND BOTH WERE REPORTED FROM THE APP ═══
       It read `id: "review-30", label: "30-day review due", subjectId: "t17"`, and
       t17 is 196 days into a mentorship on the QUARTERLY cadence. What the record
       rendered was "due in 2 days · 90-day review", which is correct for t17 and has
       nothing to do with a 30-day review — so a reviewer selecting the scenario got
       a screen that contradicted its own name at every data point.

       AND "30-day review" IS NOT A STATE THIS PRODUCT HAS. `STAGE_LABEL` is
       Intake / Day 30 / 90-day review. A review falling due at the 30-day mark
       happens while a teen is in the INTAKE stage (`dueOffset = 30`), and the chip
       then reads "due in N days · Intake". Measured: the string "30-day" appears
       nowhere in the rendered record — only in this file's own label, which is
       where it came from.

       So the id and the label now name the stage the product names, and the subject
       is a teen who is actually in it: t6 is 20 days past her first assessment, in
       intake, with her first review due in 10 days — inside the 14-day window, so
       the warning tone this scenario exists to show is live. */
    id: "review-intake",
    label: "Intake review due",
    kind: "teen",
    subjectId: "t6",
    exercises:
      "First review due in 10 days — the warning tone on the cadence row, at the intake stage. Chip reads \"due in 10 days · Intake\".",
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
      "Quarterly cadence, due in 2 days — five assessments behind it. Chip reads \"due in 2 days · 90-day review\".",
    data: "mocked",
    note:
      "The RECURRENCE is real (t17 is on a 90-day cadence with a review due in 2 days) but the AGGREGATE RECENCY-WEIGHTED SCORE the brief describes does not exist: `scoreSeriesFor` returns a flat series and no weighting function exists anywhere in the codebase. The card shows the latest score, not a weighted aggregate. Unchanged by the repoint — the gap is in `scoreSeriesFor`, not in the subject.",
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
