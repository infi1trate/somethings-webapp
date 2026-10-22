import { describe, expect, it } from "vitest";
import type { EscalationState } from "@/lib/chat/types";
import { DEFAULT_FILTER, duration, eventsCsv, filterEvents, monitoringEvents, rangeSummary, timelineHref, CSV_COLUMNS, type EventSources } from "@/lib/monitoring/events";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import type { TierEvent } from "@/lib/tiering/events";

const NOW = new Date("2026-10-22T18:00:00").getTime();
const MIN = 60_000;
const DAY = 86_400_000;
const teen = (o: Partial<MonitoringTeen> & { id: string }): MonitoringTeen => ({
  teen: "Riley M.", mentor: "Noah K.", tier: 2, daysOnPlatform: 40, daysEngaged: 20, engagement7d: [1, 2, 3, 4, 5, 6, 7], riskFlags: { count: 0 }, escalations: { count: 0 }, surveys: { count: 0 }, ...o,
});
const esc = (o: Partial<EscalationState> = {}): EscalationState => ({
  id: "esc-1", threadId: "t15", openedAt: NOW - 3 * DAY, anchorMessageId: null, supervisorNotifiedAt: NOW - 3 * DAY, supervisorId: "s-stephen", resolvedAt: null, resolutionNoteId: null, requested: 1, contextNote: "x", safetyCheck: { answers: {}, submittedAt: null }, ...o,
});
const confirmed: TierEvent = { id: "te1", teenId: "t15", at: NOW - 3 * DAY + 48_000, kind: "confirmed", tier: 1, fromTier: 3, actor: { id: "s-stephen", name: "Stephen Rowe", role: "supervisor" }, reason: "Plan.", escalationId: "esc-1" };
const steppedDown: TierEvent = { id: "te2", teenId: "t15", at: NOW - 3 * DAY + 134 * MIN, kind: "stepped-down", tier: 3, fromTier: 1, actor: { id: "s-stephen", name: "Stephen Rowe", role: "supervisor" }, reason: "Stable.", escalationId: "esc-1" };

const sources = (o: Partial<EventSources> = {}): EventSources => ({
  roster: [teen({ id: "t15", recordId: "t15", riskFlags: { count: 4, window: "48h", trigger: "surge" } })],
  eventsFor: () => [confirmed, steppedDown],
  escalationsFor: () => [esc({ confirmedTier: 1, confirmedAt: NOW - 3 * DAY + 48_000, resolvedAt: NOW - 3 * DAY + 134 * MIN, meta: { timeToConfirmMs: 48_000 } })],
  nameOf: (a) => a.name,
  now: NOW,
  ...o,
});

describe("one event list, derived from the tier store", () => {
  const events = monitoringEvents(sources());
  it("is newest first — a log", () => {
    expect([...events].sort((a, b) => b.at - a.at).map((e) => e.id)).toEqual(events.map((e) => e.id));
  });
  it("writes an escalation's whole audit line: flagged, confirmed by whom in how long, closed to which tier, after how long", () => {
    const e = events.find((x) => x.kind === "escalation")!;
    expect(e.detail).toBe("Flagged Tier 1 by Noah K. · confirmed Tier 1 by Stephen R. in 0:48 · closed → Tier 3, 2h 14m");
    expect([e.state, e.responseSeconds, e.toTier]).toEqual(["closed", 48, 3]);
  });
  it("makes tier changes immutable, with the audit word", () => {
    const t = events.filter((x) => x.kind === "tier_change");
    expect(t.map((x) => [x.immutable, x.auditLabel, x.detail])).toEqual([
      [true, "Stepped down", "T1 → T3 · update note · Stephen R."],
      [true, "Confirmed", "T3 → T1 · placement note · Stephen R."],
    ]);
  });
  it("expands a flag signal into one event per flag, inside its window", () => {
    const f = events.filter((x) => x.kind === "flag");
    expect(f).toHaveLength(4);
    expect(f.every((x) => x.surge && NOW - x.at <= 2 * DAY && x.detail.startsWith("Surge · 4 flags in 48h"))).toBe(true);
  });
  it("names an open, unconfirmed escalation by its clock", () => {
    const open = monitoringEvents(sources({ escalationsFor: () => [esc({ openedAt: NOW - 5_000 })], eventsFor: () => [] })).find((x) => x.kind === "escalation")!;
    expect(open.detail).toBe("Open · unconfirmed · 0:55 left");
    expect(open.state).toBe("open");
    expect(timelineHref(open)).toBe("/app/chat/t15");
  });
});

describe("filters compose", () => {
  const all = monitoringEvents({ ...sources(), roster: [...sources().roster, ...Array.from({ length: 12 }, (_, i) => teen({ id: `teen-gen-${i}`, teen: `Gen ${i}.`, tier: 4 }))] });
  it("by range, type, tier, mentor and supervisor — each narrowing the last", () => {
    const d30 = filterEvents(all, DEFAULT_FILTER, NOW);
    const d7 = filterEvents(all, { ...DEFAULT_FILTER, range: "7d" }, NOW);
    expect(d7.length).toBeLessThan(d30.length);
    expect(d7.every((e) => NOW - e.at <= 7 * DAY)).toBe(true);
    const onlyEsc = filterEvents(all, { ...DEFAULT_FILTER, kinds: ["escalation"] }, NOW);
    expect(onlyEsc.every((e) => e.kind === "escalation")).toBe(true);
    const t4 = filterEvents(all, { ...DEFAULT_FILTER, range: "90d", tiers: [4] }, NOW);
    expect(t4.every((e) => e.tier === 4 || e.tier === undefined)).toBe(true);
    const noah = filterEvents(all, { ...DEFAULT_FILTER, range: "90d", mentor: "noah" }, NOW);
    expect(noah.every((e) => e.mentorName === "Noah K.")).toBe(true);
    const sup = filterEvents(all, { ...DEFAULT_FILTER, range: "90d", supervisor: "stephen" }, NOW);
    expect(sup.length).toBeGreaterThan(0);
    expect(sup.every((e) => (e.supervisorName ?? "").includes("Stephen"))).toBe(true);
  });
  it("a custom range is inclusive of both days", () => {
    const day = new Date(NOW - 3 * DAY);
    const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const one = filterEvents(all, { ...DEFAULT_FILTER, range: "custom", from: ymd, to: ymd }, NOW);
    expect(one.some((e) => e.kind === "escalation")).toBe(true);
    expect(one.every((e) => new Date(e.at).getDate() === day.getDate())).toBe(true);
  });
});

describe("the summary line and the export", () => {
  const events = monitoringEvents(sources());
  it("counts escalations by tier, the median response, flags and surge, tier changes", () => {
    expect(rangeSummary(events)).toMatchObject({ escalations: 1, t1: 1, t2: 0, medianResponseSeconds: 48, flags: 4, surge: 4, tierChanges: 2 });
  });
  it("exports the audit columns, one row per filtered event, with ISO timestamps", () => {
    const csv = eventsCsv(events.filter((e) => e.kind === "escalation")).split("\n");
    expect(csv[0]).toBe(CSV_COLUMNS.join(","));
    expect(csv).toHaveLength(2);
    const row = csv[1].split(",");
    expect(row[0]).toBe("escalation");
    expect(row[2]).toBe("Riley M.");
    expect(row[4]).toBe("Stephen R.");
    expect(row[6]).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(row[9]).toBe("48");
    expect([row[10], row[11]]).toEqual(["3", "3"]);
  });
  it("quotes a cell that holds a comma", () => {
    expect(eventsCsv(events.filter((e) => e.kind === "escalation"))).toContain('"Flagged Tier 1 by Noah K. · confirmed Tier 1 by Stephen R. in 0:48 · closed → Tier 3, 2h 14m"');
  });
  it("formats durations as m:ss under an hour", () => {
    expect([duration(48_000), duration(55 * 60_000), duration(134 * 60_000)]).toEqual(["0:48", "55:00", "2h 14m"]);
  });
});
