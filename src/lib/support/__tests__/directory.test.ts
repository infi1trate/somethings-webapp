import { describe, expect, it } from "vitest";
import { isFirstRun, SECTION_ORDER, supportDirectory } from "../directory";
import { supportStamp } from "../relative-time";

const NOW = new Date(2026, 9, 16, 12, 0).getTime();
const rows = (persona: Parameters<typeof supportDirectory>[0], id: string) =>
  supportDirectory(persona, "active-mentorship", NOW).find((s) => s.id === id)!.rows;

describe("supportDirectory", () => {
  it("is four sections in the pack's order", () => {
    expect(supportDirectory("mentor", "active-mentorship", NOW).map((s) => s.id)).toEqual(SECTION_ORDER);
    expect(SECTION_ORDER).toEqual(["supervisors", "cohorts", "groups", "other"]);
  });
  it("gives a mentor the chat fixture's two support contacts, and agrees with it on unread", () => {
    expect(rows("mentor", "supervisors").map((r) => r.id).sort()).toEqual(["s-brandy", "s-stephen"]);
    const esc = supportDirectory("mentor", "escalation-active", NOW).find((s) => s.id === "supervisors")!.rows;
    expect(esc.find((r) => r.id === "s-brandy")!.unread).toBe(1);
  });
  it("gives a lead mentor their supervisor", () => {
    expect(rows("lead-mentor", "supervisors").map((r) => r.name)).toEqual(["Stephen Rowe"]);
    expect(rows("lead-mentor", "cohorts")).toEqual([]);
  });
  it("leaves a supervisor's Supervisors empty, which is the section's empty state", () => {
    expect(rows("supervisor", "supervisors")).toEqual([]);
    expect(rows("supervisor", "groups").length).toBeGreaterThan(0);
  });
  it("is a first run for an admin, and only for an admin", () => {
    expect(isFirstRun(supportDirectory("admin", "active-mentorship", NOW))).toBe(true);
    for (const p of ["mentor", "lead-mentor", "supervisor"] as const) {
      expect(isFirstRun(supportDirectory(p, "active-mentorship", NOW))).toBe(false);
    }
  });
  it("puts every rung of the timestamp ladder on a mentor's screen", () => {
    const stamps = supportDirectory("mentor", "active-mentorship", NOW)
      .flatMap((s) => s.rows)
      .filter((r) => r.at !== null)
      .map((r) => supportStamp(r.at!, NOW));
    expect(stamps.some((t) => /^\d+m$/.test(t))).toBe(true);
    expect(stamps.some((t) => /^\d+h$/.test(t))).toBe(true);
    expect(stamps.some((t) => /^[1-6]d$/.test(t))).toBe(true);
    expect(stamps.some((t) => /^[A-Z][a-z]{2} \d{1,2}$/.test(t))).toBe(true);
    expect(stamps.some((t) => /^[A-Z][a-z]{2} \d{4}$/.test(t))).toBe(true);
    expect(stamps.every((t) => !/^\d{2,}d$/.test(t))).toBe(true);
  });
});
