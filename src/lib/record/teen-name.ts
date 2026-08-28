// STANDING RULE 6 LIVES HERE. "Teens are FIRST NAME ONLY, everywhere, always.
// Never render a teen surname."
//
// This module exists because the rule had NO enforcement point. The display
// idiom across every record surface was `teen.goesBy ?? teen.name`, and that is
// not surname suppression — `goesBy` is a NICKNAME, set on three of twenty-six
// fixture teens, and the fallback `name` is a FULL name. So `/app/mentees` listed
// "Caleb Ortiz", "Elena Duarte", "Jonah Whitfield"; the rows that looked
// compliant ("Pat", "Marc", "Jordy") were compliant by accident. See
// design-system-gaps.md row 254.
//
// THE FIX IS A CHOKEPOINT, NOT A SWEEP. A sweep fixes today's call sites; the
// next one written from the old idiom re-breaks the rule silently. Everything
// that renders a teen's name goes through `teenDisplayName` instead, so there is
// one function to read, one to test, and one to change.
//
// DELIBERATELY STRUCTURAL TYPING (not `DemoTeen`): the same name has to be
// resolved from the fixture row, from a `FixtureSubject`, and from the thin row
// shapes the tables build. One helper for all of them beats three that drift.
//
// NOT FOR STAFF. Mentors, leads and supervisors keep their full names — rule 6
// is about minors. `subjectDisplayName` is the role-aware entry point when the
// person could be either.

/** The naming facts a teen carries. `firstName` is authoritative; `name` is the
 *  legal name and is NEVER the thing rendered (see the one sanctioned exception
 *  in `people-demo.ts`'s DemoTeen doc). */
export interface TeenNameParts {
  name: string;
  /** Teen-facing nickname when they go by something other than their first
   *  name — "Pat" for Patricia, "Jordy" for Jordan. */
  goesBy?: string;
  /** The authoritative first name. Optional ONLY so the fallback below can
   *  cover a fixture author who forgets it; every DEMO_TEENS row sets it. */
  firstName?: string;
}

/** The first whitespace-delimited token of a full name.
 *
 *  THE LAST-RESORT FALLBACK, not the primary path. It is here so that a teen row
 *  missing `firstName` still cannot leak a surname — the failure mode of the
 *  forgotten field is a slightly wrong first name ("Mary" for "Mary Anne"), never
 *  a rule-6 violation. That is why `firstName` exists at all: string surgery
 *  guesses, and a compound first name is exactly the case it guesses wrong. */
export function firstNameOf(name: string): string {
  const [first] = name.trim().split(/\s+/);
  // `|| name` covers the blank-name case (a lone token of whitespace splits to
  // ""), and keeps this honest if `noUncheckedIndexedAccess` is ever turned on.
  return first || name;
}

/** WHAT A TEEN IS CALLED ON SCREEN. The only sanctioned way to render one.
 *
 *  `goesBy` wins because a teen who goes by "Pat" is called Pat by everyone,
 *  including the mentor reading the row. Otherwise the recorded first name, and
 *  only then the stripped token. */
export function teenDisplayName(teen: TeenNameParts): string {
  return teen.goesBy ?? teen.firstName ?? firstNameOf(teen.name);
}

/** The avatar letterform for a teen: ONE letter, from the displayed name.
 *
 *  Never `initials(name)`. Two-letter initials on a teen ("CO") reconstruct the
 *  surname's first letter, which is the same fact the rule is suppressing, and it
 *  would disagree with the record header — which has always shown a single
 *  letter. Staff avatars are untouched and keep both initials. */
export function teenAvatarInitial(teen: TeenNameParts): string {
  return teenDisplayName(teen).charAt(0).toUpperCase();
}
