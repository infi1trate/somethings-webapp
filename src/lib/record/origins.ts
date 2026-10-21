// WHERE THE READER CAME FROM — the back link's destination.
//
// THE MECHANISM, and why it is a stamped param rather than history.
//
// The back link used to be derived from the SUBJECT's role: a teen sent you to
// Mentees, anyone else to Team. That is right about half the time and confidently
// wrong the rest — a supervisor who reached a teen from their mentor's record got
// "Mentees", a list they were never on.
//
// Three mechanisms were available and two of them do not work here:
//
//   · ROUTER HISTORY. Next's App Router exposes no history stack. `router.back()`
//     can go back, but nothing can ask it WHERE back is, so the link cannot be
//     LABELLED. A back link whose text is a guess is worse than a fixed one.
//   · document.referrer. Empty on client-side navigation, which is every
//     navigation in this app. It only populates on a full page load, so it would
//     work exactly when it is least needed.
//   · A STAMPED PARAM — this. Every link into a record already goes through ONE
//     helper (`recordHrefFor`), so the origin can be attached at the source, by
//     the surface that actually knows it.
//
// WHY THE PARAM WINS BEYOND JUST WORKING: it survives a refresh and a shared URL,
// it is inspectable in the address bar, it needs no effect and no client state,
// and it renders identically on the server and the client. sessionStorage would
// have met the first requirement and none of the others.
//
// THE FALLBACK IS THE OLD BEHAVIOUR. No `from` (a bookmark, a pasted link, a
// call site that has not been stamped) falls back to the subject's list type. So
// this is strictly additive: nothing regresses, and each stamped call site is an
// independent improvement.

/** A known origin. `record:<id>` is handled separately — see `originFor`. */
interface OriginDef {
  href: string;
  /** TODO-COPY. The destination, named as the reader would name it. */
  label: string;
}

/** THE REGISTRY. Ids are short and stable because they travel in URLs; renaming
 *  one breaks links people have already shared, so treat them as a contract. */
const ORIGINS: Record<string, OriginDef> = {
  mentees: { href: "/app/mentees", label: "Mentees" },
  /* pack v3.0: a supervisor reaches a record from a Monitoring entry whose
     teen has no conversation here. */
  monitoring: { href: "/app/monitoring", label: "Monitoring" },
  team: { href: "/app/team", label: "Team" },
  teens: { href: "/admin/users?tab=teens", label: "Teens" },
  mentors: { href: "/admin/users", label: "Mentors" },
  supervision: { href: "/app/team", label: "Team" },
};

export interface BackTarget {
  href: string;
  label: string;
}

/** Resolve a `from` param to a back target.
 *
 *  `record:<id>` resolves against the caller-supplied name resolver, so this
 *  module needs no dependency on the person fixtures — which also keeps it usable
 *  from a server component later.
 *
 *  Returns null for an unknown or absent value, and the caller falls back. An
 *  unrecognised id is treated as absent rather than as an error: a stale link
 *  from an older build should degrade to the default, not break the header. */
export function originFor(
  from: string | string[] | null | undefined,
  nameOf: (id: string) => string | null
): BackTarget | null {
  if (typeof from !== "string" || from.length === 0) return null;

  // THE INTERESTING CASE: arrived from another person's record. "Back to Brandon
  // Forant" is the whole reason this exists — a supervisor who opened a teen from
  // their mentor's Mentees table is one click from where they were, named.
  if (from.startsWith("record:")) {
    const id = from.slice("record:".length);
    const name = nameOf(id);
    if (!name) return null;
    return { href: `/admin/person/${id}`, label: name };
  }

  return ORIGINS[from] ?? null;
}

/** Stamp an origin onto a record href. Used by `recordHrefFor`. */
export function withOrigin(href: string, from?: string): string {
  if (!from) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(from)}`;
}

/** The origin id for "I came from this person's record". */
export function recordOrigin(id: string): string {
  return `record:${id}`;
}
