// ═══════════════════════════════════════════════════════════════════════════
// THE PINNED ROW'S FOUR FIELDS, AND THE FIELD THAT IS CURRENTLY CONSTANT
//
// The rendered section is measured in the DOM. What that cannot show:
//
//  · THAT THE OBLIGATION FIELD WORKS AT ALL. Every row reads "Nothing open"
//    today, because no pinnable teen id appears in any destination fixture —
//    so a DOM check proves only that the null branch renders. The claim that
//    the field is correct-by-construction is worth nothing unless the non-null
//    branch is exercised, which needs ids that match. That is what most of
//    this file does.
//  · THE ORDERING BEING PIN TIME. Insertion order and pin-time order coincide
//    in any fixture the UI can produce, so only a deliberately-unsorted input
//    can tell them apart.

import { describe, expect, it } from "vitest";
import {
  activityLabel,
  obligationFor,
  pinnedInOrder,
  type ObligationInput,
} from "@/lib/home/pinned-rows";
import { DEMO_TEENS } from "@/lib/record/people-demo";
import { ROSTER, tasksScenario, TASK_SCENARIOS } from "@/lib/tasks/seed";
import { monitoringData } from "@/lib/monitoring/scenarios";
import type { EscalationRecord } from "@/lib/monitoring/escalation";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import type { TaskItem } from "@/lib/tasks/types";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const EMPTY: ObligationInput = { items: [], events: [], escalations: [], now: NOW };

const review = (teenId: string, openedAt: number): TaskItem =>
  ({
    id: `r-${teenId}-${openedAt}`,
    teenId,
    taskType: "intakeBillingReview",
    domain: "billing",
    status: "open",
    openedAt,
    slaDeadline: null,
  }) as unknown as TaskItem;

const flag = (teenId: string, at: number): MonitoringEvent =>
  ({ id: `f-${teenId}-${at}`, teenId, at }) as unknown as MonitoringEvent;

const esc = (teenId: string, triggeredAt: number): EscalationRecord =>
  ({
    id: `e-${teenId}`,
    teenId,
    triggeredAt,
    acknowledgedAt: null,
    resolvedAt: null,
    closeOut: [],
  }) as unknown as EscalationRecord;

describe("one obligation, and it is the destination with the oldest item", () => {
  it("names nothing when the teen has nothing anywhere", () => {
    expect(obligationFor("t1", EMPTY)).toBeNull();
  });

  it("names the one destination that has work", () => {
    const o = obligationFor("tk-a", { ...EMPTY, items: [review("tk-a", NOW - 3 * HOUR)] });
    expect(o).toEqual({ destination: "care-reviews", count: 1, oldestAt: NOW - 3 * HOUR });
  });

  it("picks the OLDEST destination when several have work, and does not total", () => {
    /* F: "Where multiple destinations have open items, name the one with the
       oldest. Do not total across destinations." Two flags and one review; the
       review is older, so the review's destination wins AND the count is that
       destination's 1 — never 3. */
    const o = obligationFor("tk-a", {
      ...EMPTY,
      items: [review("tk-a", NOW - 40 * HOUR)],
      events: [flag("tk-a", NOW - 2 * HOUR), flag("tk-a", NOW - 3 * HOUR)],
    });
    expect(o?.destination).toBe("care-reviews");
    expect(o?.count).toBe(1);
  });

  it("counts only that destination's items, never the sum", () => {
    const o = obligationFor("tk-a", {
      ...EMPTY,
      items: [review("tk-a", NOW - 2 * HOUR)],
      events: [flag("tk-a", NOW - 40 * HOUR), flag("tk-a", NOW - 30 * HOUR)],
    });
    expect(o?.destination).toBe("risk-flags");
    expect(o?.count).toBe(2); // the flags, NOT 3
  });

  it("puts an escalation first when it is the oldest", () => {
    const o = obligationFor("tk-a", {
      ...EMPTY,
      escalations: [esc("tk-a", NOW - 80 * HOUR)],
      events: [flag("tk-a", NOW - 2 * HOUR)],
    });
    expect(o?.destination).toBe("escalations");
  });

  it("never reports another teen's work", () => {
    const o = obligationFor("tk-a", {
      ...EMPTY,
      events: [flag("tk-b", NOW - HOUR), flag("tk-b", NOW - 2 * HOUR)],
    });
    expect(o).toBeNull();
  });

  it("breaks an exact tie deterministically, by destination order", () => {
    // Two destinations, identical instants. Without the tie-break the answer
    // would depend on the order the branches happen to push, which is a
    // different row on a different day for no reason a reader could see.
    const t = NOW - 5 * HOUR;
    const o = obligationFor("tk-a", {
      ...EMPTY,
      items: [review("tk-a", t)],
      events: [flag("tk-a", t)],
    });
    expect(o?.destination).toBe("risk-flags"); // earlier in DESTINATION_ORDER
  });
});

describe("and today it is null for every pinnable mentee — measured, not assumed", () => {
  it("shares no id between the record side and any destination fixture", () => {
    /* ═══ WHY EVERY ROW SAYS "Nothing open" ═══
       This is gap 432, already pinned by `teen-namespaces.test.ts`. Asserted
       again HERE because it is the reason a whole contract field renders a
       constant, and the next person reading this section will otherwise think
       the field is broken.
       IT FAILS THE DAY THE NAMESPACES RECONCILE, which is the day the pinned
       rows start naming real destinations — nothing in `pinned-rows.ts` needs
       to change, and this test is where that is recorded. */
    const taskSide = new Set<string>(ROSTER.map((t) => t.id));
    for (const s of TASK_SCENARIOS) {
      for (const i of tasksScenario(s.id, NOW)) taskSide.add(i.teenId);
      const d = monitoringData(null, s.id, NOW);
      for (const e of d.events) taskSide.add(e.teenId);
      for (const r of d.escalations) taskSide.add(r.teenId);
    }
    const shared = DEMO_TEENS.map((t) => t.id).filter((id) => taskSide.has(id));
    expect(DEMO_TEENS.length).toBeGreaterThan(20);
    expect(taskSide.size).toBeGreaterThan(20);
    expect(
      shared,
      "IDS NOW OVERLAP — pinned rows can name a real destination; re-check the " +
        "obligation field end to end and drop the 'always Nothing open' note"
    ).toEqual([]);
  });
});

describe("pin time, ascending, and nothing else", () => {
  it("sorts by pin time even when the stored array is not in that order", () => {
    /* INSERTION ORDER AND PIN-TIME ORDER COINCIDE in anything the UI produces,
       so only a deliberately-unsorted input can tell the two apart — and a
       migrated or hand-edited store is exactly that input. */
    const out = pinnedInOrder([
      { id: "t5", at: 3000 },
      { id: "t2", at: 1000 },
      { id: "t9", at: 2000 },
    ]);
    expect(out.map((p) => p.id)).toEqual(["t2", "t9", "t5"]);
  });

  it("does not mutate the stored array", () => {
    const stored = [{ id: "b", at: 2 }, { id: "a", at: 1 }];
    pinnedInOrder(stored);
    expect(stored.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("recency, never frequency", () => {
  it("reads the more recent of the two sides", () => {
    expect(activityLabel(5, 2)).toBe("Active 2d ago");
    expect(activityLabel(2, 5)).toBe("Active 2d ago");
  });

  it("says today and yesterday in words", () => {
    expect(activityLabel(0, 4)).toBe("Active today");
    expect(activityLabel(1, 9)).toBe("Active yesterday");
  });

  it("returns null rather than inventing a recency it does not have", () => {
    // A row with no activity data omits the field. Rendering "Active ? ago" or
    // defaulting to 0 would be a fabricated statistic.
    expect(activityLabel(undefined, undefined)).toBeNull();
  });

  it("carries no rate, trend or count in its wording", () => {
    for (const s of [activityLabel(0, 9), activityLabel(1, 9), activityLabel(7, 9)]) {
      expect(s).not.toMatch(/per|\/|avg|average|streak|%|trend/i);
    }
  });
});
