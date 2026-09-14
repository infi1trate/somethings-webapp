// THE GUARD ON LOCKED DECISION 8 — one global priority sort, no secondary
// prioritization logic anywhere.
//
// Each key is tested in isolation AND the precedence between them is tested,
// because the failure mode is not "the comparator is wrong" — it is "someone
// reordered two keys and every list still looked plausible." A breached clinical
// flag beating an on-track imminent one is the case that looks like a bug and is the
// spec, so it gets its own test.

import { describe, expect, it } from "vitest";
import {
  closedToday,
  compareTasks,
  defaultActiveDomain,
  domainSummaries,
  headerCounts,
  listForDomain,
  nextUp,
  openEscalations,
  preselectedFor,
  sortedOpen,
} from "@/lib/tasks/sort";
import { deadlineFor } from "@/lib/tasks/sla";
import { TASK_DOMAINS, TIER_RANK, type TaskItem, type TaskType } from "@/lib/tasks/types";
import { DOMAIN_OF_TYPE } from "@/lib/tasks/types";
import { tasksScenario } from "@/lib/tasks/seed";

const NOW = new Date("2026-08-26T20:05:00.000Z").getTime();
const HOUR = 3_600_000;

let seq = 0;
/** A minimal item. `openedAgo` drives both openedAt and the SLA deadline, so
 *  "opened 26h ago" on a 24h SLA is breached without hand-writing a deadline. */
function item(taskType: TaskType, openedAgo: number, over?: Partial<TaskItem>): TaskItem {
  const openedAt = NOW - openedAgo;
  seq += 1;
  return {
    id: `t${seq}`,
    domain: DOMAIN_OF_TYPE[taskType],
    taskType,
    tierRank: TIER_RANK[taskType],
    teenId: `teen-${seq}`,
    teenDisplayName: `Teen ${seq}.`,
    mentorId: "m1",
    mentorName: "A Mentor",
    objectId: `obj-${seq}`,
    openedAt,
    slaDeadline: deadlineFor(taskType, openedAt),
    status: "open",
    payload: {
      kind: "riskFlag",
      tier: "imminent",
      sourceType: "Message",
      categories: [],
      flaggedExcerpt: "",
      aiRationale: "",
      flaggedCorrectly: null,
      conversationFlagCount: 1,
    },
    ...over,
  };
}

const ids = (items: TaskItem[]) => items.map((i) => i.id);

describe("§3 — the sort key, one level at a time", () => {
  it("1 · an active escalation outranks everything, even a breached imminent flag", () => {
    const esc = item("activeEscalation", 1 * 60_000); // 1m old, not breached
    const breachedRed = item("imminentFlagReview", 40 * HOUR); // very breached
    expect(compareTasks(esc, breachedRed, NOW)).toBeLessThan(0);
  });

  it("2 · breach outranks tier — a breached clinical flag beats an on-track imminent one", () => {
    // THE CASE THAT LOOKS LIKE A BUG. The ladder says what matters in the
    // abstract; breach says what has already been failed.
    const breachedOrange = item("clinicalFlagReview", 50 * HOUR); // 48h SLA → breached
    const onTrackRed = item("imminentFlagReview", 2 * HOUR); // 24h SLA → fine
    expect(compareTasks(breachedOrange, onTrackRed, NOW)).toBeLessThan(0);
    expect(sortedOpen([onTrackRed, breachedOrange], NOW)[0].id).toBe(
      breachedOrange.id
    );
  });

  it("3 · tier decides between two items in the same breach state", () => {
    const imminent = item("imminentFlagReview", 2 * HOUR);
    const clinical = item("clinicalFlagReview", 2 * HOUR);
    const billing = item("intakeBillingReview", 2 * HOUR);
    const routine = item("routineFlagReview", 2 * HOUR);
    const docs = item("escalationDocumentation", 2 * HOUR);
    expect(ids(sortedOpen([docs, routine, billing, clinical, imminent], NOW))).toEqual([
      imminent.id,
      clinical.id,
      billing.id,
      routine.id,
      // Documentation LAST, below routine review — deliberate, see types.ts.
      docs.id,
    ]);
  });

  it("4 · within a tier, the soonest deadline wins", () => {
    const older = item("imminentFlagReview", 20 * HOUR); // 4h left
    const newer = item("imminentFlagReview", 2 * HOUR); // 22h left
    expect(ids(sortedOpen([newer, older], NOW))).toEqual([older.id, newer.id]);
  });

  it("4b · among breached items, the MOST overdue comes first", () => {
    const veryLate = item("imminentFlagReview", 60 * HOUR);
    const justLate = item("imminentFlagReview", 25 * HOUR);
    expect(ids(sortedOpen([justLate, veryLate], NOW))).toEqual([
      veryLate.id,
      justLate.id,
    ]);
  });

  it("5 · openedAt is only a stable tiebreak, never an arrival-order signal", () => {
    // Two items identical on every other key. The sort must be deterministic, and
    // it must not be doing anything else with openedAt — test 4 already showed a
    // NEWER item sorting after an older one when the deadline says so.
    const a = item("routineFlagReview", 3 * HOUR, { id: "zzz" });
    const b = item("routineFlagReview", 3 * HOUR, { id: "aaa" });
    // Same openedAt → falls through to the id, so the order is total.
    expect(ids(sortedOpen([a, b], NOW))).toEqual(["aaa", "zzz"]);
  });

  it("the sort is stable across repeated calls on the same input", () => {
    const items = tasksScenario("heavy-caseload", NOW);
    const once = ids(sortedOpen(items, NOW));
    const twice = ids(sortedOpen(items, NOW));
    const shuffled = ids(sortedOpen([...items].reverse(), NOW));
    expect(twice).toEqual(once);
    // A list that reshuffles when the input order changes is not a total order.
    expect(shuffled).toEqual(once);
  });
});

describe("§3 — everything derives from the one comparator", () => {
  it("Next-up is the head of the globally sorted open set", () => {
    const items = tasksScenario("typical-shift", NOW);
    expect(nextUp(items, NOW)!.id).toBe(sortedOpen(items, NOW)[0].id);
  });

  it("a tab's list is the same sort, filtered — never re-sorted", () => {
    const items = tasksScenario("heavy-caseload", NOW);
    const global = sortedOpen(items, NOW);
    for (const domain of TASK_DOMAINS) {
      const tab = listForDomain(items, domain, NOW);
      expect(ids(tab)).toEqual(ids(global.filter((i) => i.domain === domain)));
    }
  });

  it("the pre-selected item is the head of the active tab's list", () => {
    const items = tasksScenario("typical-shift", NOW);
    for (const domain of TASK_DOMAINS) {
      const head = listForDomain(items, domain, NOW)[0] ?? null;
      expect(preselectedFor(items, domain, NOW)?.id ?? null).toBe(head?.id ?? null);
    }
  });

  it("the default active tab is the Next-up item's domain", () => {
    for (const id of ["quiet-day", "typical-shift", "heavy-caseload", "breach-overnight", "active-escalation"]) {
      const items = tasksScenario(id, NOW);
      expect(defaultActiveDomain(items, NOW), id).toBe(nextUp(items, NOW)!.domain);
    }
  });

  it("with nothing open, the default tab is the first in fixed order", () => {
    expect(defaultActiveDomain([], NOW)).toBe(TASK_DOMAINS[0]);
    expect(nextUp([], NOW)).toBeNull();
  });

  it("an active escalation scenario opens on the Escalations tab", () => {
    const items = tasksScenario("active-escalation", NOW);
    expect(defaultActiveDomain(items, NOW)).toBe("escalation");
    expect(nextUp(items, NOW)!.taskType).toBe("activeEscalation");
  });
});

describe("locked decision 7 — cards never reorder, breach is treatment not position", () => {
  it("domain summaries come back in fixed order regardless of counts or breach", () => {
    for (const id of ["quiet-day", "breach-overnight", "heavy-caseload"]) {
      const summaries = domainSummaries(tasksScenario(id, NOW), NOW);
      expect(summaries.map((s) => s.domain), id).toEqual(TASK_DOMAINS);
    }
  });

  it("zero-count domains are still present, not dropped", () => {
    const summaries = domainSummaries(tasksScenario("quiet-day", NOW), NOW);
    expect(summaries).toHaveLength(4);
    // Quiet day has no escalations — the card must still exist to be
    // de-emphasized rather than hidden.
    expect(summaries.find((s) => s.domain === "escalation")!.openCount).toBe(0);
  });

  it("summary counts equal the tab lists they describe", () => {
    // §2.4's "tab counts equal list contents", enforced through the selectors the
    // UI actually calls rather than through the fixture.
    for (const id of ["typical-shift", "heavy-caseload", "breach-overnight"]) {
      const items = tasksScenario(id, NOW);
      for (const s of domainSummaries(items, NOW)) {
        expect(s.openCount, `${id}/${s.domain}`).toBe(
          listForDomain(items, s.domain, NOW).length
        );
      }
    }
  });
});

describe("header counts and Closed today (§1)", () => {
  it("open and overdue counts match the sorted open set", () => {
    const items = tasksScenario("breach-overnight", NOW);
    const c = headerCounts(items, NOW);
    expect(c.open).toBe(sortedOpen(items, NOW).length);
    // Breach-overnight is entirely breached, so the two are equal there.
    expect(c.overdue).toBe(c.open);
  });

  it("Closed today only reports domains with matching resolved items", () => {
    const items = tasksScenario("typical-shift", NOW);
    const closed = closedToday(items, NOW);
    for (const [domain, n] of Object.entries(closed)) {
      const matching = items.filter(
        (i) => i.domain === domain && i.status === "resolved"
      );
      expect(matching.length, domain).toBeGreaterThanOrEqual(n as number);
    }
    // §1 names escalations, flags and billing — the routine tier is deliberately
    // not a header counter.
    expect(Object.keys(closed)).not.toContain("routineFlag");
  });
});

describe("locked decision 10 — escalations are never only inside a tab", () => {
  it("openEscalations reads the whole item set, not the active domain", () => {
    const items = tasksScenario("active-escalation", NOW);
    const strip = openEscalations(items, NOW);
    expect(strip.length).toBe(2);
    // Sorted, so the breached 911 escalation leads.
    expect(strip[0].payload.kind).toBe("escalation");
    if (strip[0].payload.kind === "escalation") {
      expect(strip[0].payload.is911).toBe(true);
    }
  });

  it("resolved escalations do not appear in the strip", () => {
    // typical-shift has a RESOLVED activeEscalation, which must not render.
    const items = tasksScenario("typical-shift", NOW);
    expect(openEscalations(items, NOW)).toHaveLength(0);
  });
});
