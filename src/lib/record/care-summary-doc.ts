// THE CARE SUMMARY AS A PER-CYCLE CLINICAL EVIDENCE DOCUMENT.
//
// ═══ THE REFRAME THIS FILE IMPLEMENTS ═══
//
// The Care summary was an ambient rolling panel: a 21-day reading of engagement
// that refreshed whenever anyone looked at it. It is now a DOCUMENT with a
// lifecycle, covering one coding cycle — from the last diagnostic-code update
// (or intake, on a first cycle) to now — and its purpose is narrow: give a
// supervisor the qualitative context needed to designate a code, particularly
// where assessment scores and session content disagree.
//
// EVIDENCE IN, JUDGMENT OUT. This document is AI-generated INPUT to the coding
// decision. The clinician's care update is the human OUTPUT. Two documents per
// cycle, and the division of authority is the point — nothing here is authored
// by a person and nothing here is a clinical determination.
//
// ═══ THE WINDOW IS CADENCE-AGNOSTIC, DELIBERATELY ═══
//
// The implemented cadence is intake → day 30 → day 120 → quarterly
// (`care-demo.ts`, `cadenceFor`). The brief described "every 30 days". That
// discrepancy is a product decision and is NOT resolved here — instead the window
// is derived as "last code update → now", which is correct under either cadence
// and needs no rework if the cadence changes. Nothing in this file reads
// `CadenceStage`.
//
// ═══ ABSENCE RENDERS EXPLICITLY — AN INVERSION, ON PURPOSE ═══
//
// Everywhere else on this record, absence renders nothing: no pattern, no block.
// Here every element that cannot be computed says so — "No risk flags triggered
// this cycle", "None this cycle", "Insufficient data". On a clinical record a
// missing line is ambiguous between "none" and "not checked", and that ambiguity
// is unacceptable when the reader is about to assign a diagnostic code.
//
// DO NOT "TIDY" THIS INTO THE USUAL PATTERN. The empty states here are the
// feature. design-system-gaps.md row 301.

import {
  careTimelineFor,
  presentationFor,
  severityFor,
  type CareEvent,
  type CareStoreSlice,
} from "@/lib/record/care-demo";
import { categoryLabel, DEMO_TEENS } from "@/lib/record/people-demo";
import {
  CLINICAL_REVIEW_THRESHOLD,
  themeOf,
  tierOf,
  TIER_LABEL,
  THEME_LABEL,
  type RiskTier,
} from "@/lib/record/risk-taxonomy";

const DAY = 86_400_000;

type Instrument = "PHQ-9" | "GAD-7";

/** Fewer than this many conversation days and no concordance call is attempted.
 *  Matches `MIN_DAYS_ENGAGED` in `care-reading.ts`, which exists for the same
 *  reason: two exchanges are not a pattern and must not be described as one. */
export const SUMMARY_MIN_CONTACT_DAYS = 3;

/** How many qualifying flags make session content "show markers". Deliberately
 *  the same number as `CLUSTER_MIN_FLAGS` in `care-pattern.ts`, which encodes the
 *  playbook's own line: "the same flag appearing 3+ times in a month is a
 *  clinical pattern." One threshold, one source. */
export const SUMMARY_MARKER_THRESHOLD = 3;

/** WHICH FLAG TIERS COUNT AS MARKERS.
 *
 *  ═══ A REPORTED VOCABULARY CONFLICT, RESOLVED THE SAFE WAY ═══
 *
 *  The brief states this rule in the playbook's own terms — "≥3 risk flags within
 *  top-1% and/or top-5% categories". Those percentile names are the playbook's
 *  tier names, and `risk-taxonomy.ts` deliberately does not carry them: a
 *  percentile attached to a child IS a risk score, and "a Top 1% teen" is the
 *  sentence that phrasing produces. The tiers are named by the RESPONSE they
 *  require instead.
 *
 *  The mapping is ordinal and unambiguous: top 1% → `imminent`, top 5% →
 *  `clinicalReview`. The rule's LOGIC is unchanged; only the vocabulary is, and
 *  the brief's own guardrail ("the person never" carries a tier) agrees. Recorded
 *  here so the mapping stays auditable without the phrasing entering the product.
 *  design-system-gaps.md row 302. */
const QUALIFYING_TIERS: RiskTier[] = ["imminent", "clinicalReview"];

/** Severity ladders, from `severityFor`. INSTRUMENT-SPECIFIC on purpose: GAD-7
 *  has no "moderately severe" band, so a shared ladder would report a two-tier
 *  move where the instrument only has one. */
const BAND_ORDER: Record<Instrument, string[]> = {
  "PHQ-9": ["minimal", "mild", "moderate", "moderately severe", "severe"],
  "GAD-7": ["minimal", "mild", "moderate", "severe"],
};

// ─── ELEMENT 5 · CONCORDANCE ────────────────────────────────────────────────

export type ConcordanceResult = "diverges" | "concordant" | "insufficientData";

/** The three labelled fragments the statement renders. NOT a paragraph: a
 *  supervisor has to be able to check the stated threshold against criteria, and
 *  "score and content diverge" is not a checkable claim. */
export interface ConcordanceStatement {
  /** What the code on record implies — "mild (F33.0)". */
  codeImplies: string;
  /** The specific threshold the content meets. */
  contentMeets: string;
  /** The resulting gap — "one severity tier". */
  gap: string;
}

export interface ConcordanceCall {
  result: ConcordanceResult;
  /** Present only on `diverges`. */
  statement?: ConcordanceStatement;
  /** ═══ WHICH REFUSAL, AND WHY IT HAS TO BE NAMED ═══
   *
   *  Present only on `insufficientData`. The card used to render ONE sentence
   *  for both refusals — "fewer than three conversation days, or only one
   *  comparable reading" — and that disjunction is FALSE on a large part of the
   *  roster: a teen with seven months of mentorship and five assessments got a
   *  document telling their supervisor there were fewer than three conversation
   *  days, because `contactDays` comes from the mocked theme extraction and is 0
   *  wherever that mock has no row. A clinical document may refuse; it may not
   *  make a false statement about the record while refusing.
   *
   *  `contact` — no conversation content is available for this window.
   *  `readings` — fewer than two comparable assessments in it. */
  reason?: "contact" | "readings";
}

export interface ConcordanceInput {
  contactDays: number;
  instrument: Instrument | null;
  priorScore: number | null;
  currentScore: number | null;
  /** Categories per qualifying flag in the window. */
  categoriesPerFlag: string[][];
  /** The code on record, for the "implies" fragment. */
  currentCode: string | null;
}

/** ═══ DETERMINISTIC. NO MODEL JUDGMENT. ═══
 *
 *  Pure function of its input: no clock, no randomness, no network, no store
 *  read. The same input always produces the same call, which is what makes it
 *  reviewable against criteria — and is why it is a rule set rather than a
 *  prompt. Tested in `__tests__/care-summary-doc.test.ts`.
 *
 *  ORDER MATTERS AND IS INTENTIONAL:
 *
 *  1. `insufficientData` is checked FIRST. It is a refusal, not a result, and it
 *     must not be reachable only after the other branches decline to fire.
 *  2. `diverges` is checked BEFORE `concordant`. The brief's two conditions
 *     overlap — a record with matching direction, no tier movement and 4 markers
 *     satisfies both — and on a tie the more clinically consequential call has to
 *     win. REPORTED as a spec ambiguity rather than resolved silently. */
export function concordanceFor(input: ConcordanceInput): ConcordanceCall {
  if (input.contactDays < SUMMARY_MIN_CONTACT_DAYS) {
    return { result: "insufficientData", reason: "contact" };
  }
  if (
    input.instrument === null ||
    input.priorScore === null ||
    input.currentScore === null
  ) {
    // No two comparable readings: movement is undefined, so no call is possible.
    return { result: "insufficientData", reason: "readings" };
  }

  const bands = BAND_ORDER[input.instrument];
  const movement =
    bands.indexOf(severityFor(input.instrument, input.currentScore)) -
    bands.indexOf(severityFor(input.instrument, input.priorScore));

  const markers = input.categoriesPerFlag.filter((cats) =>
    cats.some((c) => {
      const t = tierOf(c);
      return t !== null && t !== "unassigned" && QUALIFYING_TIERS.includes(t);
    })
  ).length;

  if (Math.abs(movement) < 1 && markers >= SUMMARY_MARKER_THRESHOLD) {
    return {
      result: "diverges",
      statement: divergenceStatement(input, markers),
    };
  }
  return { result: "concordant" };
}

/** NAMES THE THRESHOLD, never just the disagreement.
 *
 *  `contentMeets` is built from `CLINICAL_REVIEW_THRESHOLD` — the playbook's own
 *  crossing point, exported as a threshold and explicitly not as a grade — plus
 *  the clinical themes behind the qualifying flags. That is what makes the gap
 *  checkable: a supervisor can take the stated threshold to the criteria. */
function divergenceStatement(
  input: ConcordanceInput,
  markers: number
): ConcordanceStatement {
  const instrument = input.instrument as Instrument;
  const implied = severityFor(instrument, input.currentScore as number);
  const bands = BAND_ORDER[instrument];
  const nextBand = bands[Math.min(bands.indexOf(implied) + 1, bands.length - 1)];
  const threshold = CLINICAL_REVIEW_THRESHOLD[instrument];

  const themes = Array.from(
    new Set(
      input.categoriesPerFlag
        .flat()
        .map(themeOf)
        .filter((t): t is NonNullable<ReturnType<typeof themeOf>> => t !== null)
    )
  ).map((t) => THEME_LABEL[t]);

  return {
    // TODO-COPY
    codeImplies: input.currentCode
      ? `${implied} (${input.currentCode})`
      : implied,
    // TODO-COPY. Counts and names; never quotes. The frequency claim is the
    // marker count over the window, which is a fact about the period.
    contentMeets: `${markers} flags at or above the clinical-review threshold (${instrument} ≥ ${threshold})${
      themes.length ? `, concerning ${themes.join(" and ")}` : ""
    }, consistent with ${nextBand}`,
    // TODO-COPY
    gap: bands.indexOf(nextBand) - bands.indexOf(implied) === 1
      ? "one severity tier"
      : `${bands.indexOf(nextBand) - bands.indexOf(implied)} severity tiers`,
  };
}

// ─── THE WINDOW ─────────────────────────────────────────────────────────────

export interface SummaryWindow {
  fromAt: number;
  toAt: number;
  /** No prior code, so no "since last update" comparison exists. */
  firstCycle: boolean;
}

const CODE_EVENTS = new Set([
  "presentation_assigned",
  "presentation_reviewed",
  "presentation_changed",
]);

/** LAST CODE UPDATE → NOW. Intake → now on a first cycle.
 *
 *  Reads the timeline rather than the cadence, so a cadence change needs no
 *  edit here — see the module note. "Intake" is the teen's own join date, which
 *  is the only start a first cycle can honestly claim. */
export function summaryWindowFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): SummaryWindow | null {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return null;

  const events = careTimelineFor(teenId, now, store);
  const codeUpdates = events
    .filter((e) => CODE_EVENTS.has(e.type))
    .sort((a, b) => b.occurredAt - a.occurredAt);

  const joinedAt = now - teen.joinedDaysAgo * DAY;
  if (codeUpdates.length === 0) {
    return { fromAt: joinedAt, toAt: now, firstCycle: true };
  }
  return { fromAt: codeUpdates[0].occurredAt, toAt: now, firstCycle: false };
}

// ─── ELEMENT 2 · THEME FREQUENCY (MOCKED — SEE THE NOTE) ────────────────────

export interface ThemeCount {
  /** ═══ AN ID FROM THE OFFICIAL TAXONOMY, NOT A LABEL ═══
   *
   *  This was `label: string`, and that is how "Exam stress", "Worry about
   *  school" and "Appetite loss" got onto a clinical record: a chip took whatever
   *  string a fixture handed it, and nothing could tell an invented phrase from a
   *  canonical one.
   *
   *  Now it is an id into `content-tags.ts`. A copy change to a label is not a
   *  data migration, an unknown id is loud in DEV rather than silent, and the
   *  retired placeholders are unrepresentable because they have no id. */
  tagId: string;
  days: number;
}

/** ═══ TODO-DATA. THIS IS MOCKED, AND THE CARD SAYS SO. ═══
 *
 *  There is no transcript store, no session-note store, and no theme extraction
 *  anywhere in this codebase — reported at the Phase 0 gate. So both halves of
 *  this element are fixture data and the provenance line names it as mocked.
 *
 *  ═══ AND THE DENOMINATOR IS NOT "SESSIONS" ═══
 *
 *  The brief asks for "Sleep disturbance 7/9" over sessions in the window. This
 *  product has no sessions: mentoring is asynchronous chat, and the engagement
 *  data carries exchanges, days engaged and reply latency — never a discrete
 *  session. "7/9 sessions" would import a therapy-session model into a chat
 *  product, and a supervisor checking that denominator would find nothing behind
 *  it. CONVERSATION DAYS is the honest unit and the one the data would actually
 *  support if the extraction existed.
 *
 *  A fixture rather than a hash of the teen id, deliberately: authored numbers
 *  are visibly authored, where a hash is invented precision wearing the costume
 *  of derivation. Teens without an entry render the explicit unavailable state,
 *  which is also how the insufficient-data variants are reachable in the demo. */
const THEME_FIXTURE: Record<
  string,
  { conversationDays: number; themes: ThemeCount[] }
> = {
  /* ═══ TAGS CHOSEN FOR THE RECORD'S OWN TRACK ═══
     A PHQ-9 record draws its content tags from Depression plus whatever SDOH and
     risk tags the story supports; a GAD-7 record draws from Anxiety. Mixing them
     would put a GAD-7 item on a depression record and make the tag set disagree
     with the instrument the card is scored against.
     "Low mood" became `low-mood-hopelessness` — the canonical label is "Low mood
     / hopelessness", and the shortened form was itself a placeholder. */
  t17: {
    conversationDays: 9,
    themes: [
      { tagId: "sleep-disturbance", days: 7 },
      { tagId: "low-mood-hopelessness", days: 6 },
      { tagId: "school-avoidance", days: 4 },
    ],
  },
  // GAD-7 TRACK. "Worry about school" → `excessive-worry`, which is the GAD-7
  // item it was standing in for.
  t18: {
    conversationDays: 11,
    themes: [
      { tagId: "excessive-worry", days: 8 },
      { tagId: "restlessness", days: 5 },
    ],
  },
  // PHQ-9 TRACK. "Withdrawal from friends" → `social-isolation`, the SDOH tag
  // for the thing that phrase described. It is deliberately NOT
  // `social-avoidance`: avoidance is a fear of judgment, isolation is the state,
  // and this record's story is the state.
  t19: {
    conversationDays: 8,
    themes: [
      { tagId: "low-mood-hopelessness", days: 6 },
      { tagId: "social-isolation", days: 4 },
      { tagId: "appetite-change", days: 3 },
    ],
  },
  // Two contact days: the fewer-than-three variant, and the reason element 2 and
  // element 5 both have to be able to refuse.
  t21: { conversationDays: 2, themes: [{ tagId: "low-mood-hopelessness", days: 2 }] },
};

// ─── ELEMENTS 3 & 4 ─────────────────────────────────────────────────────────

export interface WindowFlag {
  /** The `CareEvent.id`, so the card can link into History. */
  eventId: string;
  tier: RiskTier | "unassigned";
  tierLabel: string;
  /** TODO-COPY — the category's own label, never the raw wire value. */
  categoryLabels: string[];
  at: number;
  resolved: boolean;
}

/** TODO-DATA. "New" and "resolved" content relative to the prior code. There is
 *  no content pipeline to diff, so these are fixture-derived like element 2 and
 *  carry the same provenance label. */
const CONTENT_DELTA_FIXTURE: Record<
  string,
  { added: string[]; resolved: string[] }
> = {
  /* ═══ t17 EXERCISES ALL THREE TOOLTIP BEHAVIOURS (Workstream C2) ═══
       · `appetite-change`  — ANNOTATED, so its tooltip renders whatever the width
       · `peer-difficulty`  — 57 characters, so it TRUNCATES and tooltips
       · `bullying-online`  — a SUB-TAG, tooltipped as "Bullying → Online /
         cyberbullying", and clinically coherent beside school avoidance and peer
         difficulty on this record.
     "Appetite loss" → `appetite-change` (the canonical tag, which the record's
     own theme list already used); "Friend conflict" → `peer-difficulty`. */
  t17: {
    added: ["appetite-change", "peer-difficulty", "bullying-online"],
    resolved: ["panic-episodes"],
  },
  // "Exam stress" → `anticipatory-fear`, the GAD-7 item it stood in for on a
  // GAD-7 record.
  t18: { added: ["anticipatory-fear"], resolved: [] },
  t19: { added: [], resolved: ["school-avoidance"] },
};

// ─── THE DOCUMENT ───────────────────────────────────────────────────────────

export interface CareSummaryDoc {
  teenId: string;
  window: SummaryWindow;
  /** TODO-DATA — there is no generation step, so this is the read time. */
  generatedAt: number;
  /** Named for the provenance block. */
  sources: string[];
  /** Element 1. Null when it cannot be stated honestly — see the rule below. */
  trajectory: string | null;
  /** Element 2. Null = no extraction available for this teen. */
  themes: { conversationDays: number; themes: ThemeCount[] } | null;
  /** Element 3. `null` on a first cycle: "resolved" has no referent. */
  contentDelta: { added: string[]; resolved: string[] } | null;
  /** Element 4. Empty array is meaningful and renders explicitly. */
  flags: WindowFlag[];
  /** Element 5. */
  concordance: ConcordanceCall;
  contactDays: number;
  currentCode: string | null;
}

/** ═══ WHY ELEMENT 1 REFUSES UNDER INSUFFICIENT DATA ═══
 *
 *  Element 1 is a claim about DIRECTION OF CHANGE, and direction needs two
 *  comparable observations. Under three contact days there is at most one
 *  assessment and almost no content, so any sentence written from it is either a
 *  restatement of a single score or a guess with a hedge on it.
 *
 *  Prose carries no visible confidence marker — that is exactly why the brief
 *  gives element 1 no chip — so a reader cannot tell a thin trajectory sentence
 *  from a solid one. Guardrail 5 forbids "a hedged sentence that reads like a
 *  finding", and a trajectory sentence is the shape most likely to become one.
 *
 *  THE ONE EXCEPTION: if two assessments exist inside the window, element 1 may
 *  state the SCORE movement alone, attributed to assessments and explicitly not
 *  to content. That is a fact about two numbers, not an interpretation of a
 *  window nobody observed. */
function trajectoryFor(
  assessments: { at: number; score: number; instrument: Instrument }[],
  contactDays: number
): string | null {
  if (assessments.length < 2) return null;

  const first = assessments[0];
  const last = assessments[assessments.length - 1];
  const from = severityFor(first.instrument, first.score);
  const to = severityFor(last.instrument, last.score);
  const thin = contactDays < SUMMARY_MIN_CONTACT_DAYS;
  /** ═══ WHAT "THIN" ACTUALLY MEANS, AND WHAT IT DOES NOT ═══
   *
   *  `contactDays` comes from the theme extraction, which is mocked and has no
   *  row for most of the roster — so `thin` means NO CONVERSATION CONTENT WAS
   *  EXTRACTED, not that little contact occurred. These sentences used to say
   *  "there was too little contact in the window", which is false on any record
   *  with real tenure and no extraction: a teen with four months of mentorship
   *  and 26 exchanges got a document asserting the opposite to their supervisor.
   *
   *  The clause is still needed — element 1 must say it spoke from scores alone —
   *  so it names the missing INPUT instead of inventing a fact about contact.
   *  TODO-COPY. */
  const scoresOnly =
    "Stated from assessments only — no conversation content is available for this window."; // TODO-COPY

  // TODO-COPY. Describes the window; never forecasts, never attributes a cause.
  if (from === to) {
    return thin
      ? `${last.instrument} has held in the ${to} band across ${assessments.length} readings this cycle. ${scoresOnly}`
      : `${last.instrument} has held in the ${to} band across ${assessments.length} readings, with the most recent at ${last.score}.`;
  }
  const dir = last.score > first.score ? "risen" : "come down";
  return thin
    ? `${last.instrument} has ${dir} from the ${from} band to the ${to} band across ${assessments.length} readings. ${scoresOnly}`
    : `${last.instrument} has ${dir} from the ${from} band to the ${to} band across ${assessments.length} readings, reaching ${last.score} most recently.`;
}

function scoreOf(e: CareEvent): number {
  return Number.parseInt(e.result, 10);
}

export function careSummaryFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): CareSummaryDoc | null {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  const window = summaryWindowFor(teenId, now, store);
  if (!teen || !window) return null;

  const inWindow = (at: number) => at >= window.fromAt && at <= window.toAt;
  const events = careTimelineFor(teenId, now, store);

  // ── assessments in the window, oldest first ──
  const assessmentEvents = events
    .filter((e) => e.type === "assessment" && inWindow(e.occurredAt))
    .sort((a, b) => a.occurredAt - b.occurredAt);
  const instrument =
    (assessmentEvents[assessmentEvents.length - 1]?.description as
      | Instrument
      | undefined) ?? null;
  const assessments = assessmentEvents
    .filter((e) => e.description === instrument)
    .map((e) => ({
      at: e.occurredAt,
      score: scoreOf(e),
      instrument: e.description as Instrument,
    }))
    .filter((a) => Number.isFinite(a.score));

  // ── flags in the window, with their tier from the source record ──
  const flagEvents = events.filter(
    (e) =>
      (e.type === "risk_flag" || e.type === "escalation") &&
      inWindow(e.occurredAt)
  );
  const flags: WindowFlag[] = flagEvents.map((e) => {
    const rec = (teen.careFlags ?? []).find(
      (c) => Math.abs(now - c.daysAgo * DAY - e.occurredAt) < DAY
    );
    const cats = rec?.categories ?? [];
    // Highest tier the flag carries — a flag with two categories is routed by
    // the more urgent of them.
    const tier =
      cats
        .map(tierOf)
        .find((t) => t === "imminent") ??
      cats.map(tierOf).find((t) => t === "clinicalReview") ??
      cats.map(tierOf).find((t) => t === "generalMonitoring") ??
      "unassigned";
    const resolvedTier = (tier ?? "unassigned") as RiskTier | "unassigned";
    return {
      eventId: e.id,
      tier: resolvedTier,
      tierLabel:
        resolvedTier === "unassigned"
          ? "Unassigned" // TODO-COPY
          : TIER_LABEL[resolvedTier],
      categoryLabels: cats.map(categoryLabel),
      at: e.occurredAt,
      resolved: rec?.resolvedDaysAgo !== undefined,
    };
  });

  const themes = THEME_FIXTURE[teenId] ?? null;
  const contactDays = themes?.conversationDays ?? 0;
  const presentation = presentationFor(teenId, now, store);
  const currentCode = presentation?.code ?? null;

  const concordance = concordanceFor({
    contactDays,
    instrument,
    priorScore: assessments.length >= 2 ? assessments[0].score : null,
    currentScore: assessments.length
      ? assessments[assessments.length - 1].score
      : null,
    categoriesPerFlag: flags.map((f) =>
      (teen.careFlags ?? [])
        .filter((c) => Math.abs(now - c.daysAgo * DAY - f.at) < DAY)
        .flatMap((c) => c.categories ?? [])
    ),
    currentCode,
  });

  return {
    teenId,
    window,
    generatedAt: now,
    // TODO-COPY. Names what was drawn on, including what is mocked, because the
    // provenance block has to be honest about the difference.
    sources: [
      "Assessment history",
      "Risk flag log",
      "Presentation history",
      "Theme extraction (mocked — no pipeline)",
    ],
    trajectory: trajectoryFor(assessments, contactDays),
    themes: contactDays >= SUMMARY_MIN_CONTACT_DAYS ? themes : null,
    // FIRST CYCLE: "resolved" has no prior code to be relative to, so the element
    // states that rather than rendering an empty row.
    contentDelta: window.firstCycle
      ? null
      : (CONTENT_DELTA_FIXTURE[teenId] ?? { added: [], resolved: [] }),
    flags,
    concordance,
    contactDays,
    currentCode,
  };
}

// ─── COMMITTING A SUMMARY TO THE RECORD ─────────────────────────────────────
//
// ═══ WHY A SNAPSHOT AND NOT A RE-DERIVATION ═══
//
// `careSummaryFor` reads the record as it stands NOW. That is right for a draft
// and wrong for a record entry: flags get resolved, codes change, a later
// assessment lands. Re-deriving a committed summary would silently rewrite what
// a supervisor saw when they made the decision, and the decision would end up
// justified by evidence that did not exist at the time.
//
// So a commit freezes the FINDINGS — not the prose, not the layout — at the
// moment the cycle's review is approved. Same discipline as the changeRequests
// baseline (standing rule 1): captured at the moment of the act, never
// recomputed. The labels are deliberately NOT stored: they resolve from the
// taxonomy at read time, so a copy fix never edits a record entry — except the
// theme labels, which have no ids to resolve from; see the field.
//
// ═══ WHAT IS DELIBERATELY ABSENT ═══
//
// No message text, no transcript excerpts, no per-theme prose (no verbatim
// content). No numeric composite of the flags (no sentiment score). Counts per
// tier, never a tier for the teen (no person-level tiering). And no sentence
// about what any of it caused or predicts.

/** A committed summary, frozen at the moment its cycle's review was approved. */
export interface CareSummaryCommit {
  /** Doubles as the `CareEvent.id` of the History row this becomes. */
  id: string;
  teenId: string;
  committedAt: number;
  /** The window the evidence covered. Named on the row so a frozen summary can
   *  never be mistaken for a current read. Same vocabulary as `SummaryWindow`
   *  on purpose — two names for one span is how they drift apart. */
  windowFromAt: number;
  windowToAt: number;
  /** Carried, not re-derived: whether this was the record's FIRST cycle is a
   *  fact about the moment, and a later code update would erase it. */
  firstCycle: boolean;
  /** The CALL, not a score. */
  concordance: ConcordanceResult;
  /** Code in force when the summary was committed. */
  code: string | null;
  /** The themes the document named, each with its conversation-day count.
   *
   *  LABELS, NOT TAXONOMY IDS — because there are none. Element 2 is fixture
   *  data (this codebase has no theme extraction, reported at the Phase 0 gate),
   *  so the labels ARE the data and there is no id behind them to store instead.
   *  If extraction ever lands this becomes theme ids resolved at read time, and
   *  entries written before then keep their labels — which is why the type is
   *  `ThemeCount` and not `RiskTheme`.
   *
   *  A COUNT WITHOUT ITS DENOMINATOR IS NOT EVIDENCE: `conversationDays` travels
   *  with them, so "Sleep disturbance 7" can never be read against the wrong
   *  base. Null when element 2 refused. */
  themes: ThemeCount[];
  conversationDays: number | null;
  /** COUNTS PER TIER, never a tier for the person. */
  markerCounts: Record<RiskTier | "unassigned", number>;
  contactDays: number;
  /** The `CareEvent.id` of the care update documenting the same cycle.
   *
   *  SET AT COMMIT TIME, in the same handler that writes the update — the two
   *  are written together, so there is never a moment where this points at
   *  nothing. It is not settable afterwards, which is the point: nothing in the
   *  store edits a committed entry, so a cross-reference cannot be added later
   *  to a record it was not part of. */
  documents?: string;
}

/** Freezes `doc` into a record entry. Pure — the caller supplies the id and the
 *  clock, so this is as testable as `concordanceFor`. */
export function commitFor(
  doc: CareSummaryDoc,
  id: string,
  committedAt: number,
  /** The care update written in the same act. See the field. */
  documents?: string
): CareSummaryCommit {
  const markerCounts: Record<RiskTier | "unassigned", number> = {
    imminent: 0,
    clinicalReview: 0,
    generalMonitoring: 0,
    unassigned: 0,
  };
  for (const flag of doc.flags) markerCounts[flag.tier] += 1;

  return {
    id,
    teenId: doc.teenId,
    committedAt,
    windowFromAt: doc.window.fromAt,
    windowToAt: doc.window.toAt,
    firstCycle: doc.window.firstCycle,
    concordance: doc.concordance.result,
    code: doc.currentCode,
    // COPIED, not aliased. `doc.themes.themes` is a fixture array shared across
    // every read of that teen; storing the reference would put a live object
    // inside a frozen record, and a mutation anywhere would silently edit
    // history. An empty array is the honest record of a cycle whose theme
    // element refused.
    themes: doc.themes?.themes.map((t) => ({ ...t })) ?? [],
    conversationDays: doc.themes?.conversationDays ?? null,
    markerCounts,
    contactDays: doc.contactDays,
    documents,
  };
}
