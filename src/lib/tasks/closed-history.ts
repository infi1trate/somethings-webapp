// ═══════════════════════════════════════════════════════════════════════════
// CLOSED-REVIEW HISTORY, AS A FIXTURE (Closed-tab pack §1)
//
// The Closed tab holds every closed review and grows without bound, so it has
// to be exercised at volume: date groups, virtualization, search across
// hundreds of rows. Before this the only closed reviews were the ones a tester
// had submitted in the current browser, so the tab could never be seen with
// more than a handful.
//
// ═══ DETERMINISTIC, NO RANDOMNESS ═══
// The same convention as the bulk fill in `seed.ts`: every value is a function
// of the index, so a scenario renders the same list on every load and a probe
// can assert counts. Dates are relative to `now`, so the groups land on Today,
// Yesterday and the weekdays whatever day it is.
//
// ═══ THE POOLS ARE PASSED IN ═══
// `seed.ts` owns the teen roster and mentor pool and imports this module, so
// importing them back would be a cycle.

import type { CareUpdateAssessment, CareUpdateBody } from "@/lib/record/care-demo";
import type { FieldProvenance } from "@/lib/record/field-provenance";
import { billingReviewFor } from "@/lib/tasks/billing-presentation";
import { buildClosedReview, type ClosedCareReview } from "@/lib/tasks/closed-review";
import type { BillingPayload, TaskItem } from "@/lib/tasks/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Person {
  id: string;
  name: string;
}

const CODES = {
  gad: { code: "F41.1", statement: "Generalized anxiety disorder" },
  mddModerate: { code: "F33.1", statement: "Major depressive disorder, recurrent, moderate" },
  mddMild: { code: "F33.0", statement: "Major depressive disorder, recurrent, mild" },
  adjustment: { code: "R45.89", statement: "Other symptoms involving emotional state" },
};

/** TODO-DATA. Who submitted — staff, so full names. */
const SUBMITTERS = [
  { name: "Sasha Rivera", role: "Supervisor" },
  { name: "Dana Okafor", role: "Supervisor" },
  { name: "Priya Nair", role: "Lead mentor" },
];

/** TODO-DATA, all prose. Three of each so neighbouring rows differ. */
const CLINICAL = [
  "Mood has lifted since the last review. Sleep is back to roughly seven hours and the teen describes school as manageable again. No new risk content in the mentorship conversations.",
  "Low mood persists, concentrated in the evenings. The teen has withdrawn from two activities they previously enjoyed and reports more frequent arguments at home.",
  "Anxiety around exams is the dominant theme. Physical symptoms (stomach aches, restlessness) are reported on school mornings and ease at weekends.",
];
const DIAGNOSTIC = [
  "PHQ-9 moved from 14 to 9 across the two most recent administrations, with the largest drops on the mood and sleep items.",
  "PHQ-9 is 15, in the moderately severe band, with items 1, 2 and 4 each scoring 3. This matches what the teen describes in conversation.",
  "GAD-7 is 12. Worry and restlessness items carry most of the score, consistent with the exam-related pattern the mentor has noted.",
];
const ASSESSMENTS: CareUpdateAssessment[] = ["improved", "maintained", "escalated"];
const PROVENANCE: FieldProvenance[] = ["authored", "ai_inserted", "ai_assisted"];

/** ═══ HOW FAR BACK EACH ONE CLOSED ═══
 *  A power curve over ~120 days rather than an even spread: real history is
 *  dense near the present and thins out, and an even spread at n=40 would put
 *  one review every three days and leave Today and Yesterday empty. */
function submittedAgo(i: number, n: number, spanDays: number): number {
  const days = Math.pow(i / Math.max(1, n), 1.6) * spanDays;
  /* Jitter inside the day so rows in one group do not share a minute. */
  return days * DAY + 25 * MINUTE + (i % 7) * 37 * MINUTE;
}

export function closedHistory(
  now: number,
  n: number,
  pools: { teens: readonly Person[]; mentors: readonly Person[] },
  /** How far back the oldest review closed. 120 by default; the 600-row scale
   *  scenario passes more so its tail crosses New Year and the year-bearing
   *  `Review date` format (`Sep 29, 2025 · 4:46 PM`) renders on real rows. */
  spanDays = 120
): ClosedCareReview[] {
  const out: ClosedCareReview[] = [];
  for (let i = 0; i < n; i++) {
    const teen = pools.teens[(i * 7) % pools.teens.length];
    const mentor = pools.mentors[(i * 3) % pools.mentors.length];
    const intake = i % 4 === 3;
    const submittedAt = now - submittedAgo(i, n, spanDays);
    /* ONE IN SIX LATE — submitted 60–90h after reception, past the 48h line. */
    const responseMs = i % 6 === 5 ? (60 + (i % 31)) * HOUR : (4 + (i % 37)) * HOUR;
    const openedAt = submittedAt - responseMs;

    /* THE FOUR OUTCOMES. An intake has nothing on record, so it is always
       `assigned`; the others rotate change-accepted / change-declined / renewal. */
    const variant = intake ? 3 : i % 3;
    const prior = variant === 3 ? null : variant === 2 ? CODES.gad : CODES.mddMild;
    const recommended =
      variant === 3 ? (i % 2 ? CODES.adjustment : CODES.gad) : variant === 2 ? CODES.gad : CODES.mddModerate;
    const committed = variant === 1 ? CODES.mddMild : recommended;

    const payload: BillingPayload = {
      kind: "billing",
      isReReview: !intake,
      current: prior,
      survey: { instrument: "PHQ-9", score: 6 + (i % 14), max: 27, takenAt: openedAt - 2 * DAY },
      mentorStats: {
        daysInMentorship: 21 + ((i * 13) % 280),
        messagesLast30: 8 + ((i * 7) % 74),
        videoLast30: i % 4,
      },
      aiSummary:
        "Scores have moved across the last three assessments, with the mood items accounting for most of the change.",
      recommended,
    };
    const item: TaskItem = {
      id: `closed-${i + 1}`,
      domain: "billing",
      taskType: intake ? "intakeBillingReview" : "monthlyReReview",
      urgencyRank: 0,
      teenId: teen.id,
      teenDisplayName: teen.name,
      mentorId: mentor.id,
      mentorName: mentor.name,
      objectId: `review-closed-${i + 1}`,
      openedAt,
      slaDeadline: null,
      status: "open",
      payload,
    };
    const body: CareUpdateBody = {
      assessment: ASSESSMENTS[i % 3],
      clinical: CLINICAL[i % 3],
      diagnostic: DIAGNOSTIC[(i + 1) % 3],
    };
    out.push(
      buildClosedReview({
        item,
        review: billingReviewFor(item, payload),
        committedCode: committed.code,
        committedStatement: committed.statement,
        body,
        provenance: { clinical: PROVENANCE[i % 3], diagnostic: PROVENANCE[(i + 2) % 3] },
        submittedAt,
        submittedBy: SUBMITTERS[i % SUBMITTERS.length],
      })
    );
  }
  return out;
}
