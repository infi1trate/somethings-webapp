// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4's ACCEPTANCE TEST — the grep, made executable
//
// The phase's target, in the product owner's own correction of the pack's
// broader wording: **zero occurrences of per-flag tier assignment and
// tier-as-IA. The playbook's category grouping survives.**
//
// That is a claim about ABSENCE, and absence is the one thing a normal test
// cannot show — every assertion here would pass on an empty codebase. So this
// file works in three layers, each catching what the others cannot:
//
//  1 · THE TYPE LAYER. The unions themselves: one flag task type, three domains,
//      no tier field. A type-level claim cannot be re-violated at runtime.
//  2 · THE DATA LAYER. Every flag in every shipped scenario, at runtime: no
//      `tier` key, no deadline, not breached at any age, and every category a
//      published playbook id. This is what catches a fixture that types fine and
//      lies anyway — which is exactly how the free-text categories survived four
//      phases.
//  3 · THE SOURCE LAYER — the literal grep. The retired identifiers are searched
//      for across `src/`, with comments stripped, because this phase's whole
//      history is of the concept surviving as a rename. Nothing else in this repo
//      asserts about its own source text; it earns the exception because "we
//      removed it" is otherwise unfalsifiable.
//
// ═══ AND WHAT MUST STILL BE THERE ═══
//
// The last suite is the counterweight, and it is not decoration. The pack
// originally said "remove the concept everywhere", which was corrected as too
// broad: `lib/record/risk-taxonomy.ts` groups 21 PUBLISHED categories into three
// tiers, and that grouping is a clinical judgment somebody owns. A phase that
// removed it would have destroyed real work in the name of removing a guess.
// So the derivation is asserted present, working, and read-only.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOMAIN_OF_TYPE,
  TASK_DOMAINS,
  TYPE_URGENCY_RANK,
  isBreached,
  type TaskItem,
} from "@/lib/tasks/types";
import { TASK_SLA_MS } from "@/lib/tasks/sla";
import { TASK_KIND_GROUP, TASK_KIND_LABEL } from "@/lib/tasks/task-kind";
import { BAND_LABEL } from "@/lib/tasks/bands";
import { tasksScenario, TASK_SCENARIOS } from "@/lib/tasks/seed";
import {
  RISK_CATEGORIES,
  TIER_ORDER,
  riskCategory,
  tierOf,
  unknownCategories,
} from "@/lib/record/risk-taxonomy";
import { flagCategoryRank } from "@/lib/monitoring/constants";

const NOW = 1_800_000_000_000;

/** The names the per-flag tier went by. Every one of them was, at some point,
 *  the "fixed" version of the one before it — colours became tiers, tiers became
 *  task types, task types became domains — which is why this list is long and
 *  why the source layer below exists at all. */
const RETIRED: Array<{ id: string; except?: string; why?: string }> = [
  { id: "imminentFlagReview" },
  { id: "clinicalFlagReview" },
  { id: "routineFlagReview" },
  { id: "routineFlag" },
  { id: "TIER_RANK" },
  { id: "tierRank" },
  { id: "TIER_BAND_TYPE" },
  { id: "compositionLabel" },
  { id: "imminentBreached" },
  { id: "clinicalBreached" },
  { id: "imminentOpen" },
  { id: "clinicalOpen" },
  { id: "routineOpen" },
  /** ═══ THE ONE SCOPED ENTRY, AND THE SCOPE IS THE POINT ═══
   *
   *  `tierLabel` was a `lib/tasks/bands.ts` function mapping the per-flag tier to
   *  a display word. That one is deleted. `lib/record/` has a FIELD of the same
   *  name on the Care summary document, and it is the survivor this phase is
   *  required not to touch: its value is `TIER_LABEL[tierOf(category)]` — the
   *  playbook's own words for the playbook's own grouping, derived from a
   *  published category at the point of use.
   *
   *  THE EXCLUSION IS ITSELF CHECKED, below, rather than trusted: the excluded
   *  path must import from `risk-taxonomy` and must not mention a retired task
   *  type. An `except` that quietly let the real thing back in would be worse
   *  than no grep at all. */
  {
    id: "tierLabel",
    except: "lib/record/",
    why: "the Care summary's playbook-derived tier label — see risk-taxonomy",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE TYPE LAYER
// ═══════════════════════════════════════════════════════════════════════════
describe("the model has one flag type and no tier domain", () => {
  it("has exactly one task type in the risk-flag domain", () => {
    const types = Object.keys(DOMAIN_OF_TYPE) as Array<keyof typeof DOMAIN_OF_TYPE>;
    // THE INPUT IS ASSERTED: an empty table would satisfy every filter below.
    expect(types.length).toBeGreaterThan(3);
    expect(types.filter((t) => DOMAIN_OF_TYPE[t] === "riskFlag")).toEqual([
      "riskFlagReview",
    ]);
  });

  it("has three domains, and none of them is a severity", () => {
    expect(TASK_DOMAINS).toEqual(["escalation", "riskFlag", "billing"]);
  });

  it("names the flag type once, and not after a tier, in every label table", () => {
    // Three tables used to carry three tier words each. A collapsed union with a
    // label table still saying "Imminent" would type-check perfectly.
    for (const table of [TASK_KIND_LABEL, BAND_LABEL, TASK_KIND_GROUP]) {
      const words = Object.values(table).join(" ").toLowerCase();
      for (const w of ["imminent", "clinical review", "routine"]) {
        expect(words, `"${w}" in a label table`).not.toContain(w);
      }
    }
  });

  it("gives the flag type no SLA, and every other type one", () => {
    expect(TASK_SLA_MS.riskFlagReview).toBeNull();
    for (const [t, ms] of Object.entries(TASK_SLA_MS)) {
      if (t === "riskFlagReview") continue;
      expect(ms, `${t} SLA`).toBeGreaterThan(0);
    }
  });

  it("ranks the flag type without ranking a tier", () => {
    // `TYPE_URGENCY_RANK` had six rows and three were tiers; it has five.
    expect(Object.keys(TYPE_URGENCY_RANK).sort()).toEqual([
      "activeEscalation",
      "escalationDocumentation",
      "intakeBillingReview",
      "monthlyReReview",
      "riskFlagReview",
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE DATA LAYER — every flag, every shipped scenario
// ═══════════════════════════════════════════════════════════════════════════
describe("no shipped fixture assigns a flag a tier or a deadline", () => {
  const flagsOf = (scenario: string): TaskItem[] =>
    tasksScenario(scenario, NOW).filter((i) => i.payload.kind === "riskFlag");

  const SCENARIOS = TASK_SCENARIOS.map((s) => s.id);

  it("ships scenarios with flags in them, so the checks below are not vacuous", () => {
    expect(SCENARIOS.length).toBeGreaterThan(2);
    const total = SCENARIOS.reduce((n, s) => n + flagsOf(s).length, 0);
    // The heavy fixture alone carries well over a hundred.
    expect(total).toBeGreaterThan(100);
  });

  it("puts no `tier` key on any flag payload", () => {
    for (const s of SCENARIOS) {
      for (const f of flagsOf(s)) {
        expect(Object.keys(f.payload), `${s}/${f.id}`).not.toContain("tier");
      }
    }
  });

  it("gives no flag a deadline, and calls none of them breached at any age", () => {
    // AT ANY AGE is the part that matters. The old fixtures deliberately aged
    // imminent flags past 24h so "a handful are genuinely breached" — that was
    // the seed's own comment. Now the oldest flag in any scenario must still not
    // breach, because there is nothing for it to breach.
    let oldest = 0;
    for (const s of SCENARIOS) {
      for (const f of flagsOf(s)) {
        expect(f.slaDeadline, `${s}/${f.id}`).toBeNull();
        expect(isBreached(f, NOW), `${s}/${f.id}`).toBe(false);
        oldest = Math.max(oldest, NOW - f.openedAt);
      }
    }
    // And confirm the fixtures really do contain an old one — days, not minutes.
    expect(oldest).toBeGreaterThan(24 * 3_600_000);
  });

  it("uses only published playbook category ids", () => {
    const all: string[] = [];
    for (const s of SCENARIOS) {
      for (const f of flagsOf(s)) {
        if (f.payload.kind !== "riskFlag") continue;
        all.push(...f.payload.categories);
        expect(f.payload.categories.length, `${s}/${f.id}`).toBeGreaterThan(0);
      }
    }
    // `unknownCategories` is the product's own authority on this, and it would
    // have returned every category in every fixture before this phase.
    expect(unknownCategories(all)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE SOURCE LAYER — the grep
// ═══════════════════════════════════════════════════════════════════════════
describe("the retired identifiers appear nowhere in the source", () => {
  /** Comments are stripped before searching, because the whole point of this
   *  codebase's comments is to record what was removed and why — a grep that
   *  counted them would force the removal to be undocumented to pass. Crude but
   *  honest: block comments, line comments, and nothing clever about strings
   *  containing `//`, which would only ever produce a FALSE POSITIVE (a failing
   *  test to investigate) rather than a false pass. */
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  }

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full, out);
      } else if (/\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
    return out;
  }

  const SRC = join(process.cwd(), "src");
  const files = walk(SRC).filter((f) => !f.endsWith("no-per-flag-tier.test.ts"));

  it("reads a real source tree, so a miscomputed path cannot pass this suite", () => {
    expect(files.length).toBeGreaterThan(100);
    // And the stripper must not be eating everything.
    const code = files.map((f) => stripComments(readFileSync(f, "utf8"))).join("");
    expect(code.length).toBeGreaterThan(200_000);
    // A sanity anchor: something that IS still in the code.
    expect(code).toContain("riskFlagReview");
  });

  for (const { id, except, why } of RETIRED) {
    it(`has no \`${id}\` outside a comment${except ? ` (except ${except} — ${why})` : ""}`, () => {
      const hits: string[] = [];
      let excluded = 0;
      for (const f of files) {
        const rel = f.slice(SRC.length + 1);
        const code = stripComments(readFileSync(f, "utf8"));
        if (!code.includes(id)) continue;
        if (except && rel.startsWith(except)) {
          excluded += 1;
          continue;
        }
        hits.push(rel);
      }
      expect(hits).toEqual([]);
      /* AN EXCEPTION THAT MATCHES NOTHING IS A STALE EXCEPTION, and a stale one
         is how the real identifier walks back in under a path nobody rechecks. */
      if (except) expect(excluded, `${except} no longer uses ${id}`).toBeGreaterThan(0);
    });
  }

  it("the scoped exception really is the playbook's, not the deleted one", () => {
    // ═══ THE EXCLUSION IS VERIFIED, NOT TRUSTED ═══
    // `lib/record/` keeps a `tierLabel` FIELD whose value comes from the
    // playbook. This asserts that claim about the file rather than accepting it
    // from a comment: it must read the taxonomy, and it must not name a retired
    // task type anywhere in its code.
    const doc = readFileSync(join(SRC, "lib/record/care-summary-doc.ts"), "utf8");
    expect(doc).toContain("risk-taxonomy");
    expect(doc).toContain("TIER_LABEL");
    const code = stripComments(doc);
    for (const t of ["imminentFlagReview", "clinicalFlagReview", "routineFlagReview"]) {
      expect(code, `${t} in the Care summary`).not.toContain(t);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · WHAT SURVIVED — the playbook's grouping, derived and read-only
// ═══════════════════════════════════════════════════════════════════════════
describe("the playbook's category grouping is intact", () => {
  it("still holds twenty-one categories across three tiers", () => {
    expect(RISK_CATEGORIES).toHaveLength(21);
    expect(TIER_ORDER).toEqual(["imminent", "clinicalReview", "generalMonitoring"]);
    // Every tier is actually populated — a grouping with an empty tier is a
    // grouping somebody half-deleted.
    for (const t of TIER_ORDER) {
      expect(RISK_CATEGORIES.filter((c) => c.tier === t).length, t).toBeGreaterThan(0);
    }
  });

  it("derives a flag's tier from its category, and it is a read", () => {
    // THE DISTINCTION THIS WHOLE PHASE RESTS ON: the tier is answerable, and the
    // answer comes from a document rather than from this codebase.
    expect(tierOf("ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS")).toBe("imminent");
    expect(tierOf("PASSIVE_SUICIDAL_IDEATION")).toBe("clinicalReview");
    expect(tierOf("ASSESSMENT_BELOW_THRESHOLD")).toBe("generalMonitoring");
    // And an id outside the playbook gets no tier invented for it.
    expect(tierOf("WAT")).toBeNull();
  });

  it("is what the flag comparator's second step now reads", () => {
    // `FLAG_CATEGORY_RANK` was `{}` and blocked; step 2 was a no-op. It is the
    // playbook's ordering now — which could only happen once the fixtures
    // emitted real ids.
    const rank = (id: string) => flagCategoryRank(id);
    expect(rank("ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS")).toBeLessThan(
      rank("PASSIVE_SUICIDAL_IDEATION")
    );
    expect(rank("PASSIVE_SUICIDAL_IDEATION")).toBeLessThan(
      rank("ASSESSMENT_BELOW_THRESHOLD")
    );
    // Unknown last, never first.
    expect(rank("WAT")).toBeGreaterThan(rank("ASSESSMENT_BELOW_THRESHOLD"));
  });

  it("is flat within a tier, which is the part still with Dr. Nissan", () => {
    const imminent = RISK_CATEGORIES.filter((c) => c.tier === "imminent");
    expect(imminent.length).toBeGreaterThan(1);
    const ranks = new Set(imminent.map((c) => flagCategoryRank(c.id)));
    expect(ranks.size).toBe(1);
  });

  it("names every category for a reader, so no raw id can reach one", () => {
    for (const c of RISK_CATEGORIES) {
      expect(riskCategory(c.id)?.label, c.id).toBeTruthy();
      // A label that is just the id shouted quietly is not a label.
      expect(c.label).not.toMatch(/^[A-Z_]+$/);
    }
  });
});
