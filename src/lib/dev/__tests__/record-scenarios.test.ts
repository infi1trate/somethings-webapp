// THE GUARD ON THE SCENARIO REGISTRY'S OWN CLAIMS.
//
// ═══ WHY THIS TEST EXISTS ═══
//
// The registry's contract is that a scenario NAMES A RECORD THAT ALREADY EXHIBITS
// THE STATE, and `data: "real"` asserts exactly that. Nothing verified it, and one
// entry had been wrong for long enough to be reported from the app: `review-30`
// pointed at t17, who is 196 days into a mentorship on the quarterly cadence, so
// selecting "30-day review due" produced a screen reading "due in 2 days · 90-day
// review". Every data point on it contradicted the scenario's own name.
//
// A test cannot verify "exhibits the state" in general — most of these states are
// visual. But the review scenarios name a MACHINE-READABLE state (a cadence stage
// plus a due/overdue distinction), so those three can be held exactly, and they are
// the three that drifted.
//
// ═══ AND IT CATCHES THE DUPLICATE — ACROSS THE WHOLE REGISTRY ═══
//
// `review-90` and `review-overdue` both named t19 in the identical state, so two of
// the twenty scenarios were the same screenshot. A registry of curated pointers is
// only worth having if the pointers are distinct.
//
// THE FIRST VERSION OF THAT CHECK ONLY COMPARED THE REVIEW SCENARIOS TO EACH OTHER,
// and the fix it was written to guard introduced two new duplicates against
// NON-review scenarios (`review-intake` onto t6, already `single-flag`; `review-90`
// onto t17, already `longitudinal`) while removing one. The test passed the whole
// time. It now compares every scenario to every other, with the deliberate pairs
// declared by name — so sharing a subject is a decision somebody wrote down rather
// than something a test failed to look at.
//
// ═══ AND IT HOLDS THE FIXTURES' SEVERITY COHERENT ═══
//
// A pending review renders the survey's BAND ("in the moderate band", from the
// score) beside the recommended code's STATEMENT (which carries its own severity
// word). Three fixtures had those disagreeing — t8 stated `severity: "moderate"`
// next to a mild code inside one object literal, t13's rationale said the scores
// rose INTO the moderate band and then recommended the mild code, and t17 ran five
// readings of 10–15 under a recommendation of "recurrent, mild". Two numbers for one
// clinical judgment on one card, which is the same class of defect as the score/items
// mismatch `assertScoreMatchesItems` already guards.

import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, scenarioById } from "@/lib/dev/record-scenarios";
import {
  AGGREGATE_WEIGHTS,
  cadenceFor,
  careTimelineFor,
  pendingReviewFor,
  reviewDueState,
  severityFor,
  STAGE_LABEL,
  weightedAggregate,
} from "@/lib/record/care-demo";
import { DEMO_TEENS } from "@/lib/record/people-demo";

/** A fixed instant. Every fixture is positioned relative to a passed `now`, so the
 *  test pins one rather than depending on when it runs. */
const NOW = new Date("2026-09-01T12:00:00.000Z").getTime();

/** What each review scenario CLAIMS, in machine-readable form. Written here rather
 *  than parsed out of the label, because parsing prose is how a test ends up
 *  agreeing with a typo. */
const REVIEW_CLAIMS = [
  { id: "review-intake", stage: "intake" as const, overdue: false },
  { id: "review-day30", stage: "day30" as const, overdue: false },
  { id: "review-90", stage: "quarterly" as const, overdue: false },
  { id: "review-overdue", stage: "quarterly" as const, overdue: true },
];

/** ═══ THE PAIRS THAT SHARE A SUBJECT ON PURPOSE ═══
 *
 *  Each is justified in the registry entry itself. Listing them here rather than
 *  exempting duplicates in general is the point: a new collision fails, and making
 *  it pass means writing down why two scenarios are one record.
 *
 *  Unordered — the test compares sorted pairs. */
const DECLARED_SHARED_SUBJECTS: ReadonlyArray<readonly [string, string]> = [
  // One record carrying an open escalation AND a due review. The second scenario
  // exists for the ORDERING of two items in the action region, which by definition
  // needs both on one record.
  ["escalation-crisis", "escalation-and-review"],
  // t17 is the only quarterly record due-but-not-overdue inside the warning window,
  // and also the longest history in the roster. Different regions of one screen.
  ["review-90", "longitudinal"],
  // Admin is a ROLE, not a person — there is no separate admin staff record to point
  // at, which is why `admin` is marked mocked.
  ["supervisor", "admin"],
];

describe("the record scenario registry", () => {
  it("every scenario resolves to a subject", () => {
    expect(ALL_SCENARIOS.length).toBeGreaterThan(15);
    for (const s of ALL_SCENARIOS) {
      expect(scenarioById(s.id), s.id).toBeDefined();
      expect(s.subjectId.length, s.id).toBeGreaterThan(0);
    }
  });

  it("every mocked scenario says what is missing", () => {
    // The `data` field is the whole point of the registry — a reviewer looking at a
    // screenshot needs to know whether they are seeing behaviour or a dressed-up
    // fixture. "mocked" with no note is the same as no label at all.
    for (const s of ALL_SCENARIOS) {
      if (s.data !== "mocked") continue;
      expect(s.note, `${s.id} is mocked with no note`).toBeDefined();
      expect(s.note!.length, s.id).toBeGreaterThan(40);
    }
  });

  it("no scenario label names a cadence the product cannot render", () => {
    /* THE ROOT OF THE ORIGINAL BUG. The label read "30-day review due", and the
       three stages this product renders are Intake, Day 30 and 90-day review — so
       no record could ever have shown those words. A label naming a string the
       product does not have is a label that will always be wrong about something.
       MEASURED at the time: "30-day" appeared nowhere in the rendered record. */
    const renderable = Object.values(STAGE_LABEL).map((l) => l.toLowerCase());
    for (const s of ALL_SCENARIOS) {
      for (const phrase of s.label.toLowerCase().match(/[0-9]+-day [a-z]+/g) ?? []) {
        expect(
          renderable.some((r) => r.includes(phrase)),
          `"${s.label}" names "${phrase}", which is not one of: ${renderable.join(" / ")}`
        ).toBe(true);
      }
    }
  });
});

describe("the review scenarios exhibit the state they name", () => {
  it("each one's subject is in the cadence stage its label claims", () => {
    for (const claim of REVIEW_CLAIMS) {
      const scenario = scenarioById(claim.id);
      expect(scenario, `${claim.id} is missing from the registry`).toBeDefined();
      const cadence = cadenceFor(scenario!.subjectId, NOW, {});
      expect(
        cadence.stage,
        `${claim.id} → ${scenario!.subjectId}: labelled "${scenario!.label}" but the record is in the ${cadence.stage} stage, which renders as "${STAGE_LABEL[cadence.stage]}"`
      ).toBe(claim.stage);
    }
  });

  it("and its due-or-overdue state matches too", () => {
    /* THE HALF THE STAGE DOES NOT CATCH. `review-90` and `review-overdue` are both
       quarterly; what separates them is whether the review has already lapsed — and
       that is exactly the distinction that collapsed when both pointed at t19. */
    for (const claim of REVIEW_CLAIMS) {
      const scenario = scenarioById(claim.id)!;
      const cadence = cadenceFor(scenario.subjectId, NOW, {});
      expect(cadence.nextReviewDue, `${claim.id} has no review due at all`).not.toBeNull();
      const state = reviewDueState(cadence.nextReviewDue!, NOW);
      expect(
        state.label.startsWith("overdue"),
        `${claim.id} → ${scenario.subjectId}: expected ${claim.overdue ? "overdue" : "due, not overdue"} but the chip reads "${state.label}"`
      ).toBe(claim.overdue);
      // All three exist to show the WARNING TONE on the cadence row. A review due
      // in forty days renders neutral and demonstrates nothing.
      expect(state.tone, `${claim.id} is outside the warning window ("${state.label}")`).toBe(
        "warning"
      );
    }
  });

  it("no two scenarios anywhere in the registry share a subject undeclared", () => {
    /* WIDENED AFTER IT MISSED TWO. See the module note — the review-only version of
       this check passed while the fix it guarded created `review-intake` + t6 +
       `single-flag` and `review-90` + t17 + `longitudinal`. */
    const declared = new Set(
      DECLARED_SHARED_SUBJECTS.map((pair) => [...pair].sort().join(" + "))
    );
    const bySubject = new Map<string, string[]>();
    for (const s of ALL_SCENARIOS) {
      bySubject.set(s.subjectId, [...(bySubject.get(s.subjectId) ?? []), s.id]);
    }
    for (const [subject, ids] of bySubject) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join(" + ");
          expect(
            declared.has(key),
            `"${ids[i]}" and "${ids[j]}" both point at ${subject}, so they are one screenshot. Either repoint one, or add ["${ids[i]}", "${ids[j]}"] to DECLARED_SHARED_SUBJECTS with the reason.`
          ).toBe(true);
        }
      }
    }
  });

  it("every review scenario's subject is in the warning window", () => {
    // Folded out of the due/overdue test so a tone regression names itself rather
    // than arriving as a second failure on an assertion about lapsing.
    for (const claim of REVIEW_CLAIMS) {
      const scenario = scenarioById(claim.id)!;
      const cadence = cadenceFor(scenario.subjectId, NOW, {});
      const state = reviewDueState(cadence.nextReviewDue!, NOW);
      expect(state.tone, `${claim.id} → ${scenario.subjectId} reads "${state.label}"`).toBe(
        "warning"
      );
    }
  });

  it("all three renderable stages have a scenario", () => {
    /* THE GAP THE LAST FIX OPENED. Repointing `review-30` at the intake stage left
       the stage the product labels "Day 30" with no scenario at all — reported from
       the app as "were missing the 30 day review scenario". A stage the chip can
       render and the registry cannot reach is a state nobody will screenshot. */
    const covered = new Set(
      REVIEW_CLAIMS.map((c) => cadenceFor(scenarioById(c.id)!.subjectId, NOW, {}).stage)
    );
    for (const stage of Object.keys(STAGE_LABEL) as Array<keyof typeof STAGE_LABEL>) {
      expect(
        covered.has(stage),
        `no review scenario is in the ${stage} stage ("${STAGE_LABEL[stage]}")`
      ).toBe(true);
    }
  });
});

describe("a pending review's band and its recommended code agree", () => {
  /** The severity words a DSM-5 statement in this file actually carries. Matched on
   *  word boundaries so "moderate" does not match inside "moderately". */
  const CODE_SEVERITIES = ["mild", "moderate", "severe"] as const;

  /** Which code words a given PHQ-9/GAD-7 band may be paired with. "moderately
   *  severe" is a band with no code word of its own, so it accepts either
   *  neighbour; every other band is exact. */
  const ALLOWED: Record<string, readonly string[]> = {
    minimal: ["mild"],
    mild: ["mild"],
    moderate: ["moderate"],
    "moderately severe": ["moderate", "severe"],
    severe: ["severe"],
  };

  /** What the CARD shows as the band: the weighted aggregate on a quarterly review,
   *  the single displayed survey otherwise — the same precedence the card uses, so
   *  the test reads the number a mentor reads. */
  function bandOn(pending: NonNullable<ReturnType<typeof pendingReviewFor>>) {
    return pending.aggregate?.severity ?? pending.survey?.severity ?? null;
  }

  it("the stated band matches the score it is stated against", () => {
    /* THE FIRST LINK. `severity` is a STORED STRING on `CareAssessment`, and
       PENDING_DEMO writes it by hand beside the score — so it can disagree with its
       own number the way t13's PHQ-9 and t6's GAD-7 once disagreed with their item
       sums. Derived and stored values for one quantity, checked against each other. */
    const check = (
      label: string,
      s: { instrument: string; score: number; severity: string }
    ) =>
      expect(
        s.severity,
        `${label}: the ${s.instrument} scored ${s.score} and states the "${s.severity}" band`
      ).toBe(severityFor(s.instrument as "PHQ-9" | "GAD-7", s.score));

    for (const teen of DEMO_TEENS) {
      const pending = pendingReviewFor(teen.id, NOW, {});
      if (!pending) continue;
      if (pending.survey) check(teen.id, pending.survey);
      /* THE AGGREGATE CARRIES THE SAME EXPOSURE AND MORE OF IT — a weighted score
         with its own stated band, plus every survey behind it. This branch is not
         optional cover: once day 30 and 90-day reviews moved to the aggregate, a
         survey-only loop stopped covering ANY of them and would have gone on
         passing while saying nothing. */
      if (pending.aggregate) {
        check(`${teen.id} weighted`, {
          instrument: pending.aggregate.surveys[0]?.instrument ?? "",
          score: pending.aggregate.score,
          severity: pending.aggregate.severity,
        });
        pending.aggregate.surveys.forEach((s, i) =>
          check(`${teen.id} survey ${i + 1}`, s)
        );
      }
    }
  });

  it("and no rationale compares the code on record to itself", () => {
    /* The generated rationale had ONE branch and it was comparative — "X fits the
       current scores more closely than Y does". A cadence review that CONFIRMS the
       code puts the same code on both sides, and t23's card read "Generalized
       anxiety disorder fits the current scores more closely than F41.1 does".
       Found by rendering the scenario, not by reading the fixture: the fixture is
       correct (`assigned` and `pending` are both F41.1) and the sentence built from
       it was not. */
    for (const teen of DEMO_TEENS) {
      const pending = pendingReviewFor(teen.id, NOW, {});
      if (!pending) continue;
      const against = /more closely than (\S+) does/.exec(pending.rationale.text)?.[1];
      if (!against) continue;
      expect(
        against,
        `${teen.id} (${teen.name}): the rationale compares ${pending.recommended.code} to itself — "${pending.rationale.text}"`
      ).not.toBe(pending.recommended.code);
    }
  });

  it("and the recommended code carries that same severity", () => {
    /* THE SECOND LINK, AND THE ONE THAT WAS BROKEN THREE TIMES. The rationale prints
       "in the {band} band" from the score while the recommendation prints a statement
       ending in its own severity word. Nothing made them agree, so a card could — and
       did — recommend "recurrent, mild" directly beneath the words "moderate band". */
    for (const teen of DEMO_TEENS) {
      const pending = pendingReviewFor(teen.id, NOW, {});
      if (!pending) continue;

      const words = CODE_SEVERITIES.filter((w) =>
        new RegExp(`\\b${w}\\b`).test(pending.recommended.statement)
      );
      // Plenty of codes carry no severity at all — F41.1 generalised anxiety,
      // F43.22 adjustment. Nothing to reconcile on those.
      if (words.length === 0) continue;

      const band = bandOn(pending);
      expect(band, `${teen.id}: a pending review with no survey and no aggregate`).not.toBeNull();
      expect(
        words.some((w) => ALLOWED[band!]?.includes(w)),
        `${teen.id} (${teen.name}): the card shows the ${band} band and recommends "${pending.recommended.statement}" — two different severities for one judgment.`
      ).toBe(true);
    }
  });
});

describe("the recency-weighted aggregate", () => {
  const survey = (score: number, daysAgo: number, instrument = "PHQ-9") => ({
    instrument,
    at: NOW - daysAgo * 86_400_000,
    score,
    severity: severityFor(instrument as "PHQ-9" | "GAD-7", score),
    items: [],
  });

  it("weights by recency in the ratio the one shipped card already implies", () => {
    /* t13's hand-written aggregate is the ONLY one that existed before this
       function, and its comment states the number outright: "11 rather than the
       flat mean of 10.7". That pins the ratio rather than leaving it to taste —
       3:2:1 returns 67/6 = 11.17 → 11. A test asserting only "newer counts for
       more" would pass for a dozen ratios that all make that card lie. */
    expect(AGGREGATE_WEIGHTS).toEqual([3, 2, 1]);
    expect(
      weightedAggregate([survey(11, 12), survey(13, 74), survey(8, 121)])?.score
    ).toBe(11);

    /* AND A CASE THAT SEPARATES WEIGHTED FROM FLAT. t13's own numbers do not: its
       flat mean is 10.67, which rounds to 11 as well, so on that fixture alone a
       plain mean would look correct. t17's do — 59/6 = 9.83 weighted against 32/3
       = 10.67 flat. */
    expect(
      weightedAggregate([survey(8, 14), survey(11, 88), survey(13, 154)])?.score
    ).toBe(10);
    expect(Math.round((8 + 11 + 13) / 3)).toBe(11);
  });

  it("reads only the three most recent surveys", () => {
    const five = [
      survey(8, 14),
      survey(11, 88),
      survey(13, 154),
      survey(27, 190),
      survey(27, 204),
    ];
    // The two 27s are deliberately extreme: if the window leaked they would drag
    // the score far past anything the first three can produce.
    expect(weightedAggregate(five)?.score).toBe(10);
    expect(weightedAggregate(five)?.surveys).toHaveLength(3);
  });

  it("never averages across instruments", () => {
    /* A PHQ-9 is scored out of 27 and a GAD-7 out of 21, so a mean across them is
       a number with no denominator. `scoreSeriesFor` filters the same way, and
       t13's comment says an aggregate is "only meaningful across comparable
       scores" — this is that sentence, enforced. */
    const mixed = [survey(8, 14), survey(20, 60, "GAD-7"), survey(13, 154)];
    const a = weightedAggregate(mixed);
    expect(a?.surveys.every((s) => s.instrument === "PHQ-9")).toBe(true);
    // (8·3 + 13·2) / 5 = 10 — the GAD-7 is absent, not folded in at some weight.
    expect(a?.score).toBe(10);
  });

  it("returns null when there is nothing to weight", () => {
    // A "recency-weighted" label over a single reading would describe arithmetic
    // that never happened, and "across 1 surveys" would be ungrammatical too.
    expect(weightedAggregate([])).toBeNull();
    expect(weightedAggregate([survey(11, 12)])).toBeNull();
    expect(weightedAggregate([survey(11, 12), survey(9, 60, "GAD-7")])).toBeNull();
  });

  it("bands the weighted score, not the newest survey", () => {
    /* THE WHOLE POINT, AND THE REASON TWO FIXTURES CHANGED CODE. t17's newest
       reading is 8 — mild — while the period it sits in weights to 10, which is
       moderate. The card must say what the period says. */
    const a = weightedAggregate([survey(8, 14), survey(11, 88), survey(13, 154)]);
    expect(a?.score).toBe(10);
    expect(a?.severity).toBe("moderate");
    expect(severityFor("PHQ-9", 8)).toBe("mild");
  });
});

describe("which evidence block a pending review gets", () => {
  it("exactly one of survey and aggregate is ever set", () => {
    // `PresentationReview` states this as its contract and
    // `care-review-card.tsx` branches its entire evidence block on it, so a
    // review carrying both or neither renders something nobody designed.
    for (const teen of DEMO_TEENS) {
      const pending = pendingReviewFor(teen.id, NOW, {});
      if (!pending) continue;
      expect(
        !!pending.survey !== !!pending.aggregate,
        `${teen.id}: survey=${!!pending.survey} aggregate=${!!pending.aggregate}`
      ).toBe(true);
    }
  });

  it("intake shows one survey; day 30 and 90-day show the weighted period", () => {
    /* The comparable count is derived from the TIMELINE rather than read off the
       aggregate, so a day30 record that failed to get one still fails this test.
       Reading `aggregate.surveys.length` would have made the assertion agree with
       whatever the code did. */
    for (const teen of DEMO_TEENS) {
      const pending = pendingReviewFor(teen.id, NOW, {});
      if (!pending) continue;
      const stage = cadenceFor(teen.id, NOW, {}).stage;
      if (stage === "intake") {
        expect(
          pending.aggregate,
          `${teen.id} is at intake, where there is one reading by definition`
        ).toBeNull();
        continue;
      }
      const assessments = careTimelineFor(teen.id, NOW, {})
        .filter((e) => e.type === "assessment")
        .sort((a, b) => b.occurredAt - a.occurredAt);
      const instrument = assessments[0]?.description;
      const comparable = assessments.filter(
        (e) => e.description === instrument
      ).length;
      if (comparable < 2) continue; // nothing to weight — see PENDING_DEMO
      expect(
        pending.aggregate,
        `${teen.id} is at the ${stage} stage with ${comparable} comparable ${instrument} results and still shows a single survey`
      ).not.toBeNull();
    }
  });

  it("no intake record yet has two comparable surveys, so the guard above is a canary", () => {
    /* ═══ THIS RECORDS A COVERAGE GAP RATHER THAN HIDING IT ═══
       MEASURED: every intake record in the roster (t3, t6, t9, t11, t14) has
       exactly ONE survey, so `weightedAggregate` returns null on all of them
       whatever the stage guard does. Confirmed by mutation — deleting
       `stage === "intake" ? null :` from `profileReviewFor` breaks no test, so the
       intake branch of the assertion above currently passes without exercising
       the thing it names.
       The guard is still correct: nothing stops a teen answering twice inside
       their first 30 days. So instead of deleting either side, this fails the day
       a fixture closes the gap — at which point the assertion above starts doing
       real work and this canary can go. */
    for (const teen of DEMO_TEENS) {
      if (!pendingReviewFor(teen.id, NOW, {})) continue;
      if (cadenceFor(teen.id, NOW, {}).stage !== "intake") continue;
      const assessments = careTimelineFor(teen.id, NOW, {}).filter(
        (e) => e.type === "assessment"
      );
      const instrument = [...assessments].sort(
        (a, b) => b.occurredAt - a.occurredAt
      )[0]?.description;
      expect(
        assessments.filter((e) => e.description === instrument).length,
        `${teen.id} is at intake with more than one comparable survey. The intake guard in profileReviewFor is now load-bearing and the assertion above finally covers it — delete this canary.`
      ).toBe(1);
    }
  });

  it("the rationale cites the number the card displays", () => {
    /* Every branch of the generated rationale used to open "The most recent PHQ-9
       scored 8, in the mild band". Above a weighted score of 10 in the moderate
       band that is two numbers and two bands for one clinical judgment — the same
       shape of defect that had three fixtures recommending a mild code under a
       moderate reading. */
    for (const teen of DEMO_TEENS) {
      const pending = pendingReviewFor(teen.id, NOW, {});
      if (!pending) continue;
      const shown = pending.aggregate?.score ?? pending.survey?.score;
      const cited = /scor(?:ed|e is) (\d+)/.exec(pending.rationale.text)?.[1];
      // t13's hand-written prose names no single figure, which is allowed — the
      // rule is that a figure it DOES name has to be the one on the card.
      if (!cited) continue;
      expect(
        Number(cited),
        `${teen.id}: the card shows ${shown} and the rationale says ${cited} — "${pending.rationale.text}"`
      ).toBe(shown);
    }
  });
});
