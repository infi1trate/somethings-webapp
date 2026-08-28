// THE CARE SUMMARY'S READING — a static, read-only summarisation of how one
// mentee's care is going across a rolling window.
//
// ═══════════════════════════════════════════════════════════════════════════
// THIS REPLACES THE CARE ASSISTANT. There is no live model, no thread, no input
// and no refusal paths, because there is nothing to refuse — the reader cannot
// ask this panel anything. What used to be a conversation is a fixed set of
// named dimensions, each one sentence of prose over a caption of evidence.
//
// ═══ WHAT IS REAL AND WHAT IS MOCKED ═══════════════════════════════════════
//
// Audited before writing this (Phase 0). Of the seven signals the summary wants:
//
//   REAL      flags and escalations in the window — CareFlagRecord carries kind,
//             severity, reason and daysAgo, so a window slice is exact.
//   PARTIAL   video calls — `videoCount30d` is a 30-day COUNT with no held /
//             missed / rescheduled breakdown and cannot be re-cut to 21 days.
//   MOCKED    conversation tone, reply latency, reply rate, exchange counts,
//             message-length trend, days engaged, and life-context extraction.
//             None of these exists in any shape. The entire message layer is two
//             integers on the teen fixture — `mentorLastSentDaysAgo` and
//             `menteeLastSentDaysAgo`, "days since last sent". There is no
//             message record to count, time, measure or read.
//
// SO THE NUMBERS BELOW ARE INVENTED, and the two rules that keeps honest are:
//
//   1. They are DERIVED DETERMINISTICALLY FROM THE TEEN ID, so a record reads
//      identically on every load and a screenshot stays true.
//   2. They are RECONCILED AGAINST THE DATA THAT IS REAL. A teen whose last
//      message was 16 days ago cannot be given a busy window — see
//      `engagementFor`, which clamps against the recency stamps rather than
//      inventing freely. A summary that contradicts the row above it is worse
//      than no summary.
//
// See design-system-gaps.md row 242. No dimension ships with invented precision
// presented as real: the panel's footer states AI generation and scope, and the
// window line states the period, on every render.
// ═══════════════════════════════════════════════════════════════════════════

import {
  openFlagsFor,
  type CareStoreSlice,
} from "@/lib/record/care-demo";
import { DEMO_TEENS, type CareFlagRecord } from "@/lib/record/people-demo";

const DAY = 86_400_000;

/** THE WINDOW. 21 days, per the brief.
 *
 *  Exported because the panel states it out loud — the reader is told the period
 *  the reading covers, and a constant is the only way the sentence and the slice
 *  cannot disagree. */
export const READING_WINDOW_DAYS = 21;

/** ═══ THE LOW-DATA THRESHOLD ═══
 *
 *  A window must hold at least SIX mentee messages across at least THREE separate
 *  days before anything is summarised. Reasoning, because an arbitrary threshold
 *  is worse than none:
 *
 *  SIX MESSAGES. "How they sound" is a comparison against the previous window,
 *  and "How they're showing up" is a claim about cadence. A cadence needs at
 *  least two intervals, so three messages, and a comparison needs enough on both
 *  sides of the window's midpoint to compare — three each, six in total. Below
 *  that the panel would be describing one or two exchanges as a pattern.
 *
 *  THREE SEPARATE DAYS. Six messages in a single evening is one conversation, not
 *  a cadence. Without the day requirement a single burst reads as engagement and
 *  the reading would be confidently wrong about the shape of the window.
 *
 *  The panel then renders ONE honest line and NO dimensions. It does not generate
 *  thin readings from sparse data — a hedged sentence about almost no evidence is
 *  still a sentence a mentor will act on. */
export const MIN_EXCHANGES = 6;
export const MIN_DAYS_ENGAGED = 3;

/** The four dimensions, in render order. `worthWatching` is CONDITIONAL — a
 *  healthy record shows three, never four with a "nothing to report" row. */
export type ReadingDimensionId =
  | "showingUp"
  | "sound"
  | "whatsNew"
  | "worthWatching";

/** A DIRECTION, NEVER A SCORE. See the guardrail note on `sound` below. */
export type ReadingDirection = "steadier" | "harder" | "same";

export interface ReadingMoment {
  /** TODO-COPY. Names WHEN, never what was said. */
  label: string;
  /** The person whose conversation this points at. */
  conversationWith: string;
}

export interface ReadingDimension {
  id: ReadingDimensionId;
  /** TODO-COPY */
  label: string;
  /** ONE humanist sentence. Two only where the reading is genuinely compound. */
  reading: string;
  /** At most three compact data points. Evidence, never the headline. */
  metrics?: string[];
  /** Where a trend genuinely exists. Absent means no arrow renders. */
  trend?: "up" | "down" | "flat";
  /** `whatsNew` only — the metric line's position holds a moment link instead. */
  moment?: ReadingMoment;
  /** `worthWatching` only — a pointer to an EXISTING flag. See the guardrail. */
  flagPointer?: { label: string; raisedDaysAgo: number };
  /** `worthWatching` only — true when no flag exists for the period, so the line
   *  directs the reader to the normal path rather than authoring a warning. */
  noFlagOnRecord?: boolean;
}

export interface CareReading {
  windowStartAt: number;
  windowEndAt: number;
  generatedAt: number;
  /** Empty when `insufficient`. Three or four entries otherwise. */
  dimensions: ReadingDimension[];
  /** True when the window holds too little conversation to read. */
  insufficient: boolean;
  /** The two counts the threshold was tested against — shown in the low-data
   *  line so the reader knows WHY there is nothing rather than assuming a bug. */
  exchanges: number;
  daysEngaged: number;
}

// ── The mocked engagement layer ─────────────────────────────────────────────

/** Deterministic 0..n-1 from a string. Same hash the record avatar uses, so two
 *  mocked surfaces about one person at least agree with each other. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Engagement {
  exchanges: number;
  daysEngaged: number;
  /** Whole minutes. Rendered as "4h" / "35m" by the panel. */
  avgReplyMinutes: number;
  trend: "up" | "down" | "flat";
  direction: ReadingDirection;
}

/** MOCKED, BUT RECONCILED. The invented figures are clamped against the two
 *  recency stamps that ARE real, so the panel cannot claim a busy window for a
 *  teen the record shows as quiet. */
function engagementFor(teenId: string): Engagement {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  const h = hash(teenId);
  const lastFromTeen = teen?.menteeLastSentDaysAgo;

  // NO CONTACT STAMPS AT ALL = a match with no conversation yet. Zero, not a
  // hashed guess: this is the one case the real data answers outright.
  if (lastFromTeen === undefined) {
    return { exchanges: 0, daysEngaged: 0, avgReplyMinutes: 0, trend: "flat", direction: "same" };
  }

  // SILENT LONGER THAN TWO THIRDS OF THE WINDOW → necessarily sparse. A teen
  // whose last message was 15+ days ago cannot have six messages across three
  // days inside a 21-day window that ends today.
  if (lastFromTeen >= 15) {
    return {
      exchanges: h % 3,
      daysEngaged: Math.min(h % 3, 2),
      avgReplyMinutes: 0,
      trend: "down",
      direction: "same",
    };
  }

  const exchanges = 7 + (h % 22);
  const daysEngaged = Math.max(3, Math.min(READING_WINDOW_DAYS, 4 + (h % 12)));
  const avgReplyMinutes = 25 + (h % 400);
  const trend = (["up", "down", "flat"] as const)[h % 3];
  const direction = (["steadier", "harder", "same"] as const)[(h >> 3) % 3];
  return { exchanges, daysEngaged, avgReplyMinutes, trend, direction };
}

/** TODO-COPY. "4h" / "35m" — the compact form the caption wants. */
export function replyTimeLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** TODO-COPY. The direction sentence for `sound`. WORDS AND A DIRECTION ONLY —
 *  see the guardrail note in the panel component. */
function directionLabel(d: ReadingDirection): string {
  if (d === "steadier") return "steadier than the previous window";
  if (d === "harder") return "harder than the previous window";
  return "about the same as the previous window";
}

// ── Per-teen written readings ───────────────────────────────────────────────
//
// TODO-COPY and TODO-DATA on every string. Hand-written for the teens whose
// fixtures carry enough of a story to be worth reading, and derived for the rest.
//
// OBSERVATIONAL LANGUAGE ONLY. What was discussed, how often, how the exchange
// felt. No DSM term, no severity band, no "seems anxious", nothing forward-
// looking. A reading describes the window that happened.

interface WrittenReading {
  showingUp: string;
  sound: string;
  whatsNew?: { reading: string; moment: ReadingMoment };
  worthWatching?: string;
}

const WRITTEN: Record<string, WrittenReading> = {
  // Riley — the amendment-chain fixture. Sleep was the standing subject; school
  // has taken over.
  t15: {
    showingUp:
      "Replying within a few hours most days, though the messages themselves have got shorter over the last week.",
    sound:
      "Less about sleep than earlier in the window, and more about school pressure — exams were mentioned in three separate exchanges.",
    whatsNew: {
      reading:
        "Mentioned moving to a different class group after the half-term, and asked twice about how much of that gets shared with their parents.",
      moment: { label: "Aug 19 conversation", conversationWith: "t15" },
    },
  },
  // Jordan — scores moved band. Contact stayed but calls slipped.
  t13: {
    showingUp:
      "Started more of the exchanges than their mentor did this window, which is a change from the previous one, and replies have come faster.",
    sound:
      "Steadier in the last week and a half than at the start of the window, with less about being tired and more about a friend they have fallen out with.",
    whatsNew: {
      reading:
        "Said a parent has changed shift pattern, so their evenings look different from here on.",
      moment: { label: "Aug 22 conversation", conversationWith: "t13" },
    },
    worthWatching:
      "Two scheduled calls did not happen after a long stretch where none had been missed.",
  },
  // Liam — has a live escalation, which the Worth watching pointer references
  // rather than restates.
  t9: {
    showingUp:
      "Replying quickly and at length, and answering most days of the window.",
    sound:
      "More about school than anything else across the period, and more urgent in tone in the last few exchanges than the ones before them.",
    whatsNew: {
      reading:
        "Raised changing schools mid-year, and came back to it in two later exchanges.",
      moment: { label: "Aug 24 conversation", conversationWith: "t9" },
    },
    worthWatching:
      "The same subject has come up in three separate exchanges across four days.",
  },
};

/** The generic reading, for a teen with no written one. Deliberately plainer —
 *  it describes cadence and nothing it cannot see. */
function derivedShowingUp(e: Engagement): string {
  const cadence =
    e.avgReplyMinutes < 120
      ? "usually replying within a couple of hours"
      : e.avgReplyMinutes < 720
        ? "usually replying the same day"
        : "replying within a day or so";
  const shape =
    e.trend === "up"
      ? "and the exchange has picked up across the window"
      : e.trend === "down"
        ? "though the gaps between messages have got longer"
        : "at much the same rate as the previous window";
  return `Answering on ${e.daysEngaged} of the last ${READING_WINDOW_DAYS} days, ${cadence}, ${shape}.`;
}

/** Flags raised INSIDE the window. Real data. */
function flagsInWindow(
  teenId: string,
  store: CareStoreSlice
): CareFlagRecord[] {
  return openFlagsFor(teenId, store).filter(
    (f) => f.daysAgo <= READING_WINDOW_DAYS
  );
}

/** ═══ THE READING ═══════════════════════════════════════════════════════════
 *
 *  Returns null for a teen with no record at all. `insufficient` is the low-data
 *  state and carries no dimensions. */
export function careReadingFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): CareReading | null {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return null;

  const e = engagementFor(teenId);
  const base = {
    windowStartAt: now - READING_WINDOW_DAYS * DAY,
    windowEndAt: now,
    // TODO-DATA. There is no generation step, so "updated" is the window's end.
    generatedAt: now,
    exchanges: e.exchanges,
    daysEngaged: e.daysEngaged,
  };

  if (e.exchanges < MIN_EXCHANGES || e.daysEngaged < MIN_DAYS_ENGAGED) {
    return { ...base, insufficient: true, dimensions: [] };
  }

  const written = WRITTEN[teenId];
  const dimensions: ReadingDimension[] = [];

  // 1 · HOW THEY'RE SHOWING UP. Quantitative and felt together.
  dimensions.push({
    id: "showingUp",
    /* TODO-COPY */
    label: "How they're showing up",
    reading: written?.showingUp ?? derivedShowingUp(e),
    metrics: [
      `${e.exchanges} exchanges`,
      `${replyTimeLabel(e.avgReplyMinutes)} average reply`,
      `${e.daysEngaged} days engaged`,
    ],
    trend: e.trend,
  });

  // 2 · HOW THEY SOUND. A DIRECTION, NEVER A NUMBER — the metric line holds one
  //     phrase and no figure. There is no scale here to put a value on.
  dimensions.push({
    id: "sound",
    /* TODO-COPY */
    label: "How they sound",
    reading:
      written?.sound ??
      "Nothing in the window stands out as a change in what they talk about or how they talk about it.",
    metrics: [directionLabel(e.direction)],
  });

  // 3 · WHAT'S NEW. ALWAYS PRESENT on a readable window, so the panel's floor is
  //     three dimensions — the brief's "3–4", where three is a healthy record and
  //     the fourth is `worthWatching`.
  //
  //     WHEN NOTHING CHANGED, IT SAYS SO, naming the four categories it covers.
  //     That is a genuinely different fact from "we did not look", and a reader
  //     who cannot tell those apart has to go and check the conversation anyway —
  //     which is the cost the panel exists to remove. The absence line carries no
  //     moment link, because there is no moment to point at.
  if (written?.whatsNew) {
    dimensions.push({
      id: "whatsNew",
      /* TODO-COPY */
      label: "What's new",
      reading: written.whatsNew.reading,
      moment: written.whatsNew.moment,
    });
  } else {
    dimensions.push({
      id: "whatsNew",
      /* TODO-COPY */
      label: "What's new",
      reading:
        "Nothing about school, family, housing or work came up in this window.",
    });
  }

  // 4 · WORTH WATCHING. CONDITIONAL, and NEVER THE PRIMARY CARRIER OF A CONCERN.
  //
  //     The pointer is to an EXISTING flag when one was raised in the window. If
  //     there is an observable pattern and NO flag, the line says so and points
  //     at the normal path — it does not author a warning of its own. See the
  //     guardrail comment in the panel component.
  const flags = flagsInWindow(teenId, store);
  const pattern = written?.worthWatching;
  if (flags.length > 0) {
    const f = flags[0];
    dimensions.push({
      id: "worthWatching",
      /* TODO-COPY */
      label: "Worth watching",
      reading:
        pattern ??
        // NO WRITTEN PATTERN FOR THIS TEEN. The honest reading is the flag's
        // STATE — still open, raised inside this window — and the pointer beneath
        // carries which one and when. Saying "there is an open item" and then
        // pointing at it would be the same fact twice, and inventing a pattern
        // here would be the panel authoring a concern (guardrail 2).
        "A flag raised inside this window is still open.",
      flagPointer: {
        // The flag's OWN reason, quoted from the record rather than re-authored.
        label: f.reason,
        raisedDaysAgo: f.daysAgo,
      },
    });
  } else if (pattern) {
    dimensions.push({
      id: "worthWatching",
      label: "Worth watching",
      reading: pattern,
      noFlagOnRecord: true,
    });
  }

  return { ...base, insufficient: false, dimensions };
}
