// THE COMPARATOR IS THE SURFACE'S ONLY ORDERING, so each of its five steps gets
// a test that would fail if that step were removed — and the two steps that are
// currently no-ops get a test that says so, because "no-op" is a decision with
// an owner and not an accident.

import { describe, expect, it } from "vitest";
import {
  compareEvents,
  sortEvents,
  type MonitoringEvent,
} from "@/lib/monitoring/event";
import type { TaskItem } from "@/lib/tasks/types";
import { FLAG_PATTERN_WINDOW } from "@/lib/monitoring/constants";

const NOW = 1_760_000_000_000;
const HOUR = 3_600_000;

function ev(o: Partial<MonitoringEvent> & { id: string }): MonitoringEvent {
  return {
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
    /* THE COMPARATOR NEVER READS THE PAYLOAD — all five steps run off the
       precomputed fields above — so a placeholder is honest here rather than
       lazy, and building a real `TaskItem` would suggest the sort depends on
       one. */
    flag: {} as TaskItem,
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

  /* ═══ "does not order by subject" IS GONE (addendum §2.1) ═══
     It asserted that a practice event and a flag of the same age sorted by age
     and id rather than by kind — the property that made one comparator over two
     subjects legitimate. There is one subject now, so the test has no second
     kind to construct and the property it protected cannot be violated.
     THE COMPARATOR ITSELF DID NOT CHANGE: none of its five steps ever read
     `subject`, which is why removing a subject removed no ordering. */
});

/* ═══ THE GROUPING BLOCK IS GONE TOO ═══
   `groupEvents` split the queue into teen safety above mentor practice, in a
   fixed order so the data could not reorder them, and omitted empty groups.
   With one subject it would return one group holding everything, and a header
   over the whole list restates the page title — so the function, its three
   tests and `subjectOf` all went. */
