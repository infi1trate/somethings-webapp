// ═══════════════════════════════════════════════════════════════════════════
// THE GREETING, COMPUTED FROM REAL TIME (Phase G.1 option a, Phase L.2)
//
// ═══ WHY IT IS COMPUTED NOW, WHEN IT WAS TIME-NEUTRAL BEFORE ═══
//
// G.1 offered two options and defaulted to (b) — no time word — "if the
// time-word computation would ever render 'morning' during a standard shift
// window". This build shipped (b), and the reasoning recorded at the time was
// that supervisor timezone localisation is unresolved (Meg), so a greeting
// computed from the SCHEDULE's zone would tell a supervisor in California "Good
// evening" at 2pm their time.
//
// L.2 OVERRIDES IT, and the reason is structural rather than a change of mind
// about clocks: the greeting IS the page title now. "Hi there" at 32px Avantt
// Bold is too thin to be a page title — it says nothing about the page. So the
// time word comes back, and the open item stays open.
//
// ═══ THE ZONE IS THE SCHEDULE'S, AND THAT IS A STATED LIMITATION ═══
//
// Computed in `SCHEDULE_TZ`, the same zone the schedule module reads. It is
// correct for a supervisor on Eastern time and wrong by up to three hours for
// one on the west coast — which is the SAME exposure the Suggested Schedule
// already carries, not a new one. Supervisor timezone localisation is Meg's
// open item and this file does not pre-empt it.
//
// ═══ THE BOUNDARIES, AND WHY THEY ARE WHERE THEY ARE ═══
//
// The shift runs 1 PM – 10 PM. The boundaries are chosen so that NO POINT IN
// THAT WINDOW READS "morning", which is G.1.2's own test and what made (b) the
// default:
//
//   05:00–11:59  morning      — entirely before the shift
//   12:00–16:59  afternoon    — covers 1 PM
//   17:00–21:59  evening      — covers 6 PM and 9:30 PM
//   22:00–04:59  late         — the shift's last minute and after
//
// `greeting.test.ts` sweeps every minute of the day and asserts that no instant
// between 1 PM and 10 PM produces the morning string.

import { SCHEDULE_TZ } from "@/lib/home/schedule";

export type GreetingBand = "morning" | "afternoon" | "evening" | "late";

/** NEEDS-COPY-NICOLE, all four. The band's word, without the name — the caller
 *  appends it, because a greeting with no name is a real state (a reader whose
 *  first name has not been captured) rather than a fallback. */
export const GREETING_WORD: Record<GreetingBand, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  late: "Working late",
};

/** The hour in `SCHEDULE_TZ`, 0–23. Pure given `now`, so a pinned clock
 *  produces a deterministic greeting. */
function hourIn(now: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

export function greetingBandFor(now: number): GreetingBand {
  const h = hourIn(now);
  if (h >= 22 || h < 5) return "late";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/**
 * The hero's line. NEEDS-COPY-NICOLE on both shapes.
 *
 * THE NAME IS OPTIONAL AND ITS ABSENCE IS NOT AN ERROR. A supervisor who has
 * not completed the profile draft has no first name on file, and the greeting
 * still has to be a page title — so the band's word stands alone rather than
 * falling back to a generic string that asserts nothing.
 */
export function greetingFor(now: number, firstName?: string | null): string {
  const word = GREETING_WORD[greetingBandFor(now)];
  const name = firstName?.trim();
  /* NEEDS-COPY-NICOLE: {word}, {name} / {word} */
  return name ? `${word}, ${name}` : word;
}
