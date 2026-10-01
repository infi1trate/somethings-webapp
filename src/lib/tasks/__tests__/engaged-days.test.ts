// ═══════════════════════════════════════════════════════════════════════════
// ENGAGED DAYS — THE ARITHMETIC, AND THE BLOCKER AS A FACT
//
// Two jobs. The first is ordinary: option (a) counts the days the TEEN sent a
// message and nothing else. The second is the one worth having — it pins the
// measurement that says this cannot be rendered today, so the blocker is a
// test result rather than a sentence in a comment somebody can delete.

import { describe, expect, it } from "vitest";
import { buildConversation } from "@/lib/tasks/conversation";
import {
  canCountEngagedDays,
  engagedDays,
  ENGAGED_DAYS_MIN_WINDOW_MS,
} from "@/lib/tasks/engaged-days";
import { tasksScenario } from "@/lib/tasks/seed";
import type { ConversationMessage } from "@/lib/tasks/conversation";
import type { TaskItem } from "@/lib/tasks/types";

const DAY = 24 * 60 * 60 * 1000;

/** A message set with explicit senders and instants. `text` and `senderName`
 *  are irrelevant to the count, so they are constant — a fixture that varied
 *  them would invite a reader to think they mattered. */
const msgs = (
  spec: readonly { sender: "teen" | "mentor"; at: number }[]
): ConversationMessage[] =>
  spec.map((s, i) => ({
    id: `m${i}`,
    sender: s.sender,
    senderName: s.sender === "teen" ? "Riley" : "Maria Lopez",
    at: s.at,
    text: "—",
  }));

const T0 = new Date("2026-03-02T10:00:00Z").getTime();

describe("engagedDays counts the days the TEEN sent a message", () => {
  it("counts one day per calendar day, not one per message", () => {
    /* Three messages, one day. The defect this rules out is counting messages
       and calling them days, which is the reading the NAME invites. */
    const m = msgs([
      { sender: "teen", at: T0 },
      { sender: "teen", at: T0 + 60_000 },
      { sender: "teen", at: T0 + 3 * 60 * 60 * 1000 },
      /* and a 4-day span so the window is sufficient */
      { sender: "mentor", at: T0 + 4 * DAY },
    ]);
    expect(engagedDays(m)).toBe(1);
  });

  it("and counts a day per distinct day the teen spoke", () => {
    const m = msgs([
      { sender: "teen", at: T0 },
      { sender: "teen", at: T0 + 2 * DAY },
      { sender: "teen", at: T0 + 4 * DAY },
    ]);
    expect(engagedDays(m)).toBe(3);
  });

  it("and IGNORES mentor messages — this is option (a), not (b)", () => {
    /* THE DISCRIMINATING TEST. Option (b) — both parties — would return 1 here
       because only one day has both. (a) returns 3 because the teen spoke on
       three. A test that used days where both spoke could not tell the two
       definitions apart, which is how the wrong one ships. */
    const m = msgs([
      { sender: "teen", at: T0 },
      { sender: "mentor", at: T0 + 60_000 },
      { sender: "teen", at: T0 + 2 * DAY },
      { sender: "teen", at: T0 + 4 * DAY },
      { sender: "mentor", at: T0 + 5 * DAY },
    ]);
    expect(engagedDays(m)).toBe(3);
  });

  it("and a log with no teen messages at all is 0, not null", () => {
    /* The distinction the module is built on: 0 is a MEASUREMENT — the teen was
       silent across a sufficient window — and null is "we cannot measure". */
    const m = msgs([
      { sender: "mentor", at: T0 },
      { sender: "mentor", at: T0 + 3 * DAY },
    ]);
    expect(engagedDays(m)).toBe(0);
  });

  it("and an empty log is null, because there is nothing to measure", () => {
    expect(engagedDays([])).toBeNull();
  });
});

describe("and refuses to answer when the window cannot support it", () => {
  it("a log shorter than the floor returns null rather than a plausible 1", () => {
    const m = msgs([
      { sender: "teen", at: T0 },
      { sender: "teen", at: T0 + 90 * 60 * 1000 },
    ]);
    expect(canCountEngagedDays(m)).toBe(false);
    expect(engagedDays(m)).toBeNull();
  });

  it("and the floor is 48h — the smallest span that can hold two days", () => {
    /* WHY 48 AND NOT 24: a 23-hour log can straddle midnight and report 2,
       which would be a figure driven by the time of day rather than by
       engagement. Asserted as a boundary so the reasoning cannot be lost by
       somebody "tightening" it to a day. */
    expect(ENGAGED_DAYS_MIN_WINDOW_MS).toBe(2 * DAY);
    const justUnder = msgs([
      { sender: "teen", at: T0 },
      { sender: "teen", at: T0 + 2 * DAY - 1 },
    ]);
    const justOver = msgs([
      { sender: "teen", at: T0 },
      { sender: "teen", at: T0 + 2 * DAY },
    ]);
    expect(engagedDays(justUnder)).toBeNull();
    expect(engagedDays(justOver)).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE BLOCKER, AS A MEASUREMENT
// ═══════════════════════════════════════════════════════════════════════════

describe("the Care Reviews fixtures cannot support this figure", () => {
  const now = Date.UTC(2026, 2, 2, 10, 0, 0);
  const scenario = tasksScenario("heavy-caseload", now) as unknown as {
    items?: TaskItem[];
  };
  const items: TaskItem[] = Array.isArray(scenario)
    ? (scenario as unknown as TaskItem[])
    : (scenario.items ?? []);
  const billing = items.filter((i) => i.payload?.kind === "billing");

  it("finds billing items at all, so the next assertion is not vacuous", () => {
    /* THE INPUT IS ASSERTED. A scenario rename would otherwise make the claim
       below pass by measuring nothing — and the claim is the whole point. */
    expect(billing.length).toBeGreaterThan(3);
  });

  it("and every one of their conversations is too short to count days from", () => {
    /* MEASURED, and this is the reason `engaged days` is defined but not
       rendered. At the default page every billing conversation spans 1.63-1.87h
       — the generator's gaps are 30-60s and 4-11min — so the honest count is
       `null` and the alternative is a hard `1` on every row forever: a constant
       rendered as a measurement, which is what §4.1 said must not go on a
       clinical record. */
    for (const item of billing.slice(0, 8)) {
      const conv = buildConversation(item, null, now);
      const span = conv.messages[conv.messages.length - 1].at - conv.messages[0].at;
      expect(
        canCountEngagedDays(conv.messages),
        `${item.id} now spans ${(span / 3_600_000).toFixed(2)}h — long enough to count days. ` +
          "If that is intended, `engaged days` is unblocked: render it in " +
          "`EngagementLine` and delete this test."
      ).toBe(false);
      expect(engagedDays(conv.messages, now)).toBeNull();
    }
  });

  it("and ASKING FOR MORE does not help — the generator saturates at 4.5h", () => {
    /* ═══ THE STRONGER FORM OF THE BLOCKER, AND I NEARLY MISSED IT ═══
       `buildConversation` takes a `beforeCount`, and its own note says "asking
       for more produces the same messages plus older ones". So the 1.7h default
       page is NOT the limit, and a blocker resting on it would have been a
       blocker resting on a parameter.
       MEASURED across beforeCount 15 / 50 / 200 / 500 / 2000 on one item:
           15 ->  18 msgs  1.6h  truncatedStart=true
           50 ->  53 msgs  4.5h  truncatedStart=FALSE
          200 ->  53 msgs  4.5h
          500 ->  53 msgs  4.5h
         2000 ->  53 msgs  4.5h
       IT SATURATES. Past 50 the generator returns the same 53 messages and
       flips `truncatedStart` to false — the fixture saying "this is the whole
       conversation". The entire log is 4.5 hours, so no page size reaches the
       48h a day-count needs.
       THAT IS WHY THIS IS A DATA BLOCKER AND NOT A PAGING ONE. The fix is a
       longer fixture, not a bigger request.

       THIS TEST ALSO EXISTS BECAUSE `tsc` CAUGHT MY ARITY. Both of my first two
       probes called `buildConversation(item, now)` — two arguments against a
       (item, anchorText, now, beforeCount) signature — so `now` landed in
       `anchorText` and the real `now` was undefined. vitest ran it happily; only
       the typecheck objected. The spans turned out identical either way, which
       is luck and not a defence: the numbers I reported first were produced by a
       malformed call. */
    const item = billing[0];
    const full = buildConversation(item, null, now, 2000);
    const span = full.messages[full.messages.length - 1].at - full.messages[0].at;
    expect(
      full.truncatedStart,
      "the generator still reports more history available; re-measure the ceiling"
    ).toBe(false);
    expect(
      span,
      `the whole conversation now spans ${(span / 3_600_000).toFixed(1)}h`
    ).toBeLessThan(ENGAGED_DAYS_MIN_WINDOW_MS);
    expect(engagedDays(full.messages, now)).toBeNull();
  });
});
