// ═══════════════════════════════════════════════════════════════════════════
// ENGAGED DAYS — DEFINED, IMPLEMENTED, AND BLOCKED ON A LONGER LOG
//
// ═══ THE DEFINITION, ANSWERED ═══
//
// Asked four times across three packs and now answered: "engaged days is the
// days a teen sent a message." That is §4.1's option (a) — days on which the
// TEEN sent at least one message — chosen over (b) both parties and (c) any
// recorded activity.
//
// It is written down here rather than left in a pack because the question
// outlived three attempts to answer it, and the thing that kept getting lost
// was the definition, not the code.
//
// ═══ AND IT IS STILL NOT RENDERABLE — FOR A DIFFERENT REASON THAN REPORTED ═══
//
// I previously reported this blocked because `mentorStats` is a hard-coded
// literal with no message log behind it. HALF OF THAT WAS WRONG, and the
// correction matters because it changes what would unblock it.
//
// THE LOG EXISTS AND IT REACHES THESE TEENS. `ConversationMessage` carries
// `sender: "teen" | "mentor"` and `at: number`, and `buildConversation` produces
// one per task item — including every billing item, which is this surface's
// whole population. The FIELDS are exactly what option (a) needs.
//
// WHAT IT CANNOT SUPPLY IS A WINDOW. Measured over six billing items in
// `heavy-caseload`:
//
//     task-14   18 msgs   7 teen   span 1.63h   distinct teen days = 1
//     task-15   19 msgs  12 teen   span 1.68h   distinct teen days = 1
//     task-16   21 msgs  14 teen   span 1.81h   distinct teen days = 1
//     task-17   22 msgs  14 teen   span 1.87h   distinct teen days = 1
//     task-113  19 msgs  12 teen   span 1.65h   distinct teen days = 1
//     task-114  19 msgs  12 teen   span 1.70h   distinct teen days = 1
//
// Every conversation spans under two hours at the default page — the generator's
// inter-message gaps are 30–60 seconds and 4–11 minutes.
//
// AND ASKING FOR MORE DOES NOT HELP, which is the half that makes this a data
// blocker rather than a paging one. `buildConversation` takes a `beforeCount`
// and its own note says more produces "the same messages plus older ones", so
// the default page is not the ceiling. Measured on one item at 15 / 50 / 200 /
// 500 / 2000:
//
//     15 ->  18 msgs  1.6h  truncatedStart = true
//     50 ->  53 msgs  4.5h  truncatedStart = FALSE
//   2000 ->  53 msgs  4.5h  truncatedStart = FALSE
//
// It saturates at 53 messages and 4.5 hours, and flips `truncatedStart` to
// false — the fixture stating that this is the whole conversation. No page size
// reaches the 48 hours a day-count needs, so the fix is a longer fixture rather
// than a bigger request.
//
// So the honest count over the available data is **1**, on every row, for every
// teen, permanently.
//
// A CONSTANT RENDERED AS A MEASUREMENT IS THE FAILURE §4.1 NAMED: "it cannot be
// computed from the name, and inventing a rule puts an authoritative-looking
// number on a clinical record." Shipping `1 engaged day` beside `140d` would be
// worse than shipping nothing, because nothing is visibly absent and a 1 is
// not.
//
// ═══ SO THE BLOCKER IS MECHANICAL, NOT A COMMENT ═══
//
// `FLAG_REVIEW_SLA` is this codebase's precedent: null, blocked on Meg, and
// "while it is null nothing on the page may derive a flag deadline". The same
// shape here — `engagedDays` returns `null` when the source cannot support the
// count, and null is not renderable. The arithmetic is real and tested, so the
// day a longer log lands this is one call site away rather than a definition
// that has to be asked for a fifth time.

import type { ConversationMessage } from "@/lib/tasks/conversation";

/** ═══ THE WINDOW A DAY-COUNT NEEDS BEFORE IT MEANS ANYTHING ═══
 *
 *  A count of distinct days is only a measurement if the source could in
 *  principle have produced more than one. 48 hours is the floor because it is
 *  the smallest span that can contain two calendar days however the clock
 *  happens to fall — a 23-hour log can straddle midnight and report 2, which
 *  would be a number driven by the time of day rather than by engagement.
 *
 *  DELIBERATELY NOT `CARE_REVIEW_RESPONSE_MS`, which is also 48h. That constant
 *  is the overdue threshold and is read by the chip and the filter; this is a
 *  data-sufficiency floor on a different concept, and `care-overdue.ts` already
 *  argues at length why two concepts that share a number must not share a
 *  constant. */
export const ENGAGED_DAYS_MIN_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The teen's local-calendar day for an instant. `toDateString` rather than a
 *  UTC slice: "days the teen sent a message" is a human claim about their days,
 *  and a UTC bucket would split an evening conversation across two of them for
 *  anyone west of Greenwich. */
const dayKey = (at: number) => new Date(at).toDateString();

/** ═══ OPTION (a), EXACTLY AS DEFINED ═══
 *
 *  Days on which the teen sent at least one message. Mentor messages are
 *  counted by nothing here — that is what makes this (a) and not (b), and the
 *  tradeoff Brandon accepted is recorded in the pack: (a) measures one side of
 *  the mentorship and is easier to inflate than (b), and it is also the one a
 *  reader can verify from a transcript without arithmetic.
 *
 *  RETURNS `null` WHEN THE SOURCE CANNOT SUPPORT THE COUNT, which is every
 *  caller on this surface today. Not `0` — zero is a measurement, and "we
 *  cannot measure this" is not. A caller that renders a `0` for an absent
 *  figure is the defect `summaryStats` already guards against on the record
 *  header, in the other direction.
 */
export function engagedDays(
  messages: readonly ConversationMessage[],
  /** Injected so a test can pin it; never read from the clock in production
   *  paths, because the answer must not change between two renders. */
  nowMs: number = Date.now()
): number | null {
  if (messages.length === 0) return null;

  /* THE WINDOW IS THE LOG'S OWN SPAN, not the span up to `now`. A conversation
     that ended a week ago still covers however many days it covered; what
     disqualifies it is being too SHORT, not being old. `nowMs` is accepted for
     callers that want to bound the window and is deliberately unused in the
     sufficiency test — see the note on `ENGAGED_DAYS_MIN_WINDOW_MS`. */
  void nowMs;
  let first = Infinity;
  let last = -Infinity;
  const days = new Set<string>();
  for (const m of messages) {
    if (m.at < first) first = m.at;
    if (m.at > last) last = m.at;
    if (m.sender === "teen") days.add(dayKey(m.at));
  }

  if (last - first < ENGAGED_DAYS_MIN_WINDOW_MS) return null;
  return days.size;
}

/** Whether a message set could support the count at all. Exported so a caller
 *  can explain an absence rather than silently omitting a column — and so the
 *  reason a figure is missing is one call rather than a re-derivation. */
export function canCountEngagedDays(
  messages: readonly ConversationMessage[]
): boolean {
  if (messages.length === 0) return false;
  let first = Infinity;
  let last = -Infinity;
  for (const m of messages) {
    if (m.at < first) first = m.at;
    if (m.at > last) last = m.at;
  }
  return last - first >= ENGAGED_DAYS_MIN_WINDOW_MS;
}
