// THE COMPARATOR IS THE SURFACE'S ONLY ORDERING, so each of its five steps gets
// a test that would fail if that step were removed — and the two steps that are
// currently no-ops get a test that says so, because "no-op" is a decision with
// an owner and not an accident.

import { describe, expect, it } from "vitest";
import {
  compareEvents,
  groupEvents,
  sortEvents,
  subjectOf,
  type MonitoringEvent,
} from "@/lib/monitoring/event";
import { FLAG_PATTERN_WINDOW } from "@/lib/monitoring/constants";

const NOW = 1_760_000_000_000;
const HOUR = 3_600_000;

function ev(o: Partial<MonitoringEvent> & { id: string }): MonitoringEvent {
  return {
    kind: "riskFlag",
    subject: "teenSafety",
    teenId: "t1",
    teenName: "Ava M.",
    mentorId: "m1",
    mentorName: "Brandon Forant",
    conversationId: "c1",
    at: NOW - HOUR,
    category: "Low mood",
    escalationOpen: false,
    patternCount: 1,
    mentorReplied: true,
    flag: null,
    practice: null,
    ...o,
  };
}

describe("the comparator", () => {
  it("1 · puts an event on an escalated teen first, whatever its age", () => {
    const old = ev({ id: "old", at: NOW - 40 * HOUR });
    const escalated = ev({ id: "esc", at: NOW - HOUR, escalationOpen: true });
    expect(sortEvents([old, escalated]).map((e) => e.id)).toEqual(["esc", "old"]);
  });

  it("3 · puts a repeat-flagged conversation ahead of a single flag of the same age", () => {
    const single = ev({ id: "single", patternCount: 1 });
    const pattern = ev({ id: "pattern", patternCount: 3 });
    expect(sortEvents([single, pattern]).map((e) => e.id)).toEqual(["pattern", "single"]);
  });

  it("4 · puts an unanswered flagged message ahead of an answered one", () => {
    const answered = ev({ id: "answered", mentorReplied: true });
    const silent = ev({ id: "silent", mentorReplied: false });
    expect(sortEvents([answered, silent]).map((e) => e.id)).toEqual(["silent", "answered"]);
  });

  it("5 · falls through to age, oldest first", () => {
    const young = ev({ id: "young", at: NOW - HOUR });
    const old = ev({ id: "old", at: NOW - 9 * HOUR });
    expect(sortEvents([young, old]).map((e) => e.id)).toEqual(["old", "young"]);
  });

  it("is a total order, so the list cannot reshuffle between renders", () => {
    const a = ev({ id: "a" });
    const b = ev({ id: "b" });
    expect(compareEvents(a, b)).toBeLessThan(0);
    expect(compareEvents(b, a)).toBeGreaterThan(0);
  });

  it("ranks the steps in order — escalation beats pattern beats silence beats age", () => {
    /* THE WHOLE LADDER IN ONE ASSERTION. Each event below wins on exactly one
       step and loses on every step beneath it, so a reordered implementation
       fails here rather than passing four single-step tests. */
    const escalated = ev({ id: "1-escalated", escalationOpen: true, at: NOW - HOUR, mentorReplied: true });
    const pattern = ev({ id: "2-pattern", patternCount: 4, at: NOW - 2 * HOUR, mentorReplied: true });
    const silent = ev({ id: "3-silent", mentorReplied: false, at: NOW - 3 * HOUR });
    const oldest = ev({ id: "4-oldest", at: NOW - 80 * HOUR });
    expect(sortEvents([oldest, silent, pattern, escalated]).map((e) => e.id)).toEqual([
      "1-escalated",
      "2-pattern",
      "3-silent",
      "4-oldest",
    ]);
  });

  /* ═══ RETARGETED — THE NO-OP ENDED (Phase 4) ═══
     This asserted `Object.keys(FLAG_CATEGORY_RANK)).toHaveLength(0)` and was
     written, in its own words, "to fail the day somebody fills the table without
     revisiting the comparator's tests". It did exactly that. The table is gone
     and the rank is DERIVED from the playbook's tier grouping over the 21
     published categories, so the contract to assert is the new one — in two
     halves, because the step is live between groups and still flat inside one. */
  it("2 · category rank orders the playbook's three groups, oldest-first be damned", () => {
    // An imminent category, 1h old, against a below-threshold one 2h old. Step 2
    // decides, so the NEWER event leads — which is the whole point of the step
    // and is the opposite of what step 5 would have done.
    const a = ev({
      id: "imminent",
      category: "ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS",
      at: NOW - HOUR,
    });
    const b = ev({
      id: "routine",
      category: "ASSESSMENT_BELOW_THRESHOLD",
      at: NOW - 2 * HOUR,
    });
    expect(sortEvents([a, b]).map((e) => e.id)).toEqual(["imminent", "routine"]);
  });

  it("2 · and is flat WITHIN a group, so age still decides there", () => {
    // Two imminent categories. The within-group ranking is the non-blocking
    // refinement still with Dr. Nissan, so the step must not invent one.
    const a = ev({
      id: "newer",
      category: "ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS",
      at: NOW - HOUR,
    });
    const b = ev({
      id: "older",
      category: "ABUSE_DISCLOSURE",
      at: NOW - 2 * HOUR,
    });
    expect(sortEvents([a, b]).map((e) => e.id)).toEqual(["older", "newer"]);
  });

  it("2 · ranks a category outside the playbook LAST, not first", () => {
    // A classifier change or a data fault is not a reason to promote something
    // above a reviewed imminent category.
    const known = ev({
      id: "known",
      category: "ASSESSMENT_BELOW_THRESHOLD",
      at: NOW - HOUR,
    });
    const unknown = ev({ id: "unknown", category: "WAT", at: NOW - 5 * HOUR });
    expect(sortEvents([known, unknown]).map((e) => e.id)).toEqual([
      "known",
      "unknown",
    ]);
  });

  it("3 · is unwindowed while the pattern window is unset, which is the wider test", () => {
    expect(FLAG_PATTERN_WINDOW).toBeNull();
    /* A conversation whose flags are months apart still counts as a pattern
       today. Documented in `constants.ts`: a wider test than intended, chosen
       over dropping a signal that exists in the data. */
    const ancientPattern = ev({ id: "pattern", patternCount: 2, at: NOW - 900 * HOUR });
    const fresh = ev({ id: "fresh", patternCount: 1, at: NOW - HOUR });
    expect(sortEvents([fresh, ancientPattern]).map((e) => e.id)).toEqual(["pattern", "fresh"]);
  });

  it("does not order by subject — a mentor's late note does not outrank a teen's flag by type alone", () => {
    /* The two subjects share one comparator, so a practice event and a flag of
       the same age sort by age and id, not by which kind they are. */
    const practice = ev({ id: "a-practice", kind: "noteOverdue", subject: "mentorPractice", at: NOW - 5 * HOUR });
    const flag = ev({ id: "b-flag", at: NOW - 5 * HOUR });
    expect(sortEvents([flag, practice]).map((e) => e.id)).toEqual(["a-practice", "b-flag"]);
  });
});

describe("grouping", () => {
  it("is fixed — teen safety above mentor practice, whatever the data says", () => {
    const practice = ev({ id: "p", kind: "offlineDuringHours", subject: "mentorPractice" });
    const flag = ev({ id: "f" });
    expect(groupEvents([practice, flag]).map((g) => g.subject)).toEqual([
      "teenSafety",
      "mentorPractice",
    ]);
  });

  it("omits an empty group rather than drawing a header over nothing", () => {
    expect(groupEvents([ev({ id: "f" })]).map((g) => g.subject)).toEqual(["teenSafety"]);
  });

  it("derives the subject from the kind, so a new practice kind cannot land in teen safety", () => {
    expect(subjectOf("riskFlag")).toBe("teenSafety");
    expect(subjectOf("conductStub")).toBe("mentorPractice");
    expect(subjectOf("teenResponseSlow")).toBe("mentorPractice");
  });
});
