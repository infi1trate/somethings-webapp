// ═══════════════════════════════════════════════════════════════════════════
// THE MENTORSHIP'S VITALS AND THE TEEN'S IDENTITY (Care Hero v7.0)
//
// What the Care hero states about the PAIR (the mentor's anchor). FACTS ONLY — counts and dates
// derived from the fixtures; no characterisation of the relationship, AI or
// otherwise (a blocked constant).
//
// ═══ FIXTURE ADDITION (Care Hero v7.0) ═══ `DemoTeen` carried no check-in
// count; `CHECK_INS_30D` holds one per record teen (completed check-ins in the
// last 30 days, "this window"). TODO-DATA: every value. A teen without a row
// omits the fragment; nothing is invented at render.
// The identity strip's age and `teenIdentity` were deleted with the strip
// (pack v8.0, Supersession 2).

import { DEMO_PEOPLE, DEMO_TEENS } from "@/lib/record/people-demo";
import { relLength } from "@/lib/record/mentees-demo";
import { LIVE_ID } from "@/lib/record/subject";

const CHECK_INS_30D: Record<string, number> = {
  t1: 9, t2: 11, t3: 4, t4: 8,
  t5: 12, t6: 7, t7: 10, t8: 2,
  t9: 6, t10: 9, t11: 13, t12: 8,
  t13: 14, t14: 6, t15: 12, t16: 5,
  t17: 9, t18: 15, t19: 7, t20: 10,
  t21: 11, t22: 4, t23: 8, t24: 6,
  t25: 9, t26: 7,
};

export interface MentorshipVitals {
  days: number;
  /** "8 months together". */
  tenure: string;
  /** The tenure's count ticked over today ("8 months" → "9 months"). */
  tickedToday: boolean;
  /** "2d ago", from either side's last message. */
  lastSpoke: string | null;
  checkIns30d: number | null;
  supervisor: { id: string; name: string } | null;
}

/** The tenure at `d` days, in the MENTEE TABLE'S OWN PHRASING (`relLength`)
 *  — two roundings of one fact is how "5 months" and "171 days" end up on two
 *  surfaces (chat-page's note on the retired Matched row). */
const DAY = 86_400_000;
export const tenureAt = (d: number) => relLength(-d * DAY, 0);

/** Did the tenure's phrase change today? ("13 days" → "2 weeks"). */
export const tickedOver = (d: number) => d > 1 && tenureAt(d) !== tenureAt(d - 1);

const ago = (days: number) => (days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`);

export function mentorshipVitals(teenId: string): MentorshipVitals | null {
  const t = DEMO_TEENS.find((x) => x.id === teenId);
  if (!t) return null;
  const days = Math.max(0, t.matchedDaysAgo ?? t.joinedDaysAgo);
  const length = tenureAt(days);
  /* TODO-COPY */
  const tenure = `${length} together`;
  const sides = [t.mentorLastSentDaysAgo, t.menteeLastSentDaysAgo].filter((x): x is number => typeof x === "number");
  /* Supervised by: the mentor's lead (the store-backed mentor reports to
     Brandy — people-demo's supervision edges). */
  const mentor = t.mentorId === LIVE_ID ? null : DEMO_PEOPLE.find((p) => p.id === t.mentorId);
  const leadId = t.mentorId === LIVE_ID ? "s-brandy" : mentor?.leadId;
  const lead = leadId ? DEMO_PEOPLE.find((p) => p.id === leadId) : undefined;
  return {
    days,
    tenure,
    tickedToday: tickedOver(days),
    lastSpoke: sides.length ? ago(Math.min(...sides)) : null,
    checkIns30d: CHECK_INS_30D[teenId] ?? null,
    supervisor: lead ? { id: lead.id, name: lead.name } : null,
  };
}
