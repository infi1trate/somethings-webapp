import { describe, expect, it } from "vitest";
import { actorName, type ActorContext } from "@/lib/chat/actor-name";
import { LIVE_ID } from "@/lib/record/subject";

const mentorView: ActorContext = { viewerId: LIVE_ID, teenId: "t13", teenFirst: "Jordan", mentorName: "Brandon", supervisorFirst: "Brandy" };
const supervisorView: ActorContext = { ...mentorView, viewerId: "staff-supervisor" };

describe("the actor an event names (Workstream E1)", () => {
  it("never names the teen for a staff close — the defect it replaces", () => {
    expect(actorName("staff-supervisor", mentorView)).toBe("Brandy");
    expect(actorName("staff-supervisor", mentorView)).not.toBe("Jordan");
  });
  it("is You for the viewer's own act, on both lenses", () => {
    expect(actorName(LIVE_ID, mentorView)).toBe("You");
    expect(actorName("staff-supervisor", supervisorView)).toBe("You");
  });
  it("names the mentor to an observing supervisor", () => {
    expect(actorName(LIVE_ID, supervisorView)).toBe("Brandon");
    expect(actorName(LIVE_ID, { ...supervisorView, mentorName: "" })).toBe("The mentor");
  });
  it("names the teen only for the teen's own act", () => {
    expect(actorName("t13", mentorView)).toBe("Jordan");
  });
  it("resolves a directory person by id, and falls back without inventing", () => {
    expect(actorName("s-brandy", mentorView)).toBe("Brandy");
    expect(actorName("nobody-123", mentorView)).toBe("Someone");
  });
});
