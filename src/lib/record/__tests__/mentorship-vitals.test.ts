import { describe, expect, it } from "vitest";
import { mentorshipVitals, teenIdentity, tenureAt, tickedOver } from "@/lib/record/mentorship-vitals";
import { relLength } from "@/lib/record/mentees-demo";
import { DEMO_TEENS } from "@/lib/record/people-demo";

const DAY = 86_400_000;

describe("the Mentorship cell's vitals (Care Hero v7.0)", () => {
  it("phrases tenure exactly as the mentee table does — one fact, one phrasing", () => {
    for (const t of DEMO_TEENS) {
      const d = Math.max(0, t.matchedDaysAgo ?? t.joinedDaysAgo);
      expect(mentorshipVitals(t.id)?.tenure).toBe(`${relLength(-d * DAY, 0)} together`);
    }
  });

  it("agrees with the mentee table at every day to 400 — not only on the fixture's days", () => {
    // Mutation testing: a 3% re-rounding survived the fixture check, because
    // no fixture teen sat near a boundary. The sweep hits every boundary.
    for (let d = 0; d <= 400; d++) expect(tenureAt(d)).toBe(relLength(-d * DAY, 0));
    expect(tenureAt(45)).toBe("6 weeks");
    expect(tenureAt(243)).toBe("8 months");
  });

  it("ticks over only on the day the phrase changes", () => {
    expect(tenureAt(13)).toBe("13 days");
    expect(tenureAt(14)).toBe("2 weeks");
    expect(tickedOver(14)).toBe(true);
    expect(tickedOver(15)).toBe(false);
    expect(tickedOver(1)).toBe(false);
    // Months: the first day relLength rounds to the next month.
    const first = Array.from({ length: 400 }, (_, i) => i).filter((d) => d >= 60 && tickedOver(d));
    for (const d of first) expect(tenureAt(d)).not.toBe(tenureAt(d - 1));
    expect(first.length).toBeGreaterThan(5);
  });

  it("reads last spoke from whichever side wrote most recently", () => {
    const t = DEMO_TEENS.find((x) => typeof x.mentorLastSentDaysAgo === "number" && typeof x.menteeLastSentDaysAgo === "number" && x.mentorLastSentDaysAgo !== x.menteeLastSentDaysAgo)!;
    const n = Math.min(t.mentorLastSentDaysAgo!, t.menteeLastSentDaysAgo!);
    expect(mentorshipVitals(t.id)?.lastSpoke).toBe(n <= 0 ? "today" : n === 1 ? "yesterday" : `${n}d ago`);
  });

  it("names the supervisor from the supervision edge — the live mentor's is Brandy", () => {
    const live = DEMO_TEENS.find((x) => x.mentorId === "live");
    if (live) expect(mentorshipVitals(live.id)?.supervisor).toEqual({ id: "s-brandy", name: "Brandy Forrestor" });
    for (const t of DEMO_TEENS) expect(mentorshipVitals(t.id)?.supervisor).not.toBeNull();
  });

  it("carries facts only — no clinical field can reach the mentor's lens through it", () => {
    const v = mentorshipVitals(DEMO_TEENS[0].id)!;
    expect(Object.keys(v).sort()).toEqual(["checkIns30d", "days", "lastSpoke", "supervisor", "tenure", "tickedToday"]);
    expect(JSON.stringify(v)).not.toMatch(/[A-Z]\d{2}\.\d|diagnos|presentation/i);
  });

  it("states the identity, and invents nothing for an unknown teen", () => {
    const t = DEMO_TEENS[0];
    expect(teenIdentity(t.id)).toMatchObject({ pronouns: t.pronouns ?? null });
    expect(teenIdentity("nobody")).toBeNull();
    expect(mentorshipVitals("nobody")).toBeNull();
  });
});
