// TEEN NAMING, ASSERTED OVER EVERY TEEN IN THE FIXTURE.
//
// These tests used to assert standing rule 6 — "Teens are FIRST NAME ONLY,
// everywhere, always. Never render a teen surname." That rule was RETIRED by
// product-owner decision on 2026-08-28: mentees display their full name, the
// same as staff. See design-system-gaps.md rows 254 (enforcement) and 284
// (reversal).
//
// The suite is kept and inverted rather than deleted, for the reason it was
// written in the first place. The original bug was not that a rule was broken;
// it was that the display idiom LOOKED correct — `teen.goesBy ?? teen.name`,
// with three of twenty-six teens carrying a `goesBy`, so any spot check of the
// fixture found agreeable rows. Whichever way the naming decision goes, it needs
// to be proven over every teen on every commit, including ones a future edit
// adds, rather than by reading a few rows.

import { describe, expect, it } from "vitest";
import { DEMO_TEENS } from "@/lib/record/people-demo";
import {
  firstNameOf,
  teenAvatarInitial,
  teenDisplayName,
} from "@/lib/record/teen-name";
import { resolveSubject, subjectDisplayName } from "@/lib/record/subject";

describe("teenDisplayName", () => {
  it("returns the full legal name for every teen", () => {
    for (const teen of DEMO_TEENS) {
      expect(
        teenDisplayName(teen),
        `${teen.id} does not render its full name`
      ).toBe(teen.name);
    }
  });

  it("includes the surname for every teen who has one", () => {
    // The instruction, stated directly: a mentee shows their last name. Asserted
    // over the fixture rather than on a sample, because the failure this suite
    // exists to catch is precisely a naming path that looks right on the rows
    // someone happens to read.
    for (const teen of DEMO_TEENS) {
      const surname = teen.name.trim().split(/\s+/).slice(1).join(" ");
      if (!surname) continue; // a mononym has none to show
      expect(
        teenDisplayName(teen),
        `${teen.id} (${teen.name}) is missing its surname`
      ).toContain(surname);
    }
  });

  it("ignores goesBy and firstName — the legal name always wins", () => {
    // DOCUMENTS A DELIBERATE LOSS. `goesBy` used to win, and three fixture teens
    // have one ("Pat" for Patricia, "Jordy" for Jordan). It renders nowhere in a
    // list, header or sentence now: `goesBy ?? name` would have left those three
    // showing a nickname with no surname, which is the thing being fixed. The
    // nickname survives on the record's "Goes by" row. If preferred names should
    // win again, this test is the one that should fail first.
    const base = { name: "Patricia Johnson", firstName: "Patricia" };
    expect(teenDisplayName({ ...base, goesBy: "Pat" })).toBe("Patricia Johnson");
    expect(teenDisplayName(base)).toBe("Patricia Johnson");
    expect(teenDisplayName({ name: "Patricia Johnson" })).toBe(
      "Patricia Johnson"
    );
  });

  it("returns a compound first name intact", () => {
    // `firstNameOf` guesses wrong on these ("Mary" for "Mary Anne"), which is
    // why it was never the primary path. Rendering the recorded name cannot.
    expect(teenDisplayName({ name: "Mary Anne Whitfield" })).toBe(
      "Mary Anne Whitfield"
    );
  });

  it("gives the avatar TWO letters, matching staff", () => {
    // One letter existed only to keep the surname's initial off screen. With the
    // rule retired, a lone "C" beside a header reading "Caleb Ortiz" would read
    // as a bug.
    expect(teenAvatarInitial({ name: "Caleb Ortiz", firstName: "Caleb" })).toBe(
      "CO"
    );
    for (const teen of DEMO_TEENS) {
      const expected = teen.name.trim().split(/\s+/).length > 1 ? 2 : 1;
      expect(
        teenAvatarInitial(teen),
        `${teen.id} (${teen.name}) initial`
      ).toHaveLength(expected);
    }
  });
});

describe("firstNameOf", () => {
  it("takes the first whitespace-delimited token", () => {
    // No longer on the display path, still exported for the places that want a
    // first name alone (a greeting, a composed sentence).
    expect(firstNameOf("Jonah Whitfield")).toBe("Jonah");
    expect(firstNameOf("Simone Ba")).toBe("Simone");
    expect(firstNameOf("  Elena   Duarte ")).toBe("Elena");
    expect(firstNameOf("Prince")).toBe("Prince");
  });
});

describe("the fixture itself", () => {
  it("records a firstName for every teen", () => {
    for (const teen of DEMO_TEENS) {
      expect(teen.firstName, `${teen.id} has no firstName`).toBeTruthy();
    }
  });

  it("records a firstName that is actually part of the legal name", () => {
    // Catches a typo'd or pasted-wrong field. `goesBy` is deliberately NOT
    // checked this way — a nickname ("Pat" for Patricia) need not be a prefix.
    for (const teen of DEMO_TEENS) {
      expect(
        teen.name.toLowerCase(),
        `${teen.id}: firstName "${teen.firstName}" is not in "${teen.name}"`
      ).toContain(teen.firstName.toLowerCase());
    }
  });
});

describe("subjectDisplayName", () => {
  it("gives every teen subject the same full name as teenDisplayName", () => {
    for (const teen of DEMO_TEENS) {
      const subject = resolveSubject(teen.id);
      expect(subject, `${teen.id} did not resolve`).not.toBeNull();
      if (!subject || subject.kind !== "fixture") continue;
      expect(subjectDisplayName(subject)).toBe(teenDisplayName(teen));
      expect(subjectDisplayName(subject)).toBe(teen.name);
    }
  });

  it("keeps the full name for staff", () => {
    // Unchanged by the reversal, and the reason it is still worth asserting:
    // staff were never affected either way, so teens and staff now resolve to
    // the same shape and a future divergence should show up here.
    const subject = resolveSubject("m1");
    expect(subject?.kind).toBe("fixture");
    if (subject?.kind === "fixture") {
      expect(subjectDisplayName(subject)).toBe("John Smith");
    }
  });
});
