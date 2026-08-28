// SUBJECT RESOLUTION — who a record is ABOUT.
//
// The record page never had this seam: /admin/mentor is a static route wired
// straight to the store's one mentor draft, and the dev `?subjectRole=` param
// only changed which TABS rendered, never the person. That made Supervision and
// teen records impossible — you cannot show "the mentors Brandy leads" on a
// page that can only ever be Jordan.
//
// Two kinds of subject, deliberately asymmetric because the data is:
//   • "live"  — the store-backed mentor. DEEP: a profile draft, activity feed,
//     review lanes, schedule. This is the one person the prototype models fully.
//   • anyone else — a fixture person (people-demo). THIN: identity, org facts,
//     and relationships, but no draft or activity. Honest to what exists rather
//     than faking depth.
//
// Consumers branch on `kind` and render what the subject actually has.

import { withOrigin } from "@/lib/record/origins";
import { teenDisplayName } from "@/lib/record/teen-name";
import {
  DEMO_PEOPLE,
  DEMO_TEENS,
  roleOf,
  type DemoMentorRow,
  type DemoTeen,
  type PersonRole,
} from "@/lib/record/people-demo";

/** The store-backed mentor's reserved id — the caseload/status override maps
 *  are already keyed by it, so it stays the canonical handle. */
export const LIVE_ID = "live";

export interface LiveSubject {
  kind: "live";
  id: typeof LIVE_ID;
  role: "mentor";
  /** Name/pronouns/photo come from the store at the call site (the fixtures
   *  don't hold them); this is just the handle. */
}

export interface FixtureSubject {
  kind: "fixture";
  id: string;
  role: PersonRole;
  /** The person's FULL name, and for everyone now the thing rendered (rule 6
   *  retired 2026-08-28, gap row 284). Still read through `subjectDisplayName`
   *  rather than directly — not to suppress anything any more, but so that how a
   *  person is named stays one decision in one place. */
  name: string;
  /** Teens only — the authoritative first name, carried up from the fixture. It
   *  existed so the subject could satisfy rule 6 without a second lookup; with
   *  the rule retired (gap row 284) it is no longer on the display path, and is
   *  kept for anywhere a first name alone is wanted. */
  firstName?: string;
  goesBy?: string;
  phone: string;
  email?: string;
  group: string;
  pronouns?: string;
  /** Present only for teens. */
  teen?: DemoTeen;
  /** Present for mentors + staff. */
  person?: DemoMentorRow;
}

export type Subject = LiveSubject | FixtureSubject;

/** Resolve a record's subject by id. Returns null for an unknown id so the
 *  route can render a not-found rather than inventing a person. */
export function resolveSubject(id: string): Subject | null {
  if (id === LIVE_ID) return { kind: "live", id: LIVE_ID, role: "mentor" };

  const person = DEMO_PEOPLE.find((p) => p.id === id);
  if (person) {
    return {
      kind: "fixture",
      id: person.id,
      role: roleOf(person),
      name: person.name,
      goesBy: person.goesBy,
      phone: person.phone,
      email: person.email,
      group: person.group,
      pronouns: person.pronouns,
      person,
    };
  }

  const teen = DEMO_TEENS.find((t) => t.id === id);
  if (teen) {
    return {
      kind: "fixture",
      id: teen.id,
      role: "teen",
      name: teen.name,
      firstName: teen.firstName,
      goesBy: teen.goesBy,
      phone: teen.phone,
      email: teen.email,
      group: teen.group,
      pronouns: teen.pronouns,
      teen,
    };
  }

  return null;
}

/** Where a person's record lives. One place that knows the URL shape.
 *
 *  `from` STAMPS THE ORIGIN so the record's back link can name where the reader
 *  came from instead of guessing from the subject's role (see origins.ts for why
 *  a param and not history). OPTIONAL and additive: every call site that omits it
 *  produces exactly the URL it produced before, and the record falls back to its
 *  old subject-derived back link. Each stamped call site is an independent
 *  improvement rather than part of a migration. */
export function recordHrefFor(id: string, from?: string): string {
  const base = id === LIVE_ID ? "/admin/mentor" : `/admin/person/${id}`;
  return withOrigin(base, from);
}

/** WHAT TO CALL THIS PERSON ON SCREEN. Role-aware, because the two roles have
 *  different rules and the old one-liner (`goesBy ?? name`) applied the staff
 *  rule to everybody.
 *
 *  TEENS AND STAFF NOW RESOLVE THE SAME WAY — the full name. Standing rule 6
 *  ("first name only, always") was retired on 2026-08-28; gap row 284. Teens are
 *  still delegated to the one chokepoint (`teenDisplayName`) so this function and
 *  the tables cannot disagree, which is also what made the reversal a one-line
 *  change rather than a sweep. */
export function subjectDisplayName(s: FixtureSubject): string {
  if (s.role === "teen") return teenDisplayName(s);
  return s.goesBy ?? s.name;
}
