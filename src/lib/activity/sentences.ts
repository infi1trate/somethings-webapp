// ROW SENTENCES AND TIMESTAMPS.
//
// ═══════════════════════════════════════════════════════════════════════════
// SPEC §5.1 AND §5.2 ARE UNAVAILABLE — activity-page-spec.md is not in this
// repository. The grammar below is reconstructed from the examples the phase
// prompts state verbatim, and nothing beyond them is invented:
//
//   A3 step 7  ACTIVITY is first person   — "You closed Maya's escalation."
//   A3 step 7  ACTION is a past-tense record of raising, never imperative —
//              "A billing review opened for Jordan."
//   A6         grouped ACTIVITY           — "You closed 7 risk flags in Maya's
//              conversation."
//   A6         grouped and degraded       — "Lydia closed risk flags in Maya's
//              conversation."
//
// From those four, three rules fall out and are implemented here:
//   1. VOICE FOLLOWS THE ACTOR, not the alert type. "You" when the viewer did it;
//      the actor's first name when a colleague did; an agentless construction
//      when the system did ("A billing review opened") because "Somethings opened
//      a billing review" credits a person-shaped agent to a cron job.
//   2. EVERY SENTENCE IS PAST TENSE AND DECLARATIVE. No imperatives anywhere —
//      an imperative ("Review Jordan's billing code") invites an inline resolve
//      control, and this surface deliberately has none. It is a ledger.
//   3. THE TEEN IS POSSESSIVE, NOT A DESTINATION, where the object belongs to
//      them ("Maya's escalation"), and a destination where it does not ("a
//      billing review opened FOR Jordan" — the review is the org's process, not
//      the teen's possession).
//
// Anything §5.1 specifies beyond these four examples is missing here. Flagged.
// ═══════════════════════════════════════════════════════════════════════════
//
// NO CELEBRATION AND NO EXCLAMATION (standing rule 5). A completion row states the
// completion: "You closed Maya's escalation." Not "Nice work" and not a full stop
// with a flourish. Operational vocabulary is correct on this surface — escalation,
// risk flag, billing code are the words the work uses.
//
// TEENS ARE FIRST NAME ONLY (standing rule 6). Every teen string here arrives from
// `teenFirstName`, which can only return a first name because the fixtures contain
// no surnames at all.

import { SYSTEM_ACTOR_ID, type ActivityEventType } from "@/lib/activity/events";

/** The noun a row is about, per event type. Singular; the grouped builder
 *  pluralises. TODO-COPY on every string. */
const OBJECT_NOUN: Record<ActivityEventType, string> = {
  ESCALATION_RAISED: "escalation",
  ESCALATION_CLOSED: "escalation",
  ESCALATION_OVERDUE: "escalation",
  RISK_FLAG_RAISED: "risk flag",
  RISK_FLAG_CLOSED: "risk flag",
  RISK_FLAG_OVERDUE: "risk flag",
  BILLING_REVIEW_OPENED: "billing review",
  BILLING_REVIEW_COMPLETE: "billing review",
  BILLING_REVIEW_OVERDUE: "billing review",
  PRESENTATION_REVIEW_COMPLETE: "presentation review",
  SURVEY_COMPLETED: "survey",
  TEEN_MATCHED: "match",
  TEEN_PAUSED: "mentorship",
  TEEN_DEACTIVATED: "mentorship",
};

/** Past-tense verb per event type, for the actor-led constructions. */
const VERB: Record<ActivityEventType, string> = {
  ESCALATION_RAISED: "raised",
  ESCALATION_CLOSED: "closed",
  ESCALATION_OVERDUE: "went overdue",
  RISK_FLAG_RAISED: "raised",
  RISK_FLAG_CLOSED: "closed",
  RISK_FLAG_OVERDUE: "went overdue",
  BILLING_REVIEW_OPENED: "opened",
  BILLING_REVIEW_COMPLETE: "completed",
  BILLING_REVIEW_OVERDUE: "went overdue",
  PRESENTATION_REVIEW_COMPLETE: "completed",
  SURVEY_COMPLETED: "completed",
  TEEN_MATCHED: "matched",
  TEEN_PAUSED: "paused",
  TEEN_DEACTIVATED: "ended",
};

/** Possessive form. ALWAYS 's, including after a final s — "Marcus's", not
 *  "Marcus'".
 *
 *  Caught in review: the bare-apostrophe form rendered "a risk flag in Marcus'
 *  conversation", which reads as a typo on a surface that is otherwise carefully
 *  written. Chicago style takes 's on singular nouns regardless of the final
 *  letter, and every name on this surface is a singular first name. */
function possessive(name: string): string {
  return `${name}'s`;
}

/** "an escalation", "a billing review", "a risk flag".
 *
 *  The agentless construction hard-coded "A" before the noun, which read
 *  "A escalation opened for Maya." — latent until A9 routed every ACTION row
 *  through that branch, because the only nouns reaching it before were "billing
 *  review" and "risk flag". Vowel test on the noun, which is enough for a closed
 *  set of five nouns and does not pretend to handle "an hour". */
function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

export interface SentenceInput {
  eventType: ActivityEventType;
  /** Resolved per viewer — never read off the event (rule 8). */
  actorId: string;
  viewerId: string;
  /** First name only. */
  teenName: string;
  /** First name only; "Somethings" for the system actor. */
  actorName: string;
  /** > 1 renders the coalesced form (A6). */
  count?: number;
  /** True when A5 has degraded this row: no count, no payload, and the group
   *  reads without a number (A6's privacy note — a count is clinical signal that
   *  coalescing manufactures out of individually-degraded rows). */
  degraded?: boolean;
  /** Risk-flag rows are about a CONVERSATION, which changes the preposition. */
  onConversation?: boolean;
  /** ═══ §5.1: ACTION ROWS ARE PAST-TENSE RECORD VOICE, NEVER FIRST PERSON ═══
   *
   *  A9 item 2. The builder's rule 1 above is "voice follows the actor", and for
   *  ACTIVITY rows that is right. For an ACTION row it is not: an action row is
   *  open work, and the spec's own example is agentless —
   *  "An escalation opened for Maya.", not "You raised Maya's escalation."
   *
   *  WHY THE ALERT TYPE AND NOT THE EVENT TYPE decides this: the same
   *  ESCALATION_RAISED row is an action to the supervisor and a notification to
   *  the teen's mentor, and only the first takes record voice. Passed in as a flag
   *  rather than read here, because resolution is the query's job (rule 8). */
  recordVoice?: boolean;
  /** The billing code, PRESENT ONLY WHEN THE QUERY GRANTED FULL DETAIL.
   *
   *  A9 item 3. Renders as a trailing clause: "You completed Ava's billing review
   *  — H0038." Absent on a degraded row, because the query omits the payload it
   *  would have come from — rule 12 decides, not this function. */
  billingCode?: string;
}

/** Sentinel for a coalesced group with more than one actor — see `mixedActors`. */
export const MIXED_ACTOR_ID = "__mixed__";

/** THE ROW SENTENCE. One function, so the row, the accessible name and any future
 *  feed renderer cannot drift into three different grammars. */
export function rowSentence(i: SentenceInput): string {
  const base = rowClause(i);
  // ── THE BILLING CODE CLAUSE (A9 item 3). An em-dash tail rather than a
  //    parenthetical: the code IS the outcome of a billing review, not an aside
  //    about it, and the reader scanning a code history reads the right-hand end
  //    of the line. Absent whenever the query withheld the payload.
  if (i.billingCode) return `${stripFullStop(base)} — ${i.billingCode}.`;
  return base;
}

function stripFullStop(s: string): string {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}

function rowClause(i: SentenceInput): string {
  const noun = OBJECT_NOUN[i.eventType];
  const verb = VERB[i.eventType];
  const isSystem = i.actorId === SYSTEM_ACTOR_ID;
  const isSelf = i.actorId === i.viewerId;
  const n = i.count ?? 1;
  /** A COALESCED GROUP WHOSE MEMBERS HAVE DIFFERENT ACTORS. The group key is
   *  (eventType, objectId, day) and excludes the actor, so this is reachable in
   *  principle even though the brief's premise says no supervisor event type has
   *  multiple actors against one object. It gets an AGENTLESS sentence: "You
   *  closed 7" would be a lie when you closed three, and crediting the batch to
   *  whoever is most recent is the same lie with better manners. */
  const mixedActors = i.actorId === MIXED_ACTOR_ID;

  // ── AGENTLESS: A SYSTEM ACTOR, OR AN ACTION ROW (§5.1).
  //
  //    Two different reasons, one construction. A cron job is not a person and
  //    must not be written as one. An ACTION row is open work, and naming who
  //    opened it turns a record into a credit — "You raised Maya's escalation."
  //    reads as the supervisor's history when it is in fact their queue.
  //
  //    "A billing review opened for Jordan." is the prompt's own example, and
  //    "An escalation opened for Maya." is A9's.
  if (isSystem || i.recordVoice) {
    if (i.eventType.endsWith("_OVERDUE")) {
      return `${capitalise(possessive(i.teenName))} ${noun} went overdue.`;
    }
    if (i.eventType === "SURVEY_COMPLETED") {
      // The TEEN did this one, so they are the subject rather than an object.
      return `${i.teenName} completed a survey.`;
    }
    // A COALESCED ACTION GROUP is still agentless, and still takes its count —
    // the count is not the actor. Degraded groups drop the number (A6).
    const where = i.onConversation
      ? `in ${possessive(i.teenName)} conversation`
      : `for ${i.teenName}`;
    const n = i.count ?? 1;
    if (n > 1) {
      return i.degraded
        ? `${capitalise(noun)}s opened ${where}.`
        : `${n} ${noun}s opened ${where}.`;
    }
    return `${capitalise(article(noun))} ${noun} opened ${where}.`;
  }

  // ── MATCHING IS ITS OWN CONSTRUCTION. Caught in review: the generic
  //    actor-verb-object form produced "Omar matched Theo's match", because
  //    TEEN_MATCHED's verb and its noun are the same word. A match is made
  //    BETWEEN people, so the teen is the object and the mentor is where they
  //    went — no possessive at all.
  if (i.eventType === "TEEN_MATCHED") {
    return isSelf
      ? `You matched ${i.teenName} with a mentor.`
      : `${i.actorName} matched ${i.teenName} with a mentor.`;
  }

  // ── COALESCED (A6). Degraded groups carry NO COUNT — enforced upstream in the
  //    query, and re-enforced here so a caller that forgets cannot leak it.
  if (n > 1 && mixedActors) {
    const where = i.onConversation
      ? `in ${possessive(i.teenName)} conversation`
      : `for ${i.teenName}`;
    // Passive, and number-free when degraded.
    return i.degraded
      ? `${capitalise(noun)}s were ${verb} ${where}.`
      : `${n} ${noun}s were ${verb} ${where}.`;
  }
  if (n > 1 && !i.degraded) {
    const plural = `${n} ${noun}s`;
    const where = i.onConversation
      ? `in ${possessive(i.teenName)} conversation`
      : `for ${i.teenName}`;
    return isSelf
      ? `You ${verb} ${plural} ${where}.`
      : `${i.actorName} ${verb} ${plural} ${where}.`;
  }
  if (n > 1 && i.degraded) {
    // No number. "Lydia closed risk flags in Maya's conversation."
    const where = i.onConversation
      ? `in ${possessive(i.teenName)} conversation`
      : `for ${i.teenName}`;
    return isSelf
      ? `You ${verb} ${noun}s ${where}.`
      : `${i.actorName} ${verb} ${noun}s ${where}.`;
  }

  // ── SINGLE ROW.
  const object = i.onConversation
    ? `a ${noun} in ${possessive(i.teenName)} conversation`
    : `${possessive(i.teenName)} ${noun}`;

  return isSelf ? `You ${verb} ${object}.` : `${i.actorName} ${verb} ${object}.`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Timestamps ──────────────────────────────────────────────────────────────

/** THE LADDER. §5.2 is unavailable; this is derived from A6's example, which shows
 *  a bare time of day ("2:14 PM") on a row.
 *
 *  TIME OF DAY ONLY, because THE DAY DIVIDER ALREADY CARRIES THE DATE. Repeating
 *  "Aug 24" on every row under a divider that says "Monday, August 24th" is the
 *  same fact twice, and it is the fact the reader already used to orient.
 *
 *  Relative phrasing is deliberately NOT used ("2 hours ago"). In a ledger the
 *  reader is reconstructing a sequence, and relative stamps make two adjacent rows
 *  incomparable without arithmetic. Absolute times sort by eye. */
export function rowTimestamp(occurredAt: string): string {
  const d = new Date(occurredAt);
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/ /g, " ");
}

/** The full absolute value for `<time datetime>` and for the row's accessible
 *  name — a screen reader gets the date it cannot see in the divider. */
export function absoluteTimestamp(occurredAt: string): string {
  return new Date(occurredAt).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** DAY DIVIDER LABEL. Today has no divider at all (A3 step 6) — the feed opens
 *  straight into it — so this is only ever called for yesterday and earlier. */
export function dayDividerLabel(dayKey: string, nowMs: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const now = new Date(nowMs);
  const startOf = (dt: Date) =>
    new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(day)) / 86_400_000);

  if (diffDays === 1) return "Yesterday";
  // Ordinal date, per the prompt's example "Monday, August 24th".
  const weekday = day.toLocaleDateString("en-US", { weekday: "long" });
  const month = day.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${ordinal(day.getDate())}`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
