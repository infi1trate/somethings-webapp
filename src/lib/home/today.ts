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
import {
  activeEscalations,
  openCareReviews,
  openCounts,
} from "@/lib/ia/open-counts";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import type { SupervisedConversation } from "@/lib/monitoring/coverage";
import {
  ackStateFor,
  escalationObligations,
  isSettled,
  type EscalationRecord,
} from "@/lib/monitoring/escalation";
import { ESCALATION_ACK_SLA } from "@/lib/monitoring/constants";
import type { ShiftFacts } from "@/lib/tasks/shift";
import type { TaskItem } from "@/lib/tasks/types";
import { elapsedAgo, oldestAgeLabel } from "@/lib/ia/age";

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
/** The destination names, in one place. EXPORTED since Phase D: the schedule
 *  module names a destination in its CTA, and a second copy of these three
 *  strings is how "Care Reviews" becomes "Care reviews" on one surface. */
export const LABEL: Record<DestinationId, string> = {
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

/** ═══ THE OLDEST INSTANT, PER PRIMITIVE (Phase B.2) ═══
 *
 *  Phase B makes "open count + age of oldest" the shape of every row, matching
 *  the Risk Flags line it names as the quality bar. The three destinations hold
 *  three different primitives, so "oldest" is three different fields —
 *  `MonitoringEvent.at`, `EscalationRecord.triggeredAt`, `TaskItem.openedAt` —
 *  and each needs its own reader.
 *
 *  THEY TAKE THE SET THE COUNT WAS DRAWN FROM, NOT THE WHOLE FIXTURE. An age
 *  computed over a different set than the count beside it is the same class of
 *  defect Phase A closed one level up: "19 open · oldest 6d ago" where the 6d
 *  item is not one of the 19. So each caller passes the filtered list. */
function oldestTriggered(records: EscalationRecord[]): number | null {
  let min: number | null = null;
  for (const r of records) if (min == null || r.triggeredAt < min) min = r.triggeredAt;
  return min;
}

function oldestOpened(items: TaskItem[]): number | null {
  let min: number | null = null;
  for (const i of items) if (min == null || i.openedAt < min) min = i.openedAt;
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
  /* ═══ `facts` IS NO LONGER DESTRUCTURED, AND STAYS ON THE INPUT (Phase B) ═══
     Care Reviews was its only reader — `facts.billing.open` for the count and
     `.overdue` for a clause that could not fire. Phase A moved the count to
     `openCounts` and Phase B removed the dead clause, so no card reads `facts`.
     THE FIELD STAYS ON `TodayInput`, which is the posture this file already
     takes for `conversations` one field below: "removing it from this type
     would be a change to every caller for no behaviour". The page still builds
     `shiftFactsFor` for `ClosedToday`, so nothing is computed that is not
     used — it simply is not used HERE. */
  const { items, events, escalations, classifierDegraded, now } = input;
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

  /** ═══ THE COUNTS COME FROM `lib/ia/open-counts`, NOT FROM HERE (Phase A) ═══
   *  Every `count:` below, and every open FIGURE inside a `state:` sentence,
   *  reads this map. The rail reads the same function, so the two surfaces
   *  cannot disagree about a destination — and a row cannot say "19 open"
   *  beside a figure of 18, which a second local expression would eventually
   *  allow. See that module on the domain-vs-task-type accident this closes. */
  const open = openCounts({ items, events, escalations, now });

  /* EVERY EVENT IS A FLAG SINCE §2.1 — the subject filter went with Mentor
     Practice, so this is the whole set rather than a half of it. */
  const flags = events;

  const build: Record<DestinationId, TodayCard> = {
    /* ── ESCALATIONS · the only destination with two real clocks ──────────── */
    escalations: (() => {
      /** ═══ COUNT + AGE OF OLDEST, AND A BREACH THAT OUTRANKS THE AGE ═══
       *
       *  Phase B.2 gives every row the shape of the Risk Flags line —
       *  "5 open · oldest 21h ago" — and names it for Escalations as "open
       *  count + age of oldest". This line WAS three clauses: "2 active · 2
       *  awaiting acknowledgement · 3 close-out items overdue".
       *
       *  TWO CLAUSES, LIKE THE EXEMPLAR. The acknowledgement clause goes: it
       *  was the third fact on a row Phase B allows two, and the age carries
       *  the same urgency less precisely but in the shape every other row now
       *  uses.
       *
       *  THE BREACH CLAUSE STAYS, AND REPLACES THE AGE RATHER THAN JOINING IT.
       *  Stated as a deviation because it is one: Phase B's literal list is
       *  count-plus-age and nothing else. Two reasons it survives —
       *   · PRECEDENCE IS THE EXEMPLAR'S OWN PATTERN. Risk Flags already
       *     overrides its whole line when the pipeline is degraded, because a
       *     zero there means something different. Same move, same clause
       *     budget: a passed clock replaces the age, it does not add a third
       *     fact.
       *   · THESE ARE THE ONLY PUBLISHED CLOCKS IN THE PRODUCT. `AGENTS.md`:
       *     "the only published clocks left anywhere on this surface are the
       *     escalation pair", and arch-mon put breach treatment there
       *     deliberately after removing it from flags. Dropping it would leave
       *     Today unable to say a clock had passed at all — and it would
       *     produce "Nothing open" on a fixture with three overdue close-out
       *     items, which is measurably worse than the row it replaced. */
      const breached = ob.ackBreached > 0 || ob.closeOutOverdue > 0;
      const parts: string[] = [];
      if (open.escalations > 0) parts.push(`${open.escalations} active`);
      if (ob.closeOutOverdue > 0) {
        parts.push(
          /* ═══ SHORTENED, NOT ELLIPSISED — AND MEASURED, NOT GUESSED (L.5.6) ═══
             It read "3 close-out ITEMS overdue" and clipped on a 275px card.
             MEASURED in situ: the second line has 217px, and
             "2 active · 3 close-out notes overdue" is 193px — it fits. "items"
             is what went; "notes" is the authored table's own noun and stays.
             A FIRST PASS CUT IT TO "close-out" AND "ack", which fit by a wide
             margin and bought that with jargon. The measurement says the clear
             words fit, so the clear words ship.
             NEEDS-COPY-NICOLE: {n} close-out notes overdue */
          `${plural(ob.closeOutOverdue, "close-out note", "close-out notes")} overdue`
        );
      } else if (ob.ackBreached > 0) {
        /* ═══ A PASSED ACK CLOCK MUST BE IN THE TEXT, NOT ONLY THE TONE ═══
           MEASURED on `active-escalation`: with the age clause here the row
           read "2 active · oldest 12m ago" at `tone: "breach"`. The breach was
           carried by the tone and by an `aria-hidden` AlertTriangle — so for a
           screen-reader user it was carried by NOTHING, and the standing
           constraint is that colour is never the sole carrier. The old
           three-clause line said "awaiting acknowledgement" and covered this by
           accident; two clauses have to cover it on purpose.
           `ackBreached`, NOT `ackOutstanding` — an escalation inside its five
           minutes is the most urgent thing in the console and is not yet a
           breach, which is the `attention` arm. And "overdue" rather than the
           destination's "awaiting": this is the PASSED clock, a different
           quantity, and the file already records what it cost to phrase a
           different quantity like a similar one. */
        parts.push(
          /* MEASURED: "3 active · 1 acknowledgement overdue" is 207px against
             the 217px the line has, so the full word fits and "ack" was an
             unnecessary abbreviation.
             NEEDS-COPY-NICOLE: {n} acknowledgement(s) overdue */
          `${plural(ob.ackBreached, "acknowledgement", "acknowledgements")} overdue`
        );
      } else if (open.escalations > 0) {
        /* THE AGE IS OVER THE SET THE COUNT CAME FROM — `activeEscalations` is
           the array whose length IS `open.escalations`, so the two cannot
           describe different records. */
        parts.push(
          `oldest ${ageOf(oldestTriggered(activeEscalations(escalations, now)), now)}`
        );
      }
      return {
        id: "escalations" as const,
        label: LABEL.escalations,
        /* NEEDS-COPY-NICOLE: {n} active · oldest {age}
           NEEDS-COPY-NICOLE: {n} close-out items overdue
           NEEDS-COPY-NICOLE: {n} acknowledgements overdue */
        state: parts.length ? parts.join(" · ") : "Nothing open",
        tone: breached ? "breach" : open.escalations > 0 ? "attention" : "clear",
        href: "/app/escalations",
        count: open.escalations,
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
          count: open["risk-flags"],
        };
      }
      return {
        id: "risk-flags" as const,
        label: LABEL["risk-flags"],
        /* NEEDS-COPY-NICOLE. "21 open · oldest 4d ago". NO BREACH CLAUSE IS
           REACHABLE HERE — see the header. */
        state: open["risk-flags"]
          ? `${plural(open["risk-flags"], "open", "open")} · oldest ${ageOf(at, now)}`
          : "Nothing waiting for judgment",
        tone: open["risk-flags"] ? "attention" : "clear",
        href: "/app/risk-flags",
        count: open["risk-flags"],
      };
    })(),

    /* ── CARE REVIEWS · the one queue with a published deadline ───────────── */
    "care-reviews": (() => {
      /** ═══ COUNT + AGE OF OLDEST, AND THE OVERDUE CLAUSE WAS DEAD ═══
       *
       *  Phase B.2: "Care Reviews: open count + age of oldest." The line was
       *  "19 open" with an `overdue` clause beside it and a `breach` tone.
       *
       *  MEASURED: `facts.billing.overdue` is 0 on every one of the five task
       *  scenarios, and structurally so — `TASK_SLA_MS.intakeBillingReview` and
       *  `.monthlyReReview` are both null (`CARE_REVIEW_SLA` was retired), so
       *  `deadlineFor` returns null, `slaDeadline` is null, and `isBreached` is
       *  false for every billing item that can exist. The clause and the
       *  `breach` arm could not fire. Removing them costs no information; the
       *  age Phase B asks for replaces a branch that was already unreachable.
       *
       *  THE TONE LOSES ITS BREACH ARM WITH IT. A tone nothing can reach is the
       *  same dead chrome as a filter with one value — and if a billing SLA is
       *  ever published, the clock belongs to `sla.ts` and a review, not to a
       *  branch left behind in case. */
      const openCount = open["care-reviews"];
      /* THE SAME ARRAY THE COUNT IS THE LENGTH OF. */
      const openItems = openCareReviews(items);
      return {
        id: "care-reviews" as const,
        label: LABEL["care-reviews"],
        /* NEEDS-COPY-NICOLE: {n} open · oldest {age} */
        state: openCount
          ? `${plural(openCount, "open", "open")} · oldest ${ageOf(oldestOpened(openItems), now)}`
          : "Nothing open",
        tone: openCount > 0 ? "attention" : "clear",
        href: "/app/care-reviews",
        count: openCount,
      };
    })(),
  };

  return DESTINATION_ORDER.map((id) => build[id]);
}

/** Age, or a stated absence. Never an empty string: a card with a dangling
 *  "oldest " is the empty-label-stack defect the production audit recorded, and
 *  this is only reachable with a non-empty set anyway — so it asserts rather
 *  than guesses. */
/* ═══ IT DELEGATES NOW — ONE AGE EXPRESSION (Phase K.2) ═══
   This had its own floor/hour/day arithmetic, a copy of `elapsedLabel`'s. The
   copy is how the surfaces diverged: it ROUNDED where `elapsedLabel` floors,
   so a 66-hour item was "oldest 3d ago" on Today's card and "2d" on the row
   three lines beneath it. Making it floor closed the rendered defect and left
   the real one — two expressions agreeing by accident, which is worse than two
   that disagree because nothing fails while the accident holds.
   So the arithmetic is gone and this is a preposition. */
function ageOf(at: number | null, now: number): string {
  if (at == null) return "unknown";
  return elapsedAgo(at, now);
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
// ═══════════════════════════════════════════════════════════════════════════
// THE BANNER'S RATIONALE — WHY *THIS* DESTINATION (Phase C)
//
// ═══ WHAT IT REPLACES ═══
//
// The banner body was `todayDigestLine` — "Escalations, Risk Flags and Care
// Reviews need attention." That is a restatement of the three rows directly
// below it, each of which carries its own count, its own age and its own link.
// Phase C.2: the banner's only job is the rationale, "not a restatement of the
// list below it".
//
// ═══ RATIONALE-OR-NOTHING, AND WHY THAT IS A REAL CONSTRAINT ═══
//
// C.3 says the banner does not render when no rationale can be derived. That is
// only meaningful if the rationale is allowed to FAIL to derive — so this
// function returns null rather than falling back to a sentence that is true of
// anything. The two bases it can prove:
//
//  · A CLOCK. Only Escalations has published clocks — the five-minute
//    acknowledgement and the 24-hour close-out note. `FLAG_REVIEW_SLA` is null
//    and both billing SLAs are null, so no other destination can cite one.
//    Strongest basis, because a passed or running deadline outranks an age.
//  · THE OLDEST UNRESOLVED WORK, *verified to be the oldest*. Asserted only
//    when the recommended destination genuinely holds the oldest item on the
//    board. If it does not, this returns null instead of saying "oldest" about
//    something that is not — a banner that lies about its reason is worse than
//    no banner, and C.3 already provides for its absence.
//
// ═══ THE THIRD BASIS C.2 OFFERS IS NOT DERIVABLE ═══
//
// "Blocking another person's work" — nothing in the data models it. A care
// review does plausibly block a mentor, and an escalation plausibly blocks the
// teen's mentor, but neither is a field: there is no dependency edge, no
// waiting-on, and no assignee state to read. Inventing one would be a
// fabricated statistic. Reported rather than approximated.
//
// ═══ IT NEVER REORDERS THE LIST (C.5) ═══
//
// This function returns a DestinationId and a sentence. It does not sort, and
// `todayCards` does not read it — the cards come from `DESTINATION_ORDER` and
// nothing else. A fixed list plus a variable recommendation, which is the shape
// C.5 asks for.

export interface TodayRationale {
  /** The destination the CTA navigates to. */
  id: DestinationId;
  /** NEEDS-COPY-NICOLE. One sentence: why here, citing the concrete fact. */
  reason: string;
  /** Which basis proved it. Exposed for the report and asserted in tests, so a
   *  future change cannot quietly downgrade a clock claim to an age claim. */
  basis: "clock" | "oldest";
}

/** The instant a card's oldest open item arrived, or null when it holds none.
 *  ONE READER PER PRIMITIVE, over the same sets the counts come from — see
 *  `open-counts.ts`. */
function oldestFor(
  id: DestinationId,
  input: TodayInput
): number | null {
  const { items, events, escalations, now } = input;
  if (id === "escalations") {
    return oldestTriggered(activeEscalations(escalations, now));
  }
  if (id === "risk-flags") return oldest(events);
  return oldestOpened(openCareReviews(items));
}

export function todayRationale(
  cards: TodayCard[],
  input: TodayInput
): TodayRationale | null {
  const id = directiveCardId(cards);
  /* NO RECOMMENDATION, NO RATIONALE. `directiveCardId` already refuses to point
     at a clear or unavailable destination, so this covers "nothing is owed" and
     "the pipeline is down" without restating either rule. */
  if (id == null) return null;
  const { escalations, now } = input;

  if (id === "escalations") {
    const ob = escalationObligations(
      escalations.filter((r) => !isSettled(r, now)),
      now
    );
    /* ═══ THE STRONGEST CLOCK FIRST ═══
       A passed 24-hour note outranks a passed five minutes, because the
       five-minute clock is an alarm a supervisor may still be inside of while
       the note is simply late. Both outrank a running clock. */
    if (ob.closeOutOverdue > 0) {
      return {
        id,
        basis: "clock",
        /* NEEDS-COPY-NICOLE: {n} close-out notes have passed their 24-hour deadline. */
        reason: `${plural(
          ob.closeOutOverdue,
          "close-out note has",
          "close-out notes have"
        )} passed the 24-hour deadline.`,
      };
    }
    if (ob.ackBreached > 0) {
      return {
        id,
        basis: "clock",
        /* NEEDS-COPY-NICOLE: {n} escalations passed the five-minute acknowledgement. */
        reason: `${plural(
          ob.ackBreached,
          "escalation has",
          "escalations have"
        )} passed the five-minute acknowledgement.`,
      };
    }
    if (ob.ackOutstanding > 0) {
      /* A RUNNING CLOCK, AND THE ONLY FUTURE-TENSE REASON ON THE SURFACE. The
         remaining time is derived from the OLDEST unacknowledged escalation,
         which is the one whose clock runs out first. */
      const at = oldestTriggered(
        activeEscalations(escalations, now).filter(
          (r) => ackStateFor(r, now) !== "acknowledged"
        )
      );
      const left = at == null ? 0 : Math.max(0, at + ESCALATION_ACK_SLA - now);
      return {
        id,
        basis: "clock",
        /* NEEDS-COPY-NICOLE: An acknowledgement is due in {n}m. */
        reason: `An acknowledgement is due in ${Math.ceil(left / 60_000)}m.`,
      };
    }
  }

  /* ═══ THE OLDEST BASIS, AND IT IS VERIFIED BEFORE IT IS CLAIMED ═══
     "It holds the oldest" is a comparative claim, so it is checked against
     every other destination that has work. If the recommendation is not
     actually the oldest, nothing is returned — see the module note. */
  const mine = oldestFor(id, input);
  if (mine == null) return null;
  for (const card of cards) {
    if (card.id === id) continue;
    if (card.tone === "clear" || card.tone === "unavailable") continue;
    const theirs = oldestFor(card.id, input);
    if (theirs != null && theirs < mine) return null;
  }
  return {
    id,
    basis: "oldest",
    /* NEEDS-COPY-NICOLE: {destination} holds the oldest work waiting — {age}.
       ═══ IT NAMES ITS SUBJECT, AND THAT WAS A DEFECT SEEN IN CONTEXT ═══
       This read "It holds the oldest work waiting — 6h." The pronoun has no
       antecedent: the banner's reason is the FIRST thing read and the only
       thing naming the destination is the CTA below it, so a reader met "It"
       before meeting what it referred to. Caught by looking at the assembled
       page in Phase G rather than by any assertion.
       NAMING ONE DESTINATION IS NOT A LIST. The rule C.2 sets is that the
       banner must not restate the rows; the digest sentence it replaced named
       every destination needing attention, and this names the single one it
       recommends. The test moved from "names none" to "names at most one"
       for that reason, not to accommodate this string.
       THE " ago" IS STRIPPED. `ageOf` returns "6h ago", which the row's
       "oldest 6h ago" needs and this sentence does not — "waiting — 6h ago"
       says the same thing twice. Row and banner render the same instant
       through the same function and differ only in the suffix. */
    reason: `${LABEL[id]} holds the oldest work waiting — ${ageOf(
      mine,
      now
    ).replace(/ ago$/, "")}.`,
  };
}

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
