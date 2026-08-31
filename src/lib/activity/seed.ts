// SEED SCENARIOS — five named ledgers the simulator switches between.
//
// TODO-DATA: every event here is a fixture. Nothing in this file is derived from
// the app's own store; the ledger has no writer yet.
//
// SIMULATED NOW is 9:40 PM ET — MID-SHIFT. A single exported `SIM_NOW`, with every
// timestamp derived from it, so a scenario reads the same on any day it is opened.
//
// ═══ A9 ITEM 4: WHY `SIM_NOW` MOVED, AND WHY THAT WAS THE ACTUAL BUG ═══
//
// It was 4:05 PM, which the original phase prompt gave as the convention. Shifts
// start at 4:00 PM, so 4:05 PM is FIVE MINUTES INTO THE SHIFT — "today" had a
// five-minute window to hold history in, and every fixture offset of an hour or
// more necessarily landed before the shift began. Walk back far enough and the
// events arrive in the small hours: 12:47 AM, 2:05 AM, 3:23 AM, 4:41 AM, which is
// what A9 reported.
//
// Patching the offsets would not have fixed it. The offsets were only obeying a
// `now` that left nowhere plausible for them to go. 9:40 PM puts the reader most
// of the way through a shift, so today's window is 5h40m of real working time and
// the fixtures have somewhere to be.
//
// `placeInShiftWindows` then does the placement, and it is what guarantees the
// property rather than each call site being careful.
//
// DETERMINISTIC BY CONSTRUCTION. No Math.random and no Date.now anywhere: the
// generated scenarios (heavy-day, network-wide) index off their loop counters, so
// two runs produce byte-identical ledgers and a screenshot taken today matches one
// taken next week.
//
// EVERY NAME IN THIS FILE IS A FIRST NAME — teens AND staff. It was written that
// way for standing rule 6 ("teens are first name only"), enforced at the fixture
// level rather than trusted to the renderer: there is no surname here to leak.
//
// RULE 6 WAS RETIRED ON 2026-08-28 (gap row 284) AND THIS FILE DID NOT FOLLOW,
// because it cannot without new data. The reversal works by rendering
// `DemoTeen.name`, and this is a SEPARATE fixture universe whose people
// (`teen-maya`, `mentor-brandon`, `sup-lydia`) have no surnames at all. Giving
// the ledger surnames means authoring them for teens and staff alike — a data
// decision, not a rendering one, and staff here would otherwise be the only
// people in the app shown less fully than teens. Flagged, not invented.

import {
  SYSTEM_ACTOR_ID,
  type ActivityEvent,
  type ActivityEventType,
} from "@/lib/activity/events";

/** 9:40 PM ET on 26 August 2026. ET in August is EDT (UTC−4), so 21:40 → 01:40Z
 *  on the 27th. Exported so the feed, the day grouping and the timestamp ladder
 *  all agree on "now" instead of each reading the wall clock. */
export const SIM_NOW = new Date("2026-08-27T01:40:00.000Z").getTime();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MINUTE = 60_000;

/** THE SHIFT WINDOW. Supervisor shifts start at 4:00 PM ET.
 *
 *  The window is closed at 11:45 PM RATHER THAN RUNNING PAST MIDNIGHT, even though
 *  a real 4:00 PM shift does. Day dividers are the feed's strongest organiser
 *  (A3 step 6) and A6 never coalesces across one, so letting a shift straddle the
 *  divider would split a single shift's work into two days on screen — a rendering
 *  problem imported from a scheduling fact. A fixture does not need to model the
 *  overnight tail to be plausible. */
export const SHIFT_START_HOUR = 16;
const SHIFT_END_HOUR = 23.75;

/** ISO timestamp, `h` hours before SIM_NOW. */
const at = (h: number): string => new Date(SIM_NOW - h * HOUR).toISOString();
/** ISO timestamp, `d` days and `h` hours before SIM_NOW. */
const ago = (d: number, h = 0): string =>
  new Date(SIM_NOW - d * DAY - h * HOUR).toISOString();

/** ═══ PLACE EVERY EVENT INSIDE A SHIFT WINDOW (A9 item 4) ═══
 *
 *  Applied to a whole scenario, so the guarantee is structural rather than a rule
 *  every `at()` call site has to remember. Two properties, both deliberate:
 *
 *  THE DAY IS PRESERVED. Each event keeps the local calendar day it was authored
 *  on, so the `// Yesterday` comments still mean yesterday, the day dividers do not
 *  move, and A6's within-a-day coalescing groups keep exactly the members they had.
 *  Only the time of day is rewritten.
 *
 *  THE REMAP IS AFFINE, NOT AN EVEN SPREAD. A day's authored times are mapped
 *  linearly onto that day's window, so RELATIVE SPACING SURVIVES: the seven risk
 *  flags authored minutes apart stay a tight cluster instead of being combed out
 *  across eight hours, which is the whole premise of the coalescing fixture.
 *
 *  Today's window ends at SIM_NOW, not at 11:45 PM — nothing has happened yet in
 *  the part of the shift the reader has not lived through. */
function placeInShiftWindows(events: ActivityEvent[]): ActivityEvent[] {
  const dayStart = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const todayStart = dayStart(SIM_NOW);

  const byDay = new Map<number, ActivityEvent[]>();
  for (const e of events) {
    const key = dayStart(new Date(e.occurredAt).getTime());
    const bucket = byDay.get(key);
    if (bucket) bucket.push(e);
    else byDay.set(key, [e]);
  }

  const placed = new Map<string, string>();
  for (const [key, bucket] of byDay) {
    const windowStart = key + SHIFT_START_HOUR * HOUR;
    const windowEnd =
      key === todayStart ? SIM_NOW : key + SHIFT_END_HOUR * HOUR;
    const span = Math.max(0, windowEnd - windowStart);

    const times = bucket.map((e) => new Date(e.occurredAt).getTime());
    const lo = Math.min(...times);
    const hi = Math.max(...times);
    const authoredSpan = hi - lo;

    for (const e of bucket) {
      const t = new Date(e.occurredAt).getTime();
      // ZERO SPAN — a day holding one event, or several authored at one instant.
      //
      // This used to place them all at 2/3 of the window, which put EVERY sparse
      // day at exactly 9:10 PM. Caught in browser verification: long-history
      // rendered seven consecutive dividers each with one row, all stamped 9:10
      // PM, which reads as generated data rather than as a quiet week.
      //
      // The authored TIME OF DAY is the natural source of variety and costs
      // nothing — the fixtures already spread their offsets across the clock, so
      // mapping that position within the authored day onto the window gives each
      // day a different, deterministic time.
      const authoredDayFrac = (t - key) / DAY;
      const frac =
        authoredSpan === 0 ? authoredDayFrac : (t - lo) / authoredSpan;
      // Rounded to the minute: a ledger renders times to the minute, and second-
      // level precision would only produce timestamps that look computed.
      // INSET FROM BOTH EDGES. Without it a fraction of 0 or 1 lands exactly on
      // 4:00 PM or 11:45 PM, and enough rows sitting precisely on the boundary is
      // its own tell that the times were computed.
      const inset = 0.04 + frac * 0.92;
      const ms = windowStart + inset * span;
      placed.set(e.id, new Date(Math.round(ms / MINUTE) * MINUTE).toISOString());
    }
  }

  return events.map((e) => ({
    ...e,
    occurredAt: placed.get(e.id) ?? e.occurredAt,
  }));
}

// ── The cast ────────────────────────────────────────────────────────────────
// STAFF ids are stable because the viewer identity and A5's clause (a) both
// compare against them.

export const VIEWER_SUPERVISOR_ID = "sup-lydia";

/** STAFF. `leadId` and `reviewStatus` were added for A12's mentor inspector; they
 *  are only meaningful on mentors, and are absent on everyone else rather than
 *  filled with a placeholder. */
export const STAFF = {
  lydia: { id: "sup-lydia", firstName: "Lydia", role: "supervisor" as const },
  omar: { id: "sup-omar", firstName: "Omar", role: "supervisor" as const },
  amara: { id: "sup-amara", firstName: "Amara", role: "supervisor" as const },
  priya: { id: "sup-priya", firstName: "Priya", role: "supervisor" as const },
  brandy: { id: "lead-brandy", firstName: "Brandy", role: "leadMentor" as const },
  brandon: {
    id: "mentor-brandon",
    firstName: "Brandon",
    role: "mentor" as const,
    leadId: "lead-brandy",
    /** TODO-COPY / TODO-DATA. */
    reviewStatus: "Profile approved",
  },
  maria: {
    id: "mentor-maria",
    firstName: "Maria",
    role: "mentor" as const,
    leadId: "lead-brandy",
    reviewStatus: "Profile update pending",
  },
};

/** TEENS — FIRST NAMES ONLY. No surname exists in this file to render.
 *
 *  ═══ `status`, `intakeDaysAgo` AND `mentorId` WERE ADDED FOR A12 ═══
 *
 *  The object inspector needs a teen's status, intake date and assigned mentor,
 *  and none of the three was reachable: no event payload carries them, and the
 *  join to the app's own people fixtures is blocked by gap row 207 — this file
 *  invents its own teen ids (`teen-maya`) which do not match `t5`…`t26`.
 *
 *  So they are seeded HERE, in the ledger's own cast, rather than by re-keying
 *  committed fixtures across a phase boundary or by a lookup that would resolve to
 *  nothing on every row. That keeps A12 self-contained and leaves row 207's
 *  decision where it belongs — with whoever owns the fixtures. TODO-DATA, like
 *  everything else in this file. */
export const TEENS = {
  maya: { id: "teen-maya", firstName: "Maya", status: "Active", intakeDaysAgo: 140, mentorId: "mentor-brandon" },
  jordan: { id: "teen-jordan", firstName: "Jordan", status: "Active", intakeDaysAgo: 96, mentorId: "mentor-maria" },
  naomi: { id: "teen-naomi", firstName: "Naomi", status: "Active", intakeDaysAgo: 212, mentorId: "mentor-brandon" },
  riley: { id: "teen-riley", firstName: "Riley", status: "Paused", intakeDaysAgo: 61, mentorId: "mentor-maria" },
  caleb: { id: "teen-caleb", firstName: "Caleb", status: "Active", intakeDaysAgo: 24, mentorId: "mentor-brandon" },
  simone: { id: "teen-simone", firstName: "Simone", status: "Active", intakeDaysAgo: 178, mentorId: "mentor-maria" },
  imani: { id: "teen-imani", firstName: "Imani", status: "Active", intakeDaysAgo: 133, mentorId: "mentor-brandon" },
  elena: { id: "teen-elena", firstName: "Elena", status: "Active", intakeDaysAgo: 45, mentorId: "mentor-maria" },
  marcus: { id: "teen-marcus", firstName: "Marcus", status: "Active", intakeDaysAgo: 301, mentorId: "mentor-brandon" },
  ava: { id: "teen-ava", firstName: "Ava", status: "Active", intakeDaysAgo: 88, mentorId: "mentor-maria" },
  theo: { id: "teen-theo", firstName: "Theo", status: "Ended", intakeDaysAgo: 254, mentorId: "mentor-brandon" },
  sofia: { id: "teen-sofia", firstName: "Sofia", status: "Active", intakeDaysAgo: 17, mentorId: "mentor-maria" },
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

/** TODO-COPY. The actor's ROLE, for line 1 of a detailed row (A11).
 *
 *  EMPTY FOR THE SYSTEM ACTOR rather than "Automatic" or "System": the name is
 *  already "Somethings", and giving a cron job a job title is the same mistake as
 *  giving it a person-shaped avatar (A3 step 7). The detailed row omits the
 *  separator when this is empty, so there is no dangling middot. */
export function staffRoleLabel(id: string): string {
  if (id === SYSTEM_ACTOR_ID) return "";
  const role = Object.values(STAFF).find((s) => s.id === id)?.role;
  if (role === "supervisor") return "Supervisor";
  if (role === "leadMentor") return "Lead mentor";
  if (role === "mentor") return "Mentor";
  return "";
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
    // ═══ THE DEFAULT SCENARIO'S TOP FOUR ROWS CARRY FULL EVIDENCE (B3) ═══
    // These are hand-written, so `payloadFor` never touched them — and the first
    // pane capture came back with no review document, no reviewer notes and no
    // disclosure control, because the fields simply were not there. The default
    // scenario is the one anybody demos, so it has to exercise the pane rather
    // than only the generated fixtures doing so.
    make({ type: "RISK_FLAG_CLOSED", actorId: L, teenId: TEENS.maya.id, conversationId: "conv-maya-a", occurredAt: at(1.85), payload: { categories: ["HATE_SPEECH_RACIAL_SLURS"], decision: "Closed", reviewerNotes: "Read the full thread. The language is heated but aimed at a situation rather than a person, and the mentor had already picked it up in the next message. Closing with a note on the record.", flaggedExcerpt: "i don't know how much longer i can keep doing this" } }),
    make({ type: "BILLING_REVIEW_COMPLETE", actorId: L, teenId: TEENS.caleb.id, occurredAt: at(3), payload: { code: "F41.1", previousCode: "F41.9", status: "Active", note: "Scores have held in the moderate band across three readings and the presenting content matches the recurrent course. Coding to the milder severity." } }),
    make({ type: "ESCALATION_CLOSED", actorId: L, teenId: TEENS.simone.id, occurredAt: at(4.5), payload: { outcome: "supported", notes: "Called the guardian within the hour. They were aware and had already contacted the school counsellor. Follow-up scheduled for Monday." } }),
    make({ type: "SURVEY_COMPLETED", actorId: SYSTEM_ACTOR_ID, teenId: TEENS.jordan.id, occurredAt: at(6), payload: { instrument: "GAD-7", score: 11, priorScore: 14 } }),
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
        payload: payloadFor(type, teen.id, i),
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
        //
        // ═══ THE CANARY MOVED OFF SCREEN, AND STAYED A CANARY ═══
        // It used to be `reason: "clinical detail that must never reach network
        // scope"`, and `reason` is rendered — so the string was ON SCREEN, in a
        // demo, reading "Abuse disclosure · clinical detail that must never
        // reach network scope". The instinct to make it recognisable was right;
        // putting it in a rendered field was not.
        // `canary` is rendered by nothing, so a leak is still unmistakable in a
        // payload dump or an assertion, and the row reads like a record.
        payload: payloadFor(type, teen.id, i, {
          riskTier: "high",
          canary: "NETWORK_SCOPE_MUST_OMIT_THIS_PAYLOAD",
        }),
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

// ── Scenario 6 · long-history ───────────────────────────────────────────────
// ADDED IN A7, and only because a state was otherwise unreachable. Pagination is
// a 30-day window, and every other scenario spans at most six days — so the feed
// is always already complete, "Load older" never appears and end-of-feed can only
// ever be the empty case. This one runs 48 days back so both are real.
//
// Sparse on purpose: two or three events a day over seven weeks, which is what a
// real quarter of a caseload looks like and is also what makes the 30-day boundary
// visible rather than buried.

function longHistory(): ActivityEvent[] {
  seq = 0;
  const L = STAFF.lydia.id;
  const out: ActivityEvent[] = [];
  const teens = [
    TEENS.maya, TEENS.jordan, TEENS.naomi, TEENS.riley, TEENS.caleb, TEENS.simone,
  ];
  const types: ActivityEventType[] = [
    "BILLING_REVIEW_COMPLETE",
    "ESCALATION_CLOSED",
    "PRESENTATION_REVIEW_COMPLETE",
    "SURVEY_COMPLETED",
    "TEEN_PAUSED",
  ];
  /** ═══ DAYS THAT ACTUALLY GROUP ═══
   *
   *  This loop used to place events at `ago(floor(i * 48 / 54), …)`, which spread
   *  54 events almost evenly over 48 days: MEASURED, 43 populated days of which
   *  32 held exactly one event. So a day divider rendered above nearly every
   *  single row — grouping that never groups, which is chrome rather than
   *  structure, and it also meant A6's coalescing was only ever visible in the
   *  heavy-day scenario instead of in a realistic feed.
   *
   *  An explicit plan rather than a formula: `[daysAgo, count]`, counts in the
   *  brief's 3–8 band, with gaps of one to nine days between them so some days
   *  hold none. Deterministic, so the fixture is still diffable.
   *
   *  THE 48-DAY SPAN IS PRESERVED, which is what makes "Load older" mean
   *  anything — two populated days sit beyond 30, holding 11 events between
   *  them, so paging reveals real rows rather than an empty stretch. */
  const DAY_PLAN: Array<[number, number]> = [
    [0, 5],
    [2, 3],
    [3, 7],
    [6, 4],
    [7, 3],
    [11, 6],
    [14, 4],
    [18, 8],
    [23, 3],
    [29, 5],
    [36, 3],
    [45, 3],
  ];

  let i = 0;
  for (const [daysAgo, count] of DAY_PLAN) {
    for (let k = 0; k < count; k++) {
      const type = types[i % types.length];
      const teen = teens[i % teens.length];
      out.push(
        make({
          type,
          actorId: type === "SURVEY_COMPLETED" ? SYSTEM_ACTOR_ID : L,
          teenId: teen.id,
          // ═══ THE SPREAD MUST NOT CROSS MIDNIGHT ═══
          // `ago(d, h)` subtracts h hours from SIM_NOW, which is 01:40Z — so any
          // offset over ~1.6h lands on the PREVIOUS calendar day. The first
          // version used `1 + k * 2.5` and split every planned day in two: the
          // 12-day plan measured as 22 populated days with a max of 5 instead of
          // 8, which is the same defect this change exists to remove.
          // 9 minutes apart keeps a day's rows ordered and distinct, and close
          // enough together that A6's coalescing has something to do.
          occurredAt: ago(daysAgo, k * 0.15),
          payload: payloadFor(type, teen.id, i),
        })
      );
      i++;
    }
  }
  return out;
}

/** ═══ A PAYLOAD PER EVENT, NOT ONE LITERAL PER LOOP ═══
 *
 *  Three bulk loops used to write `payload: { code: "F41.1", index: i }` for
 *  every event they generated, whatever its type. So a whole scenario rendered
 *  the same billing code on every row — reported as line 3 "inheriting from the
 *  selected pane object", which it was not: the query reads each event's own
 *  payload faithfully, and the payloads were genuinely identical. Worth naming,
 *  because the reported cause would have sent someone to the wrong file.
 *
 *  THE PAYLOAD NOW FOLLOWS THE TYPE, and varies by teen so two rows about two
 *  mentees differ — which is what the test asserts. Deterministic (indexed, not
 *  random), because a fixture that changes between runs cannot be diffed.
 *
 *  `extra` is for a scenario that needs to add something the type does not carry
 *  by default — the network fixture's degradation bait, for instance. */
function payloadFor(
  type: ActivityEventType,
  teenId: string,
  i: number,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  // Deterministic per-teen pick, so Caleb's code is Caleb's code on every row.
  const pick = <T,>(list: readonly T[]) =>
    list[
      (teenId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + i) %
        list.length
    ];
  const base = { index: i, ...extra };

  switch (type) {
    case "BILLING_REVIEW_COMPLETE":
      return {
        ...base,
        code: pick(["F41.1", "F33.0", "F33.1", "F90.0", "H0038"] as const),
        previousCode: pick(["F41.9", "F32.9", "F41.1"] as const),
        status: "Active",
        // The review document the pane previews — the supervisor's own reasoning,
        // which is what makes the code checkable rather than just recorded.
        note: pick([
          "Scores have held in the moderate band across three readings and the presenting content matches the recurrent course. Coding to the milder severity.",
          "The most recent survey moved a band and the session content supports it. Updating the code to match.",
          "No change indicated. Re-affirming the code on record at the scheduled review.",
        ] as const),
      };
    case "BILLING_REVIEW_OPENED":
    case "BILLING_REVIEW_OVERDUE":
      return {
        ...base,
        code: pick(["F41.1", "F33.0", "F33.1", "F90.0"] as const),
      };
    case "SURVEY_COMPLETED": {
      const score = 4 + ((i * 3) % 14);
      return {
        ...base,
        instrument: pick(["GAD-7", "PHQ-9", "WHO-5"] as const),
        score,
        // A PRIOR SCORE ON SOME ROWS AND NOT OTHERS, on purpose: the pane's trend
        // section has to be exercised BOTH ways, and a "trend" from a single
        // reading is a number with an arrow next to it.
        ...(i % 3 === 0 ? {} : { priorScore: Math.max(0, score + ((i % 5) - 2)) }),
      };
    }
    case "RISK_FLAG_CLOSED":
      return {
        ...base,
        decision: pick(["Closed", "Escalated", "Monitoring"] as const),
        categories: [
          pick([
            "HATE_SPEECH_RACIAL_SLURS",
            "PASSIVE_SUICIDAL_IDEATION",
            "SELF_HARM_LANGUAGE",
            "BULLYING",
          ] as const),
        ],
        // ═══ THE EVIDENCE PANE'S BODY (B3) ═══
        // Reviewer notes are AUTHORED BY THE PERSON WHO CLOSED THE FLAG, which is
        // why the pane renders them as plain prose rather than in the
        // system-attributed inset.
        reviewerNotes: pick([
          "Read the full thread. Language is heated but directed at a situation, not a person. Closing with a note to the mentor.",
          "Discussed with the mentor on shift. Agreed this is within range for this teen and does not need escalation.",
          "Escalated to the on-call supervisor and confirmed the guardian was already aware.",
        ] as const),
        // A TEEN'S OWN WORDS, and the only field in this seed that is one. It
        // reaches the pane exclusively through `flaggedContentFor`, which logs.
        flaggedExcerpt: pick([
          "i don't know how much longer i can keep doing this",
          "everyone at school acts like i'm invisible and i'm so done",
          "i said something i shouldn't have and now i feel awful",
        ] as const),
      };
    case "RISK_FLAG_RAISED":
    case "RISK_FLAG_OVERDUE":
      return {
        ...base,
        categories: [
          pick([
            "HATE_SPEECH_RACIAL_SLURS",
            "SELF_HARM_LANGUAGE",
            "BULLYING",
          ] as const),
        ],
      };
    case "ESCALATION_CLOSED":
      return {
        ...base,
        outcome: pick([
          "referred",
          "guardian contacted",
          "no further action",
          "safety plan agreed",
        ] as const),
        notes: pick([
          "Called the guardian within the hour. They were aware and had already contacted the teen's counsellor.",
          "On-call supervisor joined the conversation. Teen was safe and willing to talk; a follow-up is scheduled.",
          "Reviewed with the clinical lead. No immediate risk identified; monitoring continues at the current cadence.",
        ] as const),
      };
    case "ESCALATION_OVERDUE":
      return { ...base, hoursLate: 2 + ((i * 5) % 40) };
    case "TEEN_PAUSED":
      return {
        ...base,
        // TODO-COPY. Ordinary reasons a mentorship pauses — the point of line 3
        // here is that it is mundane and specific.
        reason: pick(["exams", "family travel", "at their request", "illness"] as const),
      };
    case "TEEN_DEACTIVATED":
      return { ...base, reason: pick(["aged out", "moved away"] as const) };
    default:
      // Types with no line 3 get no line-3 fields. A payload that carries data
      // nothing renders is how the old bug looked from the outside.
      return base;
  }
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
  // ONE CHOKEPOINT. Every scenario is built with plain `at`/`ago` offsets and then
  // placed, so no builder has to know about the shift window and none can forget
  // it. `pickUnread` runs on the PLACED events because it sorts by time.
  const shifted = placeInShiftWindows(events);
  return {
    id,
    label,
    description,
    events: shifted,
    viewerId: VIEWER_SUPERVISOR_ID,
    caseloadTeenIds: caseload,
    unreadEventIds: pickUnread(shifted, unreadCount),
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
    "Team wide",
    "39 events across four supervisors, most outside caseload.",
    networkWide(),
    6
  ),
  scenario("first-run", "First run", "No events yet.", [], 0),
  scenario(
    "long-history",
    "Long history",
    "54 events over 48 days — reaches past the 30-day window.",
    longHistory(),
    3
  ),
];

export const DEFAULT_SCENARIO_ID = "typical-shift";

export function scenarioById(id: string): ActivityScenario {
  return (
    ACTIVITY_SCENARIOS.find((s) => s.id === id) ??
    ACTIVITY_SCENARIOS.find((s) => s.id === DEFAULT_SCENARIO_ID)!
  );
}
