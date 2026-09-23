// TASKS SEED — five dev scenarios (§2.4).
//
// TODO-DATA: every item is a fixture. There is no task writer; this is the whole
// data source for the T-series.
//
// BUILT RELATIVE TO A PASSED `now`, NOT A FROZEN INSTANT. Every other fixture
// module in this repo pins a simulated clock (Activity's SIM_NOW), and that is
// right for a ledger of things that already happened. It is WRONG here: breach is
// derived (`now > slaDeadline`), so a frozen clock means the whole worklist drifts
// into breach as real time passes, and "Quiet day" would be all-red by tomorrow.
// So `tasksScenario(id, now)` positions every item relative to the caller's own
// mount-time clock. Deterministic given `now` — no Math.random, no Date.now in
// here — so two builds with the same `now` are byte-identical.
//
// INTERNALLY CONSISTENT BY CONSTRUCTION (§2.4): tab counts equal list contents
// because both derive from this array; coalesced groups sum because
// `conversationFlagCount` is written from the actual group size; "Closed today"
// counters have matching resolved items because they are counted from the same
// items. All three are asserted in __tests__/seed.test.ts rather than trusted.
//
// TEEN AND MENTOR NAMES ARE REUSED ACROSS DOMAINS within a scenario (§2.4) — the
// teen with the open escalation also has flag history. That is what makes the
// worklist read as one caseload rather than four unrelated queues.
//
// TEEN NAMES ARE FIRST NAME + LAST INITIAL (locked decision 11). No surname
// exists in this file to render.

import { riskCategory } from "@/lib/record/risk-taxonomy";
import { deadlineFor } from "@/lib/tasks/sla";
import {
  DOMAIN_OF_TYPE,
  TYPE_URGENCY_RANK,
  type TaskItem,
  type TaskPayload,
  type TaskType,
} from "@/lib/tasks/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ── The cast. Reused across domains inside a scenario. ──────────────────────

const TEENS = {
  riley: { id: "tk-riley", name: "Riley T." },
  marcus: { id: "tk-marcus", name: "Marcus L." },
  naomi: { id: "tk-naomi", name: "Naomi R." },
  jordan: { id: "tk-jordan", name: "Jordan P." },
  simone: { id: "tk-simone", name: "Simone B." },
  caleb: { id: "tk-caleb", name: "Caleb O." },
  imani: { id: "tk-imani", name: "Imani C." },
  theo: { id: "tk-theo", name: "Theo L." },
};

/** ═══ THE WIDER CASELOAD (Part 3) ═══
 *
 *  A supervisor's real queue is forty to sixty open flags, not eight — and the
 *  eight names above cannot carry that. Repeating them seven times each would
 *  produce a list that LOOKS like volume while testing none of what volume breaks:
 *  name-column truncation, avatar-initial collisions, and a reader's ability to
 *  find one person among many.
 *
 *  So the roster is extended rather than the existing names multiplied. The eight
 *  above stay exactly as they were — every hand-written scenario spec still refers
 *  to them by key, and the narrative fixtures (Marcus's five flags, Riley's
 *  documentation) are unchanged.
 *
 *  DELIBERATE COLLISIONS. Two Jordans (`Jordan P.`, `Jordan A.`), two Ms, several
 *  shared initials. A roster of forty distinct first letters is not a caseload,
 *  it is an alphabet — and the disambiguation work a supervisor actually does is
 *  exactly the work a too-tidy fixture hides.
 *
 *  FIRST NAME + LAST INITIAL, MAXIMUM (locked decision 11), asserted in
 *  seed.test.ts across every scenario — so a name added here that carries a
 *  surname fails the suite rather than reaching a screen. */
/* EXPORTED for Monitoring's coverage view (arch-mon Phase 4), which needs the
   supervised roster rather than only the teens the classifier flagged — a
   denominator, and it must be the SAME roster or the two surfaces would
   disagree about who exists. Data only: nothing about Tasks changes. */
export const ROSTER: Teen[] = [
  { id: "tk-ava", name: "Ava M." },
  { id: "tk-jordan-a", name: "Jordan A." },
  { id: "tk-diego", name: "Diego S." },
  { id: "tk-mei", name: "Mei W." },
  { id: "tk-kai", name: "Kai N." },
  { id: "tk-priya", name: "Priya R." },
  { id: "tk-noah", name: "Noah B." },
  { id: "tk-zara", name: "Zara H." },
  { id: "tk-eli", name: "Eli F." },
  { id: "tk-sofia", name: "Sofia G." },
  { id: "tk-tobias", name: "Tobias K." },
  { id: "tk-amara", name: "Amara D." },
  { id: "tk-luca", name: "Luca V." },
  { id: "tk-hana", name: "Hana T." },
  { id: "tk-omari", name: "Omari J." },
  { id: "tk-blake", name: "Blake C." },
  { id: "tk-nia", name: "Nia P." },
  { id: "tk-santiago", name: "Santiago R." },
  { id: "tk-ines", name: "Ines M." },
  { id: "tk-devon", name: "Devon A." },
  { id: "tk-yusuf", name: "Yusuf E." },
  { id: "tk-clara", name: "Clara L." },
  { id: "tk-marco", name: "Marco B." },
  { id: "tk-elena", name: "Elena Q." },
];
/* ═══ THE NAMED EIGHT ARE NOT IN THE FILL ROSTER, DELIBERATELY ═══
   They were, via a `...Object.values(TEENS)` spread — and the bulk intake fill
   landed on Riley, who already carries a hand-written MONTHLY RE-REVIEW. A teen
   cannot have both: an intake assigns a first code, a re-review revises an
   existing one. Striding the seeds fixed the fills colliding with each other and
   could not fix a fill colliding with a hand-written spec, because the hand-
   written specs do not go through `fill` at all.
   Keeping the two casts disjoint is the version of this that stays true as
   scenarios are edited: the eight carry the narrative fixtures anyone reviewing
   this surface is asked to look at, the twenty-four carry the volume, and neither
   can silently contradict the other. Pinned in seed.test.ts. */

const MENTORS = {
  brandon: { id: "tk-m-brandon", name: "Brandon Forant" },
  maria: { id: "tk-m-maria", name: "Maria Lopez" },
  brandy: { id: "tk-m-brandy", name: "Brandy Forrestor" },
  omar: { id: "tk-m-omar", name: "Omar Haddad" },
};

/** Mentors carry FULL names — they are staff, and locked decision 11 is about
 *  teens. Six more so a fifty-row list is not four mentors repeated. */
export const MENTOR_POOL: Mentor[] = [
  ...Object.values(MENTORS),
  { id: "tk-m-tasha", name: "Tasha Reyes" },
  { id: "tk-m-daniel", name: "Daniel Okafor" },
  { id: "tk-m-priscilla", name: "Priscilla Vance" },
  { id: "tk-m-jae", name: "Jae Sung Park" },
  { id: "tk-m-nour", name: "Nour Barakat" },
  { id: "tk-m-vic", name: "Victoria Ellery" },
];

/* Declared as standalone interfaces rather than derived from the literals: the
   roster below is a second source of the same shape, and a type derived from one
   of two sources is a type that stops describing the other. */
export interface Teen {
  id: string;
  name: string;
}
export interface Mentor {
  id: string;
  name: string;
}

// ── Payload builders ────────────────────────────────────────────────────────
// TODO-COPY / TODO-DATA on every string.

/** ═══ A FIXTURE CATEGORY MUST BE A PLAYBOOK CATEGORY (Phase 4) ═══
 *
 *  The categories were free text and nothing checked them, which is how
 *  "Self-harm language" and "Low mood" ended up in the data alongside a playbook
 *  holding 21 ids that look nothing like them. Two consequences followed: the
 *  clinical ranking had nothing to key on, and `unknownCategories` — the function
 *  whose whole job is surfacing a category outside the playbook — would have
 *  flagged every flag in every fixture.
 *
 *  THIS THROWS. A fixture is developer input, so a bad id should stop the build
 *  rather than reach a supervisor as a raw enum or an empty label. It runs at
 *  module scope through the payload builders, so it cannot be skipped. */
function assertPlaybookCategories(categories: string[]): void {
  const bad = categories.filter((c) => riskCategory(c) == null);
  if (bad.length > 0) {
    throw new Error(
      `seed: not playbook category ids — ${bad.join(", ")}. ` +
        `Use RISK_CATEGORIES[].id from lib/record/risk-taxonomy.ts.`
    );
  }
}

/** ═══ NO TIER, AND THE CATEGORIES ARE PLAYBOOK IDS (Phase 4) ═══
 *
 *  The first parameter was the tier — a severity this file assigned, which every
 *  surface downstream then rendered as clinical fact. It is gone, and the
 *  CATEGORY is what carries the difference between one fixture and another.
 *
 *  THE IDS ARE ASSERTED AT BUILD TIME (`assertPlaybookCategories` below), so a
 *  typo is a thrown error in development rather than a row that quietly renders
 *  a raw enum to a supervisor. */
function flagPayload(
  categories: string[],
  excerpt: string,
  rationale: string
): TaskPayload {
  assertPlaybookCategories(categories);
  return {
    kind: "riskFlag",
    sourceType: "Message",
    categories,
    flaggedExcerpt: excerpt,
    aiRationale: rationale,
    flaggedCorrectly: null,
    // Overwritten by `withCoalesceCounts` once the group sizes are known.
    conversationFlagCount: 1,
  };
}

function billingPayload(
  isReReview: boolean,
  now: number,
  current: { code: string; statement: string } | null,
  recommended: { code: string; statement: string },
  score: number
): TaskPayload {
  return {
    kind: "billing",
    isReReview,
    current,
    survey: { instrument: "PHQ-9", score, max: 27, takenAt: now - 2 * DAY },
    mentorStats: { daysInMentorship: 140, messagesLast30: 62, videoLast30: 2 },
    aiSummary:
      "Scores have moved from the mild band into the moderate band across the last three assessments, with the mood items accounting for most of the change.",
    recommended,
  };
}

function escalationPayload(is911: boolean, flaggedBy: string, id: string): TaskPayload {
  return {
    kind: "escalation",
    is911,
    flaggedBy,
    emergencyContact: "Guardian on file · reached 4:02 PM",
    escalationId: id,
  };
}

// ── Item builder ────────────────────────────────────────────────────────────

interface Spec {
  taskType: TaskType;
  teen: Teen;
  mentor: Mentor;
  objectId: string;
  /** Minutes/hours ago the task opened, in ms before `now`. */
  openedAgo: number;
  payload: TaskPayload;
  /** Documentation only: the escalation's close time drives its 24h clock, not
   *  `openedAt`. See sla.ts deadlineFor. */
  clockStartAgo?: number;
  status?: TaskItem["status"];
  /** Resolved fixtures feed the "Closed today" counters. */
  resolvedAgo?: number;
  /** ═══ A FRACTION OF THE DAY SO FAR, NOT A FIXED AGE (Phase 10) ═══
   *  `closedFill` used `resolvedAgo: 30m + (0–6)h` with the note "always inside
   *  today" — true during a day shift and false after midnight. MEASURED:
   *  Today's "Closed today" read 21 at one point in a session and 4 later on the
   *  same scenario, because `closedToday` counts only resolutions on the same
   *  CALENDAR day as `now`, and at 01:00 most of a 6.5-hour window is yesterday.
   *  Resolved in `build`, which is the only place that knows `now`. At 14:00 the
   *  closures spread across the last ~7 hours exactly as before; at 01:00 across
   *  the last hour — which is the honest reading, since nothing can have been
   *  closed today longer ago than today has been running. Gap row 419. */
  resolvedFracOfDay?: number;
}

/** ═══ HOW LONG TODAY HAS BEEN RUNNING — NO FLOOR ═══
 *
 *  A first attempt floored this at 45 minutes so the first minutes of a day
 *  still produced a plausible spread. MEASURED at 00:30: the floor exceeded the
 *  elapsed day, so the oldest closures landed BEFORE midnight and `closedToday`
 *  counted 18 of 26 — reintroducing the very drift the change exists to remove,
 *  in a narrower window.
 *
 *  So there is no floor. In the first minutes of a day the closures bunch
 *  together, which is the honest shape: nothing can have been closed today
 *  longer ago than today has been running, and a fixture that says otherwise is
 *  the fixture lying rather than the clock being awkward. */
function elapsedToday(now: number): number {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return now - midnight.getTime();
}

function build(specs: Spec[], now: number): TaskItem[] {
  return specs.map((s, i) => {
    const openedAt = now - s.openedAgo;
    const clockStart =
      s.clockStartAgo !== undefined ? now - s.clockStartAgo : openedAt;
    return {
      id: `task-${i + 1}`,
      domain: DOMAIN_OF_TYPE[s.taskType],
      taskType: s.taskType,
      urgencyRank: TYPE_URGENCY_RANK[s.taskType],
      teenId: s.teen.id,
      teenDisplayName: s.teen.name,
      mentorId: s.mentor.id,
      mentorName: s.mentor.name,
      objectId: s.objectId,
      openedAt,
      slaDeadline: deadlineFor(s.taskType, clockStart),
      status: s.status ?? "open",
      ...(s.resolvedAgo !== undefined
        ? { resolvedAt: now - s.resolvedAgo }
        : s.resolvedFracOfDay !== undefined
          ? { resolvedAt: now - Math.round(elapsedToday(now) * s.resolvedFracOfDay) }
          : {}),
      payload: s.payload,
    };
  });
}

/** COALESCE COUNTS, WRITTEN FROM THE ACTUAL GROUPS. §2.4 requires coalesced
 *  groups to sum correctly; deriving the count rather than hand-writing it makes
 *  that true by construction instead of by proofreading. */
function withCoalesceCounts(items: TaskItem[]): TaskItem[] {
  const sizes = new Map<string, number>();
  for (const it of items) {
    if (it.payload.kind !== "riskFlag" || it.status === "resolved") continue;
    const key = `${it.taskType}::${it.objectId}`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  return items.map((it) =>
    it.payload.kind === "riskFlag"
      ? {
          ...it,
          payload: {
            ...it.payload,
            conversationFlagCount:
              sizes.get(`${it.taskType}::${it.objectId}`) ?? 1,
          },
        }
      : it
  );
}

// ── Reusable payload fixtures ───────────────────────────────────────────────

/** ═══ THE FIXTURE VARIETY IS CATEGORY VARIETY NOW (Phase 4) ═══
 *
 *  These three were `IMMINENT` / `CLINICAL` / `ROUTINE` — named for the tier they
 *  asserted, each carrying one free-text category ("Self-harm language", "Family
 *  conflict", "Low mood") that matched nothing in the playbook. That is why
 *  `FLAG_CATEGORY_RANK` had nothing to key on and comparator step 2 was a no-op
 *  with no way out of it.
 *
 *  They are named for their CATEGORY now, and the ids are the playbook's. Their
 *  playbook tier is still derivable through `tierOf` — one draws from each of the
 *  three groupings, deliberately, so a surface that reads the derivation has
 *  something to read. The difference from what was removed: the grouping is a
 *  clinical judgment over published categories that somebody owns, and it is
 *  computed at the point of use rather than stamped onto the row.
 *
 *  THE EXCERPTS AND RATIONALES ARE UNCHANGED, and each still matches its
 *  category — `PASSIVE_SUICIDAL_IDEATION` for the self-harm language,
 *  `UNSAFE_ENVIRONMENT_BELOW_CPS` for the home conflict,
 *  `ASSESSMENT_BELOW_THRESHOLD` for the low mood. TODO-DATA on all three. */
const SELF_HARM = () =>
  flagPayload(
    ["PASSIVE_SUICIDAL_IDEATION"],
    "i don't know how much longer i can keep doing this",
    "The message contains language the playbook treats as a self-harm indicator, in a conversation where the previous two exchanges also referenced sleeplessness. Escalating rather than monitoring is the conservative read.",
  );
const HOME_CONFLICT = () =>
  flagPayload(
    ["UNSAFE_ENVIRONMENT_BELOW_CPS"],
    "things at home got bad again last night",
    "The message describes conflict at home without naming a specific risk. Flagged for review rather than escalation because no immediate danger is stated.",
  );
const LOW_MOOD = () =>
  flagPayload(
    ["ASSESSMENT_BELOW_THRESHOLD"],
    "kind of a rough week honestly",
    "Low-mood language with no risk indicators.",
  );

const CODES = {
  gad: { code: "F41.1", statement: "Generalized anxiety disorder" },
  mddModerate: { code: "F33.1", statement: "Major depressive disorder, recurrent, moderate" },
  mddMild: { code: "F33.0", statement: "Major depressive disorder, recurrent, mild" },
  adjustment: { code: "R45.89", statement: "Other symptoms involving emotional state" },
};

// ── Bulk fill (Part 3) ──────────────────────────────────────────────────────
//
// ═══ WHY THE FIXTURES GOT BIGGER ═══
//
// Every density decision on this surface — sticky band headers, 56px rows, the
// virtualized list, keyboard resolution — exists because a supervisor works
// through FIFTY flags, not eight. At eight rows none of those decisions can be
// evaluated: the list fits on one screen, the headers have nothing to separate,
// virtualization never crosses a boundary, and a keyboard shortcut saves nothing
// over clicking. A prototype that only ever shows eight rows is a prototype that
// answers a question nobody asked.
//
// So `typical-shift` and `heavy-caseload` now carry realistic volume, and the
// three narrative scenarios (quiet day, breach overnight, active escalation) do
// not — they exist to demonstrate specific states, and burying a single active
// escalation under sixty flags would demonstrate it worse.
//
// ═══ DETERMINISTIC, WITH NO RANDOMNESS ANYWHERE ═══
//
// No `Math.random`. The module's contract is that two builds with the same `now`
// are byte-identical, and a shuffled fixture breaks every snapshot, every
// screenshot comparison and every "is this the row I was just looking at" moment
// in review. Variation comes from `spread`, an integer hash of the index — the
// same input always yields the same caseload.

/** A small integer hash. Not cryptographic and not trying to be: it needs to
 *  produce a well-distributed value from an index so ages, mentors and group
 *  sizes vary without a random source. Knuth's multiplicative constant. */
function spread(i: number, salt: number): number {
  return Math.abs(Math.imul(i + salt * 977 + 1, 2654435761) >>> 8);
}

interface FillOptions {
  taskType: TaskType;
  /** How many TASKS to emit. */
  count: number;
  /** Distinct object ids (conversations / surveys) to spread them across. Fewer
   *  than `count` produces coalesced groups — which is the point: at fifty flags
   *  a supervisor's list is mostly groups, and a fixture of fifty singletons
   *  would never exercise the disclosure path at volume. */
  conversations: number;
  /** Age window, in ms before `now`. Ages are distributed across it, so a run of
   *  rows shows a real age gradient rather than one repeated value. */
  minAgo: number;
  maxAgo: number;
  payload: () => TaskPayload;
  /** Offsets the roster walk so two fills do not hand the same teens to the same
   *  conversations. Also salts the hash. */
  seed: number;
}

/** Emit `count` specs of one task type, spread across `conversations` objects.
 *
 *  ONE TEEN PER CONVERSATION, always. A conversation is between one teen and one
 *  mentor, so a group whose members named different teens would be incoherent
 *  data that happened to render — and the coalesced parent row shows the head's
 *  name, so the incoherence would be invisible until someone expanded it. */
function fill(o: FillOptions): Spec[] {
  const specs: Spec[] = [];
  const span = Math.max(1, o.maxAgo - o.minAgo);
  for (let i = 0; i < o.count; i++) {
    const conv = i % o.conversations;
    /* ═══ THE SEED STRIDES, IT DOES NOT OFFSET BY ONE ═══
       `(conv + seed)` put consecutive fills on overlapping slices of the roster,
       and the visible consequence was incoherent data: Sofia had an INTAKE
       billing review and a MONTHLY RE-REVIEW open at the same time. An intake is
       the first code a teen is ever assigned and a re-review revises an existing
       one, so a teen cannot plausibly have both — and it was on screen, one band
       above the other, with the same name on both rows.
       Striding by 7 gives each fill a disjoint window of the roster. Flags and
       routine review still overlap each other deliberately, because a teen WITH an imminent
       flag plausibly has a clinical one and a routine one; §2.4's cross-domain reuse
       requirement is what that serves, and it is asserted in seed.test.ts. */
    const teen = ROSTER[(conv + o.seed * 7) % ROSTER.length];
    const mentor = MENTOR_POOL[(conv + o.seed) % MENTOR_POOL.length];
    // Age walks the window by conversation, not by index, so the members of one
    // group are MINUTES apart (they are flags on one conversation) while
    // different conversations are hours apart. A flat distribution over `count`
    // would have made every group's members hours apart, which no real
    // conversation produces.
    const base = o.minAgo + Math.round((span * conv) / o.conversations);
    const jitter = (spread(i, o.seed) % 41) * MINUTE;
    specs.push({
      taskType: o.taskType,
      teen,
      mentor,
      objectId: `conv-${o.taskType}-${o.seed}-${conv}`,
      openedAgo: base + jitter,
      payload: o.payload(),
    });
  }
  return specs;
}

/** Resolved fixtures, so a fifty-row board also has a plausible number of things
 *  already closed today — the tab cards' closed segment reads "· 14 closed" at
 *  volume, and a band that clears reports a real figure rather than "1 today".
 *  ALL RESOLVED INSIDE TODAY AT ANY HOUR — see `Spec.resolvedFracOfDay` for why
 *  a fixed window was not enough. */
function closedFill(
  taskType: TaskType,
  count: number,
  payload: () => TaskPayload,
  seed: number
): Spec[] {
  return Array.from({ length: count }, (_, i) => ({
    taskType,
    teen: ROSTER[(i * 3 + seed) % ROSTER.length],
    mentor: MENTOR_POOL[(i + seed) % MENTOR_POOL.length],
    objectId: `conv-${taskType}-done-${seed}-${i}`,
    openedAgo: (10 + (spread(i, seed) % 20)) * HOUR,
    payload: payload(),
    status: "resolved" as const,
    /* 8% IN, SO NOTHING READS AS CLOSED AT THIS EXACT INSTANT, and spread over
       the rest of the day so far. `% 1000 / 1000` rather than the old `% 7`
       hours, because the window is no longer a whole number of hours.
       Deterministic in `(i, seed)` like every other spread here. */
    resolvedFracOfDay: 0.08 + ((spread(i, seed + 5) % 1000) / 1000) * 0.88,
  }));
}

// ── The five scenarios ──────────────────────────────────────────────────────

/** QUIET DAY — a handful of items, nothing breached, no escalation. Proves the
 *  surface reads calm when there is little to do, and that a near-empty state
 *  does not celebrate. ("low-tier" and "the Routine-review state" went with the
 *  tiers in Phase 4.) */
function quietDay(now: number): TaskItem[] {
  return build(
    [
      {
        taskType: "riskFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-1",
        openedAgo: 2 * DAY,
        payload: LOW_MOOD(),
      },
      {
        taskType: "monthlyReReview",
        teen: TEENS.simone,
        mentor: MENTORS.omar,
        objectId: "survey-simone-1",
        openedAgo: 6 * HOUR,
        payload: billingPayload(true, now, CODES.mddMild, CODES.mddMild, 8),
      },
      {
        /* ═══ SIMONE'S, NOT CALEB'S — AND THE FIXTURE NEEDS IT (Phase 4) ═══
           §2.4 requires a teen to appear in more than one DOMAIN inside a
           scenario, which is how the fixtures prove the same person shows up on
           more than one surface. Caleb used to satisfy it by accident: this item
           was a `clinicalFlagReview` (domain `riskFlag`) and his other was a
           `routineFlagReview` (domain `routineFlag`) — two domains for one teen
           purely because the tiers were split across them.
           Collapsing the domains collapsed that coverage, and the seed test
           caught it. Moved to Simone, who has the monthly re-review above, so
           the requirement is met by a teen genuinely spanning flags and
           billing — which is what it was always meant to assert. */
        taskType: "riskFlagReview",
        teen: TEENS.simone,
        mentor: MENTORS.omar,
        objectId: "conv-simone-1",
        openedAgo: 3 * HOUR,
        payload: HOME_CONFLICT(),
      },
      // CLOSED TODAY — one per domain that has any, so the header counters have
      // matching resolved items (§2.4).
      {
        taskType: "riskFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-3",
        openedAgo: 9 * HOUR,
        payload: SELF_HARM(),
        status: "resolved",
        resolvedAgo: 7 * HOUR,
      },
      {
        taskType: "intakeBillingReview",
        teen: TEENS.simone,
        mentor: MENTORS.omar,
        objectId: "survey-simone-2",
        openedAgo: 2 * DAY,
        payload: billingPayload(false, now, null, CODES.gad, 11),
        status: "resolved",
        resolvedAgo: 5 * HOUR,
      },
    ],
    now
  );
}

/** TYPICAL SHIFT — the default. Every tab populated, one breach, no active
 *  escalation but a documentation task outstanding. The scenario the surface
 *  should be judged on. */
function typicalShift(now: number): TaskItem[] {
  // THE NAMED CASES COME FIRST and are unchanged — Riley's documentation clock
  // with four hours left, Marcus's breached imminent flag, the two clinical. They are
  // the ones anyone reviewing this surface is asked to look at, and the priority
  // sort puts them at the top of their bands where they can be found.
  const specs: Spec[] = [
      /* ═══ THE ESCALATION LIFECYCLE, ALL THREE STATES AT ONCE (arch-B) ═══
         It was one documentation row and no active escalation, which meant
         arch-B's escalation region could not be seen in its full state on the
         scenario a supervisor's Tuesday is supposed to look like. Measured across
         the five scenarios before this change: the two that carry the flag volume
         had ZERO active escalations, and the one with active escalations had
         three flags in total. Nothing exercised the region.
         ONE ACTIVE, TWO WRITE-UPS — one with four hours left and one already past
         its twenty-four, so the region renders active, due and overdue together.
         Within the brief's seeds (1–3 active, 1–2 documentation-pending). */
      {
        taskType: "activeEscalation",
        teen: TEENS.naomi,
        mentor: MENTORS.maria,
        objectId: "esc-naomi-live",
        // 9 minutes against a 5-minute SLA — breached, which is the point: an
        // active escalation is late almost by definition and the row must not
        // read as an alarm ABOUT lateness.
        openedAgo: 9 * MINUTE,
        payload: escalationPayload(true, "Maria Lopez", "esc-naomi-live"),
      },
      {
        taskType: "escalationDocumentation",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "esc-riley-1",
        openedAgo: 20 * HOUR,
        // Clock starts at CLOSE, 20h ago — so 4h of the 24h remain.
        clockStartAgo: 20 * HOUR,
        payload: {
          kind: "documentation",
          escalationId: "esc-riley-1",
          closedAt: now - 20 * HOUR,
          /* RAISED 90 MINUTES BEFORE IT CLOSED. The window the record's timeline
             covers — see `DocumentationPayload.triggeredAt`. */
          triggeredAt: now - 21.5 * HOUR,
        },
      },
      {
        // 31h against a 24h clock: the overdue escalation note, so the third state is
        // on screen beside the other two.
        taskType: "escalationDocumentation",
        teen: TEENS.theo,
        mentor: MENTORS.brandy,
        objectId: "esc-theo-3",
        openedAgo: 31 * HOUR,
        clockStartAgo: 31 * HOUR,
        payload: {
          kind: "documentation",
          escalationId: "esc-theo-3",
          closedAt: now - 31 * HOUR,
          triggeredAt: now - 33 * HOUR,
        },
      },
      // ── Risk flags: one BREACHED imminent (26h against a 24h SLA), two clinical.
      {
        taskType: "riskFlagReview",
        teen: TEENS.marcus,
        mentor: MENTORS.brandon,
        objectId: "conv-marcus-1",
        openedAgo: 26 * HOUR,
        payload: SELF_HARM(),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-1",
        openedAgo: 9 * HOUR,
        payload: HOME_CONFLICT(),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.jordan,
        mentor: MENTORS.maria,
        objectId: "conv-jordan-1",
        openedAgo: 30 * HOUR,
        payload: HOME_CONFLICT(),
      },
      // ── Billing: one intake, one re-review.
      {
        taskType: "intakeBillingReview",
        teen: TEENS.jordan,
        mentor: MENTORS.maria,
        objectId: "survey-jordan-1",
        openedAgo: 10 * HOUR,
        payload: billingPayload(false, now, null, CODES.gad, 12),
      },
      {
        taskType: "monthlyReReview",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "survey-riley-1",
        openedAgo: 40 * HOUR,
        payload: billingPayload(true, now, CODES.mddMild, CODES.mddModerate, 15),
      },
      /* ═══ BILLING NOW STRADDLES ITS DEADLINE (arch-E) ═══
         arch-E groups Tasks by WHEN work is due rather than by task type, and the
         fixture could not exercise the grouping. MEASURED before this change,
         billing on this scenario: 0 overdue, 0 due today, 7 due tomorrow, 8
         later — so the bucket carrying the breach treatment was empty on every
         scenario except `breach-overnight`, where it held the only item.
         The 72h SLA against ages of 4–66h is why: nothing could reach a day
         boundary. These four put items on both sides of it — two already past,
         two inside the next few hours — so Overdue and Due today are real states
         a reader can be shown rather than branches nothing reaches.
         A RENEWAL AMONG THEM, deliberately. `renewal` was reachable on ONE
         scenario (`quiet-day`, its single item), so the row's disposition preview
         had a case that volume never exercised. Theo's re-review keeps its code. */
      {
        taskType: "monthlyReReview",
        teen: TEENS.theo,
        mentor: MENTORS.brandy,
        objectId: "survey-theo-2",
        // 81h against 72h — nine hours past, and a renewal.
        openedAgo: 81 * HOUR,
        payload: billingPayload(true, now, CODES.mddModerate, CODES.mddModerate, 16),
      },
      {
        taskType: "intakeBillingReview",
        teen: TEENS.imani,
        mentor: MENTORS.omar,
        objectId: "survey-imani-1",
        // 76h — four hours past.
        openedAgo: 76 * HOUR,
        payload: billingPayload(false, now, null, CODES.gad, 11),
      },
      {
        taskType: "monthlyReReview",
        teen: TEENS.naomi,
        mentor: MENTORS.maria,
        objectId: "survey-naomi-2",
        /* 69h — three hours left. WHICH BUCKET THIS LANDS IN DEPENDS ON THE TIME
           OF DAY, and that is a property of the grouping rather than a flaw in
           the fixture: "due today" is a wall-clock day boundary, so an item three
           hours out is today's until late evening and tomorrow's after. Recorded
           rather than engineered around — a fixture cannot pin a bucket whose
           edge is midnight. */
        openedAgo: 69 * HOUR,
        payload: billingPayload(true, now, CODES.mddMild, CODES.mddModerate, 14),
      },
      {
        taskType: "intakeBillingReview",
        teen: TEENS.simone,
        mentor: MENTORS.brandy,
        objectId: "survey-simone-1",
        // 70h — two hours left.
        openedAgo: 70 * HOUR,
        payload: billingPayload(false, now, null, CODES.adjustment, 9),
      },
      // ── Routine review.
      {
        taskType: "riskFlagReview",
        teen: TEENS.simone,
        mentor: MENTORS.omar,
        objectId: "conv-simone-1",
        openedAgo: 3 * DAY,
        payload: LOW_MOOD(),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-1",
        openedAgo: 5 * DAY,
        payload: LOW_MOOD(),
      },
      // ── Closed today, one per domain.
      {
        taskType: "riskFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-9",
        openedAgo: 12 * HOUR,
        payload: SELF_HARM(),
        status: "resolved",
        resolvedAgo: 4 * HOUR,
      },
      {
        taskType: "intakeBillingReview",
        teen: TEENS.imani,
        mentor: MENTORS.omar,
        objectId: "survey-imani-9",
        openedAgo: 30 * HOUR,
        payload: billingPayload(false, now, null, CODES.adjustment, 9),
        status: "resolved",
        resolvedAgo: 2 * HOUR,
      },
      {
        taskType: "activeEscalation",
        teen: TEENS.theo,
        mentor: MENTORS.brandy,
        objectId: "esc-theo-9",
        openedAgo: 8 * HOUR,
        payload: escalationPayload(false, "Brandy Forrestor", "esc-theo-9"),
        status: "resolved",
        resolvedAgo: 7 * HOUR,
      },
  ];

  /* ═══ AND THEN THE REST OF THE SHIFT ═══
     Forty-six open flags across twenty-eight conversations, thirteen billing
     reviews, eighteen routine-review rows. That is what a supervisor's Tuesday looks
     like, and it is the volume every Part 3 decision was made against.

     THE IMMINENT WINDOW CROSSES ITS SLA ON PURPOSE (2h → 26h against a 24h SLA), so a
     handful of imminent flags are genuinely breached and the Imminent band opens
     with them — breach outranks tier in the comparator, and a fixture where
     nothing is breached never proves that. The clinical window (6h → 44h against
     48h) stays inside its SLA, so the two bands differ in more than their label. */
  specs.push(
    ...fill({ taskType: "riskFlagReview", count: 22, conversations: 12, minAgo: 2 * HOUR, maxAgo: 26 * HOUR, payload: SELF_HARM, seed: 1 }),
    ...fill({ taskType: "riskFlagReview", count: 24, conversations: 16, minAgo: 6 * HOUR, maxAgo: 44 * HOUR, payload: HOME_CONFLICT, seed: 2 }),
    ...fill({ taskType: "intakeBillingReview", count: 7, conversations: 7, minAgo: 4 * HOUR, maxAgo: 60 * HOUR, payload: () => billingPayload(false, now, null, CODES.gad, 12), seed: 3 }),
    ...fill({ taskType: "monthlyReReview", count: 6, conversations: 6, minAgo: 8 * HOUR, maxAgo: 66 * HOUR, payload: () => billingPayload(true, now, CODES.mddMild, CODES.mddModerate, 15), seed: 4 }),
    ...fill({ taskType: "riskFlagReview", count: 18, conversations: 14, minAgo: 1 * DAY, maxAgo: 6 * DAY, payload: LOW_MOOD, seed: 5 }),
    // Closed today, at a volume that matches the open one.
    ...closedFill("riskFlagReview", 6, SELF_HARM, 6),
    ...closedFill("riskFlagReview", 5, HOME_CONFLICT, 7),
    ...closedFill("intakeBillingReview", 4, () => billingPayload(false, now, null, CODES.adjustment, 9), 8),
  );
  return build(specs, now);
}

/** HEAVY CASELOAD — the coalescing stress case. One conversation carrying five
 *  imminent flags, plus a full board. */
function heavyCaseload(now: number): TaskItem[] {
  const specs: Spec[] = [
    /* THE SAME LIFECYCLE SPREAD AS TYPICAL-SHIFT (arch-B), at heavy volume: two
       active rather than one, so the region is exercised with more than a single
       saturated row — the case where the alarm budget is actually under
       pressure. Within the brief's seeds (1–3 active, 1–2 awaiting
       documentation). */
    {
      taskType: "activeEscalation",
      teen: TEENS.imani,
      mentor: MENTORS.omar,
      objectId: "esc-imani-live",
      openedAgo: 4 * MINUTE,
      payload: escalationPayload(false, "Omar Haddad", "esc-imani-live"),
    },
    {
      taskType: "activeEscalation",
      teen: TEENS.simone,
      mentor: MENTORS.maria,
      objectId: "esc-simone-live",
      openedAgo: 17 * MINUTE,
      payload: escalationPayload(true, "Maria Lopez", "esc-simone-live"),
    },
    {
      taskType: "escalationDocumentation",
      teen: TEENS.riley,
      mentor: MENTORS.brandon,
      objectId: "esc-riley-1",
      openedAgo: 10 * HOUR,
      clockStartAgo: 10 * HOUR,
      payload: {
        kind: "documentation",
        escalationId: "esc-riley-1",
        closedAt: now - 10 * HOUR,
        triggeredAt: now - 11.5 * HOUR,
      },
    },
    {
      taskType: "escalationDocumentation",
      teen: TEENS.caleb,
      mentor: MENTORS.omar,
      objectId: "esc-caleb-2",
      openedAgo: 27 * HOUR,
      clockStartAgo: 27 * HOUR,
      payload: {
        kind: "documentation",
        escalationId: "esc-caleb-2",
        closedAt: now - 27 * HOUR,
        triggeredAt: now - 29 * HOUR,
      },
    },
  ];
  // FIVE IMMINENT FLAGS ON ONE CONVERSATION — the group that must render as one row
  // with a count and expand to five children.
  for (let i = 0; i < 5; i++) {
    specs.push({
      taskType: "riskFlagReview",
      teen: TEENS.marcus,
      mentor: MENTORS.brandon,
      objectId: "conv-marcus-heavy",
      openedAgo: 20 * HOUR + i * 12 * MINUTE,
      payload: SELF_HARM(),
    });
  }
  // Three clinical on a second conversation, so there are two groups of different
  // sizes and one ungrouped row for contrast.
  for (let i = 0; i < 3; i++) {
    specs.push({
      taskType: "riskFlagReview",
      teen: TEENS.naomi,
      mentor: MENTORS.brandy,
      objectId: "conv-naomi-heavy",
      openedAgo: 30 * HOUR + i * 20 * MINUTE,
      payload: HOME_CONFLICT(),
    });
  }
  specs.push({
    taskType: "riskFlagReview",
    teen: TEENS.jordan,
    mentor: MENTORS.maria,
    objectId: "conv-jordan-solo",
    openedAgo: 5 * HOUR,
    payload: HOME_CONFLICT(),
  });
  // Billing and routine review, several each.
  for (let i = 0; i < 4; i++) {
    const teen = [TEENS.jordan, TEENS.riley, TEENS.imani, TEENS.theo][i];
    specs.push({
      taskType: i % 2 === 0 ? "intakeBillingReview" : "monthlyReReview",
      teen,
      mentor: MENTORS.maria,
      objectId: `survey-${teen.id}-h`,
      openedAgo: (8 + i * 14) * HOUR,
      payload: billingPayload(i % 2 === 1, now, i % 2 === 1 ? CODES.gad : null, CODES.mddModerate, 10 + i),
    });
  }
  for (let i = 0; i < 6; i++) {
    const teen = [TEENS.caleb, TEENS.simone, TEENS.imani, TEENS.theo, TEENS.naomi, TEENS.jordan][i];
    specs.push({
      taskType: "riskFlagReview",
      teen,
      mentor: MENTORS.omar,
      objectId: `conv-${teen.id}-mon`,
      openedAgo: (2 + i) * DAY,
      payload: LOW_MOOD(),
    });
  }
  // Closed today.
  specs.push({
    taskType: "riskFlagReview",
    teen: TEENS.simone,
    mentor: MENTORS.omar,
    objectId: "conv-simone-done",
    openedAgo: 14 * HOUR,
    payload: SELF_HARM(),
    status: "resolved",
    resolvedAgo: 3 * HOUR,
  });

  /* ═══ THE WORST TUESDAY (Part 3) ═══
     Ninety-seven open flags. Not a number chosen for drama — it is the top of the
     range the brief asks the list to survive, and the one where every fallback
     has to hold at once: the virtualized window is crossing group boundaries, the
     band headers are the only way to tell where imminent stops, and the age
     gradient runs from two hours to three days inside a single band.
     Marcus's five-flag conversation above is still in here, and still findable —
     if it stops being findable at this volume, the density work failed. */
  specs.push(
    ...fill({ taskType: "riskFlagReview", count: 40, conversations: 14, minAgo: 1 * HOUR, maxAgo: 34 * HOUR, payload: SELF_HARM, seed: 11 }),
    ...fill({ taskType: "riskFlagReview", count: 48, conversations: 22, minAgo: 4 * HOUR, maxAgo: 3 * DAY, payload: HOME_CONFLICT, seed: 12 }),
    ...fill({ taskType: "intakeBillingReview", count: 7, conversations: 7, minAgo: 6 * HOUR, maxAgo: 70 * HOUR, payload: () => billingPayload(false, now, null, CODES.gad, 13), seed: 13 }),
    ...fill({ taskType: "monthlyReReview", count: 5, conversations: 5, minAgo: 12 * HOUR, maxAgo: 80 * HOUR, payload: () => billingPayload(true, now, CODES.mddMild, CODES.mddModerate, 17), seed: 14 }),
    ...fill({ taskType: "riskFlagReview", count: 20, conversations: 15, minAgo: 2 * DAY, maxAgo: 8 * DAY, payload: LOW_MOOD, seed: 15 }),
    ...closedFill("riskFlagReview", 11, SELF_HARM, 16),
    ...closedFill("riskFlagReview", 9, HOME_CONFLICT, 17),
    ...closedFill("intakeBillingReview", 5, () => billingPayload(false, now, null, CODES.adjustment, 10), 18),
  );
  return build(specs, now);
}

/** BREACH OVERNIGHT — everything past its SLA, nothing active. The digest's
 *  breach-on-arrival rule (§7) and the breach treatment on every card. */
function breachOvernight(now: number): TaskItem[] {
  return build(
    [
      {
        taskType: "riskFlagReview",
        teen: TEENS.marcus,
        mentor: MENTORS.brandon,
        objectId: "conv-marcus-1",
        openedAgo: 31 * HOUR,
        payload: SELF_HARM(),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-1",
        openedAgo: 28 * HOUR,
        payload: SELF_HARM(),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.jordan,
        mentor: MENTORS.maria,
        objectId: "conv-jordan-1",
        openedAgo: 54 * HOUR,
        payload: HOME_CONFLICT(),
      },
      {
        taskType: "intakeBillingReview",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "survey-riley-1",
        openedAgo: 80 * HOUR,
        payload: billingPayload(false, now, null, CODES.gad, 14),
      },
      // RILEY APPEARS IN TWO DOMAINS. Caught by the §2.4 consistency test, not by
      // reading: the first draft of this scenario gave every teen exactly one
      // domain, so the board read as four unrelated queues that happened to share
      // a page — the precise failure §2.4's reuse rule exists to prevent. A teen
      // whose billing has been sitting for 80 hours plausibly has an overdue flag
      // too, and now the worklist shows that.
      {
        taskType: "riskFlagReview",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "conv-riley-1",
        openedAgo: 60 * HOUR,
        payload: HOME_CONFLICT(),
      },
      {
        taskType: "escalationDocumentation",
        teen: TEENS.theo,
        mentor: MENTORS.brandy,
        objectId: "esc-theo-1",
        openedAgo: 30 * HOUR,
        clockStartAgo: 30 * HOUR,
        payload: {
          kind: "documentation",
          escalationId: "esc-theo-1",
          closedAt: now - 30 * HOUR,
          triggeredAt: now - 31 * HOUR,
        },
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-1",
        openedAgo: 9 * DAY,
        payload: LOW_MOOD(),
      },
    ],
    now
  );
}

/** ACTIVE ESCALATION — the interrupt case. Two open escalations, one 911, plus a
 *  normal board underneath so the Respond strip has something to sit above. The
 *  teen with the escalation also has flag history (§2.4). */
function activeEscalation(now: number): TaskItem[] {
  return build(
    [
      {
        taskType: "activeEscalation",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "esc-riley-live",
        // 12 minutes against a 5-minute SLA — breached, which is the point.
        openedAgo: 12 * MINUTE,
        payload: escalationPayload(true, "Brandon Forant", "esc-riley-live"),
      },
      {
        taskType: "activeEscalation",
        teen: TEENS.marcus,
        mentor: MENTORS.brandy,
        objectId: "esc-marcus-live",
        openedAgo: 3 * MINUTE,
        payload: escalationPayload(false, "Brandy Forrestor", "esc-marcus-live"),
      },
      // SAME TEENS, OTHER DOMAINS — Riley's flag history and billing.
      {
        taskType: "riskFlagReview",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "conv-riley-1",
        openedAgo: 20 * HOUR,
        payload: SELF_HARM(),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.marcus,
        mentor: MENTORS.brandy,
        objectId: "conv-marcus-2",
        openedAgo: 40 * HOUR,
        payload: HOME_CONFLICT(),
      },
      {
        taskType: "monthlyReReview",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "survey-riley-1",
        openedAgo: 20 * HOUR,
        payload: billingPayload(true, now, CODES.gad, CODES.mddModerate, 16),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.simone,
        mentor: MENTORS.omar,
        objectId: "conv-simone-1",
        openedAgo: 4 * DAY,
        payload: LOW_MOOD(),
      },
      {
        taskType: "riskFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-done",
        openedAgo: 10 * HOUR,
        payload: SELF_HARM(),
        status: "resolved",
        resolvedAgo: 1 * HOUR,
      },
    ],
    now
  );
}

// ── The registry ────────────────────────────────────────────────────────────

export interface TaskScenario {
  id: string;
  /** TODO-COPY — dev chrome, not product. */
  label: string;
  description: string;
  build: (now: number) => TaskItem[];
}

/** A SIXTH SCENARIO IS ONE ENTRY. Same extensibility contract as the Activity
 *  simulator's registry. */
export const TASK_SCENARIOS: TaskScenario[] = [
  { id: "quiet-day", label: "Quiet day", description: "Three open, nothing breached.", build: quietDay },
  { id: "typical-shift", label: "Typical shift", description: "46 open flags, 13 billing, a few breached.", build: typicalShift },
  { id: "heavy-caseload", label: "Heavy caseload", description: "97 open flags across two bands.", build: heavyCaseload },
  /* THE DESCRIPTION NARROWED IN PHASE 4, and the narrowing is the finding: a
     flag has no published review deadline, so "everything" cannot include one.
     What this scenario stresses is every item that HAS a clock, past it. */
  { id: "breach-overnight", label: "Breach overnight", description: "Every deadline past its SLA.", build: breachOvernight },
  { id: "active-escalation", label: "Active escalation", description: "Two open escalations, one 911.", build: activeEscalation },
];

export const DEFAULT_TASK_SCENARIO_ID = "typical-shift";

/** Build a scenario's items. `now` is the caller's clock — see the module note on
 *  why this is not a frozen instant. */
export function tasksScenario(id: string, now: number): TaskItem[] {
  const scenario =
    TASK_SCENARIOS.find((s) => s.id === id) ??
    TASK_SCENARIOS.find((s) => s.id === DEFAULT_TASK_SCENARIO_ID)!;
  return withCoalesceCounts(scenario.build(now));
}
