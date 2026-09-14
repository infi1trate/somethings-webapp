// THE SHIFT — the ladder, the stage lines, and the digest's gate.
//
// What these guard is a surface that must not lie about a caseload and must not
// become a performance measure. Two specific failures are worth a test each: a
// ladder that puts the wrong stage first, which sends a supervisor to the wrong
// work; and a digest that buries a breach under a count, which is the one
// ordering that makes a summary worse than none.

import { describe, expect, it } from "vitest";
import {
  SHIFT_GAP_MS,
  SHIFT_STAGES,
  digestLinesFor,
  isNewShift,
  ladderStageFor,
  ladderTargetFor,
  shiftFactsFor,
  shiftStagesFor,
  type ShiftFacts,
} from "@/lib/tasks/shift";
import { tasksScenario } from "@/lib/tasks/seed";

const NOW = Date.now();

const NOTHING: ShiftFacts = {
  activeEscalations: 0,
  documentationOpen: 0,
  documentationOverdue: 0,
  billing: { open: 0, overdue: 0 },
  imminentOpen: 0,
  imminentBreached: 0,
  clinicalOpen: 0,
  clinicalBreached: 0,
  routineOpen: 0,
  closedToday: {},
};
const facts = (over: Partial<ShiftFacts>): ShiftFacts => ({ ...NOTHING, ...over });

describe("the ladder", () => {
  it("is total — there is always exactly one directive stage", () => {
    // The last rung is reached unconditionally, so Home is never without a
    // directive and never has two.
    expect(ladderStageFor(NOTHING)).toBe("chatReview");
  });

  it("puts an open escalation above everything", () => {
    expect(
      ladderStageFor(
        facts({
          activeEscalations: 1,
          imminentBreached: 9,
          billing: { open: 20, overdue: 9 },
        })
      )
    ).toBe("escalations");
  });

  it("puts a breached imminent flag above billing past its SLA", () => {
    expect(
      ladderStageFor(facts({ imminentBreached: 1, billing: { open: 5, overdue: 5 } }))
    ).toBe("flags");
  });

  it("puts billing past SLA above an on-track imminent flag", () => {
    expect(
      ladderStageFor(facts({ imminentOpen: 40, billing: { open: 1, overdue: 1 } }))
    ).toBe("billing");
  });

  it("puts billing above clinical, whatever the counts", () => {
    /* ═══ THE ONE PLACE THIS DIVERGES FROM `compareTasks` ═══
       The item comparator ranks a BREACHED clinical flag (tierRank 3) above
       on-track billing (rank 4). This ladder does not: billing has a hard
       external deadline and a clinical review at 48h is the normal rhythm of a
       worked queue. Asserted so the divergence is deliberate rather than
       discovered. */
    expect(
      ladderStageFor(facts({ billing: { open: 1, overdue: 0 }, clinicalBreached: 30 }))
    ).toBe("billing");
  });

  it("falls to chat review only when everything else is clear", () => {
    expect(ladderStageFor(facts({ routineOpen: 1 }))).toBe("flags");
    expect(ladderStageFor(facts({}))).toBe("chatReview");
  });

  it("targets the item the comparator would have put first", () => {
    // THE LADDER CHOOSES THE STAGE; THE COMPARATOR CHOOSES THE ITEM. A CTA
    // pointing at something the destination list would not have led with would
    // be Home disagreeing with the surface it just sent somebody to.
    const items = tasksScenario("breach-overnight", NOW);
    const target = ladderTargetFor(items, NOW);
    expect(target?.taskType).toBe("imminentFlagReview");
  });

  it("has no target on the chat-review rung", () => {
    expect(ladderTargetFor([], NOW)).toBeNull();
  });
});

describe("the stage lines", () => {
  it("renders four stages, in the protocol's order, always", () => {
    for (const f of [NOTHING, facts({ activeEscalations: 3, imminentBreached: 5 })]) {
      expect(shiftStagesFor(f, null).map((s) => s.id)).toEqual(SHIFT_STAGES);
    }
  });

  it("reserves the breach tone for an actual SLA breach", () => {
    // The separation that keeps the sequence non-punitive: a missed deadline
    // gets the breach treatment, a merely busy queue does not.
    const busy = shiftStagesFor(facts({ imminentOpen: 40, billing: { open: 20, overdue: 0 } }), null);
    expect(busy.find((s) => s.id === "flags")!.tone).toBe("attention");
    expect(busy.find((s) => s.id === "billing")!.tone).toBe("attention");

    const late = shiftStagesFor(facts({ imminentBreached: 1, billing: { open: 1, overdue: 1 } }), null);
    expect(late.find((s) => s.id === "flags")!.tone).toBe("breach");
    expect(late.find((s) => s.id === "billing")!.tone).toBe("breach");
  });

  it("says what is true when nothing is outstanding, and does not celebrate", () => {
    /* THE ALL-CLEAR STATE IS NOT REACHABLE FROM ANY FIXTURE — every scenario
       carries at least one open item — so it is asserted here rather than in the
       browser probe, which can only render what a scenario produces. */
    const clear = shiftStagesFor(NOTHING, null);
    expect(clear.map((s) => s.state)).toEqual([
      "All clear",
      "Nothing open",
      "Imminent and clinical clear",
      "Not tracked yet",
    ]);
    expect(clear.every((s) => !/[!]|nice|great|done!/i.test(s.state))).toBe(true);
  });

  it("renders chat review unavailable, because its data does not exist", () => {
    // Nothing records a supervisor having reviewed a conversation. A recency
    // assembled from `lastActivityAt` or `unreadCount` would be a fabricated
    // claim about supervisory oversight.
    const stage = shiftStagesFor(NOTHING, null).find((s) => s.id === "chatReview")!;
    expect(stage.tone).toBe("unavailable");
    expect(stage.href).toBeNull();
  });

  it("gives every other stage exactly one destination", () => {
    const stages = shiftStagesFor(facts({ activeEscalations: 1 }), null);
    for (const s of stages.filter((x) => x.id !== "chatReview")) {
      expect(s.href, s.id).toMatch(/^\/app\/(tasks|monitoring)/);
    }
  });
});

describe("the shift-start digest", () => {
  it("opens after eight hours, and counts never as a gap", () => {
    expect(isNewShift(NOW - SHIFT_GAP_MS - 1, NOW)).toBe(true);
    expect(isNewShift(NOW - SHIFT_GAP_MS + 60_000, NOW)).toBe(false);
    // 0 = never seen. A first-ever session meets the digest once rather than
    // never.
    expect(isNewShift(0, NOW)).toBe(true);
  });

  it("puts every breach before any neutral count", () => {
    const lines = digestLinesFor(
      facts({
        routineOpen: 40,
        clinicalOpen: 30,
        imminentBreached: 1,
        billing: { open: 9, overdue: 2 },
      })
    );
    const lastBreach = lines.map((l) => l.tone).lastIndexOf("breach");
    const firstNeutral = lines.findIndex((l) => l.tone !== "breach");
    expect(lastBreach).toBeGreaterThanOrEqual(0);
    expect(firstNeutral).toBeGreaterThan(lastBreach);
  });

  it("says nothing when there is nothing to say", () => {
    // An empty digest does not render at all — a panel headed "Since your last
    // shift" with no lines under it is worse than no panel.
    expect(digestLinesFor(NOTHING)).toEqual([]);
  });
});

describe("the facts come from the surfaces' own functions", () => {
  it("agrees with Tasks and Monitoring about every count", () => {
    // A Home that disagreed with Tasks about how many billing reviews are open
    // would be worse than a Home with no counts at all.
    const items = tasksScenario("typical-shift", NOW);
    const f = shiftFactsFor(items, NOW);
    expect(f.billing.open).toBe(
      items.filter((i) => i.domain === "billing" && i.status !== "resolved").length
    );
    expect(f.imminentOpen).toBe(
      items.filter((i) => i.taskType === "imminentFlagReview" && i.status !== "resolved").length
    );
  });

  it("computes nothing over a date range", () => {
    // THE LINE THIS SURFACE MUST NOT CROSS. Every fact here is about NOW or
    // about today; a function taking a range is a trend, and a trend of whether
    // a supervisor kept pace is a performance surface.
    expect(shiftFactsFor.length).toBe(2); // (items, now) — no third argument
  });
});
