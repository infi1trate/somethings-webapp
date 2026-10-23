import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER, collapseRepeats, filterFacets, isRun, type MonitoringEvent } from "@/lib/monitoring/events";

const ev = (id: string, kind: MonitoringEvent["kind"], teenId: string, at: number, detail = id): MonitoringEvent => ({
  id, at, kind, teenId, teenName: teenId === "t13" ? "Jordan T." : "Sam K.", mentorId: "m", mentorName: "Alex", detail, state: "recorded", immutable: false,
});

describe("collapseRepeats", () => {
  it("collapses consecutive flags on one teen; the run keeps the newest detail", () => {
    const out = collapseRepeats([ev("f3", "flag", "t13", 30, "4 flags in 24h · not safe tonight"), ev("f2", "flag", "t13", 20), ev("f1", "flag", "t13", 10)]);
    expect(out).toHaveLength(1);
    expect(isRun(out[0]) && out[0].flags.map((f) => f.id)).toEqual(["f3", "f2", "f1"]);
    expect(isRun(out[0]) && out[0].detail).toBe("not safe tonight");
  });
  it("gathers a teen's flags across the day, at the newest's place — interleaving does not split them", () => {
    const out = collapseRepeats([ev("a", "flag", "t13", 50), ev("b", "flag", "t14", 40), ev("c", "flag", "t13", 30), ev("d", "escalation", "t13", 20), ev("e", "flag", "t13", 10)]);
    expect(out.map((x) => (isRun(x) ? `run:${x.flags.map((f) => f.id).join("")}` : x.id))).toEqual(["run:ace", "b", "d"]);
  });
  it("a single flag per teen stays an event", () => {
    expect(collapseRepeats([ev("a", "flag", "t13", 2), ev("b", "flag", "t14", 1)]).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("non-flag repeats are never collapsed", () => {
    expect(collapseRepeats([ev("x", "escalation", "t13", 2), ev("y", "escalation", "t13", 1)])).toHaveLength(2);
  });
});

describe("filterFacets", () => {
  it("the default has none", () => expect(filterFacets(DEFAULT_FILTER)).toEqual([]));
  it("one facet per changed dimension, each clearing only itself", () => {
    const f = filterFacets({ ...DEFAULT_FILTER, kinds: ["escalation", "flag"], tiers: [2, 1], mentor: " Alex " });
    expect(f.map((x) => x.label)).toEqual(["Escalations, Risk flags", "T1, T2", "Mentor: Alex"]);
    expect(f[0].clear).toEqual({ kinds: DEFAULT_FILTER.kinds });
    expect(f[2].clear).toEqual({ mentor: "" });
  });
});
