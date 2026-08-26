// SEED SCENARIOS — five named ledgers the simulator switches between.
//
// TODO-DATA: every event here is a fixture. Nothing in this file is derived from
// the app's own store; the ledger has no writer yet.
//
// SIMULATED NOW is 4:05 PM ET, per the phase prompt's convention. The Tasks page
// it refers to does not exist (its sidebar item falls through to the unbuilt
// placeholder), so there was no existing simulator convention to match — this
// establishes one: a single exported `SIM_NOW`, every timestamp derived from it by
// offset, so a scenario reads the same on any day it is opened.
//
// DETERMINISTIC BY CONSTRUCTION. No Math.random and no Date.now anywhere: the
// generated scenarios (heavy-day, network-wide) index off their loop counters, so
// two runs produce byte-identical ledgers and a screenshot taken today matches one
// taken next week.
//
// TEEN NAMES ARE FIRST NAMES ONLY — standing rule 6, and here it is enforced at
// the fixture level rather than trusted to the renderer: there is no surname in
// this file to leak. Staff carry full first names.

import {
  SYSTEM_ACTOR_ID,
  type ActivityEvent,
  type ActivityEventType,
} from "@/lib/activity/events";

/** 4:05 PM ET on 26 August 2026. ET in August is EDT (UTC−4), so 16:05 → 20:05Z.
 *  Exported so the feed, the day grouping and the timestamp ladder all agree on
 *  "now" instead of each reading the wall clock. */
export const SIM_NOW = new Date("2026-08-26T20:05:00.000Z").getTime();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** ISO timestamp, `h` hours before SIM_NOW. */
const at = (h: number): string => new Date(SIM_NOW - h * HOUR).toISOString();
/** ISO timestamp, `d` days and `h` hours before SIM_NOW. */
const ago = (d: number, h = 0): string =>
  new Date(SIM_NOW - d * DAY - h * HOUR).toISOString();

// ── The cast ────────────────────────────────────────────────────────────────
// STAFF ids are stable because the viewer identity and A5's clause (a) both
// compare against them.

export const VIEWER_SUPERVISOR_ID = "sup-lydia";

export const STAFF = {
  lydia: { id: "sup-lydia", firstName: "Lydia", role: "supervisor" as const },
  omar: { id: "sup-omar", firstName: "Omar", role: "supervisor" as const },
  amara: { id: "sup-amara", firstName: "Amara", role: "supervisor" as const },
  priya: { id: "sup-priya", firstName: "Priya", role: "supervisor" as const },
  brandy: { id: "lead-brandy", firstName: "Brandy", role: "leadMentor" as const },
  brandon: { id: "mentor-brandon", firstName: "Brandon", role: "mentor" as const },
  maria: { id: "mentor-maria", firstName: "Maria", role: "mentor" as const },
};

/** TEENS — FIRST NAMES ONLY. No surname exists in this file to render. */
export const TEENS = {
  maya: { id: "teen-maya", firstName: "Maya" },
  jordan: { id: "teen-jordan", firstName: "Jordan" },
  naomi: { id: "teen-naomi", firstName: "Naomi" },
  riley: { id: "teen-riley", firstName: "Riley" },
  caleb: { id: "teen-caleb", firstName: "Caleb" },
  simone: { id: "teen-simone", firstName: "Simone" },
  imani: { id: "teen-imani", firstName: "Imani" },
  elena: { id: "teen-elena", firstName: "Elena" },
  marcus: { id: "teen-marcus", firstName: "Marcus" },
  ava: { id: "teen-ava", firstName: "Ava" },
  theo: { id: "teen-theo", firstName: "Theo" },
  sofia: { id: "teen-sofia", firstName: "Sofia" },
};

/** The viewer's caseload in every scenario except network-wide, which
 *  deliberately puts most of its events outside it. */
const LYDIA_CASELOAD = [
  TEENS.maya.id,
  TEENS.jordan.id,
  TEENS.naomi.id,
  TEENS.riley.id,
  TEENS.caleb.id,
  TEENS.simone.id,
];

/** Teen display name by id — the ONLY place a teen id becomes a rendered word,
 *  and it can only ever return a first name. */
export function teenFirstName(id: string): string {
  return Object.values(TEENS).find((t) => t.id === id)?.firstName ?? "this teen";
}

export function staffFirstName(id: string): string {
  if (id === SYSTEM_ACTOR_ID) return "Somethings";
  return Object.values(STAFF).find((s) => s.id === id)?.firstName ?? "A colleague";
}

// ── Builders ────────────────────────────────────────────────────────────────

let seq = 0;
const nextId = () => `ev-${++seq}`;

interface MakeArgs {
  type: ActivityEventType;
  actorId: string;
  teenId: string;
  occurredAt: string;
  /** Conversation id — set for risk-flag events, whose objectId is the thread. */
  conversationId?: string;
  payload?: Record<string, unknown>;
}

function make({
  type,
  actorId,
  teenId,
  occurredAt,
  conversationId,
  payload = {},
}: MakeArgs): ActivityEvent {
  const isSystem = actorId === SYSTEM_ACTOR_ID;
  return {
    id: nextId(),
    eventType: type,
    actorId,
    actorType: isSystem ? "system" : "staff",
    objectType: conversationId ? "conversation" : "teen",
    objectId: conversationId ?? teenId,
    occurredAt,
    // `teenId` is ALWAYS in the payload, including when objectId is a
    // conversation — scope resolution and the sentence both need it, and
    // `relationshipOf` reads it here.
    payload: { teenId, ...payload },
  };
}

// ── Scenario 1 · quiet-shift ────────────────────────────────────────────────
// Three events, all inside the caseload, nothing unread. The calm end of the
// range: proves the feed reads as a ledger when there is almost nothing in it.

function quietShift(): ActivityEvent[] {
  seq = 0;
  return [
    make({
      type: "BILLING_REVIEW_COMPLETE",
      actorId: STAFF.lydia.id,
      teenId: TEENS.jordan.id,
      occurredAt: at(2),
      payload: { code: "F41.1", previousCode: "F41.9" },
    }),
    make({
      type: "SURVEY_COMPLETED",
      actorId: SYSTEM_ACTOR_ID,
      teenId: TEENS.riley.id,
      occurredAt: at(5),
      payload: { instrument: "PHQ-9", score: 9 },
    }),
    make({
      type: "PRESENTATION_REVIEW_COMPLETE",
      actorId: STAFF.lydia.id,
      teenId: TEENS.naomi.id,
      occurredAt: ago(1, 3),
      payload: { code: "F33.1" },
    }),
  ];
}

// ── Scenario 2 · typical-shift ──────────────────────────────────────────────
// ~18 events over 4 days, mixed types. This is the review case for A3: it has to
// read as a ledger of what happened, not a list of things to do.

function typicalShift(): ActivityEvent[] {
  seq = 0;
  const L = STAFF.lydia.id;
  return [
    // Today
    make({ type: "RISK_FLAG_CLOSED", actorId: L, teenId: TEENS.maya.id, conversationId: "conv-maya-a", occurredAt: at(1.85), payload: { categories: ["HATE_SPEECH_RACIAL_SLURS"] } }),
    make({ type: "BILLING_REVIEW_COMPLETE", actorId: L, teenId: TEENS.caleb.id, occurredAt: at(3), payload: { code: "F41.1" } }),
    make({ type: "ESCALATION_CLOSED", actorId: L, teenId: TEENS.simone.id, occurredAt: at(4.5), payload: { outcome: "supported" } }),
    make({ type: "SURVEY_COMPLETED", actorId: SYSTEM_ACTOR_ID, teenId: TEENS.jordan.id, occurredAt: at(6), payload: { instrument: "GAD-7", score: 11 } }),
    make({ type: "BILLING_REVIEW_OPENED", actorId: SYSTEM_ACTOR_ID, teenId: TEENS.jordan.id, occurredAt: at(6.2), payload: { code: "F41.1" } }),
    // Yesterday
    make({ type: "ESCALATION_RAISED", actorId: STAFF.brandon.id, teenId: TEENS.maya.id, occurredAt: ago(1, 2), payload: { reason: "withheld" } }),
    make({ type: "ESCALATION_CLOSED", actorId: L, teenId: TEENS.maya.id, occurredAt: ago(1, 1), payload: { outcome: "referred" } }),
    make({ type: "RISK_FLAG_CLOSED", actorId: L, teenId: TEENS.naomi.id, conversationId: "conv-naomi-a", occurredAt: ago(1, 4), payload: { categories: ["CATEGORY_4"] } }),
    make({ type: "TEEN_PAUSED", actorId: STAFF.brandy.id, teenId: TEENS.riley.id, occurredAt: ago(1, 6), payload: { reason: "exams" } }),
    make({ type: "PRESENTATION_REVIEW_COMPLETE", actorId: L, teenId: TEENS.simone.id, occurredAt: ago(1, 7) }),
    // Two days back
    make({ type: "BILLING_REVIEW_OVERDUE", actorId: SYSTEM_ACTOR_ID, teenId: TEENS.caleb.id, occurredAt: ago(2, 1), payload: { hoursLate: 4 } }),
    make({ type: "RISK_FLAG_RAISED", actorId: SYSTEM_ACTOR_ID, teenId: TEENS.jordan.id, conversationId: "conv-jordan-a", occurredAt: ago(2, 3), payload: { categories: ["GROOMING_BEHAVIOR"] } }),
    make({ type: "RISK_FLAG_CLOSED", actorId: L, teenId: TEENS.jordan.id, conversationId: "conv-jordan-a", occurredAt: ago(2, 2), payload: { categories: ["GROOMING_BEHAVIOR"] } }),
    make({ type: "SURVEY_COMPLETED", actorId: SYSTEM_ACTOR_ID, teenId: TEENS.simone.id, occurredAt: ago(2, 5), payload: { instrument: "PHQ-9", score: 6 } }),
    // Three days back
    make({ type: "TEEN_MATCHED", actorId: STAFF.brandy.id, teenId: TEENS.caleb.id, occurredAt: ago(3, 2) }),
    make({ type: "ESCALATION_OVERDUE", actorId: SYSTEM_ACTOR_ID, teenId: TEENS.naomi.id, occurredAt: ago(3, 4), payload: { hoursLate: 26 } }),
    make({ type: "BILLING_REVIEW_COMPLETE", actorId: L, teenId: TEENS.maya.id, occurredAt: ago(3, 6), payload: { code: "F33.0" } }),
    make({ type: "PRESENTATION_REVIEW_COMPLETE", actorId: STAFF.omar.id, teenId: TEENS.riley.id, occurredAt: ago(3, 8) }),
  ];
}

// ── Scenario 3 · heavy-day ──────────────────────────────────────────────────
// ~60 events, INCLUDING one conversation carrying 7 risk-flag events on the same
// day. That block is the A6 coalescing stress case, and it is deliberately
// RISK_FLAG_CLOSED rather than RAISED: closed resolves to activity and is in the
// default view, so the coalescing is visible without toggling "Include actions".
// A matching RAISED block is included so the filter-only path can be tested too —
// A6 is explicit that a default-view screenshot alone does not prove coalescing.

function heavyDay(): ActivityEvent[] {
  seq = 0;
  const L = STAFF.lydia.id;
  const out: ActivityEvent[] = [];

  // THE 7-FLAG CONVERSATION. One object, one day, seven events.
  for (let i = 0; i < 7; i++) {
    out.push(
      make({
        type: "RISK_FLAG_CLOSED",
        actorId: L,
        teenId: TEENS.maya.id,
        conversationId: "conv-maya-heavy",
        // Minutes apart, newest first in the group — the collapsed row's
        // timestamp is the most recent, so they must not all be identical.
        occurredAt: at(1.85 + i * 0.12),
        payload: { categories: ["HATE_SPEECH_RACIAL_SLURS"], index: i },
      })
    );
  }
  // THE FILTER-ONLY TWIN: 5 RAISED events on another conversation, same day.
  //
  // ON AN IN-CASELOAD TEEN, and that matters. The first draft put these on Imani,
  // who is NOT in this viewer's caseload — so the relationship resolved to
  // `network`, `inScope` excluded them from My caseload entirely, and the
  // filter-only path could never be exercised no matter how the filter was set.
  // Caught by the A6 test, which is exactly what it is for: A6 warns that a
  // default-view screenshot does not prove coalescing, and the same is true of a
  // fixture that cannot reach the view under test.
  //
  // On Jordan the relationship is `caseload`, RISK_FLAG_RAISED resolves to
  // ACTION, and the group appears only once "Include actions" is on.
  for (let i = 0; i < 5; i++) {
    out.push(
      make({
        type: "RISK_FLAG_RAISED",
        actorId: SYSTEM_ACTOR_ID,
        teenId: TEENS.jordan.id,
        conversationId: "conv-jordan-heavy",
        occurredAt: at(3.2 + i * 0.1),
        payload: { categories: ["GROOMING_BEHAVIOR"], index: i },
      })
    );
  }

  // The rest of a 60-event day, spread across the caseload and four days. Indexed
  // off the loop counter so it is deterministic.
  const teens = [
    TEENS.maya, TEENS.jordan, TEENS.naomi, TEENS.riley, TEENS.caleb, TEENS.simone,
  ];
  const types: ActivityEventType[] = [
    "BILLING_REVIEW_COMPLETE",
    "ESCALATION_CLOSED",
    "PRESENTATION_REVIEW_COMPLETE",
    "SURVEY_COMPLETED",
    "RISK_FLAG_CLOSED",
    "TEEN_PAUSED",
    "ESCALATION_RAISED",
    "BILLING_REVIEW_OVERDUE",
  ];
  for (let i = 0; i < 48; i++) {
    const type = types[i % types.length];
    const teen = teens[i % teens.length];
    const systemType =
      type === "SURVEY_COMPLETED" || type === "BILLING_REVIEW_OVERDUE";
    out.push(
      make({
        type,
        actorId: systemType ? SYSTEM_ACTOR_ID : i % 5 === 0 ? STAFF.omar.id : L,
        teenId: teen.id,
        conversationId:
          type === "RISK_FLAG_CLOSED" ? `conv-${teen.id}-${i % 3}` : undefined,
        // Spread over four days so the day dividers are exercised and A6's
        // "never coalesce across a day divider" has something to hold.
        occurredAt: ago(Math.floor(i / 14), (i % 14) * 1.3 + 1),
        payload: { code: "F41.1", index: i },
      })
    );
  }
  return out;
}

// ── Scenario 4 · network-wide ───────────────────────────────────────────────
// ~40 events across 4 supervisors, MOST OUTSIDE the viewer's caseload. This is
// A5's fixture: it must contain rows that degrade, and — per A5's instruction —
// at least one event where the viewer IS the actor but the teen has since left
// their caseload, so clause (a) has something to prove.

function networkWide(): ActivityEvent[] {
  seq = 0;
  const out: ActivityEvent[] = [];
  const supervisors = [STAFF.omar, STAFF.amara, STAFF.priya, STAFF.lydia];
  // Teens deliberately NOT in LYDIA_CASELOAD.
  const outside = [
    TEENS.imani, TEENS.elena, TEENS.marcus, TEENS.ava, TEENS.theo, TEENS.sofia,
  ];
  const types: ActivityEventType[] = [
    "BILLING_REVIEW_COMPLETE",
    "ESCALATION_CLOSED",
    "RISK_FLAG_CLOSED",
    "PRESENTATION_REVIEW_COMPLETE",
    "TEEN_MATCHED",
  ];

  for (let i = 0; i < 38; i++) {
    const sup = supervisors[i % supervisors.length];
    const teen = outside[i % outside.length];
    const type = types[i % types.length];
    out.push(
      make({
        type,
        actorId: sup.id,
        teenId: teen.id,
        conversationId:
          type === "RISK_FLAG_CLOSED" ? `conv-${teen.id}-net` : undefined,
        occurredAt: ago(Math.floor(i / 10), (i % 10) * 2 + 1),
        // PAYLOAD IS RICH ON PURPOSE. A5's degrading query must omit this whole
        // key in network scope; a thin payload would let a broken query pass.
        payload: {
          code: "F33.1",
          categories: ["ABUSE_DISCLOSURE"],
          riskTier: "high",
          reason: "clinical detail that must never reach network scope",
          index: i,
        },
      })
    );
  }

  // ── A5 CLAUSE (a) FIXTURE, added per the phase instruction.
  // Lydia's own past billing approval for a teen who is no longer on her
  // caseload. Without clause (a) this row would degrade — losing its payload and
  // its first-person voice — in a ledger whose premise is that rows never change.
  out.push(
    make({
      type: "BILLING_REVIEW_COMPLETE",
      actorId: STAFF.lydia.id,
      teenId: TEENS.theo.id,
      occurredAt: ago(6, 3),
      payload: {
        code: "H0038",
        previousCode: "F41.9",
        note: "own past approval, teen since reassigned",
      },
    })
  );
  return out;
}

// ── The registry ────────────────────────────────────────────────────────────

export interface ActivityScenario {
  id: string;
  /** TODO-COPY — the simulator's own labels are prototype chrome, not product. */
  label: string;
  description: string;
  events: ActivityEvent[];
  /** The viewer this scenario is authored for. */
  viewerId: string;
  caseloadTeenIds: string[];
  /** Event ids that start UNREAD. Everything else starts read, so a scenario's
   *  unread count is a fixture decision rather than an accident of ordering.
   *  Resolved into the read-state overlay at load (A2). */
  unreadEventIds: string[];
}

function pickUnread(events: ActivityEvent[], n: number): string[] {
  // Newest-first, deterministic — the top n rows are the unread ones, which is
  // where a reader would expect them.
  return [...events]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, n)
    .map((e) => e.id);
}

function scenario(
  id: string,
  label: string,
  description: string,
  events: ActivityEvent[],
  unreadCount: number,
  caseload = LYDIA_CASELOAD
): ActivityScenario {
  return {
    id,
    label,
    description,
    events,
    viewerId: VIEWER_SUPERVISOR_ID,
    caseloadTeenIds: caseload,
    unreadEventIds: pickUnread(events, unreadCount),
  };
}

/** THE FIVE SCENARIOS. A sixth is one entry — same extensibility contract as the
 *  view registry. */
export const ACTIVITY_SCENARIOS: ActivityScenario[] = [
  scenario(
    "quiet-shift",
    "Quiet shift",
    "Three events, all in caseload, nothing unread.",
    quietShift(),
    0
  ),
  scenario(
    "typical-shift",
    "Typical shift",
    "18 events over four days, mixed types, five unread.",
    typicalShift(),
    5
  ),
  scenario(
    "heavy-day",
    "Heavy day",
    "60 events, including seven risk flags closed on one conversation.",
    heavyDay(),
    9
  ),
  scenario(
    "network-wide",
    "Network wide",
    "39 events across four supervisors, most outside caseload.",
    networkWide(),
    6
  ),
  scenario("first-run", "First run", "No events yet.", [], 0),
];

export const DEFAULT_SCENARIO_ID = "typical-shift";

export function scenarioById(id: string): ActivityScenario {
  return (
    ACTIVITY_SCENARIOS.find((s) => s.id === id) ??
    ACTIVITY_SCENARIOS.find((s) => s.id === DEFAULT_SCENARIO_ID)!
  );
}
