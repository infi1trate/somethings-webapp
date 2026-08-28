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

import { deadlineFor } from "@/lib/tasks/sla";
import {
  DOMAIN_OF_TYPE,
  TIER_RANK,
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

const MENTORS = {
  brandon: { id: "tk-m-brandon", name: "Brandon Forant" },
  maria: { id: "tk-m-maria", name: "Maria Lopez" },
  brandy: { id: "tk-m-brandy", name: "Brandy Forrestor" },
  omar: { id: "tk-m-omar", name: "Omar Haddad" },
};

type Teen = (typeof TEENS)[keyof typeof TEENS];
type Mentor = (typeof MENTORS)[keyof typeof MENTORS];

// ── Payload builders ────────────────────────────────────────────────────────
// TODO-COPY / TODO-DATA on every string.

function flagPayload(
  tier: "red" | "orange" | "green",
  categories: string[],
  excerpt: string,
  rationale: string
): TaskPayload {
  return {
    kind: "riskFlag",
    tier,
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
      tierRank: TIER_RANK[s.taskType],
      teenId: s.teen.id,
      teenDisplayName: s.teen.name,
      mentorId: s.mentor.id,
      mentorName: s.mentor.name,
      objectId: s.objectId,
      openedAt,
      slaDeadline: deadlineFor(s.taskType, clockStart),
      status: s.status ?? "open",
      ...(s.resolvedAgo !== undefined ? { resolvedAt: now - s.resolvedAgo } : {}),
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

const RED = () =>
  flagPayload(
    "red",
    ["Self-harm language"],
    "i don't know how much longer i can keep doing this",
    "The message contains language the playbook treats as a self-harm indicator, in a conversation where the previous two exchanges also referenced sleeplessness. Escalating rather than monitoring is the conservative read.",
  );
const ORANGE = () =>
  flagPayload(
    "orange",
    ["Family conflict"],
    "things at home got bad again last night",
    "The message describes conflict at home without naming a specific risk. Flagged for review rather than escalation because no immediate danger is stated.",
  );
const GREEN = () =>
  flagPayload(
    "green",
    ["Low mood"],
    "kind of a rough week honestly",
    "Routine low-mood language with no risk indicators. Surfaced for monitoring only.",
  );

const CODES = {
  gad: { code: "F41.1", statement: "Generalized anxiety disorder" },
  mddModerate: { code: "F33.1", statement: "Major depressive disorder, recurrent, moderate" },
  mddMild: { code: "F33.0", statement: "Major depressive disorder, recurrent, mild" },
  adjustment: { code: "R45.89", statement: "Other symptoms involving emotional state" },
};

// ── The five scenarios ──────────────────────────────────────────────────────

/** QUIET DAY — a handful of low-tier items, nothing breached, no escalation.
 *  Proves the surface reads calm when there is little to do, and that the
 *  Monitoring empty/near-empty state does not celebrate. */
function quietDay(now: number): TaskItem[] {
  return build(
    [
      {
        taskType: "standardFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-1",
        openedAgo: 2 * DAY,
        payload: GREEN(),
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
        taskType: "orangeFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-2",
        openedAgo: 3 * HOUR,
        payload: ORANGE(),
      },
      // CLOSED TODAY — one per domain that has any, so the header counters have
      // matching resolved items (§2.4).
      {
        taskType: "redFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-3",
        openedAgo: 9 * HOUR,
        payload: RED(),
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
  return build(
    [
      // ── Escalations: documentation only (no active escalation here).
      {
        taskType: "escalationDocumentation",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "esc-riley-1",
        openedAgo: 20 * HOUR,
        // Clock starts at CLOSE, 20h ago — so 4h of the 24h remain.
        clockStartAgo: 20 * HOUR,
        payload: { kind: "documentation", escalationId: "esc-riley-1", closedAt: now - 20 * HOUR },
      },
      // ── Risk flags: one BREACHED red (26h old against a 24h SLA), two orange.
      {
        taskType: "redFlagReview",
        teen: TEENS.marcus,
        mentor: MENTORS.brandon,
        objectId: "conv-marcus-1",
        openedAgo: 26 * HOUR,
        payload: RED(),
      },
      {
        taskType: "orangeFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-1",
        openedAgo: 9 * HOUR,
        payload: ORANGE(),
      },
      {
        taskType: "orangeFlagReview",
        teen: TEENS.jordan,
        mentor: MENTORS.maria,
        objectId: "conv-jordan-1",
        openedAgo: 30 * HOUR,
        payload: ORANGE(),
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
      // ── Monitoring.
      {
        taskType: "standardFlagReview",
        teen: TEENS.simone,
        mentor: MENTORS.omar,
        objectId: "conv-simone-1",
        openedAgo: 3 * DAY,
        payload: GREEN(),
      },
      {
        taskType: "standardFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-1",
        openedAgo: 5 * DAY,
        payload: GREEN(),
      },
      // ── Closed today, one per domain.
      {
        taskType: "redFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-9",
        openedAgo: 12 * HOUR,
        payload: RED(),
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
    ],
    now
  );
}

/** HEAVY CASELOAD — the coalescing stress case. One conversation carrying five
 *  red flags, plus a full board. */
function heavyCaseload(now: number): TaskItem[] {
  const specs: Spec[] = [
    {
      taskType: "escalationDocumentation",
      teen: TEENS.riley,
      mentor: MENTORS.brandon,
      objectId: "esc-riley-1",
      openedAgo: 10 * HOUR,
      clockStartAgo: 10 * HOUR,
      payload: { kind: "documentation", escalationId: "esc-riley-1", closedAt: now - 10 * HOUR },
    },
  ];
  // FIVE RED FLAGS ON ONE CONVERSATION — the group that must render as one row
  // with a count and expand to five children.
  for (let i = 0; i < 5; i++) {
    specs.push({
      taskType: "redFlagReview",
      teen: TEENS.marcus,
      mentor: MENTORS.brandon,
      objectId: "conv-marcus-heavy",
      openedAgo: 20 * HOUR + i * 12 * MINUTE,
      payload: RED(),
    });
  }
  // Three orange on a second conversation, so there are two groups of different
  // sizes and one ungrouped row for contrast.
  for (let i = 0; i < 3; i++) {
    specs.push({
      taskType: "orangeFlagReview",
      teen: TEENS.naomi,
      mentor: MENTORS.brandy,
      objectId: "conv-naomi-heavy",
      openedAgo: 30 * HOUR + i * 20 * MINUTE,
      payload: ORANGE(),
    });
  }
  specs.push({
    taskType: "orangeFlagReview",
    teen: TEENS.jordan,
    mentor: MENTORS.maria,
    objectId: "conv-jordan-solo",
    openedAgo: 5 * HOUR,
    payload: ORANGE(),
  });
  // Billing and monitoring, several each.
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
      taskType: "standardFlagReview",
      teen,
      mentor: MENTORS.omar,
      objectId: `conv-${teen.id}-mon`,
      openedAgo: (2 + i) * DAY,
      payload: GREEN(),
    });
  }
  // Closed today.
  specs.push({
    taskType: "redFlagReview",
    teen: TEENS.simone,
    mentor: MENTORS.omar,
    objectId: "conv-simone-done",
    openedAgo: 14 * HOUR,
    payload: RED(),
    status: "resolved",
    resolvedAgo: 3 * HOUR,
  });
  return build(specs, now);
}

/** BREACH OVERNIGHT — everything past its SLA, nothing active. The digest's
 *  breach-on-arrival rule (§7) and the breach treatment on every card. */
function breachOvernight(now: number): TaskItem[] {
  return build(
    [
      {
        taskType: "redFlagReview",
        teen: TEENS.marcus,
        mentor: MENTORS.brandon,
        objectId: "conv-marcus-1",
        openedAgo: 31 * HOUR,
        payload: RED(),
      },
      {
        taskType: "redFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-1",
        openedAgo: 28 * HOUR,
        payload: RED(),
      },
      {
        taskType: "orangeFlagReview",
        teen: TEENS.jordan,
        mentor: MENTORS.maria,
        objectId: "conv-jordan-1",
        openedAgo: 54 * HOUR,
        payload: ORANGE(),
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
        taskType: "orangeFlagReview",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "conv-riley-1",
        openedAgo: 60 * HOUR,
        payload: ORANGE(),
      },
      {
        taskType: "escalationDocumentation",
        teen: TEENS.theo,
        mentor: MENTORS.brandy,
        objectId: "esc-theo-1",
        openedAgo: 30 * HOUR,
        clockStartAgo: 30 * HOUR,
        payload: { kind: "documentation", escalationId: "esc-theo-1", closedAt: now - 30 * HOUR },
      },
      {
        taskType: "standardFlagReview",
        teen: TEENS.caleb,
        mentor: MENTORS.maria,
        objectId: "conv-caleb-1",
        openedAgo: 9 * DAY,
        payload: GREEN(),
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
        taskType: "redFlagReview",
        teen: TEENS.riley,
        mentor: MENTORS.brandon,
        objectId: "conv-riley-1",
        openedAgo: 20 * HOUR,
        payload: RED(),
      },
      {
        taskType: "orangeFlagReview",
        teen: TEENS.marcus,
        mentor: MENTORS.brandy,
        objectId: "conv-marcus-2",
        openedAgo: 40 * HOUR,
        payload: ORANGE(),
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
        taskType: "standardFlagReview",
        teen: TEENS.simone,
        mentor: MENTORS.omar,
        objectId: "conv-simone-1",
        openedAgo: 4 * DAY,
        payload: GREEN(),
      },
      {
        taskType: "redFlagReview",
        teen: TEENS.naomi,
        mentor: MENTORS.brandy,
        objectId: "conv-naomi-done",
        openedAgo: 10 * HOUR,
        payload: RED(),
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
  { id: "typical-shift", label: "Typical shift", description: "Every tab populated, one breach.", build: typicalShift },
  { id: "heavy-caseload", label: "Heavy caseload", description: "Five red flags on one conversation.", build: heavyCaseload },
  { id: "breach-overnight", label: "Breach overnight", description: "Everything past its SLA.", build: breachOvernight },
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
