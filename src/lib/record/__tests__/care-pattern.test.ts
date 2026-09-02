// THE CARE PATTERN BLOCK'S GUARDRAILS, over every teen in the fixture.
//
// The block renders a generated paragraph about a child's clinical history to a
// mentor. These are the conditions that makes that acceptable, and they are
// asserted rather than reviewed: a grep proves them the day someone runs it,
// these prove them on every commit and over every reading a future edit adds.

import { describe, expect, it } from "vitest";
import {
  CLUSTER_MIN_FLAGS,
  PATTERN_MIN_ASSESSMENTS,
  PATTERN_MIN_CLASSES,
  PATTERN_MIN_EVENTS,
  PATTERN_MIN_SPAN_DAYS,
  carePatternFor,
} from "@/lib/record/care-pattern";
import { SPARKLINE_MIN_POINTS } from "@/components/record/score-sparkline";
import { RISK_CATEGORIES, recurringThemes, themeOf } from "@/lib/record/risk-taxonomy";
import { CATEGORY_LABEL, DEMO_TEENS } from "@/lib/record/people-demo";
import { AGGREGATE_WEIGHTS } from "@/lib/record/care-demo";
import { pendingReviewFor } from "@/lib/record/care-demo";

const NOW = new Date("2026-08-26T20:05:00.000Z").getTime();

const all = () => DEMO_TEENS.map((t) => ({ id: t.id, p: carePatternFor(t.id, NOW) }));
const rendered = () => all().filter((x) => x.p !== null) as { id: string; p: NonNullable<ReturnType<typeof carePatternFor>> }[];
const sentences = () =>
  rendered().flatMap(({ id, p }) => p.reading.map((s) => ({ id, s })));

// ═══ CO-OCCURRENCE, NEVER CAUSATION ════════════════════════════════════════

describe("no causal claim", () => {
  const banned = [
    "because", "due to", "driven by", "caused", "causing", "as a result",
    "led to", "leading to", "resulted in", "stems from", "explains",
    "attributable", "triggered by", "in response to", "reflects",
  ];
  it("no reading joins two facts with a cause", () => {
    const list = sentences();
    expect(list.length).toBeGreaterThan(0);
    for (const { id, s } of list) {
      for (const term of banned) {
        expect(s.toLowerCase().includes(term), `${id}: "${s}" contains "${term}"`).toBe(false);
      }
    }
  });

  it("a reading that states two facts states their shared PERIOD", () => {
    // The construction the module is built around. Any sentence mentioning both
    // flags and results must carry the co-occurrence phrasing, not a connective.
    for (const { id, s } of sentences()) {
      if (/result/i.test(s) && /flag/i.test(s)) {
        expect(/same stretch|same period|over that span/i.test(s), `${id}: ${s}`).toBe(true);
      }
    }
  });
});

// ═══ NO PREDICTION ═════════════════════════════════════════════════════════

describe("no forward-looking claim", () => {
  const banned = [
    "likely", "unlikely", "will ", "expected", "expect ", "at risk of",
    "on track", "heading", "trending toward", "continuing", "continues to",
    "predict", "forecast", "probability", "if this", "going to",
    "escalate again", "deteriorat",
  ];
  it("no reading looks forward", () => {
    for (const { id, s } of sentences()) {
      for (const term of banned) {
        expect(s.toLowerCase().includes(term), `${id}: "${s}" contains "${term}"`).toBe(false);
      }
    }
  });
});

// ═══ NO TIERING OF THE TEEN ════════════════════════════════════════════════

describe("the person is never graded", () => {
  const banned = [
    "high-concern", "high concern", "low concern", "risk score", "risk level",
    "severity", "tier", "top 1", "top 5", "percentile", "acuity", "priority",
    "critical teen", "at-risk teen", "high risk", "elevated risk",
  ];
  it("no reading rates the teen", () => {
    for (const { id, s } of sentences()) {
      for (const term of banned) {
        expect(s.toLowerCase().includes(term), `${id}: "${s}" contains "${term}"`).toBe(false);
      }
    }
  });

  it("the playbook's percentile tier names appear nowhere in the taxonomy's labels", () => {
    // The playbook calls its tiers "Top 1%" and "Top 5%". A percentile attached
    // to a child IS a risk score. The taxonomy renames them by response.
    for (const c of RISK_CATEGORIES) {
      expect(c.label).not.toMatch(/top\s*\d|%|percentile/i);
    }
    for (const label of Object.values(CATEGORY_LABEL)) {
      expect(label).not.toMatch(/top\s*\d|%|percentile/i);
    }
  });

  it("the pattern never reads a flag's tier", () => {
    // Structural: no mark carries a tier, so no visual can encode one.
    for (const { p } of rendered()) {
      for (const m of p.marks) {
        expect(m).not.toHaveProperty("tier");
        expect(m).not.toHaveProperty("severity");
      }
    }
  });
});

// ═══ NO VERBATIM CONTENT ═══════════════════════════════════════════════════

describe("no message content", () => {
  it("mark labels are type and date only", () => {
    for (const { id, p } of rendered()) {
      for (const m of p.marks) {
        expect(m.label, id).toMatch(
          /^(Assessment|Presentation change|Flag|\d+ flags) · [A-Z][a-z]+ \d{1,2}, \d{4}$/
        );
      }
    }
  });
  it("no reading contains a quotation mark", () => {
    for (const { id, s } of sentences()) {
      expect(/["“”]/.test(s), `${id}: ${s}`).toBe(false);
    }
  });
});

// ═══ THE THRESHOLD ═════════════════════════════════════════════════════════

describe("suppression", () => {
  it("reuses the sparkline's floor rather than declaring a second one", () => {
    expect(PATTERN_MIN_ASSESSMENTS).toBe(SPARKLINE_MIN_POINTS);
  });

  it("every rendered pattern clears all four conditions", () => {
    for (const { id, p } of rendered()) {
      expect(p.spanDays, id).toBeGreaterThanOrEqual(PATTERN_MIN_SPAN_DAYS);
      // EVENTS, NOT MARKS. Coalescing means four same-day flags are one mark, so
      // the mark count can legitimately sit below the event floor — the counts on
      // the marks are what add back up to the events the threshold was tested on.
      const events = p.marks.reduce((n, m) => n + m.count, 0);
      expect(events, id).toBeGreaterThanOrEqual(PATTERN_MIN_EVENTS);
      const classes = new Set(p.marks.map((m) => m.cls));
      expect(classes.size, id).toBeGreaterThanOrEqual(PATTERN_MIN_CLASSES);
      const asmt = p.marks.filter((m) => m.cls === "assessment");
      expect(asmt.length, id).toBeGreaterThanOrEqual(PATTERN_MIN_ASSESSMENTS);
    }
  });

  it("a short mentorship is suppressed outright, not rendered thin", () => {
    // Nothing under the span floor may render at all — no placeholder.
    const short = all().filter(({ id }) => {
      const t = DEMO_TEENS.find((x) => x.id === id)!;
      return (t.matchedDaysAgo ?? 0) > 0 && (t.matchedDaysAgo ?? 0) < 30;
    });
    expect(short.length).toBeGreaterThan(0);
    for (const { id, p } of short) expect(p, id).toBeNull();
  });

  it("most records have no pattern, and that is the designed outcome", () => {
    const on = rendered().length;
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(DEMO_TEENS.length / 2);
  });

  it("readings are at most three sentences", () => {
    for (const { id, p } of rendered()) {
      expect(p.reading.length, id).toBeLessThanOrEqual(3);
      expect(p.reading.length, id).toBeGreaterThan(0);
    }
  });
});

// ═══ COALESCING (the defect browser verification caught) ═══════════════════

describe("same-day flags coalesce", () => {
  it("no two marks share an x position", () => {
    for (const { id, p } of rendered()) {
      const flagDays = p.marks
        .filter((m) => m.cls === "flag")
        .map((m) => new Date(m.at).toDateString());
      expect(new Set(flagDays).size, id).toBe(flagDays.length);
    }
  });

  it("every mark label is unique within a record", () => {
    // Three marks sharing "Flag · August 18, 2026" cannot be told apart by the
    // accessible name the brief requires them to carry.
    for (const { id, p } of rendered()) {
      const labels = p.marks.map((m) => m.label);
      expect(new Set(labels).size, `${id}: ${labels.join(" | ")}`).toBe(labels.length);
    }
  });

  it("a coalesced mark states its count in its label", () => {
    const multi = rendered().flatMap(({ p }) => p.marks.filter((m) => m.count > 1));
    expect(multi.length).toBeGreaterThan(0);
    for (const m of multi) expect(m.label).toMatch(new RegExp(`^${m.count} flags · `));
  });
});

// ═══ THE TAXONOMY ══════════════════════════════════════════════════════════

describe("the playbook taxonomy", () => {
  it("carries all twenty playbook categories plus the legacy one", () => {
    expect(RISK_CATEGORIES).toHaveLength(21);
    const tiers = RISK_CATEGORIES.filter((c) => c.tier !== "unassigned");
    expect(tiers).toHaveLength(20);
    expect(RISK_CATEGORIES.filter((c) => c.tier === "imminent")).toHaveLength(6);
    expect(RISK_CATEGORIES.filter((c) => c.tier === "clinicalReview")).toHaveLength(6);
    expect(RISK_CATEGORIES.filter((c) => c.tier === "generalMonitoring")).toHaveLength(8);
  });

  it("the five pre-existing wire values are unchanged", () => {
    for (const id of [
      "GROOMING_BEHAVIOR",
      "ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS",
      "CREDIBLE_SPECIFIC_THREAT_TO_HARM_ANOTHER",
      "HATE_SPEECH_RACIAL_SLURS",
      "ABUSE_DISCLOSURE",
    ]) {
      expect(themeOf(id), id).not.toBeNull();
      expect(CATEGORY_LABEL[id], id).toBeTruthy();
    }
  });

  it("recurringThemes counts flags, not categories, and ignores singletons", () => {
    // One flag with two same-theme categories counts once.
    expect(
      recurringThemes([["ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS", "NON_SUICIDAL_SELF_INJURY"]])
    ).toEqual([]);
    // Two flags, same theme, counts two.
    expect(
      recurringThemes([["ABUSE_DISCLOSURE"], ["NEGLECT_INDICATORS"]])
    ).toEqual([{ theme: "abuseEnvironment", count: 2 }]);
  });

  it("the clustering threshold is the playbook's own", () => {
    expect(CLUSTER_MIN_FLAGS).toBe(3);
  });
});

// ═══ THE PER-POINT WEIGHTED VALUE (R6 · A2) ════════════════════════════════
//
// The brief's requirement is not "show a weighted number" — it is that the
// tooltip's number and the review card's Weighted column RECONCILE. That is a
// claim about two code paths agreeing, so it is asserted rather than eyeballed.

describe("the weighted value at each reading", () => {
  /** The plotted assessment marks, chronological — the same set the line is
   *  drawn through, which is what the tooltip is attached to. */
  const plotted = (p: NonNullable<ReturnType<typeof carePatternFor>>) =>
    p.marks
      .filter((m) => m.cls === "assessment" && m.score !== undefined)
      .sort((a, b) => a.at - b.at);

  it("gives the FIRST reading no weighted value — one number is not a weighting", () => {
    for (const { id, p } of rendered()) {
      const pts = plotted(p);
      if (pts.length === 0) continue;
      expect(pts[0].weighted, `${id}: first plotted reading`).toBeUndefined();
    }
  });

  it("gives every reading after the first one", () => {
    for (const { id, p } of rendered()) {
      const pts = plotted(p);
      for (let i = 1; i < pts.length; i++) {
        expect(pts[i].weighted, `${id}: reading ${i + 1} of ${pts.length}`).toBeDefined();
      }
    }
  });

  it("never weights more than the three surveys the ratio has weights for", () => {
    for (const { id, p } of rendered()) {
      for (const m of plotted(p)) {
        if (!m.weighted) continue;
        expect(m.weighted.count, `${id}`).toBeLessThanOrEqual(AGGREGATE_WEIGHTS.length);
        expect(m.weighted.count, `${id}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("counts up to three as the series lengthens, then holds", () => {
    for (const { id, p } of rendered()) {
      const pts = plotted(p);
      for (let i = 1; i < pts.length; i++) {
        const expected = Math.min(i + 1, AGGREGATE_WEIGHTS.length);
        expect(pts[i].weighted?.count, `${id}: reading ${i + 1}`).toBe(expected);
      }
    }
  });

  it("recomputes rather than repeating — a moving series moves the number", () => {
    // Not every record varies, but at least one must, or the whole feature is
    // showing a constant and this suite would not notice.
    const varying = rendered().filter(({ p }) => {
      const w = plotted(p)
        .map((m) => m.weighted?.score)
        .filter((n): n is number => n !== undefined);
      return new Set(w).size > 1;
    });
    expect(varying.length).toBeGreaterThan(0);
  });

  /** ═══ THE RECONCILIATION — THE POINT OF THE WHOLE THING ═══
   *
   *  The last plotted reading's weighted score is, by construction, the aggregate
   *  over the most recent comparable surveys — which is exactly what the review
   *  card's Weighted column shows. If these ever diverge, one page is showing two
   *  numbers for one judgment, which is the defect this tab has already paid for.
   *
   *  Compared against `pendingReviewFor` — the CARD's own source — not against a
   *  re-run of `weightedAggregate`, which would only prove the function equals
   *  itself. */
  it("the last reading's weighted score equals the review card's aggregate", () => {
    let compared = 0;
    for (const { id, p } of rendered()) {
      const pending = pendingReviewFor(id, NOW, {});
      if (!pending?.aggregate) continue;
      const pts = plotted(p);
      const last = pts[pts.length - 1];
      if (!last?.weighted) continue;
      // Same instrument on both sides, or they are not comparable at all.
      if (pending.aggregate.surveys[0]?.instrument !== p.instrument) continue;
      expect(
        last.weighted.score,
        `${id}: strip tooltip vs review card Weighted column`
      ).toBe(pending.aggregate.score);
      expect(last.weighted.severity, `${id}: band`).toBe(pending.aggregate.severity);
      compared++;
    }
    // A vacuous pass would be worse than a failure — prove the loop ran.
    expect(compared, "records where both a pattern and an aggregate exist").toBeGreaterThan(0);
  });
});
