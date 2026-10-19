// ═══════════════════════════════════════════════════════════════════════════
// THE SUPPORT LIST'S TIMESTAMP (SUP-3)
//
// The Figma row reads `243d`, and a day count that size is not something a
// person can act on (Nielsen H2). The pack's ladder:
//
//   < 60 minutes  →  Nm        < 7 days   →  Nd
//   < 24 hours    →  Nh        < 1 year   →  MMM D      else  →  MMM YYYY
//
// ONE ADDITION, FLAGGED: under a minute reads `now`, not `0m`. The ladder has
// no rung below a minute, and `0m` reads as a broken counter; `now` is what
// the chat list already says (`conversation-row.tsx`). Future instants (clock
// skew) read `now` too rather than a negative count.
//
// The absolute instant always travels with it, as `title` and `<time
// datetime>`, so the short form never stands alone.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const ABSOLUTE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function supportStamp(at: number, now: number): string {
  const d = now - at;
  if (d < MIN) return "now";
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  if (d < YEAR) return MONTH_DAY.format(at);
  return MONTH_YEAR.format(at);
}

/** `Oct 16, 2026, 1:04 PM` — the `title`. */
export function supportStampAbsolute(at: number): string {
  return ABSOLUTE.format(at);
}

// ═══ A MESSAGE'S TIME (SUP-4) ═══ Under the last bubble of a run. A clock
// time, because a conversation is read as a sequence: today's messages say
// only the time, yesterday's say so, older ones carry the date (and the year
// once it is not this one).
const CLOCK = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY_CLOCK = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const dayStart = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function supportMessageTime(at: number, now: number): string {
  const days = Math.round((dayStart(now) - dayStart(at)) / DAY);
  if (days <= 0) return CLOCK.format(at);
  /* TODO-COPY */
  if (days === 1) return `Yesterday, ${CLOCK.format(at)}`;
  if (new Date(at).getFullYear() === new Date(now).getFullYear()) return DAY_CLOCK.format(at);
  return ABSOLUTE.format(at);
}
