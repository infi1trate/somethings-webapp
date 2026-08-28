// STANDING RULE 6, ASSERTED OVER EVERY TEEN IN THE FIXTURE.
//
// "Teens are FIRST NAME ONLY, everywhere, always. Never render a teen surname."
//
// The rule was violated for the whole life of the record surfaces and nobody
// noticed, because the violating idiom (`teen.goesBy ?? teen.name`) LOOKED like
// it handled the case — three of twenty-six teens have a `goesBy`, so a spot
// check of the fixture found compliant rows. A grep proves the rule once, on the
// day someone runs it. These prove it on every commit, over every teen, including
// the ones a future edit adds. See design-system-gaps.md row 254.

import { describe, expect, it } from "vitest";
import { DEMO_TEENS } from "@/lib/record/people-demo";
import {
  firstNameOf,
  teenAvatarInitial,
  teenDisplayName,
} from "@/lib/record/teen-name";
import { resolveSubject, subjectDisplayName } from "@/lib/record/subject";

/** The surname as the fixture records it — everything after the first token.
 *  Empty for a mononym, which is why the assertions below skip those. */
const surnameOf = (name: string) =>
  name.trim().split(/\s+/).slice(1).join(" ");

describe("teenDisplayName", () => {
  it("never returns a name containing the teen's surname", () => {
    for (const teen of DEMO_TEENS) {
      const surname = surnameOf(teen.name);
      if (!surname) continue;
      expect(
        teenDisplayName(teen).toLowerCase(),
        `${teen.id} (${teen.name}) leaked a surname`
      ).not.toContain(surname.toLowerCase());
    }
  });

  it("returns a single token for every teen", () => {
    // The whole rule, stated the shortest way: one word, no exceptions. A
    // display name that grew a space grew something after the first name.
    for (const teen of DEMO_TEENS) {
      expect(teenDisplayName(teen), `${teen.id} is not one token`).not.toMatch(
        /\s/
      );
    }
  });

  it("prefers goesBy, then firstName, then the stripped token", () => {
    const base = { name: "Patricia Johnson", firstName: "Patricia" };
    expect(teenDisplayName({ ...base, goesBy: "Pat" })).toBe("Pat");
    expect(teenDisplayName(base)).toBe("Patricia");
    expect(teenDisplayName({ name: "Patricia Johnson" })).toBe("Patricia");
  });

  it("cannot leak a surname when firstName is missing", () => {
    // THE FALLBACK'S ONE JOB. A fixture author who forgets `firstName` should
    // get a slightly wrong first name at worst, never a rule-6 violation.
    expect(teenDisplayName({ name: "Mary Anne Whitfield" })).toBe("Mary");
  });

  it("gives the avatar ONE letter, from the displayed name", () => {
    // Two-letter initials ("CO") put the surname's first letter back on screen.
    for (const teen of DEMO_TEENS) {
      expect(teenAvatarInitial(teen)).toHaveLength(1);
    }
    expect(teenAvatarInitial({ name: "Caleb Ortiz", firstName: "Caleb" })).toBe(
      "C"
    );
  });
});

describe("firstNameOf", () => {
  it("takes the first whitespace-delimited token", () => {
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
  it("is first-name-only for every teen subject", () => {
    for (const teen of DEMO_TEENS) {
      const subject = resolveSubject(teen.id);
      expect(subject, `${teen.id} did not resolve`).not.toBeNull();
      if (!subject || subject.kind !== "fixture") continue;
      expect(subjectDisplayName(subject)).toBe(teenDisplayName(teen));
      expect(subjectDisplayName(subject)).not.toMatch(/\s/);
    }
  });

  it("keeps the full name for staff", () => {
    // Rule 6 is about MINORS. A mentor's surname is how colleagues address and
    // find them, and suppressing it would be a different bug.
    const subject = resolveSubject("m1");
    expect(subject?.kind).toBe("fixture");
    if (subject?.kind === "fixture") {
      expect(subjectDisplayName(subject)).toBe("John Smith");
    }
  });
});
