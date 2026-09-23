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
import {
  TASK_DOMAINS,
  TYPE_URGENCY_RANK,
  slaRemaining,
  type TaskItem,
  type TaskType,
} from "@/lib/tasks/types";
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
    urgencyRank: TYPE_URGENCY_RANK[taskType],
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
    const breachedRed = item("riskFlagReview", 40 * HOUR); // very breached
    expect(compareTasks(esc, breachedRed, NOW)).toBeLessThan(0);
  });

  it("2 · breach outranks tier — a breached clinical flag beats an on-track imminent one", () => {
    // THE CASE THAT LOOKS LIKE A BUG. The ladder says what matters in the
    // abstract; breach says what has already been failed.
    const breachedOrange = item("riskFlagReview", 50 * HOUR); // 48h SLA → breached
    const onTrackRed = item("riskFlagReview", 2 * HOUR); // 24h SLA → fine
    expect(compareTasks(breachedOrange, onTrackRed, NOW)).toBeLessThan(0);
    expect(sortedOpen([onTrackRed, breachedOrange], NOW)[0].id).toBe(
      breachedOrange.id
    );
  });

  /* ═══ RETARGETED — THE THIRD KEY WAS THE TIER LADDER (Phase 4) ═══
     It ordered `imminent · clinical · billing · routine · docs`, which is three
     flag TIERS interleaved with billing. With one flag type the key ranks task
     TYPES: flag before billing before documentation. The claim that mattered is
     unchanged and still asserted — documentation LAST, below everything, which
     is the tail that looks like a bug and is not. */
  it("3 · the type's urgency decides between two items in the same breach state", () => {
    const flag = item("riskFlagReview", 2 * HOUR);
    const billing = item("intakeBillingReview", 2 * HOUR);
    const docs = item("escalationDocumentation", 2 * HOUR);
    expect(ids(sortedOpen([docs, billing, flag], NOW))).toEqual([
      flag.id,
      billing.id,
      docs.id,
    ]);
  });

  /* ═══ AND THE FOURTH KEY CANNOT SEPARATE TWO FLAGS ANY MORE ═══
     It read "within a tier, the soonest deadline wins" over two flags with 4h
     and 22h left. A flag has NO deadline now, so `slaRemaining` returns
     `Infinity` for both and the step falls through — which is the correct
     behaviour and the opposite of what the old fixture asserted.
     THE KEY IS STILL LIVE, so it is tested on items that have deadlines. */
  it("4 · the soonest deadline wins, among items that have one", () => {
    const older = item("intakeBillingReview", 60 * HOUR);
    const newer = item("intakeBillingReview", 2 * HOUR);
    expect(ids(sortedOpen([newer, older], NOW))).toEqual([older.id, newer.id]);
  });

  it("4c · and it cannot separate two flags, because neither has a deadline", () => {
    const a = item("riskFlagReview", 20 * HOUR);
    const b = item("riskFlagReview", 2 * HOUR);
    expect(slaRemaining(a, NOW)).toBe(Infinity);
    expect(slaRemaining(b, NOW)).toBe(Infinity);
    // Falls through to the stable tiebreak — oldest first — not to a deadline.
    expect(ids(sortedOpen([b, a], NOW))).toEqual([a.id, b.id]);
  });

  it("4b · among breached items, the MOST overdue comes first", () => {
    const veryLate = item("riskFlagReview", 60 * HOUR);
    const justLate = item("riskFlagReview", 25 * HOUR);
    expect(ids(sortedOpen([justLate, veryLate], NOW))).toEqual([
      veryLate.id,
      justLate.id,
    ]);
  });

  it("5 · openedAt is only a stable tiebreak, never an arrival-order signal", () => {
    // Two items identical on every other key. The sort must be deterministic, and
    // it must not be doing anything else with openedAt — test 4 already showed a
    // NEWER item sorting after an older one when the deadline says so.
    const a = item("riskFlagReview", 3 * HOUR, { id: "zzz" });
    const b = item("riskFlagReview", 3 * HOUR, { id: "aaa" });
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
    /* DERIVED, NOT 4 (Phase 4 removed a domain). Asserting against
       `TASK_DOMAINS` is also the stronger form: it says "one summary per
       domain", which is the actual claim, rather than pinning a count that has
       to be edited every time the set changes. */
    expect(summaries).toHaveLength(TASK_DOMAINS.length);
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
    /* ═══ RETARGETED — "ENTIRELY BREACHED" IS NO LONGER POSSIBLE (Phase 4) ═══
       It asserted `c.overdue === c.open`, on the scenario whose description was
       "Everything past its SLA". A flag has no published review deadline now, so
       a flag cannot be overdue and this scenario cannot be entirely so.
       THE REPLACEMENT IS STRICTER, not looser: every item that HAS a deadline is
       past it, AND the scenario genuinely contains flags that are not — so it
       exercises both halves rather than asserting a single equality that a
       fixture with no flags at all would also satisfy. */
    const open = sortedOpen(items, NOW);
    const withDeadline = open.filter((i) => i.slaDeadline != null);
    const without = open.filter((i) => i.slaDeadline == null);
    expect(withDeadline.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
    expect(c.overdue).toBe(withDeadline.length);
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
    /* ═══ THE EXCLUSION IS RETIRED, NOT RELAXED (Phase 4) ═══
       This asserted `not.toContain("routineFlag")`, because §1 named escalations,
       flags and billing and "closing a routine review is not an achievement worth
       a counter". That domain no longer exists, so the assertion could only ever
       pass — which is a vacuous check, not a satisfied one.
       WHAT IS ASSERTED INSTEAD is the positive form the old one implied: the
       counters are exactly the three domains, so a fourth appearing is a failure
       whatever it is called. */
    expect(Object.keys(closed).sort()).toEqual(
      Object.keys(closed).filter((d) =>
        ["escalation", "riskFlag", "billing"].includes(d)
      ).sort()
    );
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
    /* ═══ THIS ASSERTED `toHaveLength(0)` AND THAT WAS THE WEAKER TEST ═══
       typical-shift carries a RESOLVED activeEscalation and, since arch-B seeded
       the escalation region, a LIVE one as well. The old assertion passed only
       while the scenario happened to hold no open escalation at all — so it was
       really testing the fixture, and it broke the moment the fixture grew
       something it was never about.
       The claim is that RESOLVED ones are excluded. Asserting that directly is
       both stronger and immune to the seed. */
    const items = tasksScenario("typical-shift", NOW);
    const resolved = items.filter(
      (i) => i.taskType === "activeEscalation" && i.status === "resolved"
    );
    expect(resolved.length).toBeGreaterThan(0);

    const strip = openEscalations(items, NOW);
    const stripIds = new Set(strip.map((i) => i.id));
    for (const r of resolved) expect(stripIds.has(r.id)).toBe(false);
    expect(strip.every((i) => i.status !== "resolved")).toBe(true);
  });
});
