import { describe, expect, it } from "vitest";
import type { EscalationState } from "@/lib/chat/types";
import type { TierEvent } from "@/lib/tiering/events";
import { escalationHref, mentorNotices, stageLine, supervisorAgenda, supervisorNotices, unreadNotices, type NoticeInput } from "@/lib/tiering/notifications";

const T0 = new Date("2026-10-23T09:00:00").getTime();
const MIN = 60_000;
const DAY = 86_400_000;
const BRANDY = { id: "s-brandy", name: "Brandy Ortiz", role: "supervisor" as const };
const no = (at: number) => ({ value: "no" as const, at });
const six = { q1: no(T0 + MIN), q2: no(T0 + MIN), q3: { value: "yes" as const, at: T0 + MIN }, q4: no(T0 + MIN), q5: no(T0 + MIN), q6: no(T0 + MIN) };

const esc = (o: Partial<EscalationState> = {}): EscalationState => ({
  id: "esc-1",
  threadId: "t13",
  openedAt: T0,
  anchorMessageId: null,
  supervisorNotifiedAt: T0,
  supervisorId: "s-brandy",
  resolvedAt: null,
  resolutionNoteId: null,
  requested: 1,
  safetyCheck: { answers: {}, submittedAt: null },
  ...o,
});
const input = (escalations: EscalationState[], events: TierEvent[] = [], support: { at: number; text: string }[] = [], now = T0 + 60 * MIN): NoticeInput => ({
  escalations,
  eventsFor: () => events,
  nameOf: (a) => a.name.split(" ")[0],
  teenName: () => "Jordan",
  mentorName: () => "Alex",
  supervisorName: () => "Brandy",
  supportFrom: () => support,
  now,
});

describe("supervisorNotices — opened and assessed, the mentor as subject", () => {
  it("opened is urgent while unconfirmed; assessed carries the risk", () => {
    const n = supervisorNotices(input([esc({ safetyCheck: { answers: six, submittedAt: T0 + 5 * MIN } })]));
    expect(n.map((x) => x.kind)).toEqual(["assessed", "opened"]);
    expect(n[1]).toMatchObject({ text: "Alex raised Tier 1 for Jordan", urgent: true });
    expect(n[0]).toMatchObject({ text: "Alex sent Jordan’s assessment", detail: "Assessment suggests: Moderate risk" });
  });
  it("is no longer urgent once confirmed", () => {
    expect(supervisorNotices(input([esc({ confirmedTier: 1, confirmedAt: T0 + 9 * MIN })]))[0].urgent).toBe(false);
  });
  it("never notifies a supervisor of a confirmation or a close — those are theirs", () => {
    const kinds = supervisorNotices(input([esc({ confirmedTier: 1, confirmedAt: T0 + 9 * MIN, resolvedAt: T0 + 50 * MIN })])).map((x) => x.kind);
    expect(kinds).not.toContain("confirmed");
    expect(kinds).not.toContain("closed");
  });
});

describe("mentorNotices — the supervisor as subject", () => {
  const confirmed: TierEvent = { id: "e1", teenId: "t13", at: T0 + 9 * MIN, kind: "confirmed", tier: 1, fromTier: 3, actor: BRANDY, reason: "x", escalationId: "esc-1" };
  const stepped: TierEvent = { id: "e2", teenId: "t13", at: T0 + 50 * MIN, kind: "stepped-down", tier: 3, fromTier: 1, actor: BRANDY, reason: "x", escalationId: "esc-1" };
  it("confirmed, then support while open — actor-correct, sentence case, Open Support offered", () => {
    const n = mentorNotices(input([esc({ confirmedTier: 1, confirmedAt: T0 + 9 * MIN })], [confirmed], [{ at: T0 + 20 * MIN, text: "Keep Jordan talking." }]));
    expect(n.map((x) => x.text)).toEqual(["Brandy messaged you in Support", "Brandy confirmed Tier 1 for Jordan"]);
    expect(n.every((x) => x.supportId === "s-brandy")).toBe(true);
  });
  it("closed: the close, and no Support notice — a thread is about no one teen once it is over", () => {
    const n = mentorNotices(input([esc({ confirmedTier: 1, confirmedAt: T0 + 9 * MIN, resolvedAt: T0 + 50 * MIN })], [confirmed, stepped], [{ at: T0 + 20 * MIN, text: "Keep Jordan talking." }]));
    expect(n.map((x) => x.text)).toEqual(["Brandy closed the escalation · Jordan moves to Tier 3", "Brandy confirmed Tier 1 for Jordan"]);
  });
  it("an adjusted tier says so, rather than claiming a confirmation", () => {
    const n = mentorNotices(input([esc({ confirmedTier: 2, confirmedAt: T0 + 9 * MIN })], [{ ...confirmed, kind: "placed", tier: 2 }]));
    expect(n[0].text).toBe("Brandy set Jordan to Tier 2");
  });
  it("a Support message from before the escalation is not about it", () => {
    expect(mentorNotices(input([esc()], [], [{ at: T0 - MIN, text: "old" }]))).toEqual([]);
  });
  it("never tells a mentor they raised it", () => {
    expect(mentorNotices(input([esc()])).map((x) => x.kind)).not.toContain("opened");
  });
});

describe("supervisorAgenda — Today's items", () => {
  it("urgent first, then follow-ups due, then scheduled", () => {
    const due = esc({ id: "d", resolvedAt: T0 - 3 * DAY, followUp: { dueAt: T0 + 2 * 3600e3, status: null } });
    const later = esc({ id: "l", resolvedAt: T0 - DAY, followUp: { dueAt: T0 + 6 * DAY, status: null } });
    const open = esc({ id: "o" });
    const a = supervisorAgenda(input([later, due, open]));
    expect(a.map((x) => x.kind)).toEqual(["opened", "follow-up-due", "follow-up-scheduled"]);
    expect(a[0]).toMatchObject({ text: "Jordan · Tier 1 requested", urgent: true, detail: "Assessment in · 0 of 6" });
  });
  it("a follow-up with a status recorded is done", () => {
    expect(supervisorAgenda(input([esc({ resolvedAt: T0, followUp: { dueAt: T0 + DAY, status: "stable" } as never })]))).toEqual([]);
  });
});

describe("stageLine — Monitoring's one quiet line", () => {
  it("follows the record", () => {
    expect(stageLine(esc())).toBe("Assessment in · 0 of 6");
    expect(stageLine(esc({ safetyCheck: { answers: six, submittedAt: T0 } }))).toBe("Awaiting confirmation");
    expect(stageLine(esc({ confirmedTier: 1, confirmedAt: T0, safetyCheck: { answers: six, submittedAt: T0 } }))).toBe("Note in progress");
    expect(stageLine(esc({ requested: "platform" }))).toBe("Platform concern · in review");
    expect(stageLine(esc({ resolvedAt: T0 }))).toBeNull();
    expect(stageLine(undefined)).toBeNull();
  });
});

describe("plumbing", () => {
  it("unread counts against the last look; the deep link opens Care on Overview", () => {
    const n = supervisorNotices(input([esc(), esc({ id: "b", openedAt: T0 + 30 * MIN })]));
    expect(unreadNotices(n, T0 + 10 * MIN)).toBe(1);
    expect(escalationHref("t13")).toBe("/app/chat/t13?care=overview");
  });
});
