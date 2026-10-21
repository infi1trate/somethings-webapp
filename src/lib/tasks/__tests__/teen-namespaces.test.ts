// ═══════════════════════════════════════════════════════════════════════════
// TWO TEEN ID NAMESPACES — measured, pinned, and NOT reconciled here
//
// The tasks and monitoring fixtures use `tk-*` ids. The record and chat surfaces
// use `t*` ids. They do not overlap, so no link built from a task item or a
// monitoring row can land on a teen's record or their conversation.
//
// ═══ WHAT IT HAS COST SO FAR ═══
//
// Coverage's row control (Phase 7) and the escalation pane's two link-outs
// (Phase 10) were all removed rather than pointed somewhere, because a door that
// cannot open is worse on a safety surface than no door — it spends a click and
// returns "We couldn't find that person" at the moment a supervisor has least
// time. Gap row 432 carries the cost; this file carries the measurement.
//
// ═══ WHY PHASE 10 DID NOT RECONCILE THEM ═══
//
// It is not a rename. MEASURED: 32 task-side teens (8 named + 24 roster) against
// 26 on the record side, so re-pointing cannot cover the roster. Closing it means
// GROWING `DEMO_TEENS`, and each entry is considered data — a phone, a group, a
// mentor assignment, relationship stamps — feeding the Care surface whose review
// body is frozen byte-identical by `review-body-parity`, which has a same-day
// capture guard. That is its own change with its own verification procedure, not
// a fixtures tweak at the end of a ten-phase programme.
//
// ═══ SO THIS TEST ASSERTS WHAT IS TRUE, ON PURPOSE ═══
//
// It fails the day the namespaces are reconciled — with an instruction saying
// that the removed link-outs should come back. A test that asserted the FIXED
// state would fail today and tell nobody anything; a test that asserts the
// broken state is what makes the breakage visible and its repair noticed.

import { describe, expect, it } from "vitest";
import { DEMO_TEENS } from "@/lib/record/people-demo";
import { ROSTER, tasksScenario } from "@/lib/tasks/seed";
import { monitoringData } from "@/lib/monitoring/scenarios";

const NOW = 1_800_000_000_000;

/** Every teen id the supervisor surfaces put in front of a reader. */
function taskSideTeenIds(): Set<string> {
  const out = new Set<string>();
  for (const t of ROSTER) out.add(t.id);
  for (const s of ["typical-shift", "heavy-caseload", "active-escalation"]) {
    for (const i of tasksScenario(s, NOW)) out.add(i.teenId);
    for (const r of monitoringData(null, s, NOW).escalations) out.add(r.teenId);
    for (const c of monitoringData(null, s, NOW).conversations) out.add(c.teenId);
  }
  return out;
}

describe("the two namespaces, as they are", () => {
  it("has more task-side teens than the record side can name", () => {
    const task = taskSideTeenIds();
    // THE INPUT IS ASSERTED: an empty set would satisfy the disjointness check
    // below and prove nothing.
    expect(task.size).toBeGreaterThan(20);
    expect(DEMO_TEENS.length).toBeGreaterThan(20);
    expect(
      task.size,
      `${task.size} task-side teens against ${DEMO_TEENS.length} on the record ` +
        `side — re-pointing cannot cover the roster, so closing gap 432 means ` +
        `growing DEMO_TEENS`
    ).toBeGreaterThan(DEMO_TEENS.length);
  });

  it("shares not one id between them", () => {
    const record = new Set(DEMO_TEENS.map((t) => t.id));
    const shared = [...taskSideTeenIds()].filter((id) => record.has(id));
    expect(
      shared,
      "IDS NOW OVERLAP — if this is deliberate, gap 432 is closing: restore the " +
        "escalation pane's `View care profile` and `View conversation` link-outs " +
        "and Coverage's row control, and check that /app/chat branches its shell " +
        "on persona first (gap 433) or the links land in mentor chrome."
    ).toEqual([]);
  });

  it("uses a prefix that makes the split visible at a glance", () => {
    // Not cosmetic: `tk-omari` next to `t18` in a URL or a log is the only clue
    // a reader gets that two rosters exist. A merge should also merge the shape.
    expect([...taskSideTeenIds()].every((id) => id.startsWith("tk-"))).toBe(true);
    expect(DEMO_TEENS.every((t) => /^t\d+$/.test(t.id))).toBe(true);
  });
});

/* ═══ "NO SUPERVISOR SURFACE OFFERS A LINK IT CANNOT LAND" IS RETIRED ═══
   Its last check read `components/monitoring/event-pane.tsx` for record and
   chat link-outs. The pane was unreachable once Monitoring became the tiered
   overview, and Escalation Exchange v2 deleted it with the rest of the
   escalation/flag dashboard chain. The coverage-row check before it went with
   Coverage (addendum §2.2). Nothing that renders today holds the removed
   affordances, so there is nothing left to assert their absence from. */
