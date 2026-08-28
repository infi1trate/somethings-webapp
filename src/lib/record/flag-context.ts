// CONTEXT AT THE DECISION POINT — what a supervisor needs beside one flag.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS. The review modal showed one flag in isolation, and that is
// exactly where a supervisor decides what it means. "Third flag in four months,
// two about the home environment, and the score had already crossed into the
// moderate band" is a different decision from the same flag with nothing around
// it — and the modal is the one place that context was unavailable.
//
// READ-ONLY, AND DELIBERATELY THIN. This informs a decision; it does not become a
// second place to act. There is no resolution control here, no link that changes
// anything, and nothing on this shape can be written back.
//
// COMPUTED AT THE CALL SITE, NOT INSIDE THE MODAL. Phase 0 established that the
// modal's caller (record-task-regions.tsx) already holds the teen and reads the
// care store, so the modal takes a prepared shape as a prop rather than growing
// its own queries. A modal that queried would duplicate the caller's reads and
// drift from them.
//
// SAME GUARDRAILS AS THE PATTERN BLOCK. No causal claim, no prediction, no rating
// of the teen. The assessment state is stated as a fact about a date — score, its
// band, the instrument, when — and the prior flags are listed with their own
// recorded resolutions. Nothing here interprets.
// ═══════════════════════════════════════════════════════════════════════════

import {
  INSTRUMENT_MAX,
  careTimelineFor,
  severityFor,
  type CareStoreSlice,
} from "@/lib/record/care-demo";
import { categoryLabel, type CareFlagRecord } from "@/lib/record/people-demo";

const DAY = 86_400_000;

/** THE MOST RECENT THREE, per the brief. Three because the modal is a decision
 *  surface and not a history view — the full list is one link away, and a fourth
 *  row starts competing with the flag being reviewed. */
export const PRIOR_FLAG_LIMIT = 3;

export interface PriorFlagRow {
  id: string;
  at: number;
  /** TODO-COPY. Joined category labels, never raw wire values. */
  categories: string;
  /** TODO-COPY. "Resolved — supported" / "Open". */
  resolution: string;
}

export interface ConcurrentAssessment {
  instrument: string;
  score: number;
  /** The instrument's own maximum, from INSTRUMENT_MAX — never a literal. */
  max: number;
  /** TODO-COPY. The instrument's band. */
  band: string;
  at: number;
}

export interface FlagContext {
  /** Most recent first, excluding the flag under review. */
  priorFlags: PriorFlagRow[];
  /** How many priors exist in total, so "3 of 7" can be honest about the trim. */
  priorTotal: number;
  /** The assessment in force WHEN THIS FLAG WAS RAISED — the most recent one at
   *  or before that moment, not the latest on the record. A supervisor reviewing a
   *  flag from July needs July's score, and showing today's would silently answer
   *  a different question. */
  assessmentAtRaise: ConcurrentAssessment | null;
}

export function flagContextFor(
  teenId: string,
  flag: CareFlagRecord,
  allFlags: CareFlagRecord[],
  now: number,
  store: CareStoreSlice = {}
): FlagContext {
  const raisedAt = now - flag.daysAgo * DAY;

  // ── PRIOR FLAGS. Strictly BEFORE this one, newest first.
  const priors = allFlags
    .filter((f) => f.id !== flag.id)
    .map((f) => ({ f, at: now - f.daysAgo * DAY }))
    .filter((x) => x.at < raisedAt)
    .sort((a, b) => b.at - a.at);

  const priorFlags: PriorFlagRow[] = priors
    .slice(0, PRIOR_FLAG_LIMIT)
    .map(({ f, at }) => ({
      id: f.id,
      at,
      categories:
        (f.categories ?? []).map(categoryLabel).join(", ") || "Uncategorised",
      // TODO-COPY. The flag's OWN recorded outcome, not a re-authored one.
      resolution:
        f.resolvedDaysAgo === undefined
          ? "Open"
          : f.outcome
            ? `Resolved — ${f.outcome}`
            : "Resolved",
    }));

  // ── THE ASSESSMENT IN FORCE AT THAT MOMENT.
  const assessments = careTimelineFor(teenId, now, store)
    .filter((e) => e.type === "assessment" && e.occurredAt <= raisedAt)
    .sort((a, b) => b.occurredAt - a.occurredAt);

  let assessmentAtRaise: ConcurrentAssessment | null = null;
  const latest = assessments[0];
  if (latest) {
    const instrument = latest.description;
    const max = INSTRUMENT_MAX[instrument as keyof typeof INSTRUMENT_MAX];
    // NO MAX MEANS NO ROW. An instrument this product has not defined a ceiling
    // for cannot have "score / max" rendered against it, and inventing 27 for an
    // unknown instrument is the kind of guess a clinical surface must not make.
    if (max !== undefined) {
      const score = (latest.items ?? []).reduce((a, i) => a + i.points, 0);
      assessmentAtRaise = {
        instrument,
        score,
        max,
        band: severityFor(instrument as "PHQ-9" | "GAD-7", score),
        at: latest.occurredAt,
      };
    }
  }

  return { priorFlags, priorTotal: priors.length, assessmentAtRaise };
}
