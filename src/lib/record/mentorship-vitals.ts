// ═══════════════════════════════════════════════════════════════════════════
// THE MENTORSHIP'S VITALS AND THE TEEN'S IDENTITY (Care Hero v7.0)
//
// What the Care hero states about the PAIR (the mentor's anchor) and about
// the teen (the identity strip, both lenses). FACTS ONLY — counts and dates
// derived from the fixtures; no characterisation of the relationship, AI or
// otherwise (a blocked constant).
//
// ═══ FIXTURE ADDITIONS (Phase 0's gaps) ═══ `DemoTeen` carried neither an age
// nor a check-in count. Both live in `VITALS` below, one row per record teen,
// rather than being threaded through the 1,500-line people fixture:
//   age          years, for the identity strip
//   checkIns30d  completed check-ins in the last 30 days ("this window")
// TODO-DATA: every value. A teen without a row reads "—" for age and omits the
// check-in fragment; nothing is invented at render.

import { DEMO_PEOPLE, DEMO_TEENS } from "@/lib/record/people-demo";
import { relLength } from "@/lib/record/mentees-demo";
import { LIVE_ID } from "@/lib/record/subject";
import { teenDisplayName } from "@/lib/record/teen-name";

const VITALS: Record<string, { age: number; checkIns30d: number }> = {
  t1: { age: 15, checkIns30d: 9 }, t2: { age: 16, checkIns30d: 11 }, t3: { age: 14, checkIns30d: 4 }, t4: { age: 17, checkIns30d: 8 },
  t5: { age: 15, checkIns30d: 12 }, t6: { age: 16, checkIns30d: 7 }, t7: { age: 13, checkIns30d: 10 }, t8: { age: 16, checkIns30d: 2 },
  t9: { age: 15, checkIns30d: 6 }, t10: { age: 17, checkIns30d: 9 }, t11: { age: 14, checkIns30d: 13 }, t12: { age: 16, checkIns30d: 8 },
  t13: { age: 15, checkIns30d: 14 }, t14: { age: 16, checkIns30d: 6 }, t15: { age: 15, checkIns30d: 12 }, t16: { age: 14, checkIns30d: 5 },
  t17: { age: 16, checkIns30d: 9 }, t18: { age: 16, checkIns30d: 15 }, t19: { age: 17, checkIns30d: 7 }, t20: { age: 15, checkIns30d: 10 },
  t21: { age: 16, checkIns30d: 11 }, t22: { age: 14, checkIns30d: 4 }, t23: { age: 17, checkIns30d: 8 }, t24: { age: 15, checkIns30d: 6 },
  t25: { age: 16, checkIns30d: 9 }, t26: { age: 15, checkIns30d: 7 },
};

export interface TeenIdentity {
  name: string;
  age: number | null;
  pronouns: string | null;
}

export function teenIdentity(teenId: string): TeenIdentity | null {
  const t = DEMO_TEENS.find((x) => x.id === teenId);
  if (!t) return null;
  return { name: teenDisplayName(t), age: VITALS[teenId]?.age ?? null, pronouns: t.pronouns ?? null };
}

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
const tenureAt = (d: number) => relLength(-d * DAY, 0);

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
    tickedToday: days > 1 && length !== tenureAt(days - 1),
    lastSpoke: sides.length ? ago(Math.min(...sides)) : null,
    checkIns30d: VITALS[teenId]?.checkIns30d ?? null,
    supervisor: lead ? { id: lead.id, name: lead.name } : null,
  };
}
