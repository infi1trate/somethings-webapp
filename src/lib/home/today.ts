// ═══════════════════════════════════════════════════════════════════════════
// TODAY, AS A MIRROR — one card per destination, and not one number of its own
//
// §4: **Today mirrors. It never contains.** This file is the mirror's data
// layer, and the rule it enforces is narrower and harder than "no buttons":
//
//   ═══ EVERY FIGURE HERE IS COMPUTED BY THE DESTINATION THAT OWNS IT ═══
//
// Not "computed the same way" — computed by the SAME FUNCTION. `homeObligations`
// for the escalation clocks, `shiftFactsFor().billing` for the review deadlines,
// `coverageProgress`/`coverageLine` for coverage, and the destinations' own
// `monitoringData().events` filtered by the same `subject` the routes pin.
//
// WHY THAT IS THE ACTUAL RULE. A mirror that disagrees with what it mirrors is
// worse than no mirror: a supervisor who reads "3 overdue" on Today and finds
// four on Care Reviews now distrusts both surfaces, and cannot tell which lied.
// The previous Home shipped `shiftFactsFor` with exactly this note on it — "a
// Home that disagreed with Tasks about how many billing reviews are open would
// be worse than a Home with no counts" — and this file is that principle applied
// to five destinations instead of two pages.
//
// So there is no arithmetic in here that a destination does not already do. What
// this file does is CHOOSE and ORDER: which of a destination's facts belong on a
// card, and in what tone.
//
// ═══ WHAT EACH CARD MAY SAY, AND WHAT IT MAY NOT ═══
//
// · ESCALATIONS may breach. It is the only destination with published clocks —
//   the 5-minute acknowledgement and the 24-hour note — so it is the only one
//   whose card can carry breach treatment. (`care-reviews` too; see below.)
// · RISK FLAGS AND MENTOR PRACTICE MAY NOT BREACH, and this is the whole of
//   arch-mon restated on a new surface. `FLAG_REVIEW_SLA` is null and blocked on
//   Meg; nothing published states a review deadline for a flag. `TaskItem.
//   slaDeadline` IS populated for the three flag types and is deliberately not
//   read here — the same prohibition Risk Flags itself operates under. They
//   carry VOLUME and AGE, both of which are facts.
// · CARE REVIEWS may breach. Its SLA is published, even if 48h-vs-72h is open.
// · COVERAGE NEVER STATES WHAT IS LEFT. `coverageLine` is progress with its unit
//   and its period; "26 unreviewed" is the inbox reading of the same number and
//   is the framing the coverage view exists to avoid. It also never breaches:
//   the credit rule is still with Meg, so there is no threshold to be under.
//
// ═══ THE ONE HONEST GAP: SESSION-LOCAL CREDIT ═══
//
// Coverage credit is page-local on the coverage view — a `useState` set, because
// nothing persists a supervisor's reading of a conversation. Today therefore
// computes coverage with an EMPTY credited set, which is the PERSISTED truth
// (`reviewedAt != null`) and nothing else. Consequence, stated: credit a
// conversation on Coverage, return to Today, and Today shows the smaller number.
//
// That is not a disagreement between two counts of one thing — it is one count
// of a thing the two surfaces can see different amounts of, and Today can only
// see what survives a navigation. Faking it would mean Today keeping its own
// credit set, which is a second source of truth for the exact figure this file
// exists to have only one of.

import { DESTINATION_ORDER, type DestinationId } from "@/lib/ia/destinations";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import type { SupervisedConversation } from "@/lib/monitoring/coverage";
import {
  escalationObligations,
  isSettled,
  type EscalationRecord,
} from "@/lib/monitoring/escalation";
import type { ShiftFacts } from "@/lib/tasks/shift";
import type { TaskItem } from "@/lib/tasks/types";

/** ═══ THE TONES, AND `breach` IS RESERVED ═══
 *  Lifted unchanged from the shift sequence's vocabulary rather than invented,
 *  because the separation it encodes is the one that matters here too: `breach`
 *  means an actual published SLA has passed, and a destination that is merely
 *  busy is `attention`. Two destinations are structurally incapable of the
 *  first — see the header. `clear` is the resting state and does not celebrate.
 *  `unavailable` is for a destination whose data this build cannot produce. */
export type CardTone = "breach" | "attention" | "clear" | "unavailable";

export interface TodayCard {
  id: DestinationId;
  /** NEEDS-COPY-NICOLE. The destination's own name, and the same string the rail
   *  uses — one name per destination reaches the reader. */
  label: string;
  /** NEEDS-COPY-NICOLE. What the destination says about itself, as a sentence.
   *  Never a bare number: "21 open" is a fact a reader has to interpret, "21
   *  open · 2 overdue" is one they can act on. */
  state: string;
  tone: CardTone;
  /** Where the card goes. Always a destination route, never a retired hop. */
  href: string;
  /** The count the card leads with, for the figure column. Null where the
   *  destination's honest answer is not a count — Coverage's is a fraction, and
   *  rendering "9" there would be the inbox reading again. */
  count: number | null;
}

/** NEEDS-COPY-NICOLE, all five. The rail's labels, deliberately the same
 *  strings — see `TodayCard.label`. */
const LABEL: Record<DestinationId, string> = {
  escalations: "Escalations",
  "risk-flags": "Risk Flags",
  "care-reviews": "Care Reviews",
};

export interface TodayInput {
  /** The task items the destinations are built from. */
  items: TaskItem[];
  /** `shiftFactsFor(items, now)` — passed in rather than recomputed so Today and
   *  the digest cannot disagree with each other either. */
  facts: ShiftFacts;
  /** `monitoringData(...).events`, unfiltered. Split here by the same `subject`
   *  the two routes pin. */
  events: MonitoringEvent[];
  /** `monitoringData(...).escalations` — the RECORDS, not the escalation task
   *  items. The destination's own input, filtered here exactly as the region
   *  filters it, because a settled record owes nothing. */
  escalations: EscalationRecord[];
  /** ═══ STILL ON THE INPUT, AND NO CARD READS IT (addendum §2.2) ═══
   *  The Coverage card was its only reader. The field stays because
   *  `MonitoringData` still carries the roster and the page still passes what
   *  it has — removing it from this type would be a change to every caller for
   *  no behaviour. The dormancy is stated rather than left to be discovered. */
  conversations: SupervisedConversation[];
  /** True when the flag pipeline is down. It makes a zero on Risk Flags mean
   *  something entirely different, so the card must be able to say so. */
  classifierDegraded: boolean;
  now: number;
}

/** The oldest event's age in a set, or null for an empty one. AGE IS A FACT and
 *  a deadline is not, which is why this is the only time figure the two flag
 *  cards get. Oldest rather than newest: the question a reader has on a queue
 *  with no deadline is "how long has something been sitting", and the newest
 *  item cannot answer it. */
function oldest(events: MonitoringEvent[]): number | null {
  let min: number | null = null;
  for (const e of events) if (min == null || e.at < min) min = e.at;
  return min;
}

/** ═══ PLURALS SPELLED OUT RATHER THAN SUFFIXED ═══
 *  NEEDS-COPY-NICOLE. Kept local and dumb: an `s`-appending helper is where
 *  "1 escalations" comes from, and every string on this surface is read by
 *  somebody deciding what to do next. */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * One card per destination, in the rail's order.
 *
 * ═══ THE RAIL'S ORDER, NOT A PRIORITY ORDER ═══
 *
 * `DESTINATION_ORDER` — the same sequence the rail renders, so a reader's map of
 * the console is one map. The previous Home ordered a LADDER instead, whose
 * sequence was a priority claim; a mirror that re-orders is asserting a priority
 * its destinations do not state, and that ladder's claim was built on the tier
 * model this restructure is removing.
 *
 * WHERE "START HERE" WENT: it is still `ladderStageFor`, still rendered, and
 * still exactly one card — see the page. Order and emphasis are different
 * channels and only one of them is a claim about the whole list.
 *
 * EVERY CARD RENDERS, INCLUDING AN EMPTY ONE. Unlike a deadline bucket, which is
 * a content grouping and vanishes when it holds nothing, a destination card is
 * NAVIGATION: a rail item that exists and a card that does not is a reader
 * wondering which surface is lying, and "nothing owed here" is the single most
 * useful thing an orientation surface can say. This is the same reason the old
 * tab cards kept their position and the opposite of the rule for buckets.
 */
export function todayCards(input: TodayInput): TodayCard[] {
  const { facts, events, escalations, classifierDegraded, now } =
    input;
  /** ═══ THE DESTINATION'S OWN COUNT, THROUGH THE DESTINATION'S OWN FUNCTION ═══
   *  This read `homeObligations(items, now)` — the nav BADGE's debt count, off
   *  TASK ITEMS. Measured by the §4 mirror probe: the card said "1 past
   *  acknowledgement" while `/app/escalations` said "2 awaiting
   *  acknowledgement". Both sentences were true and the numbers differed,
   *  because "awaiting" is pending-plus-breached and "past" is breached alone.
   *  Same input, same function, same filter as the region now. */
  const ob = escalationObligations(
    escalations.filter((r) => !isSettled(r, now)),
    now
  );

  /* EVERY EVENT IS A FLAG SINCE §2.1 — the subject filter went with Mentor
     Practice, so this is the whole set rather than a half of it. */
  const flags = events;

  const build: Record<DestinationId, TodayCard> = {
    /* ── ESCALATIONS · the only destination with two real clocks ──────────── */
    escalations: (() => {
      const parts: string[] = [];
      if (ob.active > 0) parts.push(`${ob.active} active`);
      /* ═══ THE DESTINATION'S WORDING, NOT A PARAPHRASE OF IT ═══
         "awaiting acknowledgement", which is what `/app/escalations` says in its
         header. The card used to say "past acknowledgement" and report a smaller
         number — a different quantity under a similar phrase, which is the worse
         of the two failures because it looks like agreement.
         A SUBSET AND NOT ADDED: `ackOutstanding` is drawn from the actives above,
         so summing them would count one escalation twice. */
      if (ob.ackOutstanding > 0) {
        parts.push(`${ob.ackOutstanding} awaiting acknowledgement`);
      }
      if (ob.closeOutOverdue > 0) {
        parts.push(
          `${plural(ob.closeOutOverdue, "close-out item", "close-out items")} overdue`
        );
      }
      /* BREACH IS THE PASSED CLOCK, NOT THE OPEN ONE. `ackBreached` rather than
         `ackOutstanding`: an escalation inside its five minutes is the most
         urgent thing in the console, and it is not yet a breach. That is the
         `attention` arm below. */
      const breached = ob.ackBreached > 0 || ob.closeOutOverdue > 0;
      return {
        id: "escalations" as const,
        label: LABEL.escalations,
        /* NEEDS-COPY-NICOLE */
        state: parts.length ? parts.join(" · ") : "Nothing open",
        tone: breached ? "breach" : ob.active > 0 ? "attention" : "clear",
        href: "/app/escalations",
        count: ob.active,
      };
    })(),

    /* ── RISK FLAGS · volume and age, and NO deadline ─────────────────────── */
    "risk-flags": (() => {
      const at = oldest(flags);
      /* ═══ THE PIPELINE'S HEALTH OUTRANKS THE COUNT ═══
         Zero flags is otherwise ambiguous between a quiet shift and a broken
         safety pipe, and on an orientation surface that ambiguity is the whole
         cost. Same precedence the queue's own subtitle uses. */
      if (classifierDegraded) {
        return {
          id: "risk-flags" as const,
          label: LABEL["risk-flags"],
          /* NEEDS-COPY-NICOLE */
          state: "Flag pipeline is down — no flags are arriving",
          tone: "unavailable" as const,
          href: "/app/risk-flags",
          count: flags.length,
        };
      }
      return {
        id: "risk-flags" as const,
        label: LABEL["risk-flags"],
        /* NEEDS-COPY-NICOLE. "21 open · oldest 4d ago". NO BREACH CLAUSE IS
           REACHABLE HERE — see the header. */
        state: flags.length
          ? `${plural(flags.length, "open", "open")} · oldest ${ageOf(at, now)}`
          : "Nothing waiting for judgment",
        tone: flags.length ? "attention" : "clear",
        href: "/app/risk-flags",
        count: flags.length,
      };
    })(),

    /* ── CARE REVIEWS · the one queue with a published deadline ───────────── */
    "care-reviews": (() => {
      const { open, overdue } = facts.billing;
      const parts: string[] = [];
      if (open > 0) parts.push(`${open} open`);
      if (overdue > 0) parts.push(`${overdue} overdue`);
      return {
        id: "care-reviews" as const,
        label: LABEL["care-reviews"],
        /* NEEDS-COPY-NICOLE */
        state: parts.length ? parts.join(" · ") : "Nothing open",
        tone: overdue > 0 ? "breach" : open > 0 ? "attention" : "clear",
        href: "/app/care-reviews",
        count: open,
      };
    })(),
  };

  return DESTINATION_ORDER.map((id) => build[id]);
}

/** Age, or a stated absence. Never an empty string: a card with a dangling
 *  "oldest " is the empty-label-stack defect the production audit recorded, and
 *  this is only reachable with a non-empty set anyway — so it asserts rather
 *  than guesses. */
function ageOf(at: number | null, now: number): string {
  if (at == null) return "unknown";
  const mins = Math.max(0, Math.round((now - at) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** ═══ WHICH CARD SAYS "START HERE" — DERIVED FROM THE CARDS ═══
 *
 *  ═══ IT WAS `ladderStageFor`, AND THAT WAS A THIRD SOURCE ═══
 *
 *  The ladder answers from `ShiftFacts`, which counts TASK ITEMS. Measured on
 *  mobile under `classifier-degraded`: the ladder named Escalations, so the
 *  directive dot landed on a card reading "Nothing open", and the CTA beside it
 *  said "Start with escalations — Simone first" for an escalation the
 *  destination does not have. A "start here" pointing at an empty destination is
 *  the worst single thing an orientation route can do.
 *
 *  Root cause is one fixture disagreeing with itself (gap row 409), but the
 *  DESIGN fault is this file having consulted a second opinion at all. The cards
 *  are the single source by construction; the directive is now read off them.
 *
 *  ═══ THE PROTOCOL ORDER IS KEPT, AND IT IS NOT THE RAIL ORDER ═══
 *
 *  The cards RENDER in rail order, because a mirror that re-orders asserts a
 *  priority its destinations do not state. But "where do I start" is a different
 *  question from "what is the map", and the ladder's clinical sequence was a real
 *  answer to it: a live escalation outranks a review deadline, which outranks
 *  flag volume. That order survives here, as one list, in one place.
 *
 *  BREACH OUTRANKS THE ORDER. A Care Reviews breach comes before an
 *  acknowledged, in-window escalation — because the first has missed a published
 *  deadline and the second has not missed anything yet.
 *
 *  `unavailable` IS NEVER DIRECTIVE. A pipeline being down is a fact about the
 *  system, not work a supervisor can start. Same reason it is absent from
 *  `todayDigestLine`.
 *
 *  NULL IS A REAL ANSWER and the page renders no dot at all: with nothing owed,
 *  marking one card "start here" would invent an obligation. */
const DIRECTIVE_ORDER: readonly DestinationId[] = [
  "escalations",
  "care-reviews",
  "risk-flags",
];

export function directiveCardId(cards: TodayCard[]): DestinationId | null {
  const at = (id: DestinationId) => cards.find((c) => c.id === id) ?? null;
  for (const tone of ["breach", "attention"] as const) {
    for (const id of DIRECTIVE_ORDER) {
      if (at(id)?.tone === tone) return id;
    }
  }
  return null;
}


/** ═══ THE SHIFT-START LINE — NAMES, NOT COUNTS ═══
 *
 *  ═══ WHAT THIS REPLACED, AND WHY IT HAD TO GO ═══
 *
 *  `digestLinesFor` built eight chips from `ShiftFacts`, and rendered on the new
 *  Today it read: "2 escalations open now · 10 imminent past 24h · 1 escalation
 *  note overdue · 14 clinical past 48h · 45 imminent · 16 billing · 52 clinical ·
 *  26 routine". Three things wrong at once, all of them visible on one screen:
 *
 *   1 · IT ASSERTED FLAG BREACH DEADLINES THAT DO NOT EXIST. "10 imminent past
 *       24h" and "14 clinical past 48h" are the fabricated tier SLAs arch-mon
 *       removed — `FLAG_REVIEW_SLA` is null and blocked on Meg, and
 *       `obligations.ts` excludes flag breach for exactly this reason. An
 *       orientation route is the most declarative place in the product to invent
 *       a deadline.
 *   2 · IT CONTRADICTED THE CARD BESIDE IT. The Risk Flags card read "Flag
 *       pipeline is down — no flags are arriving" while the digest claimed 123
 *       flags in three tiers, because the digest counts TASK ITEMS and the card
 *       counts the destination's EVENTS. Two sources for one figure, disagreeing
 *       on screen — the precise failure this file exists to prevent.
 *   3 · IT WAS THE CARDS AGAIN, THREE CENTIMETRES ABOVE THE CARDS. Same facts,
 *       same destinations, different order and different phrasing. The
 *       monitoring header already recorded this defect once ("the header said
 *       coverage twice, three centimetres apart") and the fix there was the same:
 *       one owner per fact.
 *
 *  ═══ SO IT NAMES DESTINATIONS AND LEAVES THE NUMBERS TO THE CARDS ═══
 *
 *  Derived from the cards themselves, which makes disagreement impossible rather
 *  than unlikely: no arithmetic, no second source, no count. Breach-first is
 *  preserved because breach cards are named first — which was the digest's one
 *  real contribution, the cards being in the rail's order rather than in
 *  urgency order.
 *
 *  `digestLinesFor` IS NOT DELETED. It belongs to the retired `home-page.tsx`
 *  and its tier fields are Phase 4's grep, so removing it here would move that
 *  phase's work into this one's diff.
 *
 *  NEEDS-COPY-NICOLE on the joined sentence and on the empty answer. */
export function todayDigestLine(cards: TodayCard[]): string | null {
  const breach = cards.filter((c) => c.tone === "breach").map((c) => c.label);
  const attention = cards
    .filter((c) => c.tone === "attention")
    .map((c) => c.label);
  const named = [...breach, ...attention];
  /* NOTHING OWED SAYS NOTHING, and the caller then renders no digest at all —
     rather than a "Since your last shift" panel whose body is "all clear", which
     is a congratulation this surface does not give. */
  if (named.length === 0) return null;
  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `${list} ${named.length === 1 ? "needs" : "need"} attention.`;
}
