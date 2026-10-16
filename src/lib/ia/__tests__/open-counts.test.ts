// ═══════════════════════════════════════════════════════════════════════════
// ONE SOURCE, AND THE TWO WAYS IT COULD STOP BEING ONE (Phase A)
//
// The rail and Today agreeing is checked in the DOM by `today-mirror`. What a
// DOM check cannot see is WHY they agree — two expressions that happen to
// produce the same number pass every rendering assertion, which is exactly the
// state Care Reviews was in before this phase: nav filtered by task type, Today
// filtered by domain, and the two were equal only because `TASK_DOMAIN` mapped
// the billing domain to precisely the destination's two types.
//
// So there are two claims here, and they need different instruments:
//
//  1 · THE NUMBERS AGREE, over every fixture pair rather than one. A property
//      test, because the failure mode is a fixture nobody tried.
//  2 · THERE IS ONLY ONE EXPRESSION. Decidable only from the source: a second
//      derivation that agreed today would satisfy (1) forever and diverge the
//      day a type is added. Read here rather than grepped in a shell so it
//      fails with the other tests and names what came back.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATION_ORDER } from "@/lib/ia/destinations";
import { openCounts } from "@/lib/ia/open-counts";
import { todayCards } from "@/lib/home/today";
import { shiftFactsFor } from "@/lib/tasks/shift";
import { TASK_SCENARIOS, tasksScenario } from "@/lib/tasks/seed";
import { monitoringData } from "@/lib/monitoring/scenarios";

const NOW = 1_800_000_000_000;

/** Every fixture pair a supervisor can actually select, not one of them. */
const MONITORING = [
  null,
  "clean-day",
  "surge",
  "flag-repeat-pattern",
  "classifier-degraded",
];

function inputsFor(taskId: string, monId: string | null) {
  const items = tasksScenario(taskId, NOW);
  const data = monitoringData(monId, taskId, NOW);
  return {
    items,
    facts: shiftFactsFor(items, NOW),
    events: data.events,
    escalations: data.escalations,
    conversations: data.conversations,
    classifierDegraded: data.classifier === "degraded",
    now: NOW,
  };
}

describe("the rail's number and the row's number are one number", () => {
  it("agrees for every fixture pair, on every destination", () => {
    let pairs = 0;
    let nonZero = 0;
    for (const sc of TASK_SCENARIOS) {
      for (const mon of MONITORING) {
        const input = inputsFor(sc.id, mon);
        /* THE RAIL'S CALL, with exactly the arguments `console-shell` passes. */
        const rail = openCounts({
          items: input.items,
          events: input.events,
          escalations: input.escalations,
          now: NOW,
        });
        const cards = todayCards(input);
        for (const id of DESTINATION_ORDER) {
          const card = cards.find((c) => c.id === id)!;
          expect(
            card.count,
            `${sc.id} + ${mon ?? "—"} · ${id}: row ${card.count} vs rail ${rail[id]}`
          ).toBe(rail[id]);
          if (rail[id] > 0) nonZero += 1;
        }
        pairs += 1;
      }
    }
    /* ═══ THE INPUT IS ASSERTED ═══
       A run where every destination was zero everywhere would satisfy the
       equality above and prove nothing. This pins that the enumeration
       actually exercised non-zero counts. */
    expect(pairs).toBe(TASK_SCENARIOS.length * MONITORING.length);
    expect(nonZero).toBeGreaterThan(20);
  });

  it("does not let a row's sentence contradict its own figure", () => {
    // The row prints a figure AND a sentence containing a number. They came
    // from two reads before this phase; a row reading "19 open" beside a
    // figure of 18 is the same defect as the rail disagreeing, one inch closer.
    for (const sc of TASK_SCENARIOS) {
      for (const mon of MONITORING) {
        const cards = todayCards(inputsFor(sc.id, mon));
        for (const card of cards) {
          const m = /^(\d+)\s+open/.exec(card.state);
          if (!m) continue;
          expect(
            Number(m[1]),
            `${sc.id} + ${mon ?? "—"} · ${card.id}: "${card.state}" vs figure ${card.count}`
          ).toBe(card.count);
        }
      }
    }
  });

  it("covers every destination, so a new one cannot ship countless", () => {
    const counts = openCounts(inputsFor("typical-shift", null));
    expect(Object.keys(counts).sort()).toEqual([...DESTINATION_ORDER].sort());
    for (const id of DESTINATION_ORDER) {
      expect(typeof counts[id], id).toBe("number");
    }
  });
});

describe("open and actionable, one semantic", () => {
  it("never exceeds the open item set it is drawn from", () => {
    // A count larger than the open set means something resolved is being
    // counted — the "81 rows where 43 were open" failure `flagPool` records.
    for (const sc of TASK_SCENARIOS) {
      const input = inputsFor(sc.id, null);
      const openItems = input.items.filter((i) => i.status !== "resolved");
      const counts = openCounts({
        items: input.items,
        events: input.events,
        escalations: input.escalations,
        now: NOW,
      });
      expect(
        counts["care-reviews"],
        `${sc.id}: ${counts["care-reviews"]} care reviews against ${openItems.length} open items`
      ).toBeLessThanOrEqual(openItems.length);
    }
  });

  it("reports zero rather than a falsy blank, so the badge gate can be `> 0`", () => {
    // The rail hides a badge on `> 0`. A count that returned null or undefined
    // for an empty destination would hide it too, by accident, and would stop
    // hiding it the day the expression changed shape.
    const counts = openCounts(inputsFor("quiet-day", "clean-day"));
    expect(counts["risk-flags"]).toBe(0);
    expect(Number.isInteger(counts["risk-flags"])).toBe(true);
  });
});

describe("there is only one expression, and that is checked at the source", () => {
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  it("leaves no destination count computed inside the rail", () => {
    /* RETARGETED (SUP-1): the rail's badge logic moved with the shell body
       from `app-chrome.tsx` (now a reporter) into `console-shell.tsx`. */
    const src = read("src/components/app-shell/console-shell.tsx");
    expect(src, "the rail derives an escalation count itself").not.toContain(
      "escalationObligations"
    );
    expect(src, "the rail filters task items by destination itself").not.toContain(
      "DESTINATION_TYPES"
    );
    expect(src, "the rail must read the shared source").toContain("openCounts(");
  });

  it("leaves no destination count computed inside todayCards", () => {
    const src = read("src/lib/home/today.ts");
    /* THE EXACT EXPRESSION THAT DIVERGED. `facts.billing.overdue` is still
       read and must stay readable — it answers a different question — so this
       names the open member rather than the object. */
    expect(src, "Today reads the domain-filtered open count again").not.toContain(
      "facts.billing.open"
    );
    expect(src, "Today must read the shared source").toContain("openCounts(");
  });
});
