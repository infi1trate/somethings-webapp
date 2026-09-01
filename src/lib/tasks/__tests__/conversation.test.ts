// THE FIXTURE'S ONE LOAD-BEARING PROPERTY: the flagged line in the transcript is
// the item's OWN string, character for character.
//
// It matters because the pane renders that string twice — once as the highlighted
// message, once quoted inside the AI rationale. If the fixture re-authored it,
// a supervisor would read a rationale about a sentence that appears nowhere in
// the conversation, and would be right to stop trusting the screen.
import { describe, expect, it } from "vitest";
import { buildConversation, firstNameOf } from "@/lib/tasks/conversation";
import { TASK_SCENARIOS, tasksScenario } from "@/lib/tasks/seed";
import type { RiskFlagPayload } from "@/lib/tasks/types";

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

/** Every risk-flag item across every scenario — the brief asks that EVERY
 *  scenario's flagged items get a plausible fixture, so the test sweeps them all
 *  rather than sampling one. */
function everyFlag() {
  return TASK_SCENARIOS.flatMap((s) =>
    tasksScenario(s.id, NOW)
      .filter((i) => i.payload.kind === "riskFlag")
      .map((i) => ({ scenario: s.id, item: i, payload: i.payload as RiskFlagPayload }))
  );
}

/** The same sweep, with the built conversation attached. Sampled to the first
 *  60 flags: the dense scenarios now carry ~140 each and building every one is
 *  several seconds of work to re-prove a property the first dozen already show. */
function everyFlagConversation() {
  return everyFlag()
    .slice(0, 60)
    .map(({ scenario, item, payload }) => ({
      scenario,
      item,
      c: buildConversation(item, payload.flaggedExcerpt, NOW),
    }));
}

describe("the conversation fixture", () => {
  it("covers every risk flag in every scenario", () => {
    const flags = everyFlag();
    // Guards against a vacuous sweep — if the filter broke, every assertion
    // below would pass by iterating nothing.
    expect(flags.length).toBeGreaterThan(5);
  });

  it("places the item's flagged excerpt VERBATIM at the anchor", () => {
    for (const { scenario, item, payload } of everyFlag()) {
      const c = buildConversation(item, payload.flaggedExcerpt, NOW);
      const anchor = c.messages.find((m) => m.id === c.anchorId);
      expect(anchor, `${scenario}/${item.id}`).toBeDefined();
      expect(anchor!.text, `${scenario}/${item.id}`).toBe(payload.flaggedExcerpt);
      expect(anchor!.flagged).toBe(true);
    }
  });

  it("flags exactly one message per conversation", () => {
    for (const { item, payload } of everyFlag()) {
      const c = buildConversation(item, payload.flaggedExcerpt, NOW);
      expect(c.messages.filter((m) => m.flagged)).toHaveLength(1);
    }
  });

  it("is deterministic — the same item builds the same conversation", () => {
    // A prototype is demonstrated repeatedly; a fixture that reshuffles makes a
    // screenshot an anecdote rather than evidence.
    for (const { item, payload } of everyFlag().slice(0, 4)) {
      const a = buildConversation(item, payload.flaggedExcerpt, NOW);
      const b = buildConversation(item, payload.flaggedExcerpt, NOW);
      expect(a).toEqual(b);
    }
  });

  it("never times a message in the future", () => {
    for (const { item, payload } of everyFlag()) {
      const c = buildConversation(item, payload.flaggedExcerpt, NOW);
      for (const m of c.messages) expect(m.at).toBeLessThanOrEqual(NOW);
    }
  });

  /* ═══ THE BURSTS ARE LOAD-BEARING, SO THEY ARE PINNED ═══
     The pane clusters timestamps: a bubble drops its name-and-time header when it
     continues the one above it. MEASURED before this test existed — 20 of 20
     bubbles carried a header, because the fixture alternated speakers strictly
     and the clustering rule could never fire. A fixture that quietly returns to
     strict alternation would make that rule dead code again, invisibly, since
     both versions render perfectly well. */
  it("has consecutive messages from one sender — people send two in a row", () => {
    let runs = 0;
    let checked = 0;
    for (const { c } of everyFlagConversation()) {
      checked++;
      for (let i = 1; i < c.messages.length; i++) {
        if (c.messages[i].sender === c.messages[i - 1].sender) runs++;
      }
    }
    expect(checked, "no conversations were checked").toBeGreaterThan(5);
    expect(runs, "the fixture alternates strictly — clustering can never fire").toBeGreaterThan(0);
  });

  it("still puts the mentor's message immediately before the flagged one", () => {
    // A flagged teen message almost always answers something, and the bursts must
    // not have broken that.
    for (const { scenario, item, c } of everyFlagConversation()) {
      const i = c.messages.findIndex((m) => m.flagged);
      if (i <= 0) continue;
      expect(c.messages[i - 1].sender, `${scenario}/${item.id}`).toBe("mentor");
    }
  });

  it("keeps messages in chronological order", () => {
    for (const { item, payload } of everyFlag()) {
      const c = buildConversation(item, payload.flaggedExcerpt, NOW);
      const times = c.messages.map((m) => m.at);
      expect([...times].sort((x, y) => x - y)).toEqual(times);
    }
  });

  it("never renders a surname — first names only, per the surface's rule", () => {
    for (const { item, payload } of everyFlag()) {
      const c = buildConversation(item, payload.flaggedExcerpt, NOW);
      for (const m of c.messages) expect(m.senderName).not.toMatch(/\s/);
    }
  });

  it("anchors to the most recent message when there is no flagged line", () => {
    // The escalation case: nothing was flagged, so nothing is highlighted.
    const { item } = everyFlag()[0];
    const c = buildConversation(item, null, NOW);
    expect(c.messages.some((m) => m.flagged)).toBe(false);
  });

  it("takes the first name off a pre-formatted display name", () => {
    expect(firstNameOf("Riley T.")).toBe("Riley");
    expect(firstNameOf("Jordan")).toBe("Jordan");
  });
});
