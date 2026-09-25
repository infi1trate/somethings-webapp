// ═══════════════════════════════════════════════════════════════════════════
// THE SUGGESTED SCHEDULE — TWO PARTS, NOT ONE LIST (Today Phase D)
//
// ═══ WHY THE OBLIGATION IS NOT A BLOCK ═══
//
// The authored table looks like a linear schedule and is not. "Escalation
// Management & General Clinical Oversight — always happening during online
// hours" spans 5–10 PM and OVERLAPS four other rows. Treated as a block it
// breaks every rule the others follow: two things would be "now" at once, and
// dim-the-past would grey out an obligation that is still running.
//
// So the model has a BLOCK SEQUENCE — ordered, non-overlapping, dimmable,
// now-markable — and an OBLIGATION, which is none of those things. The renderer
// keeps them apart and the data makes it impossible to confuse them: an
// obligation has no place in `blocks[]` and there is nowhere to put one.
//
// ═══ WHERE THIS DATA CAME FROM, AND WHAT IS AUTHORED VS DERIVED ═══
//
// Phase 0 searched the codebase: no schedule existed anywhere, in any shape.
// The only source is the reference mock's static table, so every label below is
// TRANSCRIBED FROM IT and marked `NEEDS-COPY-NICOLE` like any other invented
// string — nobody has written these for the product.
//
// TWO THINGS ARE DERIVED RATHER THAN READ, and both are flagged at their site:
// the Friday variant is TRUNCATED in the source image after 3:30–4:00 PM, and
// Friday's obligation window is not stated at all.
//
// ═══ MINUTES FROM MIDNIGHT, IN THE SCHEDULE'S OWN TIMEZONE ═══
//
// Not `Date`s: a schedule is a daily shape, not a set of instants, and storing
// instants would mean regenerating them per day and getting DST wrong twice a
// year. The caller converts `now` into this timezone's wall clock once — see
// `scheduleNowFor` — and everything downstream is integer comparison.

import type { DestinationId } from "@/lib/ia/destinations";

/** ═══ AUTHORED EST, AND NOT LOCALISED TO THE DEVICE (D.6) ═══
 *  The source table is written in Eastern time and the product has no
 *  per-supervisor timezone yet — that is Meg's, and named as an open item. So
 *  the schedule is read in this zone for everyone, and the zone is rendered in
 *  the module header so a reader in another one is not silently misled. */
export const SCHEDULE_TZ = "America/New_York";

const PM = (h: number, m = 0) => (h % 12) * 60 + 720 + m;

export interface ScheduleBlock {
  /** Minutes from midnight in `SCHEDULE_TZ`. */
  start: number;
  end: number;
  /** NEEDS-COPY-NICOLE on every one. A block may hold more than one task: the
   *  source merges the 1:00–3:00 PM cell across two rows, which is a two-hour
   *  block with two labels rather than two blocks sharing a time. */
  labels: string[];
  /** ═══ ONLY WHERE THE MAPPING IS CLEAN (D.7) ═══
   *  `null` is the common case and is deliberate: "where no clean mapping
   *  exists, no CTA — do not invent one". See `BLOCK_DESTINATIONS` below for
   *  the reasoning per block. */
  destination: DestinationId | null;
}

export interface StandingObligation {
  /** NEEDS-COPY-NICOLE. */
  label: string;
  /** NEEDS-COPY-NICOLE. The clause that makes it standing rather than timed. */
  note: string;
  start: number;
  end: number;
}

export interface ScheduleVariant {
  id: "weekday" | "friday";
  /** NEEDS-COPY-NICOLE. */
  label: string;
  /** The shift's own bounds — wider than the blocks, which do not tile it. */
  shift: { start: number; end: number };
  blocks: ScheduleBlock[];
  obligation: StandingObligation;
  /** True when the source table does not cover the whole shift. Rendered as a
   *  stated gap rather than as silence — see the Friday note. */
  truncatedAfter: number | null;
}

/** ═══ BLOCK → DESTINATION, AND WHY MOST ARE NULL (D.7) ═══
 *
 *  A CTA here promises that pressing it takes you to the work the block names.
 *  That is only true where the destination holds exactly that work.
 *
 *   · Diagnostic Coding & Billing Compliance → `care-reviews`. CLEAN: that
 *     destination IS the billing-code review queue; its rows carry the codes.
 *   · Clinical Documentation & Quality → null. Documentation is split across
 *     the record's Care tab and the escalation note; no one destination holds
 *     it, and picking either would send a reader to half of it.
 *   · Referral & Continuity of Care → null. No surface holds referrals.
 *   · Lead Mentor Supervision & Development → null. `Team` is a directory, not
 *     a queue of supervision work.
 *   · Mentor Performance Escalations → null, AND THIS ONE IS A TRAP. It reads
 *     like `Escalations`, which holds TEEN safety escalations — a different
 *     thing entirely. The mentor-practice surface that would have held this was
 *     removed (corrective pass §2.1), so there is nowhere correct to point.
 *   · People Operations → null. No surface.
 *   · Buffer / wrap-up → null. Not work.
 *
 *  ONE OF SEVEN. Stated plainly because a mapping table that mapped everything
 *  would mean the mapping was guessed. */
const CARE = "care-reviews" as const;

/** NEEDS-COPY-NICOLE on the label and the note. */
const OVERSIGHT = {
  label: "Escalation Management & General Clinical Oversight",
  note: "Always happening during online hours",
} as const;

export const WEEKDAY: ScheduleVariant = {
  id: "weekday",
  /* NEEDS-COPY-NICOLE */
  label: "Monday – Thursday",
  shift: { start: PM(1), end: PM(10) },
  blocks: [
    {
      start: PM(1),
      end: PM(3),
      /* NEEDS-COPY-NICOLE ×2. The source merges this time cell across two
         rows — one block, two tasks. */
      labels: [
        "Diagnostic Coding & Billing Compliance",
        "Clinical Documentation & Quality",
      ],
      destination: CARE,
    },
    { start: PM(3), end: PM(4), labels: ["Referral & Continuity of Care"], destination: null },
    { start: PM(4), end: PM(4, 30), labels: ["Lead Mentor Supervision & Development"], destination: null },
    { start: PM(4, 30), end: PM(5), labels: ["Mentor Performance Escalations"], destination: null },
    { start: PM(5), end: PM(5, 30), labels: ["People Operations"], destination: null },
    /* ═══ A FOUR-HOUR GAP IS IN THE SOURCE, AND IT IS REAL ═══
       Nothing sequential is scheduled between 5:30 and 9:30 PM. That is not a
       transcription error: the standing obligation runs 5–10 PM and IS the
       schedule for that stretch. The renderer says so rather than showing a
       hole — see `scheduleStateFor`'s `obligation-only` state. */
    { start: PM(9, 30), end: PM(10), labels: ["Buffer / wrap-up"], destination: null },
  ],
  obligation: { ...OVERSIGHT, start: PM(5), end: PM(10) },
  truncatedAfter: null,
};

export const FRIDAY: ScheduleVariant = {
  id: "friday",
  /* NEEDS-COPY-NICOLE */
  label: "Friday",
  shift: { start: PM(2), end: PM(7) },
  blocks: [
    { start: PM(2), end: PM(3), labels: ["Diagnostic Coding & Billing Compliance"], destination: CARE },
    { start: PM(3), end: PM(3, 30), labels: ["Referral & Continuity of Care"], destination: null },
    { start: PM(3, 30), end: PM(4), labels: ["Clinical Documentation & Quality"], destination: null },
  ],
  /* ═══ DERIVED, NOT AUTHORED — FLAGGED ═══
     The source states no Friday obligation window. Its own label says "always
     happening during online hours", and the weekday table puts online hours at
     5–10 PM; Friday's shift ends at 7. So this is the INTERSECTION of the
     stated online window with Friday's stated shift, which is a reading of the
     obligation's own words rather than a number invented for it. Flagged here
     and in the report; if the authored Friday table says otherwise, this is the
     line to correct. */
  obligation: { ...OVERSIGHT, start: PM(5), end: PM(7) },
  /* ═══ THE SOURCE IMAGE IS CUT OFF AFTER 3:30–4:00 PM ═══
     Friday runs to 7 PM and the table stops at 4. Those three hours are NOT
     modelled as a block, because nothing is known about them — inventing a
     label would be exactly the fabrication the standing constraints forbid.
     The renderer states the gap instead of leaving silence. */
  truncatedAfter: PM(4),
};

/** Which variant applies on a given weekday. Saturday and Sunday have no
 *  authored shift; the caller renders the out-of-shift line for them. */
export function variantForWeekday(weekday: number): ScheduleVariant | null {
  if (weekday >= 1 && weekday <= 4) return WEEKDAY; // Mon–Thu
  if (weekday === 5) return FRIDAY;
  return null;
}

export interface ScheduleNow {
  /** Minutes from midnight in `SCHEDULE_TZ`. */
  minutes: number;
  /** 0 = Sunday. */
  weekday: number;
  /** e.g. "EDT" — computed, so it is correct on both sides of the DST change. */
  zoneAbbrev: string;
}

/** ═══ THE WALL CLOCK IN THE SCHEDULE'S ZONE, FROM AN INSTANT ═══
 *  PURE GIVEN `now`, which is what lets the caller pass a frozen clock and lets
 *  every state below be tested without mocking Date. `Intl` with an EXPLICIT
 *  `timeZone` is not device localisation — the zone is the schedule's, whoever
 *  is reading. */
export function scheduleNowFor(now: number): ScheduleNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: Math.max(0, DAYS.indexOf(get("weekday"))),
    zoneAbbrev: get("timeZoneName"),
  };
}

export type BlockPosition = "past" | "now" | "later";

export function positionOf(block: ScheduleBlock, minutes: number): BlockPosition {
  if (minutes >= block.end) return "past";
  if (minutes >= block.start) return "now";
  return "later";
}

export type ScheduleState =
  /** `now` falls inside a block. */
  | { kind: "in-block"; variant: ScheduleVariant; block: ScheduleBlock }
  /** In the shift, but no block covers it — the obligation is the schedule. */
  | { kind: "obligation-only"; variant: ScheduleVariant }
  /** In the shift, past the point the source table describes (Friday). */
  | { kind: "unspecified"; variant: ScheduleVariant }
  /** Outside the shift, or a day with no shift at all. */
  | { kind: "out-of-shift"; variant: ScheduleVariant | null; next: ScheduleVariant };

/** The next day that has a shift, for the out-of-shift line. */
function nextShift(weekday: number): ScheduleVariant {
  for (let i = 1; i <= 7; i += 1) {
    const v = variantForWeekday((weekday + i) % 7);
    if (v) return v;
  }
  return WEEKDAY;
}

export function scheduleStateFor(at: ScheduleNow): ScheduleState {
  const variant = variantForWeekday(at.weekday);
  if (!variant || at.minutes < variant.shift.start || at.minutes >= variant.shift.end) {
    return { kind: "out-of-shift", variant, next: nextShift(at.weekday) };
  }
  const block = variant.blocks.find((b) => positionOf(b, at.minutes) === "now");
  if (block) return { kind: "in-block", variant, block };
  if (variant.truncatedAfter != null && at.minutes >= variant.truncatedAfter) {
    return { kind: "unspecified", variant };
  }
  return { kind: "obligation-only", variant };
}

export function obligationActive(v: ScheduleVariant, minutes: number): boolean {
  return minutes >= v.obligation.start && minutes < v.obligation.end;
}

/** "1:00 PM". Formatted from the integer rather than a `Date`, so it cannot
 *  pick up the device zone on its way to the screen. */
export function clockLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/* ═══ WHAT THIS MODULE IS THE INTENDED FUTURE HOST FOR, AND IS NOT NOW ═══
   The 12-hour post-escalation follow-up obligation. It is time-bound and this
   is the right-shaped module to hold it — a second standing obligation beside
   the oversight one. NOT APPROVED FOR THIS PHASE, pending Dr. Nissan. Noted
   here so the next person adds it as an obligation rather than as a block. */
