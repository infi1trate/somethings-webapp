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
import {
  DEMO_TEENS,
  defaultMenteeStatus,
  mentorName,
} from "@/lib/record/people-demo";

const NOW = Date.UTC(2026, 8, 9, 12);

const timeline = (id: string) => careTimelineFor(id, NOW, undefined);
const accountRows = (id: string): CareEvent[] =>
  timeline(id)
    .filter((e) => e.type === "account_update")
    .sort((a, b) => b.occurredAt - a.occurredAt);

/** ═══ WHAT EACH TRANSITION IMPLIES ABOUT THE TEEN'S STANDING NOW ═══
 *
 *  `null` MEANS "THIS KIND MOVES NOTHING", and it is what let a standing-neutral
 *  event join this type without either weakening the invariant below or being
 *  special-cased by name inside it. `Record<AccountChangeKind, …>` stays
 *  exhaustive, so a sixth kind still cannot be added without a decision here. */
const STANDING_AFTER: Record<AccountChangeKind, string | null> = {
  paused: "paused",
  activated: "active",
  deactivated: "deactivated",
  // The app has no closed state; both land on deactivated. See the note on
  // `AccountChangeKind`.
  closed: "deactivated",
  // A teen whose mentor changes is exactly as active as they were before.
  mentor_change: null,
};

/** The rows that move the account between states — the only ones the roster can
 *  be checked against. */
const standingRows = (id: string): CareEvent[] =>
  accountRows(id).filter((e) => STANDING_AFTER[e.accountChange!] !== null);

describe("an account row agrees with the record it sits on", () => {
  it("makes the newest STANDING transition match the roster's standing", () => {
    /* NARROWED FROM "the newest transition", and the narrowing is the point: a
       mentor change carries no standing, so a record whose most recent account
       row is one would have been checked against a `null` and failed. It is the
       newest row that MOVES the account that has to agree with where the account
       now is. Excluded by its map entry rather than by its name, so the next
       standing-neutral kind is covered by the same line. */
    let checked = 0;
    for (const teen of DEMO_TEENS) {
      const rows = standingRows(teen.id);
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
      /* STANDING ROWS ONLY. A mentor change accounts for no gap in a record — it
         is a staffing fact — so counting it here would let a paused record pass
         this test with nothing that explains the pause. */
      if (!standingRows(teen.id).length) unexplained.push(teen.id);
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

  it("gives all five transitions distinct copy", () => {
    const labels = Object.values(ACCOUNT_CHANGE_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
    /* ═══ THE RULE WAS NEVER "STARTS WITH ACCOUNT" ═══
       It was `/^Account /` because all four kinds were account lifecycle
       changes, and it was standing in for the actual rule: no label describes
       the TEEN's state. "Mentor changed" satisfies that and fails the prefix, so
       the assertion is restated as what it was always checking — each label
       names the thing that changed, and none of them names a person or a state
       a person could be in. */
    for (const l of labels) expect(l).toMatch(/^(Account|Mentor) /);
    for (const l of labels)
      expect(l.toLowerCase()).not.toMatch(/\bteen\b|\binactive\b|\bdormant\b/);
  });

  it("always states a reason on a lifecycle change, and never restates the title", () => {
    // "Account closed · Account closed at the family's request" spent the
    // sub-line repeating the row's own heading. The reason has to add the thing
    // only it knows.
    //
    // A MENTOR CHANGE IS EXEMPT AND ITS OWN TEST COVERS IT: its sub-line spends
    // that slot on the two names, which is the content, and line 2 does not wrap
    // — so requiring a reason here would require dropping one of the names.
    for (const teen of DEMO_TEENS)
      for (const e of standingRows(teen.id)) {
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

describe("a mentor change names two real mentors, and only two", () => {
  const rows = () =>
    DEMO_TEENS.flatMap((t) =>
      accountRows(t.id)
        .filter((e) => e.accountChange === "mentor_change")
        .map((e) => ({ teen: t, e }))
    );

  it("exists on the roster at all", () => {
    // A green result over an empty set proves nothing, and this variant is one
    // record — so if the fixture stops resolving, every claim below would pass
    // vacuously.
    expect(rows()).toHaveLength(1);
  });

  it("carries both names, derived from the roster", () => {
    for (const { teen, e } of rows()) {
      expect(e.mentorChange, `${e.id} has no pair`).toBeDefined();
      // THE INCOMING MENTOR IS THE ONE THE PAGE SHOWS AT THE TOP. A row naming
      // anyone else would contradict the record it sits on.
      expect(e.mentorChange!.to).toBe(mentorName(teen.mentorId));
      // The outgoing one has to be a mentor the roster lists as past — not just
      // "some other name", which is what an authored fixture would allow.
      const past = (teen.pastMentors ?? []).map((p) => mentorName(p.mentorId));
      expect(past, `${e.id}: ${e.mentorChange!.from} is not a past mentor`).toContain(
        e.mentorChange!.from
      );
      // And the two halves must differ, or the row reports a change that isn't.
      expect(e.mentorChange!.from).not.toBe(e.mentorChange!.to);
      // NEITHER HALF MAY BE THE EM-DASH `mentorName` returns for an unknown id.
      // That is how t13 and t15 would render if they carried this event.
      expect(e.mentorChange!.from).not.toBe("—");
      expect(e.mentorChange!.to).not.toBe("—");
    }
  });

  it("puts the pair where the reason goes, and carries no reason", () => {
    // The row's sub-line holds the names OR a reason, never both — line 2 does
    // not wrap and its last element truncates.
    for (const { e } of rows()) expect(e.result).toBe("");
  });

  it("gives the pair to no other row", () => {
    /* ═══ AN HONEST NOTE ON WHAT THIS CANNOT CATCH ═══
       Making the builder resolve a pair for EVERY account row — dropping the
       `c.to === "mentor_change"` condition — passes all fifteen of these tests,
       and it is not a gap in the assertion. It is unobservable on the fixtures:
       `mentorPairFor` needs a `pastMentors[0]` whose name resolves, and no record
       carrying a paused / activated / deactivated / closed row has one. Five
       teens have past mentors and none of them is in `ACCOUNT_CHANGES` except
       t12, whose only row IS the mentor change.
       So the leak would need a fixture that does not exist, and the way to make
       this catchable would be to give a paused teen a past mentor purely to
       satisfy a test — inventing roster data to observe a guard. Named instead:
       four of five mutations on this variant were caught, and the fifth is dead
       by fixture rather than by assertion. */
    for (const teen of DEMO_TEENS)
      for (const e of timeline(teen.id))
        if (e.accountChange !== "mentor_change")
          expect(e.mentorChange, `${e.id} is ${e.type} and carries a pair`).toBeUndefined();
  });

  it("sits inside the mentorship, after it started", () => {
    // A reassignment dated before the teen joined is not a reassignment.
    const DAY = 86_400_000;
    for (const { teen, e } of rows()) {
      const joinedAt = NOW - teen.joinedDaysAgo * DAY;
      expect(e.occurredAt).toBeGreaterThan(joinedAt);
      expect(e.occurredAt).toBeLessThanOrEqual(NOW);
    }
  });

  it("does not make the record explain a standing it never changed", () => {
    // THE HOLE THIS CLOSES. `accountRows` counting a mentor change would let a
    // paused record pass "explains every non-active record" on the strength of a
    // row that says nothing about the pause.
    for (const { teen, e } of rows()) {
      expect(STANDING_AFTER[e.accountChange!]).toBeNull();
      // t12 is active, so this is also the record that proves a standing-neutral
      // row can be the newest one without contradicting the roster.
      expect(defaultMenteeStatus(teen)).toBe("active");
    }
  });
});
