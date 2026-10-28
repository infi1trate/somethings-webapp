import { describe, expect, it } from "vitest";
import type { EscalationState } from "@/lib/chat/types";
import { compareT1, flaggedLine, needsYouNow, overdueText, queueSummary, responseText, t1Action, t1Holder, t1Response, t1Rows, t1Stage } from "@/lib/monitoring/t1-queue";

const NOW = 1_800_000_000_000;
const esc = (over: Partial<EscalationState> = {}): EscalationState =>
  ({
    id: "e1",
    threadId: "t13",
    openedAt: NOW - 30_000,
    anchorMessageId: null,
    supervisorNotifiedAt: NOW - 30_000,
    supervisorId: "s-brandy",
    resolvedAt: null,
    resolutionNoteId: null,
    requested: 1,
    contextNote: "",
    safetyCheck: { answers: {}, submittedAt: null },
    ...over,
  }) as EscalationState;

describe("the response is a state, never a countdown past zero", () => {
  it("inside the 60s window: n to confirm", () => {
    expect(responseText(t1Response(esc({ openedAt: NOW - 18_000 }), NOW, null))).toBe("0:42 to confirm");
  });
  it("at and past the window: Overdue — never \"0:00 left\"", () => {
    for (const s of [60, 61, 119, 14 * 60 + 60, 3 * 3600, 2 * 86400]) {
      const text = responseText(t1Response(esc({ openedAt: NOW - s * 1000 }), NOW, null));
      expect(text).toMatch(/^Overdue /);
      expect(text).not.toMatch(/0:00|left/);
    }
    expect(responseText(t1Response(esc({ openedAt: NOW - 15 * 60_000 }), NOW, null))).toBe("Overdue 14m");
  });
  it("confirmed: who, and how long it took", () => {
    const e = esc({ confirmedTier: 1, confirmedAt: NOW - 1000, meta: { timeToConfirmMs: 48_000 } });
    expect(responseText(t1Response(e, NOW, "Sarah"))).toBe("Confirmed by Sarah · 0:48");
    expect(responseText(t1Response(e, NOW, "you"))).toBe("Confirmed by you · 0:48");
  });
  it("long durations read in hours, then days", () => {
    expect(overdueText(30)).toBe("Overdue <1m");
    expect(overdueText(2 * 3600 + 14 * 60)).toBe("Overdue 2h 14m");
    expect(overdueText(6 * 86400 + 3 * 3600)).toBe("Overdue 6d 3h");
  });
});

describe("the stage, in the product's order: Requested → Assessment → Confirmed → Note", () => {
  it("mid-assessment, awaiting confirmation, confirmed", () => {
    expect(t1Stage(esc()).step).toBe("assessment");
    const assessed = esc({ safetyCheck: { answers: {}, submittedAt: NOW - 5000 } });
    expect(t1Stage(assessed)).toEqual({ step: "confirmed", label: "Awaiting confirmation" });
    expect(t1Stage(esc({ ...assessed, confirmedTier: 1, confirmedAt: NOW }))).toEqual({ step: "note", label: "Note in progress" });
  });
});

describe("holder and action", () => {
  it("Join when nobody or you; Observe when another supervisor; Resume once you joined", () => {
    const none = t1Holder({ joinedByYou: false, heldBy: null, confirmedBy: null });
    expect(none).toEqual({ kind: "none" });
    expect(t1Action(none, false)).toBe("join");
    const sarah = t1Holder({ joinedByYou: false, heldBy: "Sarah", confirmedBy: null });
    expect(t1Action(sarah, false)).toBe("observe");
    const you = t1Holder({ joinedByYou: true, heldBy: null, confirmedBy: null });
    expect(you).toEqual({ kind: "you" });
    expect(t1Action(you, true)).toBe("resume");
    expect(t1Holder({ joinedByYou: false, heldBy: null, confirmedBy: "you" })).toEqual({ kind: "you" });
    expect(t1Holder({ joinedByYou: false, heldBy: null, confirmedBy: "Sarah" })).toEqual({ kind: "other", name: "Sarah" });
  });
});

describe("the sort: overdue (longest first), awaiting (least time first), confirmed (oldest first)", () => {
  it("is a total order by response state", () => {
    const row = (id: string, openedAgo: number, confirmed = false) => {
      const e = esc({ id, openedAt: NOW - openedAgo * 1000, ...(confirmed ? { confirmedTier: 1 as const, confirmedAt: NOW } : {}) });
      return { id, openedAt: e.openedAt, response: t1Response(e, NOW, confirmed ? "Sarah" : null) };
    };
    const rows = [row("c-old", 3000, true), row("w-40", 20), row("o-2m", 180), row("w-10", 50), row("o-14m", 900), row("c-new", 100, true)];
    expect([...rows].sort(compareT1).map((r) => r.id)).toEqual(["o-14m", "o-2m", "w-10", "w-40", "c-old", "c-new"]);
  });
});

describe("the hero's In-crisis detail", () => {
  it("reads the queue", () => {
    const rs = [t1Response(esc({ openedAt: NOW - 15 * 60_000 }), NOW, null), t1Response(esc({ openedAt: NOW - 20_000 }), NOW, null), t1Response(esc({ confirmedTier: 1, confirmedAt: NOW }), NOW, "you")];
    expect(queueSummary(rs)).toBe("2 awaiting · oldest 14m overdue");
    expect(queueSummary([])).toBeNull();
  });
});

describe("the tray reads the queue's rows (§4)", () => {
  const teen = (id: string, e: EscalationState, confirmedBy: string | null = null) =>
    ({ id, teen: id, mentor: "Brandon F.", tier: 1, t1: { escalation: e, confirmedBy } }) as unknown as Parameters<typeof t1Rows>[0][number];
  const teens = [
    teen("a", esc({ id: "ea", openedAt: NOW - 20_000 })),
    teen("b", esc({ id: "eb", openedAt: NOW - 15 * 60_000 })),
    teen("c", esc({ id: "ec", confirmedTier: 1, confirmedAt: NOW }), "Sarah"),
  ];
  it("Needs you now is the unconfirmed rows, in the queue's order", () => {
    const rows = t1Rows(teens, NOW, new Set());
    expect(rows.map((r) => r.id)).toEqual(["eb", "ea", "ec"]);
    expect(needsYouNow(rows).map((r) => r.id)).toEqual(["eb", "ea"]);
  });
  it("the action follows the holder in both hosts", () => {
    const rows = t1Rows(teens, NOW, new Set(["ea"]), { b: "Sarah" });
    expect(Object.fromEntries(rows.map((r) => [r.id, r.action]))).toEqual({ eb: "observe", ea: "resume", ec: "observe" });
  });
  it("the flagged line says what the mentor has sent", () => {
    expect(flaggedLine("Brandon F.", esc({ contextNote: "Said goodbye" }))).toBe("Flagged by Brandon F. · note");
    expect(flaggedLine("Brandon F.", esc({ contextNote: "x", safetyCheck: { answers: {}, submittedAt: NOW } }))).toBe("Flagged by Brandon F. · note + C-SSRS");
    expect(flaggedLine("The mentor", esc())).toBe("Flagged by the mentor");
  });
});
