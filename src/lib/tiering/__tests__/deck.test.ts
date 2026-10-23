import { describe, expect, it } from "vitest";
import { riskLevel } from "@/lib/tiering/escalation";
import { afterRecord, deckComplete, deckProgress, nextCard, segmentState, skipEnded, skippedIds, skipStarted } from "@/lib/tiering/deck";

const yes = { value: "yes" as const, at: 1 };
const no = { value: "no" as const, at: 1 };

describe("the deck (pack v8.0)", () => {
  it("opens on the first required unanswered, and never has no card", () => {
    expect(nextCard({})).toBe("q1");
    expect(nextCard({ q1: yes })).toBe("q2");
    // Complete: the review card — the deck always has one active card.
    expect(nextCard({ q1: no, q2: no, q6: no })).toBe("review");
  });

  it("the skip path: Q1 No, Q2 No → Q3–Q5 skipped, the deck at Q6, progress of 3", () => {
    let a = afterRecord({}, "q1", "no");
    expect(skippedIds(a).size).toBe(0);
    a = afterRecord(a, "q2", "no");
    expect([...skippedIds(a)]).toEqual(["q3", "q4", "q5"]);
    expect(nextCard(a)).toBe("q6");
    expect(deckProgress(a)).toEqual({ done: 2, needed: 3 });
    a = afterRecord(a, "q6", "no");
    expect(deckProgress(a)).toEqual({ done: 3, needed: 3 });
    expect(deckComplete(a)).toBe(true);
    expect(segmentState(a, "q4")).toBe("skipped");
  });

  it("the conflict path: a recorded Q3 is retained and counted when Q1/Q2 go No", () => {
    let a = afterRecord({}, "q3", "yes");
    a = afterRecord(a, "q1", "no");
    a = afterRecord(a, "q2", "no");
    expect(a.q3?.value).toBe("yes"); // never auto-discarded
    expect([...skippedIds(a)]).toEqual(["q4", "q5"]);
    expect(deckProgress(a)).toEqual({ done: 3, needed: 4 });
    expect(riskLevel(a)).toBe("moderate"); // risk runs on recorded answers
  });

  it("the amend path: Q2 No → Yes un-skips Q3–Q5", () => {
    let a = afterRecord(afterRecord({}, "q1", "no"), "q2", "no");
    const before = a;
    a = afterRecord(a, "q2", "yes");
    expect(skippedIds(a).size).toBe(0);
    expect(skipEnded(before, a)).toBe(true);
    expect(nextCard(a)).toBe("q3");
    expect(deckProgress(a).needed).toBe(6);
  });

  it("announces the skip once — on the transition only", () => {
    const one = afterRecord({}, "q1", "no");
    const two = afterRecord(one, "q2", "no");
    expect(skipStarted(one, two)).toBe(true);
    expect(skipStarted(two, afterRecord(two, "q6", "no"))).toBe(false);
  });

  it("Q6 on a Yes waits for its follow-up", () => {
    const a = { q1: no, q2: no, q6: yes };
    expect(nextCard(a)).toBe("q6");
    expect(deckComplete({ ...a, q6b: no })).toBe(true);
  });

  it("out of order: Q6 → Q3 → Q1 leaves Q2 as the next card", () => {
    let a = afterRecord({}, "q6", "no");
    a = afterRecord(a, "q3", "no");
    a = afterRecord(a, "q1", "no");
    expect(nextCard(a)).toBe("q2");
  });
});
