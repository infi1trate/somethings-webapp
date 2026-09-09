// ACCOUNT LIFECYCLE IN THE CARE HISTORY.
//
// `account_update` rows are a FIXTURE, because the roster records a teen's
// current standing and nothing about when it changed. That makes one thing
// checkable and important: the last transition in a record's history has to
// agree with the standing the roster reports. A derived implementation would
// have given that for free; a fixture can drift from it silently, and a record
// whose history says "reactivated" while the roster says "paused" is a record
// that contradicts itself in front of a supervisor.
//
// THE SECOND CLAIM IS COVERAGE: a record that IS paused or deactivated, and has
// a care history at all, must say why. Ten records carried a non-active standing
// with nothing accounting for it before this event type existed, and the whole
// reason it exists is that a gap in a trajectory or a stopped review clock is
// innocent when the account was paused and unexplained otherwise.

import { describe, expect, it } from "vitest";
import {
  ACCOUNT_CHANGE_LABEL,
  TYPE_LABEL,
  careTimelineFor,
  matchesFilter,
  type AccountChangeKind,
  type CareEvent,
} from "@/lib/record/care-demo";
import { DEMO_TEENS, defaultMenteeStatus } from "@/lib/record/people-demo";

const NOW = Date.UTC(2026, 8, 9, 12);

const timeline = (id: string) => careTimelineFor(id, NOW, undefined);
const accountRows = (id: string): CareEvent[] =>
  timeline(id)
    .filter((e) => e.type === "account_update")
    .sort((a, b) => b.occurredAt - a.occurredAt);

/** What each transition implies about the teen's standing now. */
const STANDING_AFTER: Record<AccountChangeKind, string> = {
  paused: "paused",
  activated: "active",
  deactivated: "deactivated",
  // The app has no closed state; both land on deactivated. See the note on
  // `AccountChangeKind`.
  closed: "deactivated",
};

describe("an account row agrees with the record it sits on", () => {
  it("makes the newest transition match the roster's standing", () => {
    let checked = 0;
    for (const teen of DEMO_TEENS) {
      const rows = accountRows(teen.id);
      if (!rows.length) continue;
      const latest = rows[0];
      expect(latest.accountChange, `${teen.id}: row carries no transition`).toBeDefined();
      expect(
        STANDING_AFTER[latest.accountChange!],
        `${teen.id}: history ends "${latest.accountChange}" but the roster says "${defaultMenteeStatus(teen)}"`
      ).toBe(defaultMenteeStatus(teen));
      checked++;
    }
    // A green result over an empty set proves nothing.
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it("explains every non-active record that has a care history", () => {
    const unexplained: string[] = [];
    for (const teen of DEMO_TEENS) {
      if (defaultMenteeStatus(teen) === "active") continue;
      // A record with NO care history is the roster's "it ended before care ever
      // started" case, and is deliberately left unexplained rather than given
      // the single row the page could show. See `ACCOUNT_CHANGES`.
      const events = timeline(teen.id);
      if (!events.some((e) => e.type !== "account_update")) continue;
      if (!accountRows(teen.id).length) unexplained.push(teen.id);
    }
    expect(unexplained).toEqual([]);
  });

  it("orders a multi-step chain newest first and keeps both steps", () => {
    // t22 ended and was then closed a month later — the sequence the two words
    // describe, and the only record carrying `closed`.
    const rows = accountRows("t22");
    expect(rows.map((r) => r.accountChange)).toEqual(["closed", "deactivated"]);
    expect(rows[0].occurredAt).toBeGreaterThan(rows[1].occurredAt);
  });

  it("carries a transition on every account row and on no other row", () => {
    let account = 0;
    for (const teen of DEMO_TEENS)
      for (const e of timeline(teen.id)) {
        if (e.type === "account_update") {
          expect(e.accountChange, `${e.id} has no transition`).toBeDefined();
          account++;
        } else {
          expect(e.accountChange, `${e.id} is ${e.type} but carries one`).toBeUndefined();
        }
      }
    expect(account).toBeGreaterThanOrEqual(9);
  });
});

describe("how the row presents", () => {
  it("names the class in the pill and the transition in the description", () => {
    // The pill is one word for the class; a reader learns "Account update" once
    // and reads which transition off the row itself.
    expect(TYPE_LABEL.account_update).toBe("Account update");
    for (const teen of DEMO_TEENS)
      for (const e of accountRows(teen.id))
        expect(e.description).toBe(ACCOUNT_CHANGE_LABEL[e.accountChange!]);
  });

  it("gives all four transitions distinct copy", () => {
    const labels = Object.values(ACCOUNT_CHANGE_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
    // And none of them describes the person rather than the account.
    for (const l of labels) expect(l).toMatch(/^Account /);
  });

  it("always states a reason, and never restates the title", () => {
    // "Account closed · Account closed at the family's request" spent the
    // sub-line repeating the row's own heading. The reason has to add the thing
    // only it knows.
    for (const teen of DEMO_TEENS)
      for (const e of accountRows(teen.id)) {
        expect(e.result, `${e.id} has no reason`).toBeTruthy();
        expect(e.result.length).toBeGreaterThan(10);
        expect(
          e.result.toLowerCase().startsWith(e.description.toLowerCase()),
          `${e.id}: reason restates the description`
        ).toBe(false);
        expect(
          e.result.toLowerCase(),
          `${e.id}: reason repeats "account"`
        ).not.toContain("account");
      }
  });

  it("appears under All and under no other filter", () => {
    // `pause` and `return` used to map to `care`, which made the "Care updates"
    // filter show rows that were not care updates. This is that fix, asserted.
    expect(matchesFilter("account_update", "all")).toBe(true);
    for (const f of ["assessments", "presentation", "summary", "care", "flags"] as const)
      expect(matchesFilter("account_update", f), `leaked into ${f}`).toBe(false);
  });

  it("still routes every other type to a chip", () => {
    // `null` is allowed in the filter map now, so this guards against a future
    // type quietly taking the no-chip answer by accident.
    for (const t of [
      "assessment",
      "survey_assigned",
      "presentation_assigned",
      "presentation_reviewed",
      "presentation_changed",
      "care_update",
      "care_summary",
      "escalation",
      "risk_flag",
    ] as const) {
      const chips = ["assessments", "presentation", "summary", "care", "flags"] as const;
      expect(
        chips.some((f) => matchesFilter(t, f)),
        `${t} matches no chip`
      ).toBe(true);
    }
  });
});
