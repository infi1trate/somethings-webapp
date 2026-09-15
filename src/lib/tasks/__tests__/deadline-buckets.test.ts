// GROUPING BY WHEN WORK IS DUE.
//
// The failure this replaces was not an ordering bug — the comparator was right
// all along. It was that TYPE buckets cut a correctly sorted list into runs, so
// the page restarted its countdown at every header and scanning for what was
// about to breach meant merging N sorted lists by eye.
//
// So the claim under test is that buckets are a PARTITION of the one sort: every
// item in exactly one, in fixed order, with deadline order preserved end to end.

import { describe, expect, it } from "vitest";
import {
  BUCKET_LABEL,
  DEADLINE_BUCKETS,
  bucketOf,
  deadlineBandsFor,
} from "@/lib/tasks/deadline-buckets";
import { listEntriesFor } from "@/lib/tasks/list";
import { sortedOpen } from "@/lib/tasks/sort";
import { TASK_SCENARIOS, tasksScenario } from "@/lib/tasks/seed";
import { slaRemaining } from "@/lib/tasks/types";

const HOUR = 3_600_000;
/** Mid-morning, so "end of today" is unambiguously ahead and "end of tomorrow"
 *  further still. A fixed instant, because these boundaries are wall-clock. */
const NOON = new Date(2026, 8, 15, 11, 0, 0).getTime();

describe("which bucket a deadline falls in", () => {
  it("calls anything at or before now overdue", () => {
    expect(bucketOf(NOON - 1, NOON)).toBe("overdue");
    // Exactly on the deadline is NOT yet late, matching `isBreached`'s `now >
    // slaDeadline` at the only instant the two could differ.
    expect(bucketOf(NOON, NOON)).toBe("overdue");
    expect(bucketOf(NOON + 1, NOON)).not.toBe("overdue");
  });

  it("uses calendar days, not rolling hours", () => {
    /* THE DIFFERENCE MATTERS TO A READER: "due today" means before you go home,
       which is a wall-clock fact. A rolling 24 hours would put something due at
       9am tomorrow in the same bucket as something due at 5pm today, and those
       are two different afternoons. */
    const lateToday = new Date(2026, 8, 15, 23, 0, 0).getTime();
    const earlyTomorrow = new Date(2026, 8, 16, 1, 0, 0).getTime();
    expect(bucketOf(lateToday, NOON)).toBe("today");
    expect(bucketOf(earlyTomorrow, NOON)).toBe("tomorrow");
    // 14 hours apart, and on opposite sides of the boundary — a rolling window
    // would have put both in the same bucket.
    expect(earlyTomorrow - lateToday).toBeLessThan(3 * HOUR);
  });

  it("puts everything past tomorrow in later", () => {
    const dayAfter = new Date(2026, 8, 17, 9, 0, 0).getTime();
    expect(bucketOf(dayAfter, NOON)).toBe("later");
  });
});

describe("buckets as bands", () => {
  it("renders in fixed order, never first-appearance order", () => {
    /* ═══ THE INPUT IS DELIBERATELY OUT OF ORDER ═══
       A first draft asserted this against a real scenario and PASSED with the
       fixed ordering deleted — because a deadline-sorted list arrives in bucket
       order anyway, so first-appearance and fixed order are the same sequence and
       the mutation was unobservable. A mutation run caught that.
       The fixed order is a GUARANTEE for the case where the comparator's earlier
       keys reorder something — a breached low-tier item ahead of an on-track high
       one, say — so the test has to construct that case rather than hope for it.
       These entries arrive later-first. */
    const now = Date.now();
    const mk = (id: string, deadline: number) =>
      ({
        kind: "item" as const,
        id,
        item: { id, slaDeadline: deadline, taskType: "intakeBillingReview" } as never,
      });
    const out = deadlineBandsFor(
      [
        mk("a", now + 5 * 86_400_000), // later
        mk("b", now - HOUR), // overdue
        mk("c", now + 30 * HOUR), // tomorrow-ish
      ],
      now
    );
    expect(out.map((b) => b.id)).toEqual(
      DEADLINE_BUCKETS.filter((id) => out.some((b) => b.id === id))
    );
    expect(out[0].id).toBe("overdue");
  });

  it("omits empty buckets rather than rendering a zero", () => {
    /* Deliberately unlike the tab-card rule, which kept every card for position
       stability. A card was a navigation target a reader learned the position
       of; a bucket is a content grouping, and "Overdue — 0" is a line of noise
       claiming a shape the list does not have. */
    const items = tasksScenario("quiet-day", Date.now());
    const entries = listEntriesFor(items, "billing", Date.now());
    const bands = deadlineBandsFor(entries, Date.now());
    expect(bands.length).toBe(1);
    expect(bands.every((b) => b.taskCount > 0)).toBe(true);
  });

  it("labels every bucket it renders", () => {
    for (const id of DEADLINE_BUCKETS) expect(BUCKET_LABEL[id]).toBeTruthy();
  });

  it("counts every item exactly once, across every scenario", () => {
    const now = Date.now();
    for (const s of TASK_SCENARIOS) {
      const items = tasksScenario(s.id, now);
      const entries = listEntriesFor(items, "billing", now);
      const bands = deadlineBandsFor(entries, now);
      const counted = bands.reduce((n, b) => n + b.taskCount, 0);
      const open = items.filter(
        (i) => i.domain === "billing" && i.status !== "resolved"
      ).length;
      expect(counted, s.id).toBe(open);
    }
  });

  it("keeps deadline order monotonic across bucket boundaries", () => {
    /* ═══ THE WHOLE POINT ═══
       Type buckets destroyed this: the list ran 15h → 2d, then RESTARTED at 20h
       → 2d. Reading the buckets end to end must now give one non-decreasing
       sequence, which is what makes the page scannable for what is about to
       breach. */
    const now = Date.now();
    for (const s of TASK_SCENARIOS) {
      const items = tasksScenario(s.id, now);
      const entries = listEntriesFor(items, "billing", now);
      const flat = deadlineBandsFor(entries, now).flatMap((b) => b.entries);
      const remaining = flat.map((e) =>
        slaRemaining(e.kind === "item" ? e.item : e.head, now)
      );
      for (let i = 1; i < remaining.length; i += 1) {
        expect(remaining[i - 1], `${s.id} at ${i}`).toBeLessThanOrEqual(remaining[i]);
      }
    }
  });

  it("is a partition of the one sort, not a re-sort", () => {
    /* The flattened bands must be the SAME SEQUENCE the comparator produced —
       identity, not merely the same set. A bucket that reordered its members
       would pass a set comparison and fail this. */
    const now = Date.now();
    const items = tasksScenario("heavy-caseload", now);
    const entries = listEntriesFor(items, "billing", now);
    const flat = deadlineBandsFor(entries, now).flatMap((b) => b.entries);
    const sorted = sortedOpen(items, now).filter((i) => i.domain === "billing");
    expect(flat.map((e) => (e.kind === "item" ? e.item.id : e.head.id))).toEqual(
      sorted.map((i) => i.id)
    );
  });
});
