import { describe, expect, it } from "vitest";
import { tierCta } from "@/lib/tiering/tier-cta";
import { RAISE_DESCRIPTION, RAISE_TIERS, TIER_CRITERIA, TIER_NAME, TIERS, raiseDescription } from "@/lib/tiering/tiers";

// ═══ TierSelect (pack v10.0) — the blocked constants, and the CTA's paths ═══

describe("the tier canon (blocked constant)", () => {
  it("pairs each number with exactly one name: T1 Active crisis · T2 High risk · T3 Medium risk · T4 General", () => {
    expect(TIER_NAME).toEqual({ 1: "Active crisis", 2: "High risk", 3: "Medium risk", 4: "General" });
  });

  it("raises strictly Tiers 1–3; review and update read all four", () => {
    expect([...RAISE_TIERS]).toEqual([1, 2, 3]);
    expect([...TIERS]).toEqual([1, 2, 3, 4]);
  });

  it("carries the mentor's lines verbatim from the pack's table", () => {
    expect(raiseDescription(1, "Jordan")).toBe("Jordan might hurt themselves or someone else, or is in danger right now.");
    expect(raiseDescription(2, "Jordan")).toBe("Something serious is going on and Jordan needs closer support this week.");
    expect(raiseDescription(3, "Jordan")).toBe("You're worried and want a supervisor to know, but it isn't urgent.");
    /* The mock pasted emergency-contact copy into T3. */
    expect(RAISE_DESCRIPTION[3]).not.toMatch(/on file|intake/i);
  });

  it("carries the supervisor's criteria from the pack, one per tier, each ending in a full stop", () => {
    expect(TIER_CRITERIA[1]).toMatch(/^Specific plan with means\/timeframe, .*active command hallucinations\.$/);
    expect(TIER_CRITERIA[2]).toMatch(/^Passive suicidal ideation, .*without imminence\.$/);
    expect(TIER_CRITERIA[3]).toMatch(/^Low-level distress, .*no active high-risk indicators\.$/);
    expect(TIER_CRITERIA[4]).toBe("No issues that need supervisor intervention.");
  });
});

describe("tierCta — the consequence is spelled out before it is committed", () => {
  const confirm = { mode: "review", kind: "confirm", current: 3, requested: 1 } as const;
  const update = { mode: "review", kind: "update", current: 2, requested: null } as const;
  const pending = { mode: "review", kind: "update", current: 3, requested: 4 } as const;

  it("raise: one label, whatever is checked", () => {
    expect(tierCta({ mode: "raise" }, null)).toBe("Confirm escalation");
    expect(tierCta({ mode: "raise" }, 1)).toBe("Confirm escalation");
  });

  it("confirm: the checked tier in full, and it relabels on an override", () => {
    expect(tierCta(confirm, 1)).toBe("Confirm Tier 1 · Active crisis");
    expect(tierCta(confirm, 2)).toBe("Confirm Tier 2 · High risk");
    expect(tierCta(confirm, 4)).toBe("Confirm Tier 4 · General");
    expect(tierCta(confirm, null)).toBe("Choose a tier");
  });

  it("update: the current tier is no move; any other names it", () => {
    expect(tierCta(update, 2)).toBe("Choose a new tier");
    expect(tierCta(update, 1)).toBe("Update to Tier 1");
    expect(tierCta(update, 3)).toBe("Update to Tier 3");
  });

  it("update with a request pending: confirming it names it in full; anything else is an update", () => {
    expect(tierCta(pending, 4)).toBe("Confirm Tier 4 · General");
    expect(tierCta(pending, 2)).toBe("Update to Tier 2");
    expect(tierCta(pending, 3)).toBe("Choose a new tier");
  });

  it("a first placement has no current tier to be a no-op", () => {
    expect(tierCta({ mode: "review", kind: "update", current: null, requested: null }, 3)).toBe("Update to Tier 3");
  });
});
