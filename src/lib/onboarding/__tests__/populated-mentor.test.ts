import { describe, expect, it } from "vitest";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isPristineMentor, populatedMentorFields } from "@/lib/onboarding/populated-mentor";
import { STEP_ORDER } from "@/lib/onboarding/steps";

/* THE RULE (2026-10-26): the default Mentor is a populated mentor, and ONLY
   "Reset as new mentor" blanks it. */

const opts = () => useOnboardingStore.persist.getOptions();

describe("the populated default mentor", () => {
  it("is onboarded, published and filled — every wizard step, every hub step", () => {
    const f = populatedMentorFields();
    expect(f.status).toBe("published");
    expect(f.enteredHome).toBe(true);
    expect(f.completed).toEqual(STEP_ORDER.map((s) => s.slug));
    expect(Object.values(f.hubSteps).every((v) => v === "done")).toBe(true);
    expect(f.draft.firstName).toBeTruthy();
    expect(f.draft.displayName).toBeTruthy();
    expect(f.draft.bio.length).toBeGreaterThan(40);
    expect(f.draft.languages.length).toBeGreaterThan(0);
    expect(f.draft.interests.length).toBeGreaterThan(0);
    // The teen-facing snapshot is the draft, as `capturePublishedSnapshot` takes it.
    expect(f.publishedSnapshot.displayName).toBe(f.draft.displayName);
    expect(f.publishedSnapshot.password).toBe("");
  });

  it("reset() returns the POPULATED mentor — start over is not start as new", () => {
    const s = useOnboardingStore.getState();
    s.resetAsNewMentor();
    s.reset();
    const after = useOnboardingStore.getState();
    expect(after.status).toBe("published");
    expect(after.draft.firstName).toBe("Brandon");
    expect(after.publishedSnapshot).not.toBeNull();
    expect(after.mentorStartedNew).toBe(false);
  });

  it("resetAsNewMentor() is the one way to a blank, invited mentor, and it is remembered", () => {
    useOnboardingStore.getState().resetAsNewMentor();
    const s = useOnboardingStore.getState();
    expect(s.status).toBe("invited");
    expect(s.draft.firstName).toBe("");
    expect(s.publishedSnapshot).toBeNull();
    expect(s.enteredHome).toBe(false);
    expect(s.mentorStartedNew).toBe(true);
    expect(isPristineMentor(s)).toBe(true);
  });

  it("a fresh browser (nothing stored) hydrates as the populated mentor; a partial seed does not", () => {
    const current = useOnboardingStore.getState();
    const fresh = opts().merge!(undefined, current);
    expect(fresh.status).toBe("published");
    expect(fresh.draft.firstName).toBe("Brandon");
    // A probe's seed is an object: it keeps the blank start it was written against.
    useOnboardingStore.getState().resetAsNewMentor();
    const seeded = opts().merge!({ persona: "mentor", status: "pending" }, useOnboardingStore.getState());
    expect(seeded.status).toBe("pending");
    expect(seeded.draft.firstName).toBe("");
  });

  it("v57 migrates an untouched stored mentor to populated — never a deliberate new one, never one in progress", () => {
    const blank = { persona: "mentor", status: "invited", draft: { firstName: "" }, publishedSnapshot: null };
    const m1 = opts().migrate!(JSON.parse(JSON.stringify(blank)), 56) as unknown as Record<string, unknown>;
    expect(m1.status).toBe("published");
    expect(m1.mentorStartedNew).toBe(false);
    const asNew = opts().migrate!({ ...JSON.parse(JSON.stringify(blank)), persona: "new-mentor" }, 56) as unknown as Record<string, unknown>;
    expect(asNew.status).toBe("invited");
    expect(asNew.mentorStartedNew).toBe(true);
    const typing = opts().migrate!({ ...JSON.parse(JSON.stringify(blank)), draft: { firstName: "Sam" } }, 56) as unknown as Record<string, unknown>;
    expect((typing.draft as { firstName: string }).firstName).toBe("Sam");
    expect(typing.status).toBe("invited");
  });

  it("isPristineMentor reads only an untouched mentor as untouched", () => {
    expect(isPristineMentor({ draft: { firstName: "" }, status: "invited", publishedSnapshot: null })).toBe(true);
    expect(isPristineMentor({ draft: { firstName: "A" }, status: "invited", publishedSnapshot: null })).toBe(false);
    expect(isPristineMentor({ draft: { firstName: "" }, status: "in_review", publishedSnapshot: null })).toBe(false);
    expect(isPristineMentor({ draft: { firstName: "" }, status: "invited", publishedSnapshot: {} })).toBe(false);
  });
});
