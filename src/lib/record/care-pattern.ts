// THE CARE PATTERN — the middle horizon.
//
// ═══════════════════════════════════════════════════════════════════════════
// TWO HORIZONS, KEPT APART. The Care summary rail reads ~21 days of CONVERSATION
// (tone, engagement). This reads the WHOLE MENTORSHIP as EVENTS — flags,
// assessments, presentation changes — and looks for co-occurrence between them.
// They must not converge: if this module ever starts describing how the teen
// sounds, or the summary starts counting flags, one of them is redundant.
//
// ═══ THE CLINICAL MANDATE ═══
//
// This surface is not a design idea; the Risk Flagging Escalation Playbook asks
// for it in as many words:
//   · "the same flag appearing 3+ times in a month is a clinical pattern"
//   · "Connect to a pattern if one is developing"
//   · "a stable mild score is different from a mild score that is incrementally
//      worsening"
//   · "If score elevation pairs with other general tier flags in the same period"
// Repetition counted, themes grouped, scores tracked across the same span. That
// is this file.
//
// ═══ GUARDRAILS, ENFORCED HERE RATHER THAN IN COPY REVIEW ═══
//
// CO-OCCURRENCE, NEVER CAUSATION. Every sentence this module builds joins facts
// with "across the same stretch", "in the same period", "over that span". There
// is no code path that emits "because", "driven by", "due to", "as a result of",
// or "led to". A test asserts it.
//
// NO PREDICTION. Nothing here reads the future. There is no trend extrapolation,
// no "continuing", no "likely". Every sentence is about a span that has ended.
//
// NO TIERING OF THE TEEN. The taxonomy carries a tier per FLAG and this module
// never aggregates it into a property of the person — no max tier, no count of
// imminent flags presented as a rating, no "high-concern" anything. Periods get
// described; people do not get graded. The tier is not read in this file at all.
//
// NEVER THE PRIMARY CARRIER OF AN ACTIVE CONCERN. Open flags reach a supervisor
// through the Overview attention pipeline, which has an owner and a clock. This
// describes history. It does not know or care whether a flag is currently open,
// and it deliberately does not sort or emphasise by that.
// ═══════════════════════════════════════════════════════════════════════════

import {
  careTimelineFor,
  severityFor,
  weightedAggregate,
  type CareAssessment,
  type CareEvent,
  type CareStoreSlice,
} from "@/lib/record/care-demo";
import { SPARKLINE_MIN_POINTS } from "@/components/record/score-sparkline";
import { THEME_LABEL, recurringThemes } from "@/lib/record/risk-taxonomy";
import { DEMO_TEENS } from "@/lib/record/people-demo";

const DAY = 86_400_000;

/** ═══ THE SUPPRESSION THRESHOLD ═══
 *
 *  All four must hold or the block does not render AT ALL — no empty state, no
 *  placeholder. A three-week-old mentorship has no pattern and generating one is
 *  fabrication.
 *
 *  SPAN ≥ 90 DAYS. Two reasons. It keeps this horizon away from the Care
 *  summary's 21 days, so the two surfaces cannot start saying the same thing at
 *  different lengths. And 90 days is a real clinical rhythm in this product
 *  already — the review cadence is 30 and 90 days — rather than a number chosen
 *  to make the block appear more often.
 *
 *  ≥ 6 EVENTS. Clustering needs at least two groups of two-plus to be a cluster
 *  rather than a coincidence. Below six there is nothing for the eye or the
 *  sentence to group.
 *
 *  ≥ 2 DISTINCT CLASSES. The block's claim is CO-OCCURRENCE. Six events of one
 *  class is a list, and a timeline strip with one mark shape is a row of dots.
 *
 *  ≥ 3 ASSESSMENTS — and this reuses `SPARKLINE_MIN_POINTS` rather than declaring
 *  its own floor. The sparkline's note already argues the case: a two-point
 *  segment is a line, not a trend. Importing the constant means the strip and the
 *  sparkline cannot disagree about what counts as a trajectory. */
export const PATTERN_MIN_SPAN_DAYS = 90;
export const PATTERN_MIN_EVENTS = 6;
export const PATTERN_MIN_CLASSES = 2;
export const PATTERN_MIN_ASSESSMENTS = SPARKLINE_MIN_POINTS;
/** Two readings draw a line. See `PatternGate` for why this is not 3. */
export const STRIP_MIN_ASSESSMENTS = 2;

/** The playbook's own repetition threshold: "the same flag appearing 3+ times in
 *  a month is a clinical pattern". Used to describe CLUSTERING, never to rate. */
export const CLUSTER_WINDOW_DAYS = 30;
export const CLUSTER_MIN_FLAGS = 3;

/** The three classes the strip draws. Distinguishable by SHAPE and POSITION, not
 *  hue — see the component. */
export type PatternMarkClass = "assessment" | "flag" | "presentation";

export interface PatternMark {
  /** The underlying CareEvent id — what History scrolls to and filters by. On a
   *  coalesced mark this is the FIRST event of the day, so activating it lands the
   *  reader at the top of the group rather than in the middle of it. */
  eventId: string;
  cls: PatternMarkClass;
  at: number;
  /** Assessments only — the summed score, for vertical position. */
  score?: number;
  /** TODO-COPY. The accessible name: type and date, never content. */
  label: string;
  /** ═══ SAME-DAY FLAGS COALESCE (caught in browser verification) ═══
   *
   *  A conversation that generates three flags generates three marks at the SAME
   *  x — stacked exactly on top of each other, visually one mark, with three
   *  identical accessible labels ("Flag · August 18, 2026"). That is the same
   *  defect the Tasks worklist hit with coalesced group children, and it fails
   *  the brief's own requirement that each mark carry a label naming its type and
   *  date: three marks cannot be told apart by a label they share.
   *
   *  So flags on one day become ONE mark carrying the count. > 1 renders the count
   *  and says so in the label. */
  count: number;
  /** ═══ ESCALATION OR RISK FLAG — THE EVENT'S TYPE, NOT A GRADE ═══
   *
   *  Both classify as `cls: "flag"` so the strip still reads as three kinds of
   *  mark, but the design file draws the two in different colours and a reader
   *  scanning the axis genuinely wants to know which is which.
   *
   *  THIS IS NOT THE THING THE STANDING GUARD FORBIDS. That guard — "the pattern
   *  never reads a flag's tier", asserted structurally in `care-pattern.test.ts`
   *  — bans `tier` and `severity` on a mark, because those grade the PERSON.
   *  Whether a concern was escalated is a fact about the WORKFLOW: someone
   *  raised it to the next tier of response. History already renders that
   *  distinction as a row type, and the strip pointing at the same rows should
   *  not be the one surface that hides it.
   *
   *  On a coalesced mark it is true when ANY member was an escalation: the
   *  higher-response event is the one the mark must not lose. */
  escalation?: boolean;
  /** ═══ THE RECENCY-WEIGHTED SCORE AS OF THIS READING — assessments only ═══
   *
   *  The tooltip's third line. `undefined` on the FIRST reading of a series and
   *  on any mark that is not a plotted assessment, both of which are real
   *  outcomes rather than missing data: weighting one number is not a weighting,
   *  and `weightedAggregate` says so by returning null below two comparable
   *  surveys.
   *
   *  ═══ WHY IT IS COMPUTED HERE AND NOT IN THE COMPONENT ═══
   *
   *  The brief requires the tooltip to reconcile with the grid's Weighted column.
   *  The only way to guarantee that rather than hope for it is to call the SAME
   *  function on the SAME series — `weightedAggregate`, 3:2:1, one instrument —
   *  so the last point's value is arithmetically identical to the card's. A
   *  second implementation in the view layer is how two numbers for one judgment
   *  get onto one page, which is a defect this tab has already paid for once. */
  weighted?: { score: number; severity: string; count: number };
}

export interface CarePattern {
  spanDays: number;
  startAt: number;
  endAt: number;
  generatedAt: number;
  /** One to three sentences. */
  reading: string[];
  marks: PatternMark[];
  /** The instrument the assessment dots are on — one only, so the vertical axis
   *  means one thing. */
  instrument: string | null;
  /** Inclusive score bounds actually used for positioning. */
  scoreMin: number;
  scoreMax: number;
  /** Month boundaries inside the span, for the muted labels. */
  months: { at: number; label: string }[];
  /** ═══ SAFETY EVENTS AGGREGATED BY MONTH AND BY TYPE ═══
   *
   *  The chart's badges are per-month typed COUNTS, so the aggregation has to
   *  happen where the events are rather than in the view: `PatternMark` already
   *  coalesces flags BY DAY, which is a different grouping and lossy for this
   *  purpose — two flags on the 3rd and one on the 19th are one month with three
   *  flags, and two marks.
   *
   *  Escalations and flags stay in separate lists. They are different events
   *  with different responses, and a single count with a type beside it is the
   *  shape that produced "3 flags" on a day that contained an escalation. */
  monthSafety: {
    at: number;
    escalations: { at: number; resolved: boolean }[];
    flags: { at: number; resolved: boolean }[];
  }[];
}

// ── Classification ──────────────────────────────────────────────────────────

function classOf(e: CareEvent): PatternMarkClass | null {
  if (e.type === "assessment") return "assessment";
  if (e.type === "risk_flag" || e.type === "escalation") return "flag";
  if (
    e.type === "presentation_assigned" ||
    e.type === "presentation_changed" ||
    e.type === "presentation_reviewed"
  )
    return "presentation";
  // care_update, pause, return, survey_assigned are real events but not part of
  // the co-occurrence claim — they would add marks without adding meaning.
  return null;
}

const scoreOf = (e: CareEvent): number =>
  (e.items ?? []).reduce((a, i) => a + i.points, 0);

/** TODO-COPY. "Jun", for the muted month row. */
const monthLabel = (at: number) =>
  new Date(at).toLocaleDateString("en-US", { month: "short" });

/** Month starts inside the span, so the strip's labels land on real boundaries
 *  rather than at even pixel intervals. */
/** ═══ EVERY MONTH THE WINDOW TOUCHES, INCLUDING THE ONE IT OPENS IN ═══
 *
 *  It used to skip that one. The rule was "first boundary AT OR AFTER the span's
 *  start", so a window opening on 17 February produced its first column on
 *  1 March — while February's reading still existed and still had to be drawn
 *  somewhere. `snapX` put it on the March gridline, because snapping walks
 *  forward to the last month at or before a mark and February had no bin to
 *  find. The result was measurable on every multi-reading record in the roster:
 *  one column holding two points and one column holding none, on a chart whose
 *  whole premise is one column per month.
 *
 *  So the first bin is now the 1st of the month CONTAINING `startAt`. That
 *  boundary can precede the window start — which is exactly why the sparkline
 *  positions marks against the month bins themselves rather than against
 *  `startAt`; see the axis note there. A partial first month is a true thing
 *  about a window that began mid-month, and a column is how the chart says it. */
function monthsBetween(startAt: number, endAt: number) {
  const out: { at: number; label: string }[] = [];
  const d = new Date(startAt);
  let cur = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  while (cur <= endAt) {
    out.push({ at: cur, label: monthLabel(cur) });
    const n = new Date(cur);
    cur = new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime();
  }
  return out;
}

// ── The sentences ───────────────────────────────────────────────────────────
//
// SENTENCE-FIRST IS MANDATORY, and it is a clinical requirement rather than a
// stylistic one: "3 flags in 4 months" is a label on a child, and the identical
// fact inside an interpretive sentence is information a supervisor can weigh.
// Every builder below returns a full sentence or nothing.

/** TODO-COPY. Elapsed span in the unit that reads naturally. */
function spanPhrase(days: number): string {
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30);
  return `${months} months`;
}

/** Flags, counted and grouped by recurring clinical theme.
 *
 *  THE GROUPING IS THE POINT. A bare count is the thing the brief forbids; the
 *  theme is what makes it a reading. Falls back to the count alone when no theme
 *  recurs — an honest "three, all different" rather than a manufactured pattern. */
function flagSentence(
  flags: CareEvent[],
  categoriesPerFlag: string[][],
  spanDays: number
): string | null {
  if (flags.length === 0) return null;
  const n = flags.length;
  const themes = recurringThemes(categoriesPerFlag);
  const span = spanPhrase(spanDays);

  if (n === 1) {
    return `One flag was raised across ${span} of mentorship.`;
  }
  if (themes.length === 0) {
    return `${cap(count(n))} flags were raised across ${span}, each about something different.`;
  }
  const top = themes[0];
  const themeName = THEME_LABEL[top.theme];
  const rest = n - top.count;
  // "three flags across four months, two of them involving self-harm"
  const tail =
    rest === 0
      ? `all ${count(top.count)} involving ${themeName}`
      : `${count(top.count)} of them involving ${themeName}`;
  return `${cap(count(n))} flags were raised across ${span}, ${tail}.`;
}

/** Temporal clustering — the playbook's "3+ in a month" and the looser
 *  "close together" case.
 *
 *  DESCRIBES WHEN, NOT WHY. It reports that marks fell close together and names
 *  the month; it never offers a reason, and it never says the clustering means
 *  anything. */
function clusterSentence(flags: CareEvent[]): string | null {
  if (flags.length < 2) return null;
  const times = flags.map((f) => f.occurredAt).sort((a, b) => a - b);

  // Densest window of CLUSTER_WINDOW_DAYS.
  let best = { count: 0, at: times[0] };
  for (let i = 0; i < times.length; i++) {
    const end = times[i] + CLUSTER_WINDOW_DAYS * DAY;
    const c = times.filter((t) => t >= times[i] && t <= end).length;
    if (c > best.count) best = { count: c, at: times[i] };
  }

  if (best.count >= CLUSTER_MIN_FLAGS) {
    const when = new Date(best.at).toLocaleDateString("en-US", {
      month: "long",
    });
    return `${cap(count(best.count))} of them fell within a month of each other, starting in ${when}.`;
  }
  if (best.count === 2) {
    const gap = Math.round(
      (times[times.length - 1] - times[0]) / DAY / Math.max(1, times.length - 1)
    );
    // Only worth a sentence when they are genuinely close; otherwise silence.
    if (gap <= CLUSTER_WINDOW_DAYS) {
      return `Two fell within ${gap === 0 ? "the same day" : `${gap} days`} of each other.`;
    }
  }
  return null;
}

/** Assessment trajectory across the SAME span.
 *
 *  "ACROSS THE SAME STRETCH" IS THE WHOLE CONSTRUCTION. The sentence states two
 *  facts and their shared period and stops. It does not join them with a causal
 *  connective, and there is no branch here that could. */
function trajectorySentence(
  points: { at: number; score: number }[],
  instrument: string,
  hasFlags: boolean
): string | null {
  if (points.length < PATTERN_MIN_ASSESSMENTS) return null;
  const first = points[0].score;
  const last = points[points.length - 1].score;
  const delta = last - first;
  const n = points.length;

  // TODO-COPY. Direction only, and the numbers are the instrument's own — this
  // is not a restatement of the presentation card's band, which is a different
  // fact (see the vocabulary note: named metrics use their own format).
  const move =
    delta === 0
      ? `held level`
      : delta > 0
        ? `rose from ${first} to ${last}`
        : `came down from ${first} to ${last}`;

  const lead = hasFlags
    ? `Across the same stretch, ${n} ${instrument} results ${move}.`
    : `${cap(count(n))} ${instrument} results across the span ${move}.`;
  return lead;
}

/** Presentation changes — an event class in its own right, and the one a reader
 *  most often wants dated. */
function presentationSentence(pres: CareEvent[]): string | null {
  const changes = pres.filter((e) => e.type === "presentation_changed");
  if (changes.length === 0) return null;
  const when = new Date(
    changes[changes.length - 1].occurredAt
  ).toLocaleDateString("en-US", { month: "long" });
  return changes.length === 1
    ? `The presentation on record changed once, in ${when}.`
    : `The presentation on record changed ${count(changes.length)} times, most recently in ${when}.`;
}

/** TODO-COPY. Small numbers as words — "three flags", not "3 flags". A numeral
 *  at the head of a clinical sentence reads as a metric; the word reads as prose,
 *  which is the sentence-first rule applied to the digit itself. */
function count(n: number): string {
  const words = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve",
  ];
  return words[n] ?? String(n);
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── The pattern ─────────────────────────────────────────────────────────────

/** Null means SUPPRESSED — the block renders nothing at all. */
/** ═══ TWO GATES OVER ONE GEOMETRY (row 315) ═══
 *
 *  `"pattern"` is the original and the default: span, event count, class count
 *  and assessment count, all four. Those are the conditions a NARRATIVE needs,
 *  because the block's claim was co-occurrence — "six events of one class is a
 *  list", as the threshold's own note puts it.
 *
 *  `"strip"` exists because B2 moved the geometry into the care summary as a
 *  plot, and a plot makes a much weaker claim: these are the scores, on a time
 *  axis. It needs two comparable readings and a span to draw them against, and
 *  nothing else.
 *
 *  WHY THIS MATTERED: the strip inherited the narrative gate and vanished on
 *  records that had scores worth plotting. Measured across the five dev
 *  scenarios, it was absent on `90-day review due` and `review overdue` — both
 *  t19, two comparable PHQ-9 readings and no flags — which is precisely where two
 *  dots and a line are the useful thing. A gate written for a paragraph was
 *  deciding whether a chart appears.
 *
 *  ONE BUILDER, TWO GATES, rather than a second function: the geometry — lanes,
 *  months, score range, coalescing — is identical, and two copies of it would
 *  drift on the first change to either. */
export type PatternGate = "pattern" | "strip";

export function carePatternFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {},
  gate: PatternGate = "pattern"
): CarePattern | null {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return null;

  const all = careTimelineFor(teenId, now, store);
  const marked = all
    .map((e) => ({ e, cls: classOf(e) }))
    .filter((x): x is { e: CareEvent; cls: PatternMarkClass } => x.cls !== null)
    .sort((a, b) => a.e.occurredAt - b.e.occurredAt);

  if (marked.length === 0) return null;

  const startAt = marked[0].e.occurredAt;
  const endAt = now;
  const spanDays = Math.round((endAt - startAt) / DAY);
  const classes = new Set(marked.map((m) => m.cls));
  const assessments = marked.filter((m) => m.cls === "assessment").map((m) => m.e);
  const flags = marked.filter((m) => m.cls === "flag").map((m) => m.e);
  const pres = marked.filter((m) => m.cls === "presentation").map((m) => m.e);

  // ── THE THRESHOLD. See `PatternGate`.
  if (gate === "pattern") {
    // All four, or nothing.
    if (
      spanDays < PATTERN_MIN_SPAN_DAYS ||
      marked.length < PATTERN_MIN_EVENTS ||
      classes.size < PATTERN_MIN_CLASSES ||
      assessments.length < PATTERN_MIN_ASSESSMENTS
    ) {
      return null;
    }
  } else {
    // TWO POINTS AND A SPAN. `STRIP_MIN_ASSESSMENTS` is 2 rather than
    // `SPARKLINE_MIN_POINTS`' 3 on purpose: three points is the floor for calling
    // something a TREND in prose, and the strip does not call it anything — the
    // trajectory sentence above it does, under its own gate.
    if (spanDays < 1 || assessments.length < STRIP_MIN_ASSESSMENTS) return null;
  }

  // ONE INSTRUMENT for the dots' vertical axis — PHQ-9 caps at 27 and GAD-7 at
  // 21, so a mixed axis would put two scales on one baseline. The locked
  // instrument is the most recent one, matching `scoreSeriesFor`.
  const instrument = assessments[assessments.length - 1].description;
  const points = assessments
    .filter((e) => e.description === instrument)
    .map((e) => ({ at: e.occurredAt, score: scoreOf(e) }));
  const scores = points.map((p) => p.score);
  const scoreMin = scores.length ? Math.min(...scores) : 0;
  const scoreMax = scores.length ? Math.max(...scores) : 1;

  /** ═══ THE WEIGHTED VALUE AT EACH READING ═══
   *
   *  `points` is already chronological and already filtered to the locked
   *  instrument, which is exactly the precondition `weightedAggregate` needs —
   *  so this reverses the slice ending at `i` (the function documents newest-first
   *  as the caller's job) and hands it over untouched.
   *
   *  `items` is empty because the aggregate reads `instrument` and `score` only.
   *  Passing the real items would mean re-summing them here to no effect, and the
   *  scores on `points` came from `scoreOf` — the same sum the grid uses.
   *
   *  Keyed by timestamp rather than index so the lookup below cannot drift if the
   *  mark loop ever changes order. */
  const weightedByAt = new Map<number, { score: number; severity: string; count: number }>();
  points.forEach((_, i) => {
    const newestFirst: CareAssessment[] = points
      .slice(0, i + 1)
      .reverse()
      .map((p) => ({
        instrument,
        at: p.at,
        score: p.score,
        severity: severityFor(instrument as "PHQ-9" | "GAD-7", p.score),
        items: [],
      }));
    const agg = weightedAggregate(newestFirst);
    if (agg) {
      weightedByAt.set(points[i].at, {
        score: agg.score,
        severity: agg.severity,
        count: agg.surveys.length,
      });
    }
  });

  /** Flag categories, per flag, for the theme grouping. Flags in the timeline
   *  carry their categories on the source record rather than on the event, so
   *  they are read back from the teen's flag list by date. */
  const categoriesPerFlag = flags.map((f) => {
    const rec = (teen.careFlags ?? []).find(
      (c) => Math.abs(now - c.daysAgo * DAY - f.occurredAt) < DAY
    );
    return rec?.categories ?? [];
  });

  const reading = [
    flagSentence(flags, categoriesPerFlag, spanDays),
    clusterSentence(flags),
    trajectorySentence(points, instrument, flags.length > 0),
    presentationSentence(pres),
  ].filter((x): x is string => x !== null);

  // THREE SENTENCES MAXIMUM. Four builders can fire; the reading keeps the three
  // that carry the most — counts and grouping first, then clustering, then
  // trajectory — because a fourth turns a reading into a paragraph.
  const trimmed = reading.slice(0, 3);
  if (trimmed.length === 0) return null;

  const dateLabel = (at: number) =>
    new Date(at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  const dayKey = (at: number) => {
    const d = new Date(at);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  // FLAGS COALESCE BY DAY; the other two classes do not, because two assessments
  // or two presentation changes on one day do not happen and stacking them would
  // be solving a problem that has no instances.
  const flagsByDay = new Map<string, CareEvent[]>();
  for (const f of flags) {
    const k = dayKey(f.occurredAt);
    const b = flagsByDay.get(k);
    if (b) b.push(f);
    else flagsByDay.set(k, [f]);
  }

  const marks: PatternMark[] = [];
  for (const { e, cls } of marked) {
    if (cls === "flag") {
      const group = flagsByDay.get(dayKey(e.occurredAt));
      // Only the first flag of the day emits a mark.
      if (!group || group[0].id !== e.id) continue;
      const n = group.length;
      /* ANY escalation in the group makes the mark an escalation. A day that
         held one flag and one escalation is a day something was escalated, and
         a coalesced mark that reported the quieter of the two would be the
         merge losing the more consequential fact. */
      const escalated = group.some((g) => g.type === "escalation");
      marks.push({
        eventId: e.id,
        cls,
        at: e.occurredAt,
        count: n,
        ...(escalated ? { escalation: true } : {}),
        // TODO-COPY. The count is IN the label, so a coalesced mark is
        // distinguishable by name and not only by size. The NOUN carries the
        // event type for anyone who cannot see the colour that also does.
        label:
          n === 1
            ? `${escalated ? "Escalation" : "Flag"} · ${dateLabel(e.occurredAt)}`
            : `${n} flags${escalated ? " including an escalation" : ""} · ${dateLabel(e.occurredAt)}`,
      });
      continue;
    }
    marks.push({
      eventId: e.id,
      cls,
      at: e.occurredAt,
      count: 1,
      ...(cls === "assessment" && e.description === instrument
        ? {
            score: scoreOf(e),
            ...(weightedByAt.has(e.occurredAt)
              ? { weighted: weightedByAt.get(e.occurredAt) }
              : {}),
          }
        : {}),
      // TODO-COPY. Type and date. NEVER the description, which can carry content.
      label: `${cls === "assessment" ? "Assessment" : "Presentation change"} · ${dateLabel(e.occurredAt)}`,
    });
  }

  return {
    spanDays,
    startAt,
    endAt,
    // TODO-DATA. No generation step exists; the span's end is the stamp.
    generatedAt: now,
    reading: trimmed,
    marks,
    instrument,
    scoreMin,
    scoreMax,
    /* ═══ EIGHT MONTH BINS, MAXIMUM ═══
       The design lead's note says 8 and the reference frame draws 7, so 8 is a
       CEILING rather than a target — a younger mentorship shows fewer, which is
       what `monthsBetween` already returns. The slice takes the MOST RECENT
       eight: on a long record the far end of the axis is the part a supervisor
       is not reading, and compressing twelve columns to fit it costs the recent
       ones their spacing. Positions still derive from `startAt`/`endAt`, so the
       kept columns sit where they always did. */
    months: monthsBetween(startAt, endAt).slice(-8),
    /* BINNED BY CALENDAR MONTH, not by the month marks' positions — an event in
       a month the axis does not show would otherwise be silently dropped rather
       than simply not rendered. `resolved` reads the event's own result, which is
       what History's rows read; the tooltip states it per event. */
    monthSafety: (() => {
      const bins = new Map<
        string,
        {
          at: number;
          escalations: { at: number; resolved: boolean }[];
          flags: { at: number; resolved: boolean }[];
        }
      >();
      for (const f of flags) {
        const d = new Date(f.occurredAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        let bin = bins.get(key);
        if (!bin) {
          bin = {
            at: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
            escalations: [],
            flags: [],
          };
          bins.set(key, bin);
        }
        const entry = {
          at: f.occurredAt,
          resolved: /resolved/i.test(String(f.result ?? "")),
        };
        if (f.type === "escalation") bin.escalations.push(entry);
        else bin.flags.push(entry);
      }
      return [...bins.values()]
        .map((b) => ({
          ...b,
          escalations: [...b.escalations].sort((x, y) => x.at - y.at),
          flags: [...b.flags].sort((x, y) => x.at - y.at),
        }))
        .sort((a, b) => a.at - b.at);
    })(),
  };
}
