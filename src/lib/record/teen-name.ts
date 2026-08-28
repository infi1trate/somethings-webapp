// ═══ STANDING RULE 6 IS RETIRED (product-owner decision, 2026-08-28) ═══
//
// The rule read: "Teens are FIRST NAME ONLY, everywhere, always. Never render a
// teen surname." It was restated verbatim in every phase brief and enforced from
// this module. It no longer applies: mentees display their full name, the same
// as staff. See design-system-gaps.md row 284.
//
// WHY THIS MODULE STILL EXISTS. It was built as a CHOKEPOINT rather than a
// sweep — "a sweep fixes today's call sites; the next one written from the old
// idiom re-breaks the rule silently" — and that property is what made the
// reversal a one-function change across 47 call sites in 17 files. The
// chokepoint is worth keeping for exactly the same reason it was worth building:
// how a teen is named on screen is one decision in one place, whichever way the
// decision goes.
//
// WHAT THE RULE USED TO PREVENT, kept as the record of what changed. The display
// idiom across every record surface was `teen.goesBy ?? teen.name`, which is not
// surname suppression — `goesBy` is a NICKNAME, set on three of twenty-six
// fixture teens, and the fallback `name` is a FULL name. So `/app/mentees` listed
// "Caleb Ortiz", "Elena Duarte", "Jonah Whitfield"; the rows that looked
// compliant ("Pat", "Marc", "Jordy") were compliant by accident. Rule 6 replaced
// that with first-name-only; this reversal returns the full name deliberately
// rather than by accident. Gap row 254 recorded the enforcement; row 284 records
// the reversal.
//
// DELIBERATELY STRUCTURAL TYPING (not `DemoTeen`): the same name has to be
// resolved from the fixture row, from a `FixtureSubject`, and from the thin row
// shapes the tables build. One helper for all of them beats three that drift.
//
// STAFF WERE NEVER AFFECTED. Mentors, leads and supervisors always kept their
// full names; `subjectDisplayName` is the role-aware entry point when the person
// could be either. Teens and staff now resolve to the same shape, which is the
// point of the reversal.

/** The naming facts a teen carries. `name` is the full legal name and is now
 *  WHAT RENDERS (rule 6 retired, 2026-08-28). `firstName` is still authoritative
 *  for anywhere a first name alone is wanted, and is still what
 *  `firstNameOf` guards. */
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

/** WHAT A TEEN IS CALLED ON SCREEN — the full legal name, since rule 6 was
 *  retired on 2026-08-28.
 *
 *  `goesBy` NO LONGER WINS, and that is a real consequence worth stating rather
 *  than burying: three fixture teens have a nickname ("Pat" for Patricia, "Jordy"
 *  for Jordan) and it now renders nowhere in a list, header or sentence. The
 *  instruction was that every mentee display their last name, and `goesBy ?? name`
 *  would have left those three showing a nickname with no surname. The nickname is
 *  still on the record — `/admin/person/[id]` renders a "Goes by" row — so the
 *  fact is not lost, only demoted. If preferred names should win again, this is
 *  the one line to change: `teen.goesBy ?? teen.name`. */
export function teenDisplayName(teen: TeenNameParts): string {
  return teen.name;
}

/** The avatar letterform for a teen: TWO letters, matching staff.
 *
 *  It was ONE letter for a single reason — two-letter initials ("CO")
 *  reconstruct the surname's first letter, which was exactly the fact rule 6
 *  suppressed. With the rule retired that reason is gone, and a teen avatar
 *  showing "CO" beside a header reading "Caleb Ortiz" is consistent where a lone
 *  "C" would now look like a bug.
 *
 *  DUPLICATED LOGIC, FLAGGED: `roster.tsx:828` exports an identical `initials`.
 *  Not imported here because a `lib/` module should not depend on a component
 *  file; the two should converge into `lib/` when something else touches either.
 *  Gap row 284. */
export function teenAvatarInitial(teen: TeenNameParts): string {
  return teenDisplayName(teen)
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
