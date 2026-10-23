import { describe, expect, it } from "vitest";
import type { EscalationState } from "@/lib/chat/types";
import type { TierState } from "@/lib/tiering/events";
import { currentNode, orderNodes, timelineNodes, type Lens } from "@/lib/tiering/timeline";

const T0 = new Date("2026-10-21T17:13:00").getTime();
const MIN = 60_000;
const state = (tier: 1 | 2 | 3 | 4 | null = 3): TierState => ({ tier, since: T0 - 86_400_000, setBy: null, pending: null, history: [] });

const base = (o: Partial<EscalationState> = {}): EscalationState => ({
  id: "esc-x",
  threadId: "t13",
  openedAt: T0,
  anchorMessageId: null,
  supervisorNotifiedAt: T0,
  supervisorId: "s-brandy",
  resolvedAt: null,
  resolutionNoteId: null,
  requested: 1,
  contextNote: "They said they might not be safe tonight.",
  safetyCheck: { answers: {}, submittedAt: null },
  ...o,
});
const yes = (at: number) => ({ value: "yes" as const, at });
const all6 = { q1: yes(T0 + MIN), q2: yes(T0 + 2 * MIN), q3: yes(T0 + 3 * MIN), q4: { value: "no" as const, at: T0 + 4 * MIN }, q5: { value: "no" as const, at: T0 + 5 * MIN }, q6: { value: "no" as const, at: T0 + 6 * MIN } };
const submitted = { answers: all6, submittedAt: T0 + 7 * MIN };
const fullNote = {
  subtype: "suicidal_ideation",
  safetyPlan: { status: "created", usage: "Text her aunt." },
  resources: { shared: false, list: "" },
  referral: { made: true, list: ["therapist"] },
  contact: { engaged: true, details: "Aunt, by phone." },
  services: { contacted: false, which: [] },
  updatedAt: T0 + 20 * MIN,
};

/** Every state the record passes through, raise to close, Tier 1. */
const ARC: [string, EscalationState][] = [
  ["raised", base()],
  ["mid-assessment", base({ safetyCheck: { answers: { q1: yes(T0 + MIN), q2: yes(T0 + 2 * MIN) }, submittedAt: null } })],
  ["assessment received", base({ safetyCheck: submitted, mentorSummary: "Plan, no means." })],
  ["confirmed", base({ safetyCheck: submitted, confirmedTier: 1, confirmedAt: T0 + 9 * MIN })],
  ["note half done", base({ safetyCheck: submitted, confirmedTier: 1, confirmedAt: T0 + 9 * MIN, crisisNote: { subtype: "suicidal_ideation", safetyPlan: { status: "created", usage: "x" }, updatedAt: T0 + 12 * MIN } })],
  ["note complete", base({ safetyCheck: submitted, confirmedTier: 1, confirmedAt: T0 + 9 * MIN, crisisNote: fullNote })],
  ["outcome chosen", base({ safetyCheck: submitted, confirmedTier: 1, confirmedAt: T0 + 9 * MIN, crisisNote: fullNote, outcome: { id: "guardian", autoTagged: true, debrief: "", debriefIsDraft: true, plan: "", additional: "", chosenAt: T0 + 22 * MIN, savedAt: null } })],
  ["debrief saved", base({ safetyCheck: submitted, confirmedTier: 1, confirmedAt: T0 + 9 * MIN, crisisNote: fullNote, outcome: { id: "guardian", autoTagged: true, debrief: "d", debriefIsDraft: false, plan: "p", additional: "", chosenAt: T0 + 22 * MIN, savedAt: T0 + 25 * MIN } })],
];

describe("exactly one current node per lens", () => {
  for (const lens of ["mentor", "supervisor"] as Lens[]) {
    for (const [label, e] of ARC) {
      it(`${lens} · ${label}`, () => {
        const nodes = timelineNodes(e, state(), lens);
        expect(nodes.filter((n) => n.state === "current")).toHaveLength(1);
      });
    }
  }
  it("closed: the summary is the one current node — on both lenses (pack v8.0)", () => {
    const e = base({ safetyCheck: submitted, confirmedTier: 1, resolvedAt: T0 + 30 * MIN });
    for (const lens of ["mentor", "supervisor"] as Lens[]) {
      const nodes = timelineNodes(e, state(3), lens);
      expect(nodes.filter((n) => n.state === "current").map((n) => n.kind)).toEqual(["closed"]);
      expect(nodes.filter((n) => n.state === "upcoming")).toHaveLength(0);
    }
  });
  it("Tier 3 raise: no assessment node on either lens; the mentor waits at once", () => {
    const e = base({ requested: 3, safetyCheck: { answers: {}, submittedAt: null } });
    for (const lens of ["mentor", "supervisor"] as Lens[]) {
      const nodes = timelineNodes(e, state(4), lens);
      expect(nodes.some((n) => n.kind === "assessment")).toBe(false);
      expect(nodes.filter((n) => n.state === "current")).toHaveLength(1);
    }
    expect(currentNode(timelineNodes(e, state(4), "mentor"))?.kind).toBe("waiting");
    expect(currentNode(timelineNodes(e, state(4), "supervisor"))?.kind).toBe("confirm");
  });
});

describe("what is current, step by step", () => {
  const cur = (e: EscalationState, lens: Lens) => currentNode(timelineNodes(e, state(), lens))?.kind;
  it("mentor: assessment → waiting", () => {
    expect(ARC.map(([, e]) => cur(e, "mentor"))).toEqual(["assessment", "assessment", "waiting", "waiting", "waiting", "waiting", "waiting", "waiting"]);
  });
  /* ═══ ONE NOTE NODE (pack v6.1, Supersession 2) ═══ v3.0's node per
     section, then Outcome, then Debrief, is reversed: one Crisis note node is
     current from the confirmation until every row — Outcome and Debrief
     included — is done. */
  it("supervisor: assessment in progress → confirm → the crisis note, until every row is done → close", () => {
    expect(ARC.map(([, e]) => cur(e, "supervisor"))).toEqual(["assessment", "assessment", "confirm", "note", "note", "note", "note", "close"]);
  });
  it("the note is one node — no per-section, outcome or debrief nodes survive", () => {
    for (const [, e] of ARC) {
      const kinds = timelineNodes(e, state(), "supervisor").map((n) => n.kind as string);
      // Before the confirmation it may be trimmed from the path (next + exit).
      expect(kinds.filter((k) => k === "note").length).toBe(e.confirmedTier ? 1 : kinds.includes("note") ? 1 : 0);
      expect(kinds).not.toContain("outcome");
      expect(kinds).not.toContain("debrief");
    }
  });
  it("the note completes at its last row's moment", () => {
    const done = timelineNodes(ARC[7][1], state(), "supervisor").find((n) => n.kind === "note");
    expect(done?.state).toBe("completed");
    expect(done?.at).toBe(T0 + 25 * MIN);
  });
});

describe("upcoming: the next step and the exit, nothing between", () => {
  it("never more than two ghosts, and the exit is one of them", () => {
    for (const lens of ["mentor", "supervisor"] as Lens[]) {
      for (const [, e] of ARC) {
        const up = timelineNodes(e, state(), lens).filter((n) => n.state === "upcoming");
        expect(up.length).toBeLessThanOrEqual(2);
        if (up.length) expect(["closed", "close"]).toContain(up.at(-1)!.kind);
        for (const u of up) expect(u.condition?.length ?? 0).toBeGreaterThan(5);
      }
    }
  });
});

describe("orientation", () => {
  it("live-first: upcoming on top (exit first), then current, then completed newest-first", () => {
    const nodes = orderNodes(timelineNodes(ARC[4][1], state(), "supervisor"));
    const states = nodes.map((n) => n.state);
    expect(states.indexOf("current")).toBeGreaterThan(states.lastIndexOf("upcoming"));
    expect(states.slice(states.indexOf("current") + 1).every((s) => s === "completed")).toBe(true);
    expect(nodes[0].kind).toBe("close");
    const past = nodes.filter((n) => n.state === "completed").map((n) => n.at ?? 0);
    expect([...past].sort((a, b) => b - a)).toEqual(past);
  });
  it("chronological leaves the derivation order alone", () => {
    const nodes = timelineNodes(ARC[3][1], state(), "supervisor");
    expect(orderNodes(nodes, "chronological")).toEqual(nodes);
  });
});

describe("added chat moments", () => {
  it("are completed nodes on both lenses, in time", () => {
    const e = base({ moments: [{ id: "m1", at: T0 + 3 * MIN, messageId: "msg-1", note: "", actor: { id: "live", name: "You", role: "mentor" }, quote: { text: "i don't know how much longer", sender: "them", senderName: "Jordan", at: T0 - MIN } }] });
    for (const lens of ["mentor", "supervisor"] as Lens[]) {
      const m = timelineNodes(e, state(), lens).find((n) => n.kind === "moment");
      expect(m?.state).toBe("completed");
      expect(m?.at).toBe(T0 + 3 * MIN);
    }
  });
});
