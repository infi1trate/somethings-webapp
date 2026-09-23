// THE CLUSTERING RULE — one definition, and a measurement of what it does.
//
// ═══ WHY THIS FILE IS NOT JUST "THE PREDICATE RETURNS TRUE" ═══
//
// The de-fork's constraint was that the mentor's rendered output must not change.
// That was verified by snapshotting the thread's DOM before and after — and then
// a MUTATION RUN showed the comparison was blind: raising `CLUSTER_MS` from five
// minutes to thirty produced a byte-identical thread. An "identical" result that
// cannot see a clustering change proves nothing about clustering.
//
// So the fixtures are measured here, and the measurement is the finding: whether
// any consecutive same-sender pair in the shipped chat data straddles the
// threshold at all. If none does, the rule is inert on that surface and the DOM
// comparison was answering a different question than it appeared to.

import { describe, expect, it } from "vitest";
import { CLUSTER_MS, startsCluster } from "@/lib/chat/clustering";
import { CHAT_SCENARIOS, chatScenario } from "@/lib/chat/seed";

const NOW = 1_800_000_000_000;

describe("the rule itself", () => {
  const a = { sender: "teen", at: NOW };

  it("starts a cluster at the first message, with nothing above it", () => {
    expect(startsCluster(a, undefined)).toBe(true);
  });

  it("starts one when the speaker changes, however close together", () => {
    expect(startsCluster({ sender: "mentor", at: NOW + 1 }, a)).toBe(true);
  });

  it("does not start one inside the window for the same speaker", () => {
    expect(startsCluster({ sender: "teen", at: NOW + CLUSTER_MS }, a)).toBe(false);
  });

  it("starts one the moment the window is exceeded", () => {
    // `>`, not `>=` — exactly five minutes stays in the cluster, which is the
    // behaviour both forks had and the de-fork had to preserve.
    expect(startsCluster({ sender: "teen", at: NOW + CLUSTER_MS + 1 }, a)).toBe(
      true
    );
  });

  it("is five minutes, in one place", () => {
    expect(CLUSTER_MS).toBe(5 * 60_000);
  });
});

describe("what the rule actually does to the shipped chat fixtures", () => {
  /** Every consecutive same-sender pair's gap, across every scenario and thread. */
  function sameSenderGaps(): number[] {
    const out: number[] = [];
    for (const s of CHAT_SCENARIOS) {
      const data = chatScenario(s.id, NOW);
      /* MESSAGES ARE KEYED BY THREAD on `ChatData`, not held on the thread. */
      for (const msgs of Object.values(data.messages)) {
        for (let i = 1; i < msgs.length; i += 1) {
          if (msgs[i].sender === msgs[i - 1].sender) {
            out.push(msgs[i].at - msgs[i - 1].at);
          }
        }
      }
    }
    return out;
  }

  it("has same-sender runs at all, or there is nothing to cluster", () => {
    // THE INPUT FIRST: with no consecutive same-sender pair anywhere, every
    // message would head itself on the speaker-change branch and the threshold
    // would be unreachable by construction.
    expect(sameSenderGaps().length).toBeGreaterThan(0);
  });

  it("has a pair on BOTH sides of the threshold, so five minutes is decidable", () => {
    /* ═══ THE FIXTURE PHASE 10 ADDED, AND WHY IT WAS NEEDED ═══
       Before it the gaps were 2, 2, 2450, 3860 and 4320 minutes — so every pair
       was either obviously inside the window or obviously outside it, and
       `CLUSTER_MS` could have been any value from ~3 minutes to ~40 hours
       without a single test or snapshot moving. The threshold was not verified,
       it was merely not contradicted.
       ONE PAIR EITHER SIDE is the minimum that makes it decidable, and it is
       asserted as a RANGE rather than the exact fixture values so re-timing a
       line by a minute does not fail the test for no reason. */
    const gaps = sameSenderGaps();
    const near = (lo: number, hi: number) =>
      gaps.some((g) => g > lo && g <= hi);
    expect(
      near(3 * 60_000, CLUSTER_MS),
      `no same-sender gap sits just INSIDE the window — gaps(min): ${gaps
        .map((g) => Math.round(g / 60_000))
        .join(", ")}`
    ).toBe(true);
    expect(
      near(CLUSTER_MS, 10 * 60_000),
      `no same-sender gap sits just OUTSIDE the window — gaps(min): ${gaps
        .map((g) => Math.round(g / 60_000))
        .join(", ")}`
    ).toBe(true);
  });

  it("has pairs that straddle the threshold, so the rule is load-bearing here", () => {
    /* ═══ THIS TEST IS WHY THE DOM COMPARISON IS TRUSTWORTHY ═══
       The de-fork was verified by snapshotting the mentor thread before and
       after and finding it byte-identical. A mutation run then raised
       `CLUSTER_MS` from five minutes to thirty and the snapshot did not move —
       the comparison was BLIND, and an "identical" result that cannot see a
       clustering change proves nothing about clustering.
       THE CAUSE WAS THE THREADS CHOSEN, not the rule: measured here, three
       same-sender gaps in the shipped fixtures exceed five minutes, and all
       three are in threads the snapshot was not looking at — `t18`
       (active-mentorship), `t23` (activities-in-flight) and `t15` (re-matched).
       The snapshot now includes `t18`, which is what makes it sensitive.
       ASSERTED AS A FLOOR, not an exact count, so adding a fixture cannot fail
       it — but removing every straddling pair can, which is the case that would
       silently blind the comparison again. */
    const gaps = sameSenderGaps();
    const straddling = gaps.filter((g) => g > CLUSTER_MS);
    expect(
      straddling.length,
      `${straddling.length} of ${gaps.length} same-sender gaps exceed ${CLUSTER_MS}ms — ` +
        `at zero, the thread snapshot stops being able to see a clustering change`
    ).toBeGreaterThan(0);
  });

  it("and the supervisor excerpt is where the threshold is load-bearing", () => {
    // The excerpt is built from the TASK fixtures' conversations, not these, and
    // it additionally breaks at the flagged anchor — so its header count is not
    // decided by the speaker-change branch alone. Asserted through the shared
    // predicate rather than the excerpt's own, because the point is that the two
    // surfaces now consult one rule.
    const burst = [
      { sender: "teen", at: NOW },
      { sender: "teen", at: NOW + 60_000 },
      { sender: "teen", at: NOW + 20 * 60_000 },
    ];
    expect(burst.map((m, i) => startsCluster(m, burst[i - 1]))).toEqual([
      true,
      false,
      true,
    ]);
  });
});
