// WHO HOLDS FINAL CLINICAL AUTHORITY, resolved from the staff fixtures rather
// than written into a component.
//
// The Care tab's authority line used to hard-code the name as a string and link
// it to the Team page, which did not list that person. Two consequences: the
// name could drift from the directory without anything noticing, and there was
// no address to write to because there was no record to read one from.
//
// SO THIS LOOKS THE PERSON UP. If the fixture is renamed, the Care tab follows;
// if the fixture is removed, the build breaks here rather than silently
// rendering an empty link. That is the whole reason for the throw below.

import { DEMO_STAFF } from "@/lib/record/people-demo";

/** The staff id of the final clinical decision-maker. One constant, so a second
 *  surface needing the same person cannot pick a different one. */
export const CLINICAL_AUTHORITY_ID = "s-nissan";

function resolve() {
  const person = DEMO_STAFF.find((s) => s.id === CLINICAL_AUTHORITY_ID);
  /** ═══ A MISSING FIXTURE IS A BUILD ERROR, NOT AN EMPTY LINK ═══
   *  This is required compliance copy (PRD P0). Rendering "  is the final
   *  decision-maker…" with a blank name would be worse than not rendering it —
   *  a reader would take it as a sentence about nobody. Fixture data is
   *  compile-time in this app, so failing loudly here surfaces the mistake to
   *  whoever removed the row rather than to a supervisor reading a record. */
  if (!person)
    throw new Error(
      `clinical-authority: no staff fixture with id "${CLINICAL_AUTHORITY_ID}". ` +
        "The Care tab's authority line has no one to name."
    );
  /** THE EMAIL IS ALSO REQUIRED, and for the same reason: the module renders an
   *  Email affordance unconditionally, and a `mailto:` with nothing after it
   *  opens a blank compose window addressed to no one. An authority with no
   *  address on file would need the affordance to disappear, which is a product
   *  decision nobody has made — so it is an error until someone makes it. */
  if (!person.email)
    throw new Error(
      `clinical-authority: staff fixture "${CLINICAL_AUTHORITY_ID}" has no email. ` +
        "The Care tab's Email affordance has nowhere to point."
    );
  return {
    name: person.name,
    email: person.email,
    /** ═══ TEAM, NOT A STAFF PROFILE ═══
     *  A staff self-profile route does not exist — deferred, and recorded as
     *  design-system-gaps row 314. The directory is where a reader can actually
     *  find this person today, and it now lists them. */
    teamHref: "/app/team" as const,
  };
}

export const CLINICAL_AUTHORITY = resolve();
