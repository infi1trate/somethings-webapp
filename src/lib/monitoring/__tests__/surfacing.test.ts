// THE PLAYBOOK MATCH, AND THE TWO THINGS IT DECLINES TO INVENT
//
// Brought forward from arch-H, H7 with the block it tests. Three assertions
// needed retargeting because Phase 4 changed the fixtures underneath them, and
// each retarget is stated where it happens.
//
// WHY THESE ARE TESTED RATHER THAN CLICKED. Every assertion here is about an
// ABSENCE — no confidence, no evidence features, no source-type chip — and an
// absence is the one thing a screenshot cannot distinguish from a render that
// failed. A probe can confirm no confidence indicator is on the page; only this
// can confirm the model refuses to publish one.
//
// The assertions are written from the contract in `surfacing.ts`, not from
// reading its implementation back.

import { describe, expect, it } from "vitest";
import {
  FLAG_CONFIDENCE_PUBLISHED,
  FLAG_EVIDENCE_FEATURES_PUBLISHED,
} from "@/lib/monitoring/constants";
import { playbookMatchFor } from "@/lib/monitoring/surfacing";
import { riskCategory, riskCategoryLabel } from "@/lib/record/risk-taxonomy";
import { tasksScenario } from "@/lib/tasks/seed";
import { openTasks } from "@/lib/tasks/sort";
import type { RiskFlagPayload } from "@/lib/tasks/types";

const NOW = new Date("2026-09-17T14:00:00").getTime();
const SCENARIOS = [
  "typical-shift",
  "heavy-caseload",
  "quiet-day",
  "breach-overnight",
  "active-escalation",
];

function flagsIn(scenarioId: string): RiskFlagPayload[] {
  return openTasks(tasksScenario(scenarioId, NOW))
    .filter((i) => i.payload.kind === "riskFlag")
    .map((i) => i.payload as RiskFlagPayload);
}

describe("what the playbook match publishes", () => {
  const [p] = flagsIn("typical-shift");

  it("carries the categories through, unaltered and in order", () => {
    /* ═══ CORRECTED AFTER A MUTATION TEST, AND THE CORRECTION IS THE FINDING ═══
       This asserted `toEqual(p.categories)` against the fixture and PASSED with
       the model reversing the list — because every flag in the product carries
       exactly ONE category (measured: 202 of 202), so order has no input to be
       wrong about. An assertion whose input is absent is not coverage.
       So the order property is tested on a payload that HAS an order, and the
       fixture's own shape is asserted separately below, where it is a fact about
       the data rather than a claim about this function. */
    expect(playbookMatchFor({ ...p, categories: ["A", "B", "C"] }).categories).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("does not de-duplicate — the chips are evidence, not a set", () => {
    expect(playbookMatchFor({ ...p, categories: ["A", "A"] }).categories).toEqual([
      "A",
      "A",
    ]);
  });

  it("and the chip row is one chip today, on every flag in the product", () => {
    /* MEASURED. Recorded here because the block is designed as a chip ROW and
       the day a flag carries two categories is the day the row starts doing what
       it looks like it does. Three distinct categories across the whole fixture,
       which is the low-variance state the report names.
       RETARGETED (Phase 4): this said "one per tier", and the seed's three
       payload fixtures were named for the tiers they asserted. They are named
       for their CATEGORIES now and the tier is derived, so the count is the same
       three and the reason is different. */
    const seen = new Set<string>();
    for (const s of SCENARIOS) {
      for (const f of flagsIn(s)) {
        expect(f.categories.length, `${s} · ${f.categories.join("/")}`).toBe(1);
        seen.add(f.categories[0]);
      }
    }
    expect(seen.size).toBe(3);
  });

  it("carries PUBLISHED ids, so the chips can be labelled at all", () => {
    /* ═══ THE PHASE 4 PRECONDITION, ASSERTED HERE TOO ═══
       "Playbook match" is a claim about provenance, and it was only half true
       while the categories were free text the seed invented ("Low mood"). It is
       whole now: every id resolves in `RISK_CATEGORIES`, so the eyebrow names
       something a supervisor can look up and argue with.
       AND THE LABEL IS NOT THE ID. A render site that shipped the raw id would
       satisfy "published" and still put an enum on screen — the defect Phase 4
       found — so both halves are checked. */
    for (const s of SCENARIOS) {
      for (const f of flagsIn(s)) {
        for (const c of playbookMatchFor(f).categories) {
          expect(riskCategory(c), `${s} · ${c}`).not.toBeNull();
          expect(riskCategoryLabel(c)).not.toBe(c);
          expect(riskCategoryLabel(c)).not.toMatch(/^[A-Z_]+$/);
        }
      }
    }
  });

  it("carries the rationale verbatim, because it quotes the flagged line", () => {
    // `flaggedExcerpt` is placed verbatim at the transcript's anchor, and the
    // rationale quotes the same string — so any rewording here would make the
    // paragraph quote a sentence the reader cannot find above it.
    expect(playbookMatchFor(p).rationale).toBe(p.aiRationale);
  });
});

describe("the source-type chip renders only when it says something", () => {
  it("is null while the type is Message — which is every flag in the product", () => {
    /* MEASURED, not assumed: this is the fact the pane's removed "Type /
       Message" row was furniture FOR, and if a scenario ever ships a non-message
       flag this test is what tells the next person the chip has woken up. */
    let flags = 0;
    for (const s of SCENARIOS) {
      for (const p of flagsIn(s)) {
        flags += 1;
        expect(p.sourceType, s).toBe("Message");
        expect(playbookMatchFor(p).sourceType, s).toBeNull();
      }
    }
    expect(flags, "the scenarios carry open flags at all").toBeGreaterThan(100);
  });

  it("passes any other source through, so the chip exists before the data", () => {
    const [p] = flagsIn("typical-shift");
    expect(playbookMatchFor({ ...p, sourceType: "Video note" }).sourceType).toBe(
      "Video note"
    );
  });
});

describe("the two absences H7 asked for", () => {
  /* ═══ THESE FAIL LOUDLY THE DAY A CONSTANT IS FLIPPED, WHICH IS THE JOB ═══
     Both constants are `false` and blocked on Meg. Flipping one without building
     its treatment leaves the pane silently unchanged — these are what make that
     impossible, and each message says what has to be built. */

  it("publishes no confidence, and the constant says why", () => {
    expect(
      FLAG_CONFIDENCE_PUBLISHED,
      "if the classifier now publishes confidence: design the indicator (a bare percentage invites arithmetic the model cannot support), then read it in playbookMatchFor"
    ).toBe(false);
    for (const s of SCENARIOS) {
      for (const p of flagsIn(s)) {
        expect(playbookMatchFor(p).confidence, s).toBeNull();
      }
    }
  });

  it("publishes no evidence features, and never parses them out of the prose", () => {
    expect(
      FLAG_EVIDENCE_FEATURES_PUBLISHED,
      "if the classifier now emits structured features: render them as chips beside the categories, and keep the categories labelled as categories"
    ).toBe(false);
    for (const s of SCENARIOS) {
      for (const p of flagsIn(s)) {
        const m = playbookMatchFor(p);
        expect(m.features, s).toEqual([]);
        /* THE PROSE IS LONG AND FULL OF THE WORDS A PARSER WOULD REACH FOR.
           Asserted so "render prose alone" cannot quietly become "render prose
           and three chips derived from it". */
        expect(m.rationale.length, s).toBeGreaterThan(20);
      }
    }
  });
});
