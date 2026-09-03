// THE OFFICIAL CONTENT-TAG TAXONOMY — one canonical source, consumed by every
// surface that renders a conversation-content tag.
//
// ═══ WHY THIS FILE EXISTS ═══
//
// The tags were inline strings in two fixtures ("Exam stress", "Worry about
// school", "Appetite loss"), invented to fill a chip. Nothing connected them to
// a vocabulary, nothing stopped a sixth surface inventing a seventh string, and
// nothing could tell a reader whether "Appetite loss" and "Appetite change" were
// the same clinical thing recorded twice.
//
// ═══ LABELS ARE VERBATIM. THIS IS NOT AN EDITING SURFACE ═══
//
// Every `label` is the canonical name exactly as the official list gives it,
// slashes, spacing and parentheses included. "Peer relationship difficulty
// (distinct from social anxiety)" keeps its parenthetical because the
// parenthetical is what separates it from social avoidance. Anything that reads
// awkwardly in a chip is a SHORT-LABEL question, not a licence to rewrite the
// canonical name — see `shortLabel`.
//
// ═══ GROUPING IS DATA, NOT DISPLAY ═══
//
// `category` and `group` are carried on every tag and rendered nowhere yet. The
// rail's sections are unchanged; this is the structure a future grouped view
// would need, present now so the fixtures can be authored against it.

/** The three top-level divisions of the official list. */
export type TagCategory = "diagnostic" | "sdoh" | "risk";

/** Diagnostic tags name the instrument whose item set they came from. */
export type TagInstrument = "PHQ-9" | "GAD-7" | "WHO-5";

export interface ContentTag {
  /** Stable slug. THE WIRE VALUE — fixtures and any future pipeline reference
   *  this, never the label, so a copy change to a label is not a data
   *  migration. */
  id: string;
  /** The canonical name, VERBATIM. Never edited for fit. */
  label: string;
  /** ═══ NULL FOR EVERY TAG, DELIBERATELY ═══
   *
   *  Several canonical labels are too long for a chip, and the temptation is to
   *  shorten them here. That would be inventing clinical vocabulary, which is
   *  not a build decision. Render falls back to `label`; `needsShortLabel()`
   *  below generates the list of candidates for a copy pass. */
  shortLabel: string | null;
  category: TagCategory;
  group: string;
  /** Diagnostic tags only. */
  instrument?: TagInstrument;
  /** The leaf tags under this one. A sub-tag is its own renderable tag — see
   *  `SUB_TAGS` — and this array is how a parent knows them. */
  subTags?: string[];
  /** Set on a SUB-TAG: the id of the tag it sits under. The chip shows the leaf;
   *  its tooltip shows "{parent} → {leaf}". */
  parentId?: string;
  /** ═══ WHAT THE TAG DOES AND DOES NOT INCLUDE ═══
   *
   *  Two tags carry one. Both are boundary statements a supervisor must be able
   *  to read before acting on the tag, so an annotated tag ALWAYS renders its
   *  tooltip — truncated or not. Verbatim from the official list. */
  annotation?: string;
}

/* ══════════════════════ THE TAXONOMY, VERBATIM ══════════════════════ */

/** A compact authoring form: [id, label, subTags?, annotation?]. Expanded into
 *  `ContentTag`s below so the category/group/instrument are stated once per
 *  block rather than repeated on a hundred literals — which is how one tag ends
 *  up in the wrong group. */
type Entry = [id: string, label: string, subs?: [string, string][], note?: string];

const DIAGNOSTIC: { group: string; instrument: TagInstrument; tags: Entry[] }[] = [
  {
    group: "Depression",
    instrument: "PHQ-9",
    tags: [
      ["anhedonia", "Anhedonia / loss of interest"],
      ["low-mood-hopelessness", "Low mood / hopelessness"],
      ["sleep-disturbance", "Sleep disturbance"],
      ["fatigue", "Fatigue / low energy"],
      [
        "appetite-change",
        "Appetite change",
        undefined,
        "Excludes changes tied to named medication.",
      ],
      ["worthlessness-guilt", "Worthlessness / guilt"],
      ["concentration-difficulty", "Concentration difficulty"],
      ["psychomotor-change", "Psychomotor change"],
      [
        "suicidal-ideation",
        "Suicidal ideation / self-harm ideation",
        undefined,
        "Teen's own present-tense ideation only; excludes third-party disclosures.",
      ],
    ],
  },
  {
    group: "Anxiety",
    instrument: "GAD-7",
    tags: [
      ["nervousness", "Nervousness / on edge"],
      ["uncontrollable-worry", "Uncontrollable worry"],
      ["excessive-worry", "Excessive worry"],
      ["difficulty-relaxing", "Difficulty relaxing"],
      ["restlessness", "Restlessness"],
      ["irritability-gad", "Irritability"],
      ["anticipatory-fear", "Anticipatory fear / dread"],
    ],
  },
  {
    group: "General distress",
    instrument: "WHO-5",
    tags: [
      ["low-cheerfulness", "Low cheerfulness / positive mood"],
      ["reduced-calm", "Reduced calm / heightened unease"],
      ["low-vigor", "Low energy / vigor"],
      ["unrestful-sleep", "Disrupted or unrestful sleep"],
      ["reduced-engagement", "Reduced engagement / disinterest in daily activities"],
    ],
  },
];

const SDOH: { group: string; tags: Entry[] }[] = [
  {
    group: "Housing & Material Stability",
    tags: [
      [
        "housing-instability",
        "Housing instability",
        [
          ["frequent-moves", "Frequent moves"],
          ["overcrowding", "Overcrowding"],
          ["homelessness-risk", "Homelessness risk"],
        ],
      ],
      ["food-insecurity", "Food insecurity"],
      ["family-financial-stress", "Family financial stress"],
      ["caregiver-job-loss", "Caregiver job loss / unemployment"],
      ["healthcare-access", "Lack of access to healthcare or insurance"],
    ],
  },
  {
    group: "Family Structure & Caregiving",
    tags: [
      [
        "family-conflict",
        "Family conflict",
        [
          ["parental-conflict", "Parental conflict"],
          ["divorce-separation", "Divorce / separation"],
        ],
      ],
      ["sibling-conflict", "Sibling conflict"],
      ["caregiver-absence", "Caregiver absence / sibling caretaking responsibility"],
      ["parental-incarceration", "Parental incarceration"],
      ["household-substance-use", "Household substance use"],
      [
        "family-conflict-identity",
        "Family conflict related to identity, beliefs, or values",
      ],
    ],
  },
  {
    group: "Loss & Health",
    tags: [
      [
        "bereavement",
        "Bereavement / loss",
        [
          ["bereavement-family", "Family member"],
          ["bereavement-friend", "Friend"],
          ["bereavement-pet", "Pet"],
        ],
      ],
      ["family-member-illness", "Family member illness"],
      ["caregiver-hospitalization", "Caregiver hospitalization"],
    ],
  },
  {
    group: "School & Community",
    tags: [
      [
        "bullying",
        "Bullying",
        [
          ["bullying-school", "School-based"],
          ["bullying-online", "Online / cyberbullying"],
        ],
      ],
      [
        "school-transition",
        "School transition or change",
        [
          ["school-new", "New school"],
          ["school-grade-change", "Grade change"],
        ],
      ],
      ["community-violence", "Community violence exposure"],
      ["neighborhood-safety", "Neighborhood safety concerns"],
      [
        "transportation-barriers",
        "Transportation barriers",
        [
          ["transport-school", "Access to school"],
          ["transport-appointments", "Access to appointments"],
        ],
      ],
    ],
  },
  {
    group: "Relationships",
    tags: [
      ["breakup-relationship-stress", "Breakup / relationship stress"],
      [
        "social-isolation",
        "Social isolation",
        [
          ["isolation-new-area", "New to area"],
          ["isolation-lost-peer-group", "Loss of peer group"],
        ],
      ],
    ],
  },
];

const RISK: { group: string; tags: Entry[] }[] = [
  {
    group: "Anxiety-Adjacent",
    tags: [
      ["panic-episodes", "Panic episodes"],
      ["social-avoidance", "Social avoidance / fear of judgment"],
      ["school-avoidance", "School avoidance"],
      ["obsessive-intrusive", "Obsessive/intrusive thoughts or compulsive behaviors"],
    ],
  },
  {
    group: "Trauma-Related",
    tags: [
      ["intrusive-memories", "Intrusive memories / flashbacks"],
      ["hypervigilance", "Hypervigilance"],
      ["trauma-avoidance", "Avoidance of trauma reminders"],
      ["startle-response", "Exaggerated startle response"],
      ["event-nightmares", "Nightmares / sleep disruption tied to a specific event"],
    ],
  },
  {
    group: "Behavioral / Attention — ADHD-type",
    tags: [
      ["inattention", "Difficulty sustaining attention / easily distracted"],
      ["careless-mistakes", "Careless mistakes / lack of attention to detail"],
      ["follow-through", "Difficulty following through on tasks or instructions"],
      ["disorganization", "Disorganization"],
      ["forgetfulness", "Forgetfulness in daily activities"],
      ["fidgeting", "Fidgeting / difficulty remaining seated or still"],
      ["talks-excessively", "Talks excessively / blurts out answers"],
      ["waiting-turn", "Difficulty waiting turn / interrupting others"],
      ["impulsivity", "Acting impulsively without thinking"],
    ],
  },
  {
    group: "Behavioral / Attention — Disruptive behavior",
    tags: [
      ["anger-outbursts", "Frequent anger outbursts / loses temper"],
      ["irritability-disruptive", "Irritability / easily annoyed"],
      [
        "arguing-authority",
        "Arguing with authority figures",
        [
          ["arguing-parents", "Parents"],
          ["arguing-teachers", "Teachers"],
        ],
      ],
      ["defiance", "Defiance / refusal to follow rules"],
      ["provoking-others", "Deliberately provoking or annoying others"],
      ["blaming-others", "Blaming others / difficulty accepting responsibility"],
      ["aggression", "Aggression toward people or animals"],
      ["property-destruction", "Property destruction"],
      [
        "rule-violations",
        "Serious rule violations",
        [
          ["truancy", "Truancy"],
          ["running-away", "Running away"],
          ["theft", "Theft"],
        ],
      ],
      ["risk-taking", "Risk-taking / reckless behavior"],
    ],
  },
  {
    group: "Substance & Eating",
    tags: [
      ["substance-use-mention", "Substance use mention"],
      ["disordered-eating", "Disordered eating / body image distress"],
    ],
  },
  {
    group: "Psychosis / Dissociation",
    tags: [
      ["psychosis-mention", "Psychosis / reality distortion mention"],
      ["paranoia", "Paranoia"],
      ["dissociation", "Dissociation"],
      [
        "orientation-confusion",
        "Confusion about time, place, or identity within a conversation",
      ],
    ],
  },
  {
    group: "Identity & Self-Concept",
    tags: [
      [
        "identity-distress",
        "Identity distress",
        [
          ["identity-questioning", "Questioning who they are"],
          ["existential-distress", "Existential distress"],
        ],
      ],
      ["negative-self-image", "Negative self-image / low self-esteem"],
      ["perfectionism", "Perfectionism / excessive self-criticism"],
    ],
  },
  {
    group: "Somatic & Functional",
    tags: [
      ["somatic-complaints", "Somatic complaints without clear medical explanation"],
      ["academic-decline", "Academic performance decline"],
      [
        "peer-difficulty",
        "Peer relationship difficulty (distinct from social anxiety)",
        [["making-keeping-friends", "Making or keeping friends"]],
      ],
    ],
  },
];

/* ══════════════════════ EXPANSION + INDEX ══════════════════════ */

function expand(
  blocks: { group: string; instrument?: TagInstrument; tags: Entry[] }[],
  category: TagCategory
): ContentTag[] {
  const out: ContentTag[] = [];
  for (const block of blocks) {
    for (const [id, label, subs, note] of block.tags) {
      out.push({
        id,
        label,
        shortLabel: null,
        category,
        group: block.group,
        ...(block.instrument ? { instrument: block.instrument } : {}),
        ...(subs ? { subTags: subs.map(([sid]) => sid) } : {}),
        ...(note ? { annotation: note } : {}),
      });
      /* A SUB-TAG IS A FIRST-CLASS TAG. It is what a chip actually shows, so it
         needs its own id, its own label and a `parentId` for the tooltip —
         rather than being a string reachable only through its parent. */
      for (const [sid, slabel] of subs ?? []) {
        out.push({
          id: sid,
          label: slabel,
          shortLabel: null,
          category,
          group: block.group,
          ...(block.instrument ? { instrument: block.instrument } : {}),
          parentId: id,
        });
      }
    }
  }
  return out;
}

/** Every tag, parents and sub-tags alike, in the official list's order. */
export const CONTENT_TAGS: ContentTag[] = [
  ...expand(DIAGNOSTIC, "diagnostic"),
  ...expand(SDOH, "sdoh"),
  ...expand(RISK, "risk"),
];

const BY_ID = new Map(CONTENT_TAGS.map((t) => [t.id, t]));

export function contentTag(id: string): ContentTag | null {
  return BY_ID.get(id) ?? null;
}

/** What a chip renders. `shortLabel` is null everywhere today, so this is the
 *  canonical label until a copy pass says otherwise. */
export function tagLabel(id: string): string {
  const t = BY_ID.get(id);
  return t ? (t.shortLabel ?? t.label) : id;
}

/** ═══ THE TOOLTIP'S FULL TEXT, OR NULL WHEN THERE IS NOTHING TO ADD ═══
 *
 *  Three reasons a chip carries one, in priority order:
 *   1. AN ANNOTATION — always, truncated or not. It states what the tag excludes,
 *      and a supervisor acting on the tag has to be able to read that.
 *   2. A SUB-TAG — "{parent} → {leaf}", because the chip shows only the leaf and
 *      "Pet" on its own is not a clinical statement.
 *   3. TRUNCATION — the caller detects it and asks for the canonical label.
 *
 *  An annotated sub-tag would get both; none exists today, and the annotation
 *  leads if one ever does, because the boundary matters more than the ancestry. */
export function tagTooltip(id: string): string | null {
  const t = BY_ID.get(id);
  if (!t) return null;
  const parent = t.parentId ? BY_ID.get(t.parentId) : null;
  const lineage = parent ? `${parent.label} → ${t.label}` : t.label;
  if (t.annotation) return `${lineage}. ${t.annotation}`;
  if (parent) return lineage;
  return null;
}

/** True when a chip must render a tooltip whatever its width — see above. */
export function tagAlwaysTooltips(id: string): boolean {
  const t = BY_ID.get(id);
  return !!t && (!!t.annotation || !!t.parentId);
}

/** ═══ THE COPY CHECKLIST, GENERATED ═══
 *
 *  Labels past this length do not fit a chip at rail width and are the
 *  candidates for a `shortLabel`. The threshold is the brief's ~22 characters.
 *  Reported rather than acted on: a short clinical label is Nicole's call, and
 *  inventing one here would put un-reviewed vocabulary on a clinical record. */
export const SHORT_LABEL_THRESHOLD = 22;

export function needsShortLabel(): ContentTag[] {
  return CONTENT_TAGS.filter(
    (t) => t.shortLabel === null && t.label.length > SHORT_LABEL_THRESHOLD
  );
}

/* ══════════════════════ THE REGRESSION FENCE ══════════════════════ */

/** ═══ AN UNKNOWN TAG IS A BUG, NOT A STRING ═══
 *
 *  The placeholders ("Exam stress", "Appetite loss") were invented at the render
 *  site, and nothing could tell. This makes that impossible rather than merely
 *  fixed: in DEV an id outside the taxonomy is loud at the point of use.
 *
 *  IT DOES NOT THROW. A thrown render error on a clinical record takes the whole
 *  page down and hides the twelve tags that ARE right — so the chip renders as an
 *  unmissable error instead, naming the offending value so it can be found. In
 *  production the id renders as-is, because a degraded chip beats a blank record.
 */
export function isKnownTag(id: string): boolean {
  return BY_ID.has(id);
}
