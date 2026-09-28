// ═══════════════════════════════════════════════════════════════════════════
// THE PINNED SIMULATED CLOCK (Today rebuild, Phase J.1)
//
// ═══ WHY THIS EXISTS ═══
//
// Most states this surface has to demonstrate are THE SAME DATA AT A DIFFERENT
// TIME: the schedule's now-marker, the gap state, out-of-shift, the
// Monday–Thursday versus Friday variant, and every greeting case. J.1.2 states
// the arithmetic — with a clock control the fixture set is six data scenarios
// plus a time; without one, every time-dependent state needs its own scenario
// and the set roughly triples.
//
// ═══ WHY IT IS NOT THE CLOCK OVERRIDE WE ALREADY HAD ═══
//
// `monitoringData(...).clockOverride` exists and Today already honours it. It
// is not enough, for two measured reasons:
//
//  1 · IT IS SCENARIO-BOUND. It is a field on a monitoring scenario, so pinning
//      an hour means switching the queue's data too. J.1.1 asks for a control
//      "independent of the selected scenario", which is the opposite property.
//  2 · IT ONLY MOVES THE HOUR. Every producer is `atHour(now, 17)`, which keeps
//      TODAY'S DATE — so the Friday schedule variant is reachable only on a
//      real Friday, and the Monday–Thursday obligation overlap only on a real
//      weekday. Half of J.4's table is unreachable four sevenths of the time.
//
// So this pins a FULL INSTANT — weekday and time — and outranks the scenario's
// own override. It is dev-only and never consulted on a real user's session:
// the store field defaults to null and only the dev bar writes it.
//
// ═══ WHY NAMED POSITIONS RATHER THAN A DATE PICKER ═══
//
// A `datetime-local` input is more general and worse here. J.4 specifies its
// positions in terms the CALENDAR does not carry — "inside a sequential block,
// Mon–Thu", "inside the standing obligation while a block is also running" —
// and working out which date satisfies those is the fiddly part a fixture
// should encapsulate rather than delegate to whoever opens the bar. The pack
// makes the same point against itself: it warns that the reference Figma's
// "Monday October 11, 2026" is a Sunday.
// THE COST, STATED: an arbitrary instant cannot be pinned from the UI. Anything
// this list does not name needs an entry adding. That is the trade — the named
// list is checkable against J.4 and a free-form picker is not.
//
// ═══ THE ANCHOR WEEK IS FIXED, AND THAT IS THE POINT ═══
//
// Positions resolve against a KNOWN week rather than against "this week", so a
// screenshot taken on a Sunday and one taken on a Wednesday are the same
// screenshot. `DO NOT` hardcode a date string anywhere the UI reads it (J's own
// prohibition) — the UI reads a timestamp and formats it itself, which is why
// `shiftDateLabel` renders the anchor's real weekday rather than a literal.

import { SCHEDULE_TZ } from "@/lib/home/schedule";

/** ═══ THE ANCHOR ═══
 *  Monday 2026-09-28 is a real Monday. Verified rather than asserted: the test
 *  computes the weekday in `SCHEDULE_TZ` and fails if this is not a Monday, so
 *  the same class of error the pack warns about cannot land here silently. */
const ANCHOR_MONDAY_UTC = Date.UTC(2026, 8, 28);

/** Minutes to add to the anchor to land on a given weekday and wall time in
 *  `SCHEDULE_TZ`. Built by probing the zone rather than by assuming an offset,
 *  because September is EDT and a January anchor would be EST — an offset
 *  baked in here would be wrong for half the year. */
function instantAt(dayOffset: number, hour: number, minute: number): number {
  /* Start from the anchor midnight UTC plus the wanted day, then correct by
     whatever the zone's offset turns out to be at that moment. One correction
     pass is enough: the zone offset does not change between a day's midnight
     and its evening except across a DST boundary, and the anchor week has
     none — asserted in the test. */
  const naive = ANCHOR_MONDAY_UTC + dayOffset * 86_400_000 + hour * 3_600_000 + minute * 60_000;
  const seen = new Date(naive);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(seen);
  const seenHour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  /* The naive instant read in the target zone is `seenHour`; we wanted `hour`.
     The difference is the zone's offset, in whole hours for this zone. */
  const driftHours = ((hour - seenHour + 36) % 24) - 12;
  return naive + driftHours * 3_600_000;
}

export interface DevClockPosition {
  key: string;
  /** NEEDS-COPY-NICOLE — dev-only copy, but the marker is the protocol and this
   *  file does not get an exemption for being a harness. */
  label: string;
  at: number;
  /** Which J.4 row this serves, so the list can be checked against the pack. */
  serves: string;
}

/* Weekday offsets from the anchor Monday. */
const MON = 0;
const WED = 2;
const FRI = 4;

/**
 * J.4's table, one entry per row.
 *
 * The Monday–Thursday block sequence runs 1:00 PM – 10:00 PM with the standing
 * oversight obligation over 5:00 PM – 10:00 PM. Friday's sequence is shorter
 * and its obligation runs 5:00 PM – 7:00 PM.
 */
export const DEV_CLOCK_POSITIONS: DevClockPosition[] = [
  {
    key: "mon-block",
    /* NEEDS-COPY-NICOLE */
    label: "Mon 2:00 PM — inside a block",
    at: instantAt(MON, 14, 0),
    serves: "D.2, H.3.b — now-marker on the current block",
  },
  {
    /* ═══ THE HIGHEST-VALUE POSITION IN THE TABLE (J.4's own words) ═══
       5:15 PM Monday is inside `People Operations` (5:00–5:30 PM) AND inside
       the 5:00–10:00 PM oversight obligation. It is the only state that
       demonstrates why the schedule is two parts rather than one list, and
       FRIDAY CAN NEVER PRODUCE IT — on Friday the obligation follows the
       sequence and overlaps nothing, which the test asserts so this note
       cannot go stale.
       IT WAS 6:00 PM AND THAT WAS WRONG. MEASURED: `scheduleStateFor` returns
       `obligation-only` at 6:00 PM, because nothing sequential is scheduled
       between 5:30 and 9:30 PM — the four-hour gap the source really contains.
       A fixture named "overlap" that showed no overlap would have been the
       highest-value position in the pack demonstrating nothing. H.4 names the
       two genuine overlaps and this is the first of them; the second is
       `Buffer / wrap-up` at 9:30–10:00 PM. */
    key: "mon-overlap",
    /* NEEDS-COPY-NICOLE */
    label: "Mon 5:15 PM — block + obligation overlap",
    at: instantAt(MON, 17, 15),
    serves: "D, H.4 — the two-part split, both active at once",
  },
  {
    /* THE OTHER SIDE OF THE SAME SPLIT: the obligation running with NO
       sequential block, which is the four-hour gap between 5:30 and 9:30 PM.
       J.4 does not list it, and it is the state that proves the obligation
       strip is not merely a block by another name — it is still running when
       the sequence has nothing. */
    key: "mon-obligation-only",
    /* NEEDS-COPY-NICOLE */
    label: "Mon 6:00 PM — obligation only, no block",
    at: instantAt(MON, 18, 0),
    serves: "D — obligation runs while the sequence is empty",
  },
  {
    key: "fri-block",
    /* NEEDS-COPY-NICOLE */
    label: "Fri 2:30 PM — Friday variant",
    at: instantAt(FRI, 14, 30),
    serves: "D.1, H.4 — the Friday block sequence",
  },
  {
    /* Friday's authored table stops at 4:00 PM (`truncatedAfter`), so a Friday
       late-afternoon instant is inside shift hours and inside NO block. That is
       the honest-gap state, and it is a real data gap owned by Meg rather than
       a fixture contrivance. */
    key: "fri-gap",
    /* NEEDS-COPY-NICOLE */
    label: "Fri 4:30 PM — in shift, in no block",
    at: instantAt(FRI, 16, 30),
    serves: "D.5 — the gap state",
  },
  {
    key: "pre-shift",
    /* NEEDS-COPY-NICOLE */
    label: "Wed 9:00 AM — before shift",
    at: instantAt(WED, 9, 0),
    serves: "D.5 — out-of-shift, before",
  },
  {
    key: "post-shift",
    /* NEEDS-COPY-NICOLE */
    label: "Wed 11:00 PM — after shift",
    at: instantAt(WED, 23, 0),
    serves: "D.5 — out-of-shift, after",
  },
  /* ═══ THE THREE GREETING POSITIONS (G.1) ═══
     Option (b) shipped, so the greeting asserts no time of day and these three
     should read identically. That is the claim, and a claim needs the three
     instants to check it at — which is why they are here even though the
     greeting is time-neutral. */
  {
    key: "greet-1pm",
    /* NEEDS-COPY-NICOLE */
    label: "Wed 1:00 PM — greeting",
    at: instantAt(WED, 13, 0),
    serves: "G.1 — greeting at shift start",
  },
  {
    key: "greet-6pm",
    /* NEEDS-COPY-NICOLE */
    label: "Wed 6:00 PM — greeting",
    at: instantAt(WED, 18, 0),
    serves: "G.1 — greeting mid-shift",
  },
  {
    key: "greet-930pm",
    /* NEEDS-COPY-NICOLE */
    label: "Wed 9:30 PM — greeting",
    at: instantAt(WED, 21, 30),
    serves: "G.1 — greeting at shift end",
  },
];

export function devClockByKey(key: string | null | undefined): DevClockPosition | null {
  if (!key) return null;
  return DEV_CLOCK_POSITIONS.find((p) => p.key === key) ?? null;
}

/** The instant a pinned key names, or null for "run on the real clock". */
export function devClockAt(key: string | null | undefined): number | null {
  return devClockByKey(key)?.at ?? null;
}
