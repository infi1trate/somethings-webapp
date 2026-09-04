// THE RISK CATEGORY TAXONOMY — transcribed from the Risk Flagging Escalation
// Playbook (Notion, "The Somethings Mentor Guidebook (2026)").
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS FILE EXISTS. Before it, `CATEGORY_LABEL` in people-demo.ts held five
// safety categories and nothing else — no tier, no clinical theme, no grouping
// axis. The Care pattern block needs to say "two of these involved self-harm",
// and five flat labels cannot support that sentence.
//
// The playbook supplies TWO independent axes, and keeping them independent is the
// point:
//
//   TIER   — how fast a supervisor must respond. Imminent risk / Clinical
//            support / General monitoring. A property of the FLAG, and the
//            action each one asks for is `TIER_ACTION`.
//   THEME  — what the flag is clinically about. Self-harm, harm to others,
//            abuse and environment, substance use, eating and body image,
//            psychosis, peer harm, assessment. A property of the FLAG.
//
// ═══ THE TIER IS NEVER APPLIED TO THE TEEN ═══
//
// The playbook names its tiers by population percentile — "Top 1%", "Top 5%".
// THOSE NAMES DO NOT APPEAR IN THIS PRODUCT and must not. A percentile attached
// to a child IS a risk score, which the governing rules forbid outright, and
// "a Top 1% teen" is exactly the sentence that phrasing produces. The tiers are
// therefore named by the RESPONSE they require — the playbook's own action
// language — so the label describes what staff do, not what the teen is.
//
// Same reason the playbook's 🔴🔵🟢 is not carried over: a colour-coded person is
// named in the guardrails as out of bounds, and colour alone fails WCAG 1.4.1
// regardless.
//
// ═══ WHAT THE PLAYBOOK ADDS BEYOND THE TAXONOMY ═══
//
// It also mandates the pattern surface directly, which is worth recording because
// it is the clinical justification for the Care pattern block existing at all:
//
//   · "A single general flag may be low urgency; the same flag appearing 3+ times
//      in a month is a clinical pattern."
//   · "Connect to a pattern if one is developing: 'This is the third time [teen]
//      has mentioned [X]'."
//   · "Supervisor tracks score trajectory across assessments — a stable mild
//      score is different from a mild score that is incrementally worsening."
//   · "If score elevation pairs with other general tier flags in the same period,
//      supervisor considers escalating based on cumulative clinical picture."
//
// Co-occurrence of flags and score movement over a period, with repetition
// counted, is the block's whole job. See `care-pattern.ts`.
//
// TWO THINGS TO REPORT, both recorded here rather than resolved by guess:
//   1. `GROOMING_BEHAVIOR` predates the playbook and is NOT one of its twenty
//      categories. It keeps its label and its theme, and its tier is
//      "unassigned" — assigning one would be inventing clinical routing.
//   2. The playbook's own General-tier timing is inconsistent: the summary table
//      says "Within 7 days", Part 3 says "within 48 hours". NO SLA IS ENCODED
//      HERE — response clocks belong to the escalation workflow, which is out of
//      scope for this surface. The tier names carry no timing.
// ═══════════════════════════════════════════════════════════════════════════

/** How fast a supervisor must respond. Named by the RESPONSE, never by a
 *  percentile — see the module note. */
export type RiskTier = "imminent" | "clinicalReview" | "generalMonitoring";

/** TODO-COPY. Sentence case, and it describes the staff action.
 *
 *  "CLINICAL SUPPORT", NOT "CLINICAL REVIEW" — the product owner's term, and it
 *  is the better one: "review" names an act of looking, "support" names what the
 *  clinician is there to provide. The key stays `clinicalReview` because it is a
 *  wire value written into fixtures and into `QUALIFYING_TIERS`; renaming it
 *  would orphan them for a copy change. This label reaches the care summary
 *  document and the commit sentence as well as the flag chip, which is the point
 *  of it living here — one term, every surface. */
export const TIER_LABEL: Record<RiskTier, string> = {
  imminent: "Imminent risk",
  clinicalReview: "Clinical support",
  generalMonitoring: "General monitoring",
};

/** ═══ WHAT THE TIER ASKS STAFF TO DO ═══
 *
 *  The tier label names the response; this is the response. Kept beside the
 *  labels rather than in the component that shows them, because the same
 *  sentence has to be available anywhere a tier is explained and a second
 *  wording is how one policy becomes several.
 *
 *  ═══ NO PERCENTILES HERE EITHER ═══
 *  The playbook defines these bands as "Top 1%" / "Top 5%" / the rest, and that
 *  is where the definition stops. The module note above says why those names do
 *  not appear in this product: a percentile attached to a child IS a risk score.
 *  So the tier is defined by its band and DESCRIBED by its action, and only the
 *  action is ever rendered.
 *
 *  TODO-COPY. */
export const TIER_ACTION: Record<RiskTier, string> = {
  imminent: "Act now.",
  clinicalReview:
    "Clinician review before the next session — often same-day or within 24 hours.",
  generalMonitoring:
    "Mentor coaching, pattern tracking, and non-urgent awareness.",
};

/** Ordered most urgent first, for anywhere that needs a stable tier order. */
export const TIER_ORDER: RiskTier[] = [
  "imminent",
  "clinicalReview",
  "generalMonitoring",
];

/** WHAT THE FLAG IS CLINICALLY ABOUT — the grouping axis the pattern block reads.
 *
 *  Derived by clustering the playbook's twenty categories: the same clinical
 *  subject recurs at all three tiers (suicidality appears as Category 1 at
 *  imminent and Category A at clinical review), and it is that recurrence a
 *  supervisor is looking for when they ask what keeps coming back. */
export type RiskTheme =
  | "selfHarm"
  | "harmToOthers"
  | "abuseEnvironment"
  | "substance"
  | "eatingBody"
  | "psychosis"
  | "peerHarm"
  | "assessment";

/** TODO-COPY. Reads inside a sentence — "two of them involved self-harm" — so
 *  these are lowercase noun phrases, not headings. */
export const THEME_LABEL: Record<RiskTheme, string> = {
  selfHarm: "self-harm",
  harmToOthers: "harm to others",
  abuseEnvironment: "abuse or the home environment",
  substance: "substance use",
  eatingBody: "eating or body image",
  psychosis: "psychotic symptoms",
  peerHarm: "bullying or harassment",
  assessment: "assessment scores",
};

export interface RiskCategory {
  /** The wire value stored on a flag. */
  id: string;
  /** TODO-COPY. Display name. */
  label: string;
  /** "unassigned" only for a category the playbook does not cover. */
  tier: RiskTier | "unassigned";
  theme: RiskTheme;
  /** Where this came from, so a reader can find it in the playbook. */
  playbookRef: string;
}

/** ═══ THE TWENTY PLAYBOOK CATEGORIES, PLUS ONE LEGACY ═══
 *
 *  THE FIVE PRE-EXISTING IDS ARE UNCHANGED — `ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS`,
 *  `CREDIBLE_SPECIFIC_THREAT_TO_HARM_ANOTHER`, `ABUSE_DISCLOSURE`,
 *  `HATE_SPEECH_RACIAL_SLURS`, `GROOMING_BEHAVIOR`. They are wire values already
 *  written into fixtures; renaming them would orphan every flag that carries one.
 *  The sixteen new ids follow the same convention. */
export const RISK_CATEGORIES: RiskCategory[] = [
  // ── Imminent risk (playbook Part 1, Categories 1–6) ──────────────────────
  {
    id: "ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS",
    label: "Suicidal ideation with plan or means",
    tier: "imminent",
    theme: "selfHarm",
    playbookRef: "Part 1 · Category 1",
  },
  {
    id: "SELF_HARM_IN_PROGRESS",
    label: "Self-harm in progress",
    tier: "imminent",
    theme: "selfHarm",
    playbookRef: "Part 1 · Category 2",
  },
  {
    id: "ABUSE_DISCLOSURE",
    label: "Abuse disclosure",
    tier: "imminent",
    theme: "abuseEnvironment",
    playbookRef: "Part 1 · Category 3",
  },
  {
    id: "CREDIBLE_SPECIFIC_THREAT_TO_HARM_ANOTHER",
    label: "Threat to harm another person",
    tier: "imminent",
    theme: "harmToOthers",
    playbookRef: "Part 1 · Category 4",
  },
  {
    id: "COMMAND_HALLUCINATIONS_IMMINENT_HARM",
    label: "Command hallucinations directing harm",
    tier: "imminent",
    theme: "psychosis",
    playbookRef: "Part 1 · Category 5",
  },
  {
    id: "ACUTE_OVERDOSE",
    label: "Acute overdose or substance emergency",
    tier: "imminent",
    theme: "substance",
    playbookRef: "Part 1 · Category 6",
  },

  // ── Clinical review (playbook Part 2, Categories A–F) ────────────────────
  {
    id: "PASSIVE_SUICIDAL_IDEATION",
    label: "Passive suicidal ideation",
    tier: "clinicalReview",
    theme: "selfHarm",
    playbookRef: "Part 2 · Category A",
  },
  {
    id: "NON_SUICIDAL_SELF_INJURY",
    label: "Non-suicidal self-injury",
    tier: "clinicalReview",
    theme: "selfHarm",
    playbookRef: "Part 2 · Category B",
  },
  {
    id: "EATING_DISORDER_CLINICAL",
    label: "Eating disorder indicators",
    tier: "clinicalReview",
    theme: "eatingBody",
    playbookRef: "Part 2 · Category C",
  },
  {
    id: "SUBSTANCE_DEPENDENCE",
    label: "Substance use suggesting dependence",
    tier: "clinicalReview",
    theme: "substance",
    playbookRef: "Part 2 · Category D",
  },
  {
    id: "PSYCHOTIC_SYMPTOMS_NO_DIRECTIVE",
    label: "Psychotic symptoms",
    tier: "clinicalReview",
    theme: "psychosis",
    playbookRef: "Part 2 · Category E",
  },
  {
    id: "UNSAFE_ENVIRONMENT_BELOW_CPS",
    label: "Unsafe home environment",
    tier: "clinicalReview",
    theme: "abuseEnvironment",
    playbookRef: "Part 2 · Category F",
  },

  // ── General monitoring (playbook Part 3, Categories I–VIII) ──────────────
  {
    id: "HATE_SPEECH_RACIAL_SLURS",
    label: "Hate speech or slurs",
    tier: "generalMonitoring",
    theme: "peerHarm",
    playbookRef: "Part 3 · Category I",
  },
  {
    id: "HARASSMENT_BULLYING_VICTIM",
    label: "Bullying — teen targeted",
    tier: "generalMonitoring",
    theme: "peerHarm",
    playbookRef: "Part 3 · Category II",
  },
  {
    id: "HARASSMENT_BULLYING_PERPETRATOR",
    label: "Bullying — teen directing it",
    tier: "generalMonitoring",
    theme: "peerHarm",
    playbookRef: "Part 3 · Category III",
  },
  {
    id: "VIOLENCE_IDEATION_NONSPECIFIC",
    label: "Violence ideation without specifics",
    tier: "generalMonitoring",
    theme: "harmToOthers",
    playbookRef: "Part 3 · Category IV",
  },
  {
    id: "NEGLECT_INDICATORS",
    label: "Neglect indicators",
    tier: "generalMonitoring",
    theme: "abuseEnvironment",
    playbookRef: "Part 3 · Category V",
  },
  {
    id: "SUBSTANCE_USE_BELOW_DEPENDENCE",
    label: "Substance use below dependence",
    tier: "generalMonitoring",
    theme: "substance",
    playbookRef: "Part 3 · Category VI",
  },
  {
    id: "BODY_IMAGE_DISTRESS",
    label: "Body image distress",
    tier: "generalMonitoring",
    theme: "eatingBody",
    playbookRef: "Part 3 · Category VII",
  },
  {
    id: "ASSESSMENT_BELOW_THRESHOLD",
    label: "Assessment scores below threshold",
    tier: "generalMonitoring",
    theme: "assessment",
    playbookRef: "Part 3 · Category VIII",
  },

  // ── Legacy, not in the playbook. See the module note, item 1. ────────────
  {
    id: "GROOMING_BEHAVIOR",
    label: "Grooming behaviour",
    tier: "unassigned",
    theme: "abuseEnvironment",
    playbookRef: "Not in the playbook — predates it",
  },
];

const BY_ID = new Map(RISK_CATEGORIES.map((c) => [c.id, c]));

export function riskCategory(id: string): RiskCategory | null {
  return BY_ID.get(id) ?? null;
}

export function themeOf(id: string): RiskTheme | null {
  return BY_ID.get(id)?.theme ?? null;
}

export function tierOf(id: string): RiskTier | "unassigned" | null {
  return BY_ID.get(id)?.tier ?? null;
}

/** ═══ THE GROUPING SENTENCE'S RAW MATERIAL ═══
 *
 *  Given the categories across a set of flags, which THEME recurs and how often.
 *  Returns themes that appear at least twice, most frequent first — a theme that
 *  appears once is not a pattern and is deliberately not returned.
 *
 *  This is what lets the reading say "two of them involved self-harm" instead of
 *  "3 flags", which is the difference the brief is asking for. Counting FLAGS not
 *  categories: one flag carrying two categories of the same theme counts once. */
export function recurringThemes(
  categoriesPerFlag: string[][]
): { theme: RiskTheme; count: number }[] {
  const counts = new Map<RiskTheme, number>();
  for (const flagCategories of categoriesPerFlag) {
    const themes = new Set(
      flagCategories.map(themeOf).filter((t): t is RiskTheme => t !== null)
    );
    for (const t of themes) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
}

/** Every category id the fixtures use that this taxonomy does not know.
 *  Reported, never hidden — the same doctrine `unmappedCategories` already
 *  applies to the display map. */
export function unknownCategories(ids: string[]): string[] {
  return [...new Set(ids.filter((i) => !BY_ID.has(i)))];
}

/** ═══ ASSESSMENT BANDS, FROM THE PLAYBOOK'S CATEGORY VIII ═══
 *
 *  "PHQ-9 (5–9), GAD-7 (5–9), WHO-5 (29–50)" is mild-to-moderate; "PHQ-9 ≥10,
 *  GAD-7 ≥10, WHO-5 <29" crosses into the clinical-review tier.
 *
 *  EXPORTED AS A THRESHOLD, NOT A LABEL, and deliberately NOT used to grade a
 *  teen. The pattern block uses it for one purpose only: to say whether a score
 *  MOVED ACROSS the threshold during the span, which is a fact about the period.
 *  `care-demo.ts` already owns the band NAMES for the presentation card; this
 *  does not duplicate them. */
export const CLINICAL_REVIEW_THRESHOLD: Record<string, number> = {
  "PHQ-9": 10,
  "GAD-7": 10,
};

/** WHO-5 runs the other way — a LOWER score is worse — so it cannot share the
 *  comparison above and is kept separate rather than inverted silently. */
export const WHO5_CLINICAL_REVIEW_CEILING = 29;
