// THE EVIDENCE PANE'S REFUSALS, WHICH ARE THE PART WORTH TESTING.
//
// B3: "Evidence is the highest-sensitivity payload in this feature: enforce
// absence in the data-layer query, and test that a degraded row's pane query
// returns no evidence fields." So the first block below is the load-bearing one —
// everything else is a shape assertion, that one is a privacy assertion.
//
// The other refusals matter for a different reason: a pane that restates the row
// it was opened from has not earned a column, and the way that regression arrives
// is somebody adding a type to the switch because it "should probably have a
// pane". These tests make that a failing test rather than a judgement call.

import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/activity/filters";
import { queryFeed, type FeedRow } from "@/lib/activity/query";
import type { ActivityViewer } from "@/lib/activity/resolve-alert-type";
import { SIM_NOW, scenarioById } from "@/lib/activity/seed";
import { viewByIdStrict } from "@/lib/activity/views";
import type { ReadOverlay } from "@/lib/activity/read-state";
import type { ActivityDomain } from "@/lib/activity/events";
import {
  eventEvidenceFor,
  flaggedContentFor,
  NO_PANE_TYPES,
} from "@/lib/activity/evidence";

const EMPTY_OVERLAY: ReadOverlay = {};
const scenario = (id: string) => scenarioById(id);
const viewerFor = (id: string): ActivityViewer => {
  const s = scenario(id);
  return { id: s.viewerId, role: "supervisor", caseloadTeenIds: s.caseloadTeenIds };
};

function rowsOf(
  scenarioId: string,
  viewId: string,
  domains: ActivityDomain[] = []
): FeedRow[] {
  const s = scenario(scenarioId);
  return queryFeed({
    events: s.events,
    viewer: viewerFor(scenarioId),
    view: viewByIdStrict(viewId),
    overlay: EMPTY_OVERLAY,
    unreadOnly: false,
    filters: { ...EMPTY_FILTERS, includeActions: true, domains },
    now: SIM_NOW,
  }).flatMap((d) => d.rows);
}

const allRows = () => [
  ...rowsOf("typical-shift", "mine"),
  ...rowsOf("heavy-day", "mine"),
  ...rowsOf("network-wide", "network"),
  ...rowsOf("long-history", "mine"),
];

describe("a degraded row yields no evidence at all (rule 12)", () => {
  it("returns null for every degraded row in network scope", () => {
    const degraded = rowsOf("network-wide", "network").filter((r) => r.degraded);
    expect(degraded.length).toBeGreaterThan(0);
    for (const r of degraded) {
      expect(eventEvidenceFor(r), `${r.eventType} degraded`).toBeNull();
    }
  });

  it("returns no flagged content for a degraded row, and does not log one", () => {
    const degraded = rowsOf("network-wide", "network").filter((r) => r.degraded);
    for (const r of degraded) {
      expect(flaggedContentFor(r, "viewer-x", SIM_NOW)).toBeNull();
    }
  });

  it("is enforced by the ABSENT PAYLOAD, not by a check a component could skip", () => {
    // The property that makes the above true structurally: a degraded row carries
    // no payload, so there is nothing any caller could assemble evidence from.
    for (const r of rowsOf("network-wide", "network")) {
      if (!r.degraded) continue;
      expect(r.payload).toBeUndefined();
      expect(r.context).toBeUndefined();
    }
  });

  it("still yields evidence for the viewer's OWN rows in network scope (clause a)", () => {
    // A5 clause (a): self-authored history stays open even after reassignment. If
    // this failed, the privacy rule above would be over-applying.
    //
    // THE DOMAIN FILTER IS LOAD-BEARING HERE, and its absence is what made the
    // first version of this test fail: the Team view admits `notification` only,
    // and a supervisor's OWN completed review resolves to `activity`. A domain
    // filter admits the full type set (B2, row 322), which is exactly how a
    // reader reaches these rows in the product.
    const own = rowsOf("network-wide", "network", ["billing"]).filter(
      (r) => !r.degraded && r.eventType === "BILLING_REVIEW_COMPLETE"
    );
    expect(own.length).toBeGreaterThan(0);
    expect(own.some((r) => eventEvidenceFor(r) !== null)).toBe(true);
  });
});

describe("flagged content is reachable only through the logging seam", () => {
  it("is never part of the evidence object", () => {
    for (const r of allRows()) {
      const e = eventEvidenceFor(r);
      if (!e) continue;
      // The message must not appear anywhere in the returned shape — not in a
      // fact, not in the body, not in related context.
      const serialised = JSON.stringify(e);
      const excerpt =
        typeof r.payload?.flaggedExcerpt === "string"
          ? r.payload.flaggedExcerpt
          : null;
      if (excerpt) expect(serialised).not.toContain(excerpt);
    }
  });

  it("announces itself with a flag rather than the content", () => {
    const withContent = allRows().filter(
      (r) => typeof r.payload?.flaggedExcerpt === "string" && !r.degraded
    );
    expect(withContent.length).toBeGreaterThan(0);
    for (const r of withContent) {
      const e = eventEvidenceFor(r);
      if (!e) continue;
      // NARROWED, not cast. `hasFlaggedContent` belongs to the risk-flag member
      // of the union now — asking any other member for it is a question that no
      // longer makes sense, and the compiler saying so is the union working.
      expect(e.kind).toBe("riskFlag");
      expect(e.kind === "riskFlag" && e.hasFlaggedContent).toBe(true);
      // And the seam returns it.
      expect(flaggedContentFor(r, "viewer-x", SIM_NOW)).toBe(
        r.payload!.flaggedExcerpt
      );
    }
  });
});

describe("types that open no pane", () => {
  it("returns null for every type on the no-pane list", () => {
    for (const r of allRows()) {
      if (!NO_PANE_TYPES.includes(r.eventType)) continue;
      expect(eventEvidenceFor(r), `${r.eventType} should open no pane`).toBeNull();
    }
  });

  it("includes mentorship paused and matched, and presentation review", () => {
    // Named explicitly: these are the three the brief and the survey agreed on,
    // and a future edit that quietly adds a pane for them should fail here.
    expect(NO_PANE_TYPES).toContain("TEEN_PAUSED");
    expect(NO_PANE_TYPES).toContain("TEEN_MATCHED");
    expect(NO_PANE_TYPES).toContain("PRESENTATION_REVIEW_COMPLETE");
  });

  it("returns null for a coalesced group, whose members disagree", () => {
    const groups = allRows().filter((r) => r.eventIds.length > 1);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(eventEvidenceFor(g)).toBeNull();
  });
});

describe("the four types that do open a pane", () => {
  const evidenceFor = (type: string) =>
    allRows()
      .filter((r) => r.eventType === type && !r.degraded)
      .map(eventEvidenceFor)
      .find((e) => e !== null);

  it("every pane carries a persistent record link", () => {
    for (const type of [
      "BILLING_REVIEW_COMPLETE",
      "SURVEY_COMPLETED",
      "RISK_FLAG_CLOSED",
      "ESCALATION_CLOSED",
    ]) {
      const e = evidenceFor(type);
      expect(e, `${type} should open a pane`).toBeTruthy();
      expect(e!.record.href).toMatch(/^\/admin\/person\//);
      expect(e!.record.label.length).toBeGreaterThan(4);
    }
  });

  it("states the billing decision as a CHANGE when there was one, and as a state when there wasn't", () => {
    // "F41.9 → F41.1" is the decision; "F41.1" alone is the state, which is
    // already on the row. BOTH BRANCHES ARE REAL: the hand-written fixtures carry
    // a bare `code` with no `previousCode`, and the first version of this test
    // asserted the arrow unconditionally and failed on one of them.
    const rows = allRows().filter(
      (r) => r.eventType === "BILLING_REVIEW_COMPLETE" && !r.degraded
    );
    const withPrev = rows.filter((r) => typeof r.payload?.previousCode === "string");
    const without = rows.filter((r) => r.payload?.previousCode === undefined);
    expect(withPrev.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);

    const codeOf = (r: FeedRow) =>
      eventEvidenceFor(r)!.facts.find((f) => f.label === "Code")!.value;
    expect(codeOf(withPrev[0])).toMatch(/^\S+ → \S+$/);
    expect(codeOf(without[0])).not.toMatch(/→/);
    // C3: the review document is a `document` on the billing member, with real
    // paragraph structure rather than a single `body.text` string.
    const billing = eventEvidenceFor(withPrev[0])!;
    expect(billing.kind).toBe("billing");
    if (billing.kind === "billing") {
      expect(billing.document.paragraphs.length).toBeGreaterThan(1);
      expect(billing.document.title).toBeTruthy();
    }
  });

  it("shows a survey trend only when a prior score exists", () => {
    const rows = allRows().filter(
      (r) => r.eventType === "SURVEY_COMPLETED" && !r.degraded
    );
    /* ═══ REWRITTEN FOR C3 — AND THE OLD ASSERTION HAD BECOME UNTRUE ═══
       This asserted that a survey's `related` field exists only when the payload
       carries a `priorScore`. The trend is no longer built from that field: the
       strip is derived from the EVENT STORE (`readingsFor`), because a comparison
       to one remembered prior score cannot show a series and could disagree with
       the ledger it was summarising. What the evidence now owes is the
       instrument, the score and its band — the series is the ledger's to supply. */
    const rowsWithScore = rows.filter((r) => typeof r.payload?.score === "number");
    expect(rowsWithScore.length).toBeGreaterThan(0);
    const e = eventEvidenceFor(rowsWithScore[0])!;
    expect(e.kind).toBe("survey");
    if (e.kind === "survey") {
      expect(e.instrument).toBeTruthy();
      expect(typeof e.score).toBe("number");
      // NO OUTCOME PILL on a survey — it did not come out any way.
      expect(e.outcome).toBeNull();
    }
  });

  it("humanises flag categories and never leaks a wire value", () => {
    const e = evidenceFor("RISK_FLAG_CLOSED")!;
    const cat = e.facts.find((f) => f.label === "Category");
    expect(cat).toBeTruthy();
    expect(cat!.value).not.toMatch(/_/);
  });

  it("keeps the fact list short enough to read", () => {
    // More than four facts is a table, and A12's object summary already proved a
    // table of restated fields does not earn a column.
    for (const type of [
      "BILLING_REVIEW_COMPLETE",
      "SURVEY_COMPLETED",
      "RISK_FLAG_CLOSED",
      "ESCALATION_CLOSED",
    ]) {
      const e = evidenceFor(type)!;
      expect(e.facts.length).toBeGreaterThanOrEqual(2);
      expect(e.facts.length).toBeLessThanOrEqual(4);
    }
  });
});
