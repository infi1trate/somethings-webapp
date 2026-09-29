// ═══════════════════════════════════════════════════════════════════════════
// OVERDUE IS NOT A DEADLINE, AND IT IS NOT AGE (rework §2)
//
// §2 spent a page warning against two specific mistakes, and both are things a
// plausible implementation does by accident:
//
//  1 · deriving a DEADLINE, which was removed on Brandon's instruction and
//      whose constant is retired;
//  2 · conflating overdue with AGE, which "produces a number that looks
//      authoritative and is invented".
//
// So the tests are as much about what this must NOT do as what it does.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARE_REVIEW_RESPONSE_MS,
  isOverdue,
  overdueCount,
} from "@/lib/tasks/care-overdue";
import { TASK_SLA_MS } from "@/lib/tasks/sla";
import type { TaskItem } from "@/lib/tasks/types";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

const item = (
  id: string,
  openedAgo: number,
  status: TaskItem["status"] = "open"
): TaskItem =>
  ({
    id,
    teenId: `tk-${id}`,
    taskType: "monthlyReReview",
    domain: "billing",
    status,
    openedAt: NOW - openedAgo,
    slaDeadline: null,
  }) as unknown as TaskItem;

describe("the threshold is 48 hours since reception", () => {
  it("is 48 hours, as answered", () => {
    expect(CARE_REVIEW_RESPONSE_MS).toBe(48 * HOUR);
  });

  it.each([
    [0, false],
    [1 * HOUR, false],
    [47 * HOUR, false],
    [48 * HOUR, false],
    [48 * HOUR + 1, true],
    [72 * HOUR, true],
    [30 * 24 * HOUR, true],
  ])("at %ims elapsed, overdue is %s", (ago, want) => {
    expect(isOverdue(item("a", ago), NOW)).toBe(want);
  });

  it("is exclusive at the boundary — 'over 48 hours', not 'at'", () => {
    expect(isOverdue(item("a", 48 * HOUR), NOW)).toBe(false);
    expect(isOverdue(item("a", 48 * HOUR + 1), NOW)).toBe(true);
  });
});

describe("a reviewed item is never overdue, however long it took", () => {
  /* ═══ THE DISTINCTION §2 ASKED FOR ═══
     Age is a fact about every item. Overdue is a fact about items STILL OPEN —
     a submitted review that took three days is done, not late. An
     implementation that read only the timestamp would call it overdue, which
     is the conflation §2 names. */
  it.each(["resolved", "reviewed"] as const)("status %s is not overdue at 30 days", (status) => {
    const old = item("a", 30 * 24 * HOUR, status as TaskItem["status"]);
    expect(isOverdue(old, NOW)).toBe(false);
  });

  it("so two items of identical age can differ, and that is the point", () => {
    const openOld = item("open", 72 * HOUR);
    const doneOld = item("done", 72 * HOUR, "resolved");
    expect(openOld.openedAt).toBe(doneOld.openedAt);
    expect(isOverdue(openOld, NOW)).toBe(true);
    expect(isOverdue(doneOld, NOW)).toBe(false);
  });
});

describe("the count is over the set it is given", () => {
  it("counts only the overdue members", () => {
    const set = [
      item("a", 10 * HOUR),
      item("b", 49 * HOUR),
      item("c", 96 * HOUR),
      item("d", 96 * HOUR, "resolved"),
    ];
    expect(overdueCount(set, NOW)).toBe(2);
  });

  it("is zero for an empty set, not null", () => {
    /* The metric line renders `{n} overdue`; a null would print "null overdue"
       and a missing key would print "undefined". Zero is a real reading. */
    expect(overdueCount([], NOW)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AND THE DEADLINE CONCEPT STAYS RETIRED
// ═══════════════════════════════════════════════════════════════════════════

describe("`CARE_REVIEW_SLA` does not un-retire (§2)", () => {
  it("leaves both care-review task types with a null SLA", () => {
    /* If this ever becomes a number, `compareTasks` re-orders the queue by
       breach and breach chips return to the rows — the state two phases
       removed. The 48h threshold deliberately does NOT live here. */
    expect(TASK_SLA_MS.intakeBillingReview).toBeNull();
    expect(TASK_SLA_MS.monthlyReReview).toBeNull();
  });

  it("and the threshold is declared outside sla.ts", () => {
    const sla = readFileSync(join(process.cwd(), "src/lib/tasks/sla.ts"), "utf8");
    const stripped = sla.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(
      stripped,
      "the response threshold moved into sla.ts, where compareTasks would read it"
    ).not.toContain("CARE_REVIEW_RESPONSE_MS");
  });

  it("and nothing derives a due DATE from the cycle", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/tasks/care-overdue.ts"),
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    /* No cycle import, no due-date arithmetic. Overdue is a response time on
       reception and knows nothing about when a review was scheduled. */
    expect(src).not.toContain("review-cycle");
    expect(src).not.toMatch(/dueAt|deadline|dueDate/i);
  });
});
