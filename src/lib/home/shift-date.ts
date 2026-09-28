// ═══════════════════════════════════════════════════════════════════════════
// THE DATE IN A DESTINATION'S HEADER (Figma alignment §4.1)
//
// ═══ APPLIED TO BOTH LIST SURFACES, NOT ONE ═══
//
// §4.1 asks for the Care Reviews purpose line to become the date, and requires
// the same grammar on Risk Flags or on neither — "the two list surfaces having
// different header grammars is the kind of drift that accumulates". Both.
//
// WHAT IS LOST, STATED: the purpose sentence. That is defensible on exactly
// these two destinations and nowhere else, because their NAMES already say what
// they are — "Care Reviews" and "Risk Flags" are not ambiguous the way "Today"
// or "Team" would be. Today, Escalations, Mentees and Team keep their purpose
// lines; this is not a change to `PageHeader`'s contract, it is two callers
// passing a different string.
//
// ═══ SAME TIMEZONE DISCIPLINE AS THE SCHEDULE ═══
//
// Read in `SCHEDULE_TZ` through `Intl` with an explicit zone, for the reason
// the schedule module records: supervisor timezone localisation is unresolved
// and belongs to Meg, so the product should not silently assert a device's
// calendar day. A supervisor reading at 11pm Pacific is on the same shift date
// as the schedule beside them.
//
// PURE GIVEN `now`, so a frozen clock renders a fixed date and the string is
// testable without mocking Date.

import { SCHEDULE_TZ } from "@/lib/home/schedule";

/** NEEDS-COPY-NICOLE: Monday October 11, 2026 — the format, not the value. */
export function shiftDateLabel(now: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(new Date(now))
    /* `Intl` gives "Monday, October 11, 2026"; the reference drops the comma
       after the weekday. One replace rather than assembling from parts, so the
       month and weekday names stay `Intl`'s. */
    .replace(/^(\w+), /, "$1 ");
}
