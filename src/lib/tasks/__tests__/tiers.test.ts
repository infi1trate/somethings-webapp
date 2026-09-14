// THE THREE FLAG TIERS, AND THE ONE PLACE THEY ARE NAMED.
//
// arch-B renamed them. The data said `red | orange | green` while the band
// headers said Imminent / Clinical review / Monitoring, and the pane held a
// THIRD table that printed "Red flag" under a header reading "Imminent" — one
// judgement, three vocabularies, two of them colours on a surface whose own
// rule is that colour is never the carrier.
//
// What these guard is the collapse to one: every tier resolves to a band label,
// every flag task type is some tier's, and no colour word survives in a value a
// reader can see. A rename that half-lands is worse than one that never
// happened, because the two halves then disagree in front of a supervisor.

import { describe, expect, it } from "vitest";
import { BAND_LABEL, TIER_BAND_TYPE, tierLabel } from "@/lib/tasks/bands";
import { DOMAIN_OF_TYPE, TIER_RANK } from "@/lib/tasks/types";
import { isFlagTask } from "@/lib/tasks/list";
import type { RiskFlagPayload, TaskType } from "@/lib/tasks/types";

const TIERS = Object.keys(TIER_BAND_TYPE) as RiskFlagPayload["tier"][];

describe("the flag tiers", () => {
  it("names each one exactly once, in the band table", () => {
    for (const tier of TIERS) {
      expect(tierLabel(tier)).toBe(BAND_LABEL[TIER_BAND_TYPE[tier]]);
    }
  });

  it("reads Imminent · Clinical review · Routine review", () => {
    expect(TIERS.map(tierLabel)).toEqual([
      "Imminent",
      "Clinical review",
      "Routine review",
    ]);
  });

  // The rename's actual point. A value a reader can see must not be a colour:
  // the band comment's own argument is that "a reader who is colourblind gets
  // the same sentence, and the word survives being read aloud".
  it("carries no colour word, in the value or the label", () => {
    const colours = /\b(red|orange|green|amber|yellow)\b/i;
    for (const tier of TIERS) {
      expect(tier, `tier value ${tier}`).not.toMatch(colours);
      expect(tierLabel(tier), `label for ${tier}`).not.toMatch(colours);
    }
  });

  // A tier that mapped to a band its task type does not belong to would print a
  // correct-looking word over the wrong group.
  it("maps each tier to a flag task type, one to one", () => {
    const types = TIERS.map((t) => TIER_BAND_TYPE[t]);
    expect(new Set(types).size).toBe(TIERS.length);
    for (const type of types) expect(isFlagTask(type)).toBe(true);
  });

  // Imminent leads, and it falls out of TIER_RANK rather than being enforced in
  // the band code — see the module note there. This is that claim, asserted.
  it("ranks imminent above clinical review above routine", () => {
    const rank = (t: RiskFlagPayload["tier"]) => TIER_RANK[TIER_BAND_TYPE[t]];
    expect(rank("imminent")).toBeLessThan(rank("clinicalReview"));
    expect(rank("clinicalReview")).toBeLessThan(rank("routine"));
  });

  it("files the routine tier in its own domain", () => {
    expect(DOMAIN_OF_TYPE[TIER_BAND_TYPE.imminent]).toBe("riskFlag");
    expect(DOMAIN_OF_TYPE[TIER_BAND_TYPE.clinicalReview]).toBe("riskFlag");
    expect(DOMAIN_OF_TYPE[TIER_BAND_TYPE.routine]).toBe("routineFlag");
  });

  it("leaves no flag task type without a tier", () => {
    const flagTypes = (Object.keys(TIER_RANK) as TaskType[]).filter(isFlagTask);
    expect(new Set(Object.values(TIER_BAND_TYPE))).toEqual(new Set(flagTypes));
  });
});
