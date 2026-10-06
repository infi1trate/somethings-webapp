// ═══════════════════════════════════════════════════════════════════════════
// A CLOSED REVIEW IS A RECORD (Closed-tab pack §0–§3)
//
// The defect this module exists for is data loss: a submission kept `{ id, at }`
// and discarded the assessment, both prose fields and their provenance. These
// tests pin the record's three promises — it holds what was submitted, it does
// not move when the fixture does, and it is the one rule for "no longer open".

import { describe, expect, it } from "vitest";
import { billingReviewFor } from "@/lib/tasks/billing-presentation";
import { closedHistory } from "@/lib/tasks/closed-history";
import {
  buildClosedReview,
  calendarDaysAgo,
  closedDayBands,
  closedDayGroup,
  closedLabel,
  closedLate,
  outcomeFor,
  withClosures,
  type ClosedCareReview,
} from "@/lib/tasks/closed-review";
import { closedEntries } from "@/lib/tasks/list";
import { openCounts } from "@/lib/ia/open-counts";
import { tasksClosedHistory, tasksScenario, MENTOR_POOL, ROSTER } from "@/lib/tasks/seed";
import type { BillingPayload, TaskItem } from "@/lib/tasks/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/* A Tuesday afternoon, local time — the weekday checks below depend on it. */
const NOW = new Date(2026, 9, 6, 15, 30).getTime();

const billingItem = (now = NOW): TaskItem => {
  const item = tasksScenario("care-mixed-cycles", now).find((i) => i.payload.kind === "billing");
  if (!item) throw new Error("fixture has no billing item");
  return item;
};

const record = (over: Partial<Parameters<typeof buildClosedReview>[0]> = {}): ClosedCareReview => {
  const item = billingItem();
  const payload = item.payload as BillingPayload;
  return buildClosedReview({
    item,
    review: billingReviewFor(item, payload),
    committedCode: payload.recommended.code,
    committedStatement: payload.recommended.statement,
    body: { assessment: "improved", clinical: "Clinical text.", diagnostic: "Diagnostic text." },
    provenance: { clinical: "ai_inserted", diagnostic: "authored" },
    submittedAt: NOW - HOUR,
    submittedBy: { name: "Sasha Rivera", role: "Supervisor" },
    ...over,
  });
};

describe("the outcome is derived from what was asked and what was committed", () => {
  it("names all four", () => {
    expect(outcomeFor("F33.0", "F33.1", "F33.1")).toBe("changed");
    expect(outcomeFor("F33.0", "F33.1", "F33.0")).toBe("kept");
    expect(outcomeFor("F41.1", "F41.1", "F41.1")).toBe("renewed");
    expect(outcomeFor(null, "F41.1", "F41.1")).toBe("assigned");
  });
  it("and a renewal the supervisor overrode is a change, not a renewal", () => {
    expect(outcomeFor("F41.1", "F41.1", "F33.1")).toBe("changed");
  });
  it("and a change to a third code is still a change", () => {
    expect(outcomeFor("F33.0", "F33.1", "F41.1")).toBe("changed");
  });
});

describe("the record holds what was submitted (§0.1)", () => {
  it("keeps the body, the provenance, the decision and the byline", () => {
    const r = record();
    expect(r.body).toEqual({ assessment: "improved", clinical: "Clinical text.", diagnostic: "Diagnostic text." });
    expect(r.provenance).toEqual({ clinical: "ai_inserted", diagnostic: "authored" });
    expect(r.decision.code).toBe((billingItem().payload as BillingPayload).recommended.code);
    expect(r.submittedBy).toEqual({ name: "Sasha Rivera", role: "Supervisor" });
    expect(r.snapshot.item.status).toBe("resolved");
    expect(r.snapshot.item.resolvedAt).toBe(NOW - HOUR);
  });
});

describe("and it is a snapshot, not a pointer (§2.3)", () => {
  it("does not change when the source objects are mutated afterwards", () => {
    /* THE DISCRIMINATING TEST. A record built with spreads or references would
       pass every other test here and still move when the fixture did. */
    const item = billingItem();
    const payload = item.payload as BillingPayload;
    const review = billingReviewFor(item, payload);
    const body = { assessment: "improved" as const, clinical: "Before.", diagnostic: "Before." };
    const r = buildClosedReview({
      item,
      review,
      committedCode: payload.recommended.code,
      committedStatement: payload.recommended.statement,
      body,
      provenance: { clinical: "authored", diagnostic: "authored" },
      submittedAt: NOW,
      submittedBy: { name: "A", role: "Supervisor" },
    });
    payload.mentorStats.messagesLast30 = 999;
    payload.recommended.code = "Z99.9";
    review.rationale.text = "Regenerated.";
    body.clinical = "After.";
    expect(r.snapshot.item.payload).not.toBe(payload);
    expect((r.snapshot.item.payload as BillingPayload).mentorStats.messagesLast30).not.toBe(999);
    expect((r.snapshot.item.payload as BillingPayload).recommended.code).not.toBe("Z99.9");
    expect(r.snapshot.review.rationale.text).not.toBe("Regenerated.");
    expect(r.body.clinical).toBe("Before.");
  });

  it("and rebuilding the fixture at a later `now` leaves it untouched", () => {
    const r = record();
    const before = JSON.stringify(r);
    tasksScenario("care-mixed-cycles", NOW + 3 * DAY);
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("lateness is read off the record (§3.3)", () => {
  it("is 48h from reception, frozen at submission", () => {
    const r = record();
    const late = { ...r, submittedAt: r.snapshot.item.openedAt + 49 * HOUR };
    const prompt = { ...r, submittedAt: r.snapshot.item.openedAt + 47 * HOUR };
    expect(closedLate(late)).toBe(true);
    expect(closedLate(prompt)).toBe(false);
  });
});

describe("date groups and the Closed column (§1, §3)", () => {
  const at = (daysAgo: number, h = 10) => {
    const d = new Date(NOW);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysAgo, h, 5).getTime();
  };
  it("Today, Yesterday, weekdays to six days, then a date", () => {
    expect(closedDayGroup(at(0), NOW).label).toBe("Today");
    expect(closedDayGroup(at(1), NOW).label).toBe("Yesterday");
    expect(closedDayGroup(at(2), NOW).label).toBe("Sunday");
    expect(closedDayGroup(at(6), NOW).label).toBe("Wednesday");
    expect(closedDayGroup(at(7), NOW).label).toBe("Sep 29");
  });
  it("counts calendar days, so a minute past midnight is Today and a minute before is Yesterday", () => {
    const midnight = new Date(2026, 9, 6, 0, 0).getTime();
    expect(closedDayGroup(midnight + 60_000, NOW).label).toBe("Today");
    expect(closedDayGroup(midnight - 60_000, NOW).label).toBe("Yesterday");
    expect(calendarDaysAgo(midnight - 60_000, midnight + 60_000)).toBe(1);
  });
  it("a different year carries the year", () => {
    expect(closedDayGroup(new Date(2025, 11, 30).getTime(), NOW).label).toBe("Dec 30, 2025");
  });
  it("grouped rows say the time; ungrouped rows say as much as the day needs", () => {
    expect(closedLabel(at(3, 11), NOW, true)).toBe("11:05 AM");
    expect(closedLabel(at(0, 11), NOW, false)).toBe("11:05 AM");
    expect(closedLabel(at(3, 11), NOW, false)).toBe("Sat 11:05 AM");
    expect(closedLabel(at(9, 11), NOW, false)).toBe("Sep 27");
  });
  it("bands partition the list in order, and their counts sum to it", () => {
    const history = closedHistory(NOW, 60, { teens: ROSTER, mentors: MENTOR_POOL });
    const entries = closedEntries(history, ["billing"]);
    const bands = closedDayBands(entries, new Map(history.map((r) => [r.id, r])), NOW);
    expect(bands[0].label).toBe("Today");
    expect(bands.reduce((n, b) => n + b.taskCount, 0)).toBe(60);
    expect(bands.flatMap((b) => b.entries.map((e) => e.id))).toEqual(entries.map((e) => e.id));
  });
});

describe("one rule for 'no longer open' (§0.3)", () => {
  it("a closed record removes its item from the care-reviews count", () => {
    const items = tasksScenario("care-review-backlog", NOW);
    const before = openCounts({ items, events: [], escalations: [], now: NOW })["care-reviews"];
    const target = items.find((i) => i.payload.kind === "billing")!;
    const after = openCounts({
      items: withClosures(items, [{ id: target.id, submittedAt: NOW }]),
      events: [],
      escalations: [],
      now: NOW,
    })["care-reviews"];
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(before - 1);
  });
  it("and with nothing closed it returns the same array", () => {
    const items = tasksScenario("care-review-backlog", NOW);
    expect(withClosures(items, [])).toBe(items);
  });
});

describe("closed entries are built from the records themselves", () => {
  it("most recent first, de-duplicated with the first record winning", () => {
    const a = record({ submittedAt: NOW - 3 * HOUR });
    const dupe = { ...a, submittedAt: NOW - HOUR, submittedBy: { name: "Other", role: "Supervisor" } };
    const history = closedHistory(NOW, 5, { teens: ROSTER, mentors: MENTOR_POOL });
    const entries = closedEntries([a, dupe, ...history], ["billing"]);
    expect(entries.filter((e) => e.id === a.id)).toHaveLength(1);
    const times = entries.map((e) => (e.kind === "item" ? e.item.resolvedAt! : 0));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });
});

describe("the closed-history fixture", () => {
  const h = closedHistory(NOW, 600, { teens: ROSTER, mentors: MENTOR_POOL });
  it("is the size asked for, with unique ids that never collide with an open task's", () => {
    expect(h).toHaveLength(600);
    expect(new Set(h.map((r) => r.id)).size).toBe(600);
    expect(h.every((r) => r.id.startsWith("closed-"))).toBe(true);
  });
  it("covers every outcome and every provenance state, and some are late", () => {
    expect(new Set(h.map((r) => r.decision.outcome))).toEqual(new Set(["changed", "kept", "renewed", "assigned"]));
    expect(new Set(h.map((r) => r.provenance.clinical))).toEqual(new Set(["authored", "ai_inserted", "ai_assisted"]));
    expect(h.some(closedLate)).toBe(true);
    expect(h.some((r) => !closedLate(r))).toBe(true);
  });
  it("is deterministic, and every submission is in the past", () => {
    const again = closedHistory(NOW, 600, { teens: ROSTER, mentors: MENTOR_POOL });
    expect(JSON.stringify(again)).toBe(JSON.stringify(h));
    expect(h.every((r) => r.submittedAt < NOW)).toBe(true);
  });
  it("and the scale scenario serves 600 through the registry", () => {
    expect(tasksClosedHistory("care-closed-history", NOW)).toHaveLength(600);
    expect(tasksClosedHistory("care-open-empty", NOW)).toHaveLength(0);
  });
});
