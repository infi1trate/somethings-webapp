// ═══ MONITORING'S NAMED CONSTANTS — INCLUDING THE ONES NOBODY HAS ANSWERED ═══
//
// Every value this surface depends on lives here, resolved or not. An unresolved
// one is a named export with its owner in the comment and a value of `null`
// wherever null is expressible — NOT a plausible number inlined at the call site,
// because a plausible number is indistinguishable from a decided one six weeks
// later. Where a null cannot be expressed (a duration a clock has to count),
// the constant carries the value AND a `_UNRESOLVED` note saying what about it
// is still open.
//
// Nothing in this file is implemented twice. If two durations are the same
// number they still get one constant each, because they are answerable
// separately and will diverge the moment one of them is answered.

import { TIER_ORDER, tierOf } from "@/lib/record/risk-taxonomy";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// ── Risk flags ──────────────────────────────────────────────────────────────

/** ═══ UNBLOCKED — DERIVED FROM THE PLAYBOOK'S OWN GROUPING (Phase 4) ═══
 *
 *  It was `{}` and blocked on Dr. Nissan, with the note that ranking real output
 *  is a clinical judgment while "the tier taxonomy was a severity assertion this
 *  page could not compute". Both halves of that still hold, and the resolution is
 *  that the judgment ALREADY EXISTS and this file was not reading it:
 *  `lib/record/risk-taxonomy.ts` groups the playbook's 21 categories into three
 *  tiers, reviewed and owned, and `TIER_ORDER` states their order.
 *
 *  ═══ WHY THIS IS NOT THE THING PHASE 4 REMOVED ═══
 *
 *  What was removed was a tier ASSIGNED TO AN INDIVIDUAL FLAG by this codebase,
 *  from no upstream signal. What this reads is a tier assigned to a CATEGORY by
 *  the playbook. The flag's category comes from the classifier, which is real
 *  output; the category's grouping comes from a clinical document. Nothing here
 *  decides which tier anything is in.
 *
 *  IT COULD ONLY BE DONE NOW. Ranking is keyed on category ids, and the seed
 *  emitted free text ("Low mood") until this phase adopted the playbook ids — so
 *  the table would have matched nothing and step 2 would have stayed a no-op with
 *  a lookup in front of it, which is worse than an honest empty.
 *
 *  ═══ WITHIN-GROUP ORDER IS FLAT, AND THAT IS THE OPEN PART ═══
 *
 *  Every category in a tier shares one rank, so step 2 separates the three groups
 *  and orders WITHIN a group not at all — falling through to steps 3-5 (repeat
 *  pattern, no mentor reply, age) exactly as it did before. That refinement is
 *  non-blocking and stays with Dr. Nissan: six ways to order six imminent
 *  categories is a clinical question, and guessing one would be the same mistake
 *  at a smaller scale.
 *
 *  A CATEGORY OUTSIDE THE PLAYBOOK RANKS LAST, not first. An unrecognised string
 *  is either a classifier change or a data fault, and neither is a reason to
 *  promote it above a reviewed imminent category. `unknownCategories` is how it
 *  gets surfaced. */
export function flagCategoryRank(category: string | null): number {
  if (category == null) return UNRANKED;
  const tier = tierOf(category);
  if (tier == null || tier === "unassigned") return UNRANKED;
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? UNRANKED : i;
}

/** Past the last real tier, so an unknown sorts after every known one. Derived
 *  rather than written as `3`, so adding a tier cannot silently make it rank
 *  equal to the new last one. */
const UNRANKED = TIER_ORDER.length;

/** ═══ BLOCKED · Meg — AND THE DEFAULT IS "NONE", DELIBERATELY ═══
 *
 *  A review SLA for flags may legitimately not exist. While it is null, flags
 *  carry AGE and nothing on this page derives a deadline or a breach from a
 *  flag — which is the whole point of Phase 1: breach treatment now belongs to
 *  escalation obligations alone.
 *
 *  `TaskItem.slaDeadline` is still populated upstream by `lib/tasks/sla.ts` for
 *  every task type including the three flag types. It is IGNORED here. See
 *  `event.ts` for the read that deliberately does not happen. */
export const FLAG_REVIEW_SLA: number | null = null;

/** ═══ BLOCKED · Meg ═══
 *
 *  The window inside which repeat flags on one conversation count as a pattern
 *  (comparator step 3).
 *
 *  WHAT SHIPS WHILE IT IS NULL, stated because it is not a no-op: the step reads
 *  `conversationFlagCount`, which the seed computes across the conversation's
 *  whole open set, so the test is currently "two or more flags EVER" rather than
 *  "two or more within the window". That is a real signal already in the data
 *  and a strictly wider test than the intended one, so it will only ever narrow
 *  when the window arrives. Chosen over making the step inert because dropping a
 *  signal that exists is a worse default than applying it too widely — and the
 *  difference is written down here rather than discovered later. */
export const FLAG_PATTERN_WINDOW: number | null = null;

/** The count at which a conversation is a pattern rather than an incident. Not
 *  blocked — it is the pack's own "two or more". */
export const FLAG_PATTERN_MIN = 2;

// ── Escalations ─────────────────────────────────────────────────────────────

/** REAL, AND THE ONLY PUBLISHED RESPONSE SLA ON THE SURFACE. Five minutes from
 *  trigger to supervisor acknowledgement. This is the clock the UI did not
 *  enforce before this phase. */
export const ESCALATION_ACK_SLA = 5 * MINUTE;

/** ═══ BLOCKED · Dr. Nissan / Meg — THE DURATION IS AGREED, THE START IS NOT ═══
 *
 *  24 hours in both source documents. One counts from the escalation OCCURRING,
 *  the other from the event being FULLY RESOLVED — which are different clocks
 *  for any escalation that runs more than a few hours, and the same shape as the
 *  unresolved billing 48h/72h conflict.
 *
 *  WHAT SHIPS: the duration, plus `ESCALATION_NOTE_CLOCK_START` naming the
 *  choice explicitly so it is one edit and so no reader mistakes it for settled.
 *  "resolved" is taken as the provisional start because a note written before
 *  the escalation ends would have to be rewritten — but that is a guess about
 *  clinical process, not a decision, and it is theirs. */
export const ESCALATION_NOTE_SLA = 24 * HOUR;
export const ESCALATION_NOTE_CLOCK_START_UNRESOLVED = "resolved" as
  | "triggered"
  | "resolved";

/** The other three close-out clocks. 24h each, and each its own constant: the
 *  debrief and the follow-up are different obligations owned by different
 *  people, and one of them will move. */
export const ESCALATION_DEBRIEF_SLA = 24 * HOUR;
export const ESCALATION_TEEN_FOLLOWUP_SLA = 24 * HOUR;
/** ═══ NO PUBLISHED CLOCK ═══ The safety plan is filed to the record; nothing
 *  states when by. Null rather than borrowed from the note's 24h. */
export const ESCALATION_SAFETY_PLAN_SLA: number | null = null;

// ── Coverage ────────────────────────────────────────────────────────────────

/** ═══ BLOCKED · Meg ═══
 *
 *  What counts as having reviewed a conversation. It travels with the coverage
 *  success metric, so it is one decision and not two.
 *
 *  WHAT SHIPS: `"flag-review-or-open"` — reviewing a flag credits its
 *  conversation (the supervisor read the surrounding turns to do the review),
 *  and opening a conversation from the coverage view credits it too. Both are
 *  implemented in one place, `creditsCoverage`, so the rule is one edit. */
export const COVERAGE_CREDIT_RULE_UNRESOLVED = "flag-review-or-open" as
  | "flag-review-or-open"
  | "explicit-mark-only"
  | "flag-review-only";

/** The period coverage is measured against. A shift, because that is the unit
 *  the supervisor is on and the unit the live layer already assumes. NOT blocked
 *  — the pack asks for "progress against a period" and names no other. */
export const COVERAGE_PERIOD = "shift" as const;

// ── Mentor practice ─────────────────────────────────────────────────────────

/** ═══ PUBLISHED IN THE ROLE-ADHERENCE DOC — TRANSCRIBE, DO NOT TRUST THESE ═══
 *
 *  The pack says these five are already published, and the document is not in
 *  this repo. They are implemented as named constants so that when someone reads
 *  the real numbers off the doc it is five edits in one file — but the VALUES
 *  below are provisional and are reported as such. The 24h note SLA is the one
 *  the pack itself states; the online window is the 5.5-hour shift the pack
 *  states; the other three are placeholders shaped like the real thing. */
export const MENTOR_ONLINE_HOURS = { startHour: 15.5, endHour: 21 } as const;
export const MENTOR_ONLINE_HOURS_PROVISIONAL = true;
/** Minutes after the shift opens by which the day's outreach must be sent. */
export const MENTOR_OUTREACH_CUTOFF = 90 * MINUTE;
export const MENTOR_OUTREACH_CUTOFF_PROVISIONAL = true;
/** How long a teen may wait for a reply during the shift. */
export const MENTOR_TEEN_RESPONSE_SLA = 2 * HOUR;
export const MENTOR_TEEN_RESPONSE_SLA_PROVISIONAL = true;
/** How long a lead mentor's message may go unanswered. */
export const MENTOR_LEADERSHIP_RESPONSE_SLA = 24 * HOUR;
export const MENTOR_LEADERSHIP_RESPONSE_SLA_PROVISIONAL = true;
/** Video progress note, 24h — stated by the pack itself. */
export const MENTOR_NOTE_SLA = 24 * HOUR;

// ── Live layer ──────────────────────────────────────────────────────────────

/** ═══ BLOCKED · Dr. Nissan / Meg · DEFAULT OFF ═══
 *
 *  A live view of mentor–teen exchanges changes what it feels like to be
 *  supervised and creates a plausible performance effect on mentors. Licensed
 *  clinical oversight is the product's premise, so it is defensible — but the
 *  posture is a clinical and product call, not an engineering one. Built,
 *  inert, and reported as pending. */
export const LIVE_LAYER_ENABLED = false;

/** How many lines the Now band shows before it collapses to a count. Not
 *  blocked — five is the band's own design: it fits one screen line per item
 *  above the queue without becoming a second list, and the overflow count is
 *  what makes the cap safe rather than lossy. */
export const LIVE_BAND_MAX = 5;

export const MONITORING_MS = { MINUTE, HOUR } as const;
