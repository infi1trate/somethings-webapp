// LINE 3 IS THE ROW'S OWN, AND IT SAYS SOMETHING THE TYPE CAN CARRY.
//
// Two defects, both reported from a screenshot rather than from code:
//
//  · EVERY ROW IN A SCENARIO SHOWED THE SAME BILLING CODE. Reported as line 3
//    "inheriting from the selected pane object or a single seed value". The
//    second half was right and the first was not, which matters: the query reads
//    each event's own payload faithfully, and three bulk seed loops were writing
//    `payload: { code: "F41.1", index: i }` for every event they generated. A
//    reader sent to the component would have found nothing wrong there.
//
//  · "Code under review F41.1" APPEARED ON SURVEY, ESCALATION AND PAUSE ROWS,
//    because the builder walked the whole payload with a chain of
//    `if (field) push(...)` and any event carrying a code got the billing line.
//
// So this file asserts the two properties that would have caught both: rows
// about different mentees differ, and each type's line 3 is that type's.

import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/activity/filters";
import { queryFeed, type FeedRow } from "@/lib/activity/query";
import type { ActivityViewer } from "@/lib/activity/resolve-alert-type";
import { SIM_NOW, scenarioById } from "@/lib/activity/seed";
import { viewById } from "@/lib/activity/views";
import type { ReadOverlay } from "@/lib/activity/read-state";

const EMPTY_OVERLAY: ReadOverlay = {};
const scenario = (id: string) => scenarioById(id);

const viewerFor = (id: string): ActivityViewer => {
  const s = scenario(id);
  return { id: s.viewerId, role: "supervisor", caseloadTeenIds: s.caseloadTeenIds };
};

function rowsOf(scenarioId: string, viewId = "caseload"): FeedRow[] {
  const s = scenario(scenarioId);
  return queryFeed({
    events: s.events,
    viewer: viewerFor(scenarioId),
    view: viewById(viewId),
    overlay: EMPTY_OVERLAY,
    unreadOnly: false,
    filters: EMPTY_FILTERS,
    now: SIM_NOW,
  }).flatMap((d) => d.rows);
}

const line3 = (r: FeedRow) => (r.context ?? []).join(" · ");

describe("line 3 is bound to the row's own event", () => {
  it("gives two rows about different mentees different content", () => {
    // THE REGRESSION THIS EXISTS FOR. Before the seed fix every row in
    // `heavy-day` rendered "Code under review F41.1", so this assertion would
    // have failed on a feed of 48 rows.
    const rows = rowsOf("heavy-day").filter((r) => (r.context ?? []).length > 0);
    expect(rows.length).toBeGreaterThan(5);

    const byTeen = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = byTeen.get(r.teenName) ?? new Set<string>();
      set.add(line3(r));
      byTeen.set(r.teenName, set);
    }
    expect(byTeen.size).toBeGreaterThan(1);

    // At least two DIFFERENT mentees must differ from each other — not merely
    // "some row somewhere differs", which a single odd row would satisfy.
    const perTeen = [...byTeen.entries()].map(([teen, set]) => ({
      teen,
      sample: [...set][0],
    }));
    const distinct = new Set(perTeen.map((x) => x.sample));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("does not render one code across a whole scenario", () => {
    for (const id of ["heavy-day", "thirty-day"]) {
      const codes = rowsOf(id)
        .map(line3)
        .filter((t) => /F\d\d/.test(t));
      if (codes.length < 3) continue;
      expect(new Set(codes).size, `${id} renders one code everywhere`).toBeGreaterThan(1);
    }
  });
});

describe("line 3 says what the event type can carry", () => {
  const all = () => [...rowsOf("typical-shift"), ...rowsOf("heavy-day")];

  it("never puts a billing code on a row that is not a billing review", () => {
    for (const r of all()) {
      if (r.eventType.startsWith("BILLING_")) continue;
      expect(
        line3(r),
        `${r.eventType} should not mention a code under review`
      ).not.toMatch(/code under review/i);
    }
  });

  it("renders NO line 3 for a presentation review", () => {
    // Absence is the correct output, not a gap to fill: line 2 already carries
    // the code and the outcome for this type.
    const rows = all().filter(
      (r) => r.eventType === "PRESENTATION_REVIEW_COMPLETE"
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.context).toBeUndefined();
  });

  it("uses each type's own template", () => {
    const sample = (type: string) =>
      all().find((r) => r.eventType === type && (r.context ?? []).length > 0);

    const billing = sample("BILLING_REVIEW_COMPLETE");
    // THE STATUS, AND ONLY THE STATUS. The code is on line 2, in both densities;
    // this line renders in detailed only, so it must not be the code's only home
    // and must not be its second one. Row 321.
    expect(billing && line3(billing)).toMatch(/^\w[\w ]*$/);
    expect(billing && line3(billing)).not.toMatch(/[A-Z]\d+(\.\d+)?/);

    const flag = sample("RISK_FLAG_CLOSED");
    // decision · category, and the category is humanised, never the wire value.
    expect(flag && line3(flag)).toMatch(/^(Closed|Escalated|Monitoring)\s·\s/);
    expect(flag && line3(flag)).not.toMatch(/_/);

    const survey = sample("SURVEY_COMPLETED");
    expect(survey && line3(survey)).toMatch(/^(GAD-7|PHQ-9|WHO-5)\s·\s\d+$/);

    const escalation = sample("ESCALATION_CLOSED");
    expect(escalation && line3(escalation)).toMatch(/^Outcome: \w/);

    const paused = sample("TEEN_PAUSED");
    expect(paused && line3(paused)).toMatch(/^Paused\s·\s\w/);
  });
});

describe("no placeholder or instruction-like text reaches a row", () => {
  it("keeps the network-scope canary out of every rendered field", () => {
    // The canary used to live in `payload.reason`, which line 3 renders — so it
    // was on screen reading "Abuse disclosure · clinical detail that must never
    // reach network scope". It is now a key nothing renders, so it still fails
    // loudly in a payload dump and never in front of a viewer.
    for (const id of ["network-wide", "typical-shift", "heavy-day", "thirty-day"]) {
      for (const r of rowsOf(id, "network")) {
        const text = [r.sentence, r.lead, line3(r)].join(" ");
        expect(text, `${id} leaked a canary`).not.toMatch(
          /must never|MUST_OMIT|placeholder|TODO|lorem/i
        );
      }
    }
  });
});
