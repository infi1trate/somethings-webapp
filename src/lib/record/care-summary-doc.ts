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
import {
  blockById,
  blockWindowFor,
  type CareTimeBlockId,
} from "@/lib/record/care-time-block";
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
  /* ═══ BOTH BUCKETS, BECAUSE THE CARD NOW HAS TWO ═══
     The rail splits these into Symptoms and Environmental factors on the tag's
     own `category`, and this record carried only symptom-side tags — so the
     longitudinal case, which is the one the design file mocks, rendered one
     heading and left the other unreachable in the demo.
     The three SDOH ids are the design file's own, and they exist verbatim in
     the taxonomy: `divorce-separation`, `household-substance-use`,
     `family-member-illness`. None was invented to fill the section.
     THE DAYS STILL HAVE TO BE A STORY. They sit under `conversationDays: 9`
     alongside a household that is coming apart and a family illness, which is
     the same story the escalations on this record tell — a fixture whose
     environment tags contradicted its flags would be worse than an empty
     section. */
  t17: {
    conversationDays: 9,
    themes: [
      { tagId: "sleep-disturbance", days: 7 },
      { tagId: "low-mood-hopelessness", days: 6 },
      { tagId: "school-avoidance", days: 4 },
      { tagId: "household-substance-use", days: 6 },
      { tagId: "family-member-illness", days: 4 },
      { tagId: "divorce-separation", days: 3 },
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

/** ═══ THE QUALITATIVE READ, PER SCENARIO ═══
 *
 *  Written to agree with the record each one sits on — its tags, its flags and
 *  its escalations. A summary that described a settled mentorship on a record
 *  carrying an open escalation would be worse than no summary, because a reader
 *  would have to work out which of the two the card meant.
 *
 *  Scanned against the rules on `conversationSummary`: no quotation marks
 *  anywhere, no presentation names, no code letters, no "patient", and every
 *  reference to a flag is to the EVENT and its date rather than to what was
 *  said. A record with no entry here renders the empty state.
 *
 *  TODO-COPY, all of it. Synthetic; no real names. */
/** ═══ PER-BLOCK CONVERSATION DATA — WHAT COULD NOT BE COMPUTED ═══
 *
 *  Phase 0's feasibility split, recorded so the next reader does not re-derive
 *  it. Given the block's date range:
 *
 *    COMPUTABLE from existing fixtures, because the source events are DATED:
 *      · assessments in the block, and therefore the trajectory sentence
 *      · risk flags in the block
 *      · the chart's plot and its month bins
 *
 *    NOT COMPUTABLE, because the source has counts but no dates:
 *      · engaged days and exchanges — `THEME_FIXTURE.conversationDays` is one
 *        number for the whole record and `careReadingFor` is unwindowed
 *      · chip counts — a theme carries `days: 7` with no dates behind it
 *      · the conversation summary — prose, and there is no pipeline
 *
 *  So the three uncomputable ones are stated per block for the two scenarios the
 *  pack names, and every other record degrades to the existing empty states
 *  rather than showing another block's numbers. STALE TEXT IS THE FAILURE MODE
 *  THIS SHAPE EXISTS TO PREVENT: a 7-day view carrying the all-time summary
 *  would be a sentence about seven days that describes two hundred.
 *
 *  THE NUMBERS ARE MONOTONE BY CONSTRUCTION — a shorter block can never report
 *  more engaged days, more exchanges, or a higher chip count than a longer one
 *  containing it. Asserted in the tests, because a hand-written table is exactly
 *  where that stops being true. */
const BLOCK_CONVERSATION: Record<
  string,
  Partial<
    Record<
      CareTimeBlockId,
      {
        conversationDays: number;
        exchanges: number;
        themes: ThemeCount[];
        summary: string | null;
      }
    >
  >
> = {
  /* ═══ RICH LONGITUDINAL — VISIBLY DIFFERENT ACROSS THREE BLOCKS ═══
     The chip SET changes, not only the counts: `divorce-separation` and
     `family-member-illness` are household threads that ran earlier in the
     mentorship and do not appear in the last seven days, so they drop out of
     Recent entirely. That is the toggle demonstrably changing the data rather
     than rescaling one set of numbers. */
  t17: {
    recent: {
      conversationDays: 3,
      exchanges: 7,
      themes: [
        { tagId: "sleep-disturbance", days: 3 },
        { tagId: "low-mood-hopelessness", days: 2 },
        { tagId: "household-substance-use", days: 1 },
      ],
      summary:
        "Three engaged days this week, all teen-initiated. Sleep has come up on each of them and low mood on two. The escalation raised on Sep 1 about access to a phone is still open and with a supervisor.",
    },
    d30: {
      conversationDays: 9,
      exchanges: 22,
      themes: [
        { tagId: "sleep-disturbance", days: 7 },
        { tagId: "low-mood-hopelessness", days: 6 },
        { tagId: "school-avoidance", days: 4 },
        { tagId: "household-substance-use", days: 6 },
        { tagId: "family-member-illness", days: 4 },
        { tagId: "divorce-separation", days: 3 },
      ],
      summary:
        "Contact has been steady through the month, with the teen initiating most of the scheduled calls and keeping the two that were moved. Sleep and low mood are the themes that recur most, and school avoidance has come up in about half the conversations. An escalation raised on Sep 1 about access to a phone remains open.",
    },
    d90: {
      conversationDays: 24,
      exchanges: 61,
      themes: [
        { tagId: "sleep-disturbance", days: 18 },
        { tagId: "low-mood-hopelessness", days: 15 },
        { tagId: "school-avoidance", days: 11 },
        { tagId: "household-substance-use", days: 14 },
        { tagId: "family-member-illness", days: 9 },
        { tagId: "divorce-separation", days: 7 },
      ],
      summary:
        "Across the quarter the pattern has been consistent engagement against a household that keeps reappearing in the conversations. Sleep is the most persistent theme and low mood tracks alongside it. School avoidance surfaced in the middle of the period and has not settled. Two escalations were raised in the quarter and one remains open.",
    },
    all: {
      conversationDays: 58,
      exchanges: 149,
      themes: [
        { tagId: "sleep-disturbance", days: 41 },
        { tagId: "low-mood-hopelessness", days: 36 },
        { tagId: "school-avoidance", days: 22 },
        { tagId: "household-substance-use", days: 31 },
        { tagId: "family-member-illness", days: 18 },
        { tagId: "divorce-separation", days: 14 },
      ],
      summary:
        "Across the whole mentorship the record reads as sustained engagement through an unsettled home. Sleep and low mood have been present from the first month and have moved together. The household threads — a separation, a family illness, substance use at home — recur across the period rather than clustering in it. Engagement has not dropped off as the scores have moved, which is the most consistent feature of the record.",
    },
  },

  /* ═══ 90-DAY REVIEW DUE — the GAD-7 track, thinner contact ═══ */
  t23: {
    recent: {
      conversationDays: 2,
      exchanges: 5,
      themes: [{ tagId: "excessive-worry", days: 2 }],
      summary:
        "Two engaged days this week, both short exchanges between scheduled calls. Worry about school was the only theme raised.",
    },
    d30: {
      conversationDays: 7,
      exchanges: 18,
      themes: [
        { tagId: "excessive-worry", days: 6 },
        { tagId: "restlessness", days: 3 },
      ],
      summary:
        "Contact has been steady across the month, with short exchanges between the scheduled calls. Worry about school is the theme that recurs and has stayed level rather than building. No flags were raised.",
    },
    d90: {
      conversationDays: 19,
      exchanges: 44,
      themes: [
        { tagId: "excessive-worry", days: 15 },
        { tagId: "restlessness", days: 8 },
        { tagId: "school-avoidance", days: 4 },
      ],
      summary:
        "Over the quarter worry about school has been the constant, present in most engaged days and at a steady level. Restlessness appears alongside it in about half. School avoidance came up a few times early in the period and has not recurred.",
    },
    all: {
      conversationDays: 26,
      exchanges: 61,
      themes: [
        { tagId: "excessive-worry", days: 20 },
        { tagId: "restlessness", days: 11 },
        { tagId: "school-avoidance", days: 5 },
      ],
      summary:
        "The mentorship has been consistent since matching, with worry about school present from the start and holding at the same level rather than building. Restlessness tracks with it. Nothing in the record has been raised as a flag or an escalation.",
    },
  },
};

const SUMMARY_FIXTURE: Record<string, string> = {
  // RICH LONGITUDINAL — carries an OPEN escalation, and the summary says so.
  t17: "Contact has been steady through the window, with the teen initiating most of the scheduled calls and keeping the two that were moved. Sleep and low mood are the themes that recur most, and school avoidance has come up in about half the conversations. The household has been a consistent backdrop rather than an occasional one, with an illness in the family and a separation both referred to across the period. An escalation raised on Sep 1 about access to a phone remains open and is with a supervisor. Engagement itself has not dropped off as the scores have moved.",
  // STEADY HEALTHY — the quiet case, and it should read as quiet without
  // reading as empty. No flags to reference.
  t18: "The mentorship has been consistent across the window, with calls kept at their scheduled times and short exchanges in between. Worry about school is the theme that comes up most often and has stayed at the same level rather than building. Nothing in the period was raised as a flag or an escalation. The teen has been the one to start most conversations, which has held steady since matching.",
  // 90-DAY REVIEW DUE — thinner contact, one recurring theme, no open events.
  t19: "Contact has been lighter this window than the last, with two calls moved and both kept. Low mood is the theme that recurs, and the teen has twice described pulling back from friends rather than from the mentorship itself. Appetite came up in a smaller number of conversations. No flags were raised in the period.",
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
  /** ═══ THE QUALITATIVE READ — 3-5 SENTENCES, OR NULL ═══
   *
   *  What the numbers above cannot say: how the mentorship is going. Null when
   *  there is no conversation content in the window, which the rail states
   *  rather than hides.
   *
   *  THREE RULES, ENFORCED IN THE FIXTURES AND BINDING ON THE REAL PIPELINE:
   *  · NEVER VERBATIM. It describes patterns, engagement and status; a teen's
   *    own words never appear here, and no quotation marks around teen speech
   *    ever. This is the rail — the one place verbatim content is allowed on
   *    this record is a flag's own field set, which is a different surface with
   *    its own recorded justification.
   *  · NEVER DIAGNOSTIC. No conclusions, no code suggestions. The review flow
   *    diagnoses; this observes. A sentence here that named a presentation would
   *    be a second opinion competing with the one on the card above.
   *  · EVENTS ARE FAIR GAME AT EVENT LEVEL — "an escalation opened Aug 29
   *    remains open" — which is what the flag rows in History already say.
   *
   *  TODO-DATA: fixture. There is no summarization pipeline. */
  conversationSummary: string | null;
  /** Element 3. `null` on a first cycle: "resolved" has no referent. */
  contentDelta: { added: string[]; resolved: string[] } | null;
  /** Element 4. Empty array is meaningful and renders explicitly. */
  flags: WindowFlag[];
  /** Element 5. */
  concordance: ConcordanceCall;
  contactDays: number;
  /** How many assessments fall inside the window. The card needs the COUNT, not
   *  just "fewer than two": a block with one reading and a block with none are
   *  different facts, and one refusal sentence for both said "no new assessment"
   *  over a period that had one. */
  assessmentsInWindow: number;
  /** Exchanges in the window. Null outside a block — the cadence-window caller
   *  has never had a windowed count and the card falls back to its own prop. */
  exchanges: number | null;
  currentCode: string | null;
}

/** ═══ THE CONTACT FLOOR IS PROPORTIONAL INSIDE A BLOCK ═══
 *
 *  `SUMMARY_MIN_CONTACT_DAYS` is 3, and it was calibrated for a CADENCE window —
 *  a whole review cycle, where three engaged days really is almost no
 *  conversation. Applied unchanged to a 7-day block it is far too strict:
 *  measured on t23, whose Recent block has 2 engaged days out of 7, the floor
 *  gated off both the chips and the summary and the block rendered as though
 *  nothing had happened that week. Two days in seven is real engagement; two in
 *  ninety is not, and one number cannot mean both.
 *
 *  So the floor is `min(3, ceil(25% of the block))`: 2 for the 7-day block, 3
 *  everywhere else — the cadence behaviour is unchanged for every existing
 *  caller, because a cadence window is always long enough for the 3 to bind. A
 *  proportion rather than a table, so a future block length gets an answer
 *  without an edit.
 *
 *  EXPORTED SO A TEST CAN BIND TO IT rather than restate it. What the floor
 *  decides is not only whether the chips render: it is also the reason a
 *  rendered engaged-day count can never be 1, which is a claim about the copy
 *  the card is able to show. A test that recomputed `min(3, ceil(…))` locally
 *  would keep passing after this formula changed. */
export function contactFloorFor(block?: CareTimeBlockId): number {
  const blockDays = block ? blockById(block).days : null;
  return blockDays
    ? Math.min(SUMMARY_MIN_CONTACT_DAYS, Math.ceil(blockDays * 0.25))
    : SUMMARY_MIN_CONTACT_DAYS;
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
  store: CareStoreSlice = {},
  /** ═══ THE VIEWING BLOCK, AND WHAT IT DOES NOT TOUCH ═══
   *
   *  Rail time-block is a viewing control; clinical review windows are
   *  cadence-anchored and independent.
   *
   *  Omitted means the cadence window — last code update → now — which is what
   *  every caller wanted before this parameter existed and what the COMMITTED
   *  summary must keep using: a frozen document's window is the period its
   *  decision rested on, not a period someone later chose to look at.
   *
   *  `commitFor` therefore never passes a block, and `pendingReviewFor` never
   *  reads this function at all. */
  block?: CareTimeBlockId
): CareSummaryDoc | null {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  /** THE CADENCE WINDOW, KEPT EVEN WHEN A BLOCK IS SET. One thing still needs
   *  it: `firstCycle` means "there is no prior code to be relative to", which is
   *  a fact about the record's history and not about the period being viewed. A
   *  7-day block on a record with three code changes is not a first cycle. */
  const cadence = summaryWindowFor(teenId, now, store);
  const blockWindow = block ? blockWindowFor(teenId, now, block) : null;
  const window: SummaryWindow | null = blockWindow
    ? { fromAt: blockWindow.fromAt, toAt: blockWindow.toAt, firstCycle: cadence?.firstCycle ?? true }
    : cadence;
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

  /* ═══ THE PER-BLOCK TABLE WINS WHEN A BLOCK IS SET, AND ITS ABSENCE IS AN
        EMPTY STATE RATHER THAN A FALLBACK ═══
     `?? null`, NOT `?? THEME_FIXTURE[teenId]`. Falling back to the unwindowed
     fixture is precisely the stale-text failure: a record with no 7-day entry
     would render its all-time chips under a line that says "Sep 3 – Sep 10".
     A block with no data degrades to the existing empty state, which is honest
     and is what the pack asks for. */
  const perBlock = block ? (BLOCK_CONVERSATION[teenId]?.[block] ?? null) : null;
  const themes = block
    ? (perBlock ? { conversationDays: perBlock.conversationDays, themes: perBlock.themes } : null)
    : (THEME_FIXTURE[teenId] ?? null);
  const contactDays = themes?.conversationDays ?? 0;

  /* The floor, per block — see `contactFloorFor`. */
  const contactFloor = contactFloorFor(block);
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
    themes: contactDays >= contactFloor ? themes : null,
    /* GATED ON THE SAME CONTACT FLOOR AS THE THEMES. A qualitative read of a
       window with almost no conversation in it is the same problem element 1
       refuses for: prose with no visible confidence marker, indistinguishable
       from a solid one. One floor, both elements. */
    conversationSummary:
      contactDays >= contactFloor
        ? block
          ? (perBlock?.summary ?? null)
          : (SUMMARY_FIXTURE[teenId] ?? null)
        : null,
    // FIRST CYCLE: "resolved" has no prior code to be relative to, so the element
    // states that rather than rendering an empty row.
    contentDelta: window.firstCycle
      ? null
      : (CONTENT_DELTA_FIXTURE[teenId] ?? { added: [], resolved: [] }),
    flags,
    concordance,
    contactDays,
    /** ═══ EXCHANGES MOVED ONTO THE DOCUMENT ═══
     *  The card used to be HANDED this by `care-tab`, from `careReadingFor`,
     *  which is unwindowed — the comment there records the bug it caused, a
     *  subtitle reading "21 exchanges" beside a line naming a shorter period.
     *  With a block control that mismatch stops being a one-off and becomes the
     *  normal case, so the count now comes from the same place as the days it
     *  sits beside. Null when the block has no entry, and the subtitle then
     *  reports days alone. */
    assessmentsInWindow: assessments.length,
    exchanges: block ? (perBlock?.exchanges ?? null) : null,
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
