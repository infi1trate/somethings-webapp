import { describe, expect, it } from "vitest";
import { CLINICAL, stayCloseNudges } from "@/lib/chat/stay-close";
import { POST_SUBMIT } from "@/lib/tiering/post-submit-copy";

const JORDAN = ["not great honestly", "everything at home is bad again and i'm so tired of it", "i don't know how much longer i can keep doing this", "i think so. i'm in my room"];

describe("stayCloseNudges", () => {
  it("grounds 2–3 nudges in what the teen said, presence last", () => {
    const n = stayCloseNudges(JORDAN, "Jordan");
    expect(n.length).toBeGreaterThanOrEqual(2);
    expect(n.length).toBeLessThanOrEqual(3);
    expect(n.map((x) => x.id)).toEqual(["home", "tired", "here"]);
    expect(n.at(-1)!.text).toContain("Jordan");
  });

  it("is never clinical — not one nudge, for any topic the teen raises", () => {
    const every = ["home mom", "tired sleep", "school test", "alone nobody", "friends", "i want to kill myself", "safety plan pills"];
    for (const line of every) for (const n of stayCloseNudges([line], "Sam")) expect(n.text).not.toMatch(CLINICAL);
    /* The steadying lines are deleted (pack v11.0); the post-submit card's
       own copy holds to the same boundary. */
    for (const l of [POST_SUBMIT.reviewing("Brandy"), POST_SUBMIT.orient("Sam")]) expect(l).not.toMatch(CLINICAL);
  });

  it("never quotes the teen back — a clinical line in the thread grounds nothing", () => {
    const n = stayCloseNudges(["i want to kill myself"], "Sam");
    expect(n.map((x) => x.id)).toEqual(["thanks", "here"]);
    for (const x of n) expect(x.text).not.toMatch(/kill/);
  });

  it("is two lines even when the thread is empty", () => {
    expect(stayCloseNudges([], "Sam").map((x) => x.id)).toEqual(["thanks", "here"]);
  });

  it("the guard catches the words it exists for", () => {
    for (const w of ["suicidal", "safety plan", "risk", "assessment", "crisis", "988", "therapist"]) expect(w).toMatch(CLINICAL);
  });
});
