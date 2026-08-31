// DAY GROUPING HAS TO ACTUALLY GROUP.
//
// The 30-day fixture placed 54 events at `ago(floor(i * 48 / 54), …)`, spreading
// them almost evenly: measured by the feed's OWN day key, 48 populated days of
// which 42 held exactly one event. So a day divider rendered above 42 of 54 rows.
// Grouping that never groups is chrome, not structure — and it also meant
// coalescing was only ever visible in the heavy-day scenario.
//
// ═══ MEASURE WITH THE PRODUCT'S RULER ═══
//
// `dayKeyOf`, not `toISOString().slice(0,10)`. A UTC-day metric disagreed with
// the feed's local-day buckets and reported the corrected fixture as 22 days with
// a max of 5 — which nearly sent a correct change back for a second fix. If a
// metric and the product disagree about what a day is, the metric is wrong.

import { describe, expect, it } from "vitest";
import { ACTIVITY_SCENARIOS, scenarioById } from "@/lib/activity/seed";
import { dayKeyOf } from "@/lib/activity/events";

function perDay(scenarioId: string): number[] {
  const byDay = new Map<string, number>();
  for (const e of scenarioById(scenarioId).events) {
    const k = dayKeyOf(e.occurredAt);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  return [...byDay.values()].sort((a, b) => a - b);
}

describe("the 30-day fixture groups into real days", () => {
  it("holds 3–8 events on a typical day", () => {
    const counts = perDay("long-history");
    expect(counts.length).toBeGreaterThan(6);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...counts)).toBeLessThanOrEqual(8);
  });

  it("has NO day holding a single event", () => {
    // The regression this file exists for: 42 of 48 days used to hold one.
    expect(perDay("long-history").filter((c) => c === 1)).toEqual([]);
  });

  it("leaves days empty, so a divider means something", () => {
    // 54 events across 12 populated days inside a 48-day span — the gaps are the
    // point. A fixture with a populated day for every calendar day would pass the
    // two assertions above and still render a divider per row.
    const events = scenarioById("long-history").events;
    const days = new Set(events.map((e) => dayKeyOf(e.occurredAt)));
    const spanDays =
      (Math.max(...events.map((e) => Date.parse(e.occurredAt))) -
        Math.min(...events.map((e) => Date.parse(e.occurredAt)))) /
      86_400_000;
    expect(spanDays).toBeGreaterThan(30);
    expect(days.size).toBeLessThan(spanDays / 2);
  });

  it("still reaches beyond the 30-day window, so paging reveals rows", () => {
    const events = scenarioById("long-history").events;
    const oldest = Math.min(...events.map((e) => Date.parse(e.occurredAt)));
    const newest = Math.max(...events.map((e) => Date.parse(e.occurredAt)));
    expect((newest - oldest) / 86_400_000).toBeGreaterThan(40);
    const beyond = events.filter(
      (e) => (newest - Date.parse(e.occurredAt)) / 86_400_000 > 30
    );
    expect(beyond.length).toBeGreaterThan(5);
  });

  it("leaves no scenario with a divider-per-row shape", () => {
    // The general property, across every fixture rather than the one that was
    // reported: a scenario whose median day holds one event is grouping nothing.
    for (const s of ACTIVITY_SCENARIOS) {
      const counts = perDay(s.id);
      if (counts.length < 3) continue; // quiet-shift is legitimately tiny
      const median = counts[Math.floor(counts.length / 2)];
      expect(median, `${s.id} groups nothing`).toBeGreaterThan(1);
    }
  });
});
