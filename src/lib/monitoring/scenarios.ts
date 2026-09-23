// ═══ MONITORING'S OWN SCENARIOS ═══
//
// Separate from `TASK_SCENARIOS` on purpose. Those five were built for a
// four-domain board and three of them render this surface as a single row (gap
// rows 360, 375). Monitoring needs states Tasks has no use for — a dead
// classifier, an unacknowledged escalation, a dormant live band — and putting
// them in the shared registry would change what Tasks and Home show.
//
// EVERY FIXTURE COMPOSES FROM THE EXISTING SEED where it can. Flags are real
// flag items from `tasksScenario`, subset and re-stamped, so a fixture here
// cannot invent a payload shape the rest of the codebase does not produce.

import { buildConversation } from "@/lib/tasks/conversation";
import { isFlagTask } from "@/lib/tasks/list";
import { MENTOR_POOL, ROSTER, tasksScenario } from "@/lib/tasks/seed";
import type { RiskFlagPayload, TaskItem } from "@/lib/tasks/types";
import {
  ESCALATION_ACK_SLA,
  ESCALATION_NOTE_SLA,
  MENTOR_NOTE_SLA,
  MENTOR_ONLINE_HOURS,
  MENTOR_TEEN_RESPONSE_SLA,
} from "@/lib/monitoring/constants";
import { flagEvent, type MonitoringEvent } from "@/lib/monitoring/event";
import type { CloseOutId, EscalationRecord } from "@/lib/monitoring/escalation";
import { practiceEventsFor, stubbedConductEvent, type MentorShiftFacts } from "@/lib/monitoring/practice";
import type { SupervisedConversation } from "@/lib/monitoring/coverage";
import type { LiveItem, LiveKind } from "@/lib/monitoring/live";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A compliance path the pane has to render differently. Named on the data so
 *  the pane branches on a fact rather than on a scenario id. */
export type CompliancePath = "explicit-media" | "suspected-death" | null;

export interface MonitoringData {
  events: MonitoringEvent[];
  escalations: EscalationRecord[];
  conversations: SupervisedConversation[];
  live: LiveItem[];
  transport: "connected" | "lost";
  paused: boolean;
  /** ═══ THE CLASSIFIER'S OWN HEALTH ═══
   *  Zero flags is otherwise ambiguous between a quiet shift and a broken safety
   *  pipe, which is the highest-value distinction on this page. */
  classifier: "healthy" | "degraded";
  compliance: CompliancePath;
  /** A fixture may pin the clock's hour so the dormant band is reachable without
   *  waiting for 9pm. Null = the real clock. */
  clockOverride: number | null;
  load: "ready" | "partial";
  /** A record that changed under the reader mid-review. */
  teenDeactivated: string | null;
}

export interface MonitoringScenario {
  id: string;
  label: string;
}
export interface MonitoringScenarioGroup {
  label: string;
  scenarios: MonitoringScenario[];
}

/** NEEDS-COPY-NICOLE on every label. Keys are the pack's, verbatim, and the
 *  groups are in the pack's order. */
export const MONITORING_SCENARIO_GROUPS: MonitoringScenarioGroup[] = [
  {
    label: "Volume and coverage",
    scenarios: [
      { id: "clean-day", label: "Clean day" },
      { id: "classifier-degraded", label: "Classifier degraded" },
      { id: "shift-start-backlog", label: "Shift-start backlog" },
      { id: "normal-day", label: "Normal day" },
      { id: "surge", label: "Surge" },
      { id: "coverage-debt", label: "Coverage debt" },
    ],
  },
  {
    label: "Escalation lifecycle",
    scenarios: [
      { id: "escalation-unacked", label: "Escalation · unacknowledged" },
      { id: "escalation-breach", label: "Escalation · ack breached" },
      { id: "escalation-911", label: "Escalation · 911 dispatched" },
      { id: "escalation-concurrent", label: "Escalation · two open" },
      { id: "escalation-closeout", label: "Escalation · close-out open" },
      { id: "escalation-note-overdue", label: "Escalation · note overdue" },
      { id: "escalation-no-caregiver", label: "Escalation · no caregiver" },
      { id: "escalation-afterhours", label: "Escalation · after hours" },
      /* LAST IN THE GROUP, AFTER THE PHASE FILE'S EIGHT. Appending rather than
         inserting keeps every existing key at the position the phase file and
         the probes record, so this addition cannot be mistaken for a reordering
         of what was reviewed. */
      { id: "escalation-documented", label: "Escalation · documented" },
    ],
  },
  {
    label: "Compliance paths",
    scenarios: [
      { id: "explicit-media", label: "Explicit media" },
      { id: "suspected-death", label: "Suspected death" },
    ],
  },
  {
    label: "Risk flags",
    scenarios: [
      { id: "flag-in-escalation", label: "Flag on an escalated teen" },
      { id: "flag-repeat-pattern", label: "Repeat pattern" },
      { id: "flag-no-mentor-reply", label: "No mentor reply" },
      { id: "flag-false-positive-cluster", label: "False-positive cluster" },
    ],
  },
  {
    label: "Mentor practice",
    scenarios: [
      { id: "mentor-offline", label: "Offline during hours" },
      { id: "mentor-outreach-missed", label: "Outreach missed" },
      { id: "mentor-response-slow", label: "Response time breach" },
      { id: "mentor-note-overdue", label: "Progress note overdue" },
      { id: "mentor-conduct-flag", label: "Conduct — stubbed" },
      { id: "mentor-perf-escalation", label: "Raised by a lead mentor" },
      { id: "mentor-post-crisis", label: "Post-crisis coverage" },
    ],
  },
  {
    label: "Live layer",
    scenarios: [
      { id: "live-offhours", label: "Live · dormant" },
      { id: "live-transport-lost", label: "Live · transport lost" },
      { id: "live-quiet-shift", label: "Live · quiet shift" },
      { id: "live-busy-shift", label: "Live · busy shift" },
      { id: "live-response-clock", label: "Live · teen waiting" },
      { id: "live-mentor-drop", label: "Live · mentor offline" },
      { id: "live-outreach-window", label: "Live · outreach window" },
      { id: "live-flag-arrival", label: "Live · flag arrives" },
      { id: "live-escalation-arrival", label: "Live · escalation arrives" },
      { id: "live-paused", label: "Live · paused" },
    ],
  },
  {
    label: "System and edge",
    scenarios: [
      { id: "teen-deactivated-midreview", label: "Teen deactivated mid-review" },
      { id: "loading-partial", label: "Slow and partial" },
    ],
  },
];

export const MONITORING_SCENARIOS: MonitoringScenario[] =
  MONITORING_SCENARIO_GROUPS.flatMap((g) => g.scenarios);

export function isMonitoringScenario(id: string | null): boolean {
  return id != null && MONITORING_SCENARIOS.some((s) => s.id === id);
}

// ── Building blocks ─────────────────────────────────────────────────────────

/** Deterministic, so a fixture is the same on every render and between
 *  sessions. Same shape the task seed uses. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** ═══ DOES THE MENTOR'S LAST WORD COME AFTER THE FLAGGED ONE? ═══
 *  Comparator step 4. Read off the conversation fixture rather than guessed:
 *  there is no `repliedAt` on the payload, and inventing one would be a claim
 *  about a mentor's behaviour derived from nothing. */
function mentorRepliedAfterFlag(item: TaskItem, now: number): boolean {
  const p = item.payload;
  const convo = buildConversation(item, p.kind === "riskFlag" ? p.flaggedExcerpt : null, now);
  const idx = convo.messages.findIndex((m) => m.flagged);
  if (idx < 0) return false;
  return convo.messages.slice(idx + 1).some((m) => m.sender === "mentor");
}

function flagPool(tasksScenarioId: string, now: number): TaskItem[] {
  /* OPEN ONLY. The seed carries resolved flags for the closed-today counters, and
     a queue of events for judgment must not include judgments already made — the
     first render of this surface showed 81 rows where 43 were open. */
  return tasksScenario(tasksScenarioId, now).filter(
    (i) => isFlagTask(i.taskType) && i.status !== "resolved"
  );
}

/** Re-stamp a flag's age. Fixtures need specific ages; the seed's are its own. */
function aged(item: TaskItem, openedAt: number): TaskItem {
  return { ...item, openedAt };
}

function eventsFromFlags(
  flags: TaskItem[],
  now: number,
  escalatedTeens: ReadonlySet<string> = new Set()
): MonitoringEvent[] {
  return flags.map((f) =>
    flagEvent(f, {
      escalationOpen: escalatedTeens.has(f.teenId),
      mentorReplied: mentorRepliedAfterFlag(f, now),
    })
  );
}

let escSeq = 0;
function escalation(
  now: number,
  o: Partial<EscalationRecord> & { triggeredMinsAgo?: number }
): EscalationRecord {
  escSeq += 1;
  const teen = ROSTER[(escSeq * 7) % ROSTER.length];
  const mentor = MENTOR_POOL[(escSeq * 3) % MENTOR_POOL.length];
  const triggeredAt = now - (o.triggeredMinsAgo ?? 3) * MINUTE;
  return {
    id: o.id ?? `esc-${escSeq}`,
    teenId: o.teenId ?? teen.id,
    teenName: o.teenName ?? teen.name,
    mentorId: o.mentorId ?? mentor.id,
    mentorName: o.mentorName ?? mentor.name,
    conversationId: o.conversationId ?? (o.teenId ?? teen.id),
    triggeredAt: o.triggeredAt ?? triggeredAt,
    acknowledgedAt: o.acknowledgedAt ?? null,
    resolvedAt: o.resolvedAt ?? null,
    is911: o.is911 ?? false,
    caregiverInvolved: o.caregiverInvolved ?? null,
    closeOutDone: o.closeOutDone ?? [],
    /* TODO-DATA on both. The purpose-built records know them: this is the
       fixture a reader lands on from the region, so the pane's Facts row has
       something to state. */
    flaggedBy: o.flaggedBy ?? mentor.name,
    emergencyContact:
      o.emergencyContact ?? "Guardian on file · reached 4:02 PM",
  };
}

/** ═══ THE COVERAGE ROSTER — THE DENOMINATOR ═══
 *  Every supervised conversation, not only the flagged ones. Built from the SAME
 *  roster the task seed uses (`ROSTER`, `MENTOR_POOL`) so the two surfaces cannot
 *  disagree about who exists. `reviewedAt` is the fixture's own: a period with
 *  some reviews already done is the normal mid-shift state. */
function roster(
  now: number,
  opts: { reviewedFraction: number; events: MonitoringEvent[] }
): SupervisedConversation[] {
  const byTeen = new Map<string, number>();
  const names = new Map<string, string>();
  for (const e of opts.events) {
    if (!e.teenId) continue;
    byTeen.set(e.teenId, (byTeen.get(e.teenId) ?? 0) + 1);
    if (e.teenName) names.set(e.teenId, e.teenName);
  }
  /* ═══ THE DENOMINATOR HAS TO CONTAIN THE NUMERATOR ═══
     `ROSTER` is the seed's fill cast and deliberately excludes the eight
     hand-written teens (see its own note) — so a coverage view built from it
     alone reported "24 conversations" while the queue held flags on thirty
     different teens. Any teen the queue mentions is a supervised conversation by
     definition. */
  const extra = [...names.entries()]
    .filter(([id]) => !ROSTER.some((t) => t.id === id))
    .map(([id, name]) => ({ id, name }));
  return [...ROSTER, ...extra].map((teen, i) => {
    const mentor = MENTOR_POOL[i % MENTOR_POOL.length];
    const h = hash(teen.id);
    return {
      id: teen.id,
      teenId: teen.id,
      teenName: teen.name,
      mentorId: mentor.id,
      mentorName: mentor.name,
      lastActivityAt: now - ((h % 300) + 5) * MINUTE,
      reviewedAt: i / ROSTER.length < opts.reviewedFraction ? now - ((h % 90) + 10) * MINUTE : null,
      eventCount: byTeen.get(teen.id) ?? 0,
    };
  });
}

let liveSeq = 0;
function liveItem(kind: LiveKind, line: string, at: number, conversationId: string | null = null): LiveItem {
  liveSeq += 1;
  return { id: `live-${liveSeq}`, kind, line, at, conversationId };
}

/** One mentor's shift facts, with the breach the fixture wants. */
function shiftFacts(now: number, o: Partial<MentorShiftFacts> = {}): MentorShiftFacts {
  const mentor = MENTOR_POOL[0];
  return {
    mentorId: o.mentorId ?? mentor.id,
    mentorName: o.mentorName ?? mentor.name,
    shiftStart: o.shiftStart ?? now - 3 * HOUR,
    offlineSince: o.offlineSince ?? null,
    waitingWhenOffline: o.waitingWhenOffline ?? 0,
    outreachSentAt: o.outreachSentAt ?? now - 2 * HOUR,
    teensNeedingOutreach: o.teensNeedingOutreach ?? 0,
    longestWait: o.longestWait ?? null,
    leadership: o.leadership ?? null,
    notesDue: o.notesDue ?? [],
  };
}

function base(now: number, events: MonitoringEvent[], reviewedFraction = 0.35): MonitoringData {
  return {
    events,
    escalations: [],
    conversations: roster(now, { reviewedFraction, events }),
    live: [],
    transport: "connected",
    paused: false,
    classifier: "healthy",
    compliance: null,
    clockOverride: null,
    load: "ready",
    teenDeactivated: null,
  };
}

/** The hour of `now`, moved. Used only by the two fixtures whose whole point is
 *  a time of day — the dormant band and an after-hours escalation. */
function atHour(now: number, hour: number): number {
  const d = new Date(now);
  d.setHours(hour, 5, 0, 0);
  return d.getTime();
}

/** ═══ THE DEFAULT, WHEN NO MONITORING SCENARIO IS CHOSEN ═══
 *  Derived from whichever task scenario is active, so Home's deep links and the
 *  five existing scenarios still land on a populated surface. Escalation items
 *  become ONE record each: an `activeEscalation` is unresolved, an
 *  `escalationDocumentation` is the same event after it closed — which is the
 *  pairing this phase replaced with a lifecycle. */
/** ═══ THE ROSTER'S OWN ESCALATIONS, AS RECORDS (extracted in Phase 10) ═══
 *
 *  It was inline in `fromTasksScenario`, so only the UNSCOPED default could
 *  produce escalation records from the task roster. MEASURED: 28 of the 40 named
 *  scenarios had zero records, and for most of them that is right — a
 *  `mentor-offline` fixture has no escalation. The defect was the six
 *  volume-and-coverage scenarios, which are the general-purpose ones a reader
 *  lands on: on `normal-day`, `/app/escalations` and Today's escalation strip
 *  were EMPTY while the task scenario underneath carried two live
 *  `activeEscalation` items.
 *
 *  So the fixture most likely to be read as "the normal state" said two
 *  escalations were running on one surface and none on another. Gap row 409
 *  recorded the symptom and recommended this shape.
 *
 *  EXPORTED AS A NAMED SOURCE RATHER THAN A DEFAULT INSIDE `base`, so each
 *  builder SAYS where its escalations come from. A builder that wants none still
 *  writes none, and "no escalations" stays sayable and visibly a choice — which
 *  matters most for `clean-day`, whose whole point is that nothing is open. */
export function escalationsFromTasks(
  tasksScenarioId: string,
  now: number
): EscalationRecord[] {
  const all = tasksScenario(tasksScenarioId, now);
  const escItems = all.filter(
    (i) => i.taskType === "activeEscalation" || i.taskType === "escalationDocumentation"
  );
  return escItems.map((i) => {
    const p = i.payload;
    const active = i.taskType === "activeEscalation";
    const closedAt = p.kind === "documentation" ? p.closedAt : null;
    return {
      id: p.kind === "escalation" || p.kind === "documentation" ? p.escalationId : i.objectId,
      teenId: i.teenId,
      teenName: i.teenDisplayName,
      mentorId: i.mentorId,
      mentorName: i.mentorName,
      conversationId: i.objectId,
      triggeredAt: i.openedAt,
      /* ═══ NOT A FIELD UPSTREAM ═══ An active escalation from the task seed has
         no acknowledgement timestamp, so it reads as unacknowledged — which is
         the honest reading of "nothing recorded" and is why the ack clock shows
         breached on an old one. A closed escalation is taken as acknowledged: it
         cannot have been resolved without someone responding to it. */
      acknowledgedAt: active ? null : i.openedAt + MINUTE,
      resolvedAt: active ? null : closedAt,
      is911: p.kind === "escalation" ? p.is911 : false,
      caregiverInvolved: null,
      closeOutDone: [],
      /* ═══ THE PAYLOAD IS THE ONLY THING THAT KNOWS WHETHER IT KNOWS ═══
         A DOCUMENTATION task carries the escalation id and the close time and
         nothing else — so both of these are genuinely unknown for a record
         assembled from one, and null says exactly that. Coercing them to a
         string here is what `recordFromTask` did with `is911` and what gap row
         213 was opened about: it would print an emergency contact on a record
         that has none on file. */
      flaggedBy: p.kind === "escalation" ? p.flaggedBy : null,
      emergencyContact: p.kind === "escalation" ? p.emergencyContact : null,
    };
  });
}

function fromTasksScenario(tasksScenarioId: string, now: number): MonitoringData {
  const all = tasksScenario(tasksScenarioId, now);
  const flags = all.filter((i) => isFlagTask(i.taskType) && i.status !== "resolved");
  const records = escalationsFromTasks(tasksScenarioId, now);
  const escalatedTeens = new Set(records.filter((r) => r.resolvedAt == null).map((r) => r.teenId));
  return {
    ...base(now, eventsFromFlags(flags, now, escalatedTeens), 0.35),
    escalations: records,
  };
}

type Builder = (now: number, tasksScenarioId: string) => MonitoringData;

const BUILDERS: Record<string, Builder> = {
  /* ═══ THE VOLUME SCENARIOS CARRY THE ROSTER'S ESCALATIONS (Phase 10) ═══
     These six are the general-purpose fixtures, and all six had zero escalation
     records while the task scenario underneath carried two live ones — see
     `escalationsFromTasks`. `clean-day` is the deliberate exception below. */
  // ── Volume and coverage ───────────────────────────────────────────────────

  /* THE ONE THAT KEEPS ITS EMPTY SET, AND IT IS THE POINT OF THE FIXTURE: every
     conversation reviewed, nothing flagged, nothing open. An escalation here
     would make the only "genuinely clear" state in the list not clear. */
  "clean-day": (now) => ({ ...base(now, [], 1) }),

  /* THE HIGHEST-VALUE FIXTURE ON THE LIST, and the reason it exists: zero flags
     is otherwise ambiguous between a quiet shift and a broken safety pipe. The
     page must say which. */
  "classifier-degraded": (now, ts) => ({
    ...base(now, [], 0.4),
    /* THE ESCALATIONS STAY WHILE THE FLAGS GO. That is the fixture's whole
       claim: the flag pipeline is down, not the shift. An escalation is raised
       by a person and does not arrive through the classifier, so a degraded
       pipeline has no reason to empty the escalation region — and Phase 2
       measured exactly that contradiction on Today, where the strip showed two
       escalations above a card reading "Nothing open". */
    escalations: escalationsFromTasks(ts, now),
    classifier: "degraded",
  }),

  "shift-start-backlog": (now, ts) => {
    /* OVERNIGHT: mentors reviewed off-hours messages at shift start, so the
       flags all landed within one window 8–12h ago rather than spread. */
    const flags = flagPool(ts, now)
      .slice(0, 14)
      .map((f, i) => aged(f, now - (8 * HOUR + i * 17 * MINUTE)));
    return {
      ...base(now, eventsFromFlags(flags, now), 0.1),
      escalations: escalationsFromTasks(ts, now),
    };
  },

  "normal-day": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 12), now), 0.45),
    escalations: escalationsFromTasks(ts, now),
  }),

  /** ═══ A SURGE THAT WAS SMALLER THAN THE DEFAULT (Phase 10) ═══
   *
   *  MEASURED at 64 events, against 123 on the unscoped `heavy-caseload`
   *  default — so the fixture named `surge` was the second-quietest flag queue in
   *  the product, and the row-recycling path it exists to exercise was never
   *  reached by it. The production audit asked for 400+ and to verify the
   *  virtualizer; both are here.
   *
   *  THE POOL IS 123, SO IT IS REPEATED. Not a synthetic generator: each copy is
   *  a real seeded flag with a fresh id, a fresh `objectId` and a re-stamped age,
   *  so every field a row or a pane reads is one the product produces. What is
   *  fabricated is the VOLUME, which is the fixture's entire subject.
   *
   *  FRESH `objectId` PER COPY, and that is the part worth getting right: the
   *  coalescing key is `(taskType, objectId)`, so repeating the pool without
   *  re-keying would collapse 400 flags into 123 groups of four and the queue
   *  would render a third of the rows the fixture claims. Measured after the
   *  change rather than assumed.
   *
   *  AGES SPREAD ACROSS A WEEK so the comparator's fifth key has real work to
   *  do — a surge where every flag is the same age sorts by id, which is not a
   *  sort anybody is testing. */
  "surge": (now, ts) => {
    const pool = flagPool("heavy-caseload", now);
    const source = pool.length > 0 ? pool : flagPool(ts, now);
    const TARGET = 420;
    const flags: TaskItem[] = [];
    for (let i = 0; flags.length < TARGET; i += 1) {
      const src = source[i % source.length];
      const copy = Math.floor(i / source.length);
      flags.push({
        ...aged(src, now - (30 * MINUTE + (i % 240) * 40 * MINUTE)),
        id: copy === 0 ? src.id : `${src.id}-surge${copy}`,
        objectId: copy === 0 ? src.objectId : `${src.objectId}-surge${copy}`,
      });
    }
    return {
      ...base(now, eventsFromFlags(flags, now), 0.08),
      escalations: escalationsFromTasks(ts, now),
    };
  },

  /* FLAGS CLEARED, CONVERSATIONS UNREVIEWED — the state coverage exists to make
     visible, and the one an event-only queue reports as "done". */
  "coverage-debt": (now, ts) => ({
    ...base(now, [], 0.12),
    escalations: escalationsFromTasks(ts, now),
  }),

  // ── Escalation lifecycle ──────────────────────────────────────────────────
  "escalation-unacked": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 6), now), 0.4),
    escalations: [escalation(now, { triggeredMinsAgo: 2 })],
  }),

  "escalation-breach": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 6), now), 0.4),
    escalations: [escalation(now, { triggeredMinsAgo: 11 })],
  }),

  "escalation-911": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 4), now), 0.4),
    escalations: [escalation(now, { triggeredMinsAgo: 6, is911: true })],
  }),

  "escalation-concurrent": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 4), now), 0.3),
    escalations: [
      escalation(now, { triggeredMinsAgo: 9, is911: true }),
      escalation(now, { triggeredMinsAgo: 3, acknowledgedAt: now - MINUTE }),
    ],
  }),

  /* RESOLVED, AND STILL ON SCREEN. All four close-out items open — the state the
     old surface dropped the moment the crisis ended. */
  "escalation-closeout": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 5), now), 0.4),
    escalations: [
      escalation(now, {
        triggeredMinsAgo: 200,
        acknowledgedAt: now - 195 * MINUTE,
        resolvedAt: now - 90 * MINUTE,
      }),
    ],
  }),

  "escalation-note-overdue": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 5), now), 0.4),
    escalations: [
      escalation(now, {
        triggeredMinsAgo: 2000,
        acknowledgedAt: now - 1995 * MINUTE,
        resolvedAt: now - (ESCALATION_NOTE_SLA + 6 * HOUR) / MINUTE * MINUTE,
        closeOutDone: ["debrief"] as CloseOutId[],
      }),
    ],
  }),

  /** ═══ THE TERMINAL STATE, WHICH NOTHING COULD REACH BEFORE (arch-G, G6) ═══
   *  `closedDocumented` needs a closed record whose note is done AND nothing
   *  owed outstanding, and no fixture had one: every closed escalation shipped
   *  with paperwork open, so the surface's finished state was unreachable and
   *  therefore unverifiable.
   *  `caregiverInvolved: true` waives the teen follow-up — which is the point of
   *  the conditional item — leaving the note, the debrief and the safety plan,
   *  all three recorded here.
   *  IT IS SETTLED, SO IT LEAVES THE REGION. That is deliberate and it is what
   *  makes this fixture worth having: the record is reachable only by its own
   *  link, which is exactly the path G6 built. Open it with
   *  `/app/escalation/esc-documented`. */
  "escalation-documented": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 5), now), 0.4),
    escalations: [
      escalation(now, {
        id: "esc-documented",
        triggeredMinsAgo: 1500,
        acknowledgedAt: now - 1497 * MINUTE,
        resolvedAt: now - 1400 * MINUTE,
        is911: true,
        caregiverInvolved: true,
        closeOutDone: ["note", "debrief", "safetyPlan"] as CloseOutId[],
      }),
      /* A SECOND, UNFINISHED ONE so the scenario is not only its edge case: a
         reader lands on a page with work on it and reaches the documented
         record by link, which is the real journey. */
      escalation(now, {
        triggeredMinsAgo: 400,
        acknowledgedAt: now - 396 * MINUTE,
        resolvedAt: now - 300 * MINUTE,
      }),
    ],
  }),

  /* THE CONDITIONAL TEEN FOLLOW-UP, ACTUALLY CONDITIONAL. `caregiverInvolved`
     is a Monitoring-side field (see `escalation.ts`) — this is the fixture that
     exercises it being known and false. */
  "escalation-no-caregiver": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 5), now), 0.4),
    escalations: [
      escalation(now, {
        triggeredMinsAgo: 300,
        acknowledgedAt: now - 297 * MINUTE,
        resolvedAt: now - 120 * MINUTE,
        caregiverInvolved: false,
      }),
    ],
  }),

  "escalation-afterhours": (now, ts) => {
    const late = atHour(now, 23);
    return {
      ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 3), now), 0.5),
      escalations: [escalation(late, { triggeredMinsAgo: 4 })],
      clockOverride: late,
    };
  },

  // ── Compliance paths ──────────────────────────────────────────────────────
  /* ═══ THESE TWO ARE SPECIFIED ONLY AS FIXTURE LINES ═══
     No phase body describes their flows, so what ships is the compliance
     POSTURE each line names — occlusion with a gated, logged reveal and no
     download affordance; a verification-and-notification checklist — and the
     report says so. */
  "explicit-media": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 3), now), 0.4),
    compliance: "explicit-media",
  }),

  "suspected-death": (now, ts) => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 2), now), 0.4),
    compliance: "suspected-death",
  }),

  // ── Risk flags ────────────────────────────────────────────────────────────
  /* PRECEDENCE AND DEDUPE: the flag's teen already has an open escalation, so
     comparator step 1 puts it first and the row says why rather than appearing
     twice. */
  "flag-in-escalation": (now, ts) => {
    const flags = flagPool(ts, now).slice(0, 8);
    const target = flags[3];
    const esc = escalation(now, {
      triggeredMinsAgo: 7,
      teenId: target.teenId,
      teenName: target.teenDisplayName,
      mentorId: target.mentorId,
      mentorName: target.mentorName,
    });
    return {
      ...base(now, eventsFromFlags(flags, now, new Set([target.teenId])), 0.4),
      escalations: [esc],
    };
  },

  "flag-repeat-pattern": (now, ts) => {
    const pool = flagPool(ts, now);
    const one = pool[0];
    /* THREE FLAGS, ONE CONVERSATION. Same teen, same objectId, three ages — and
       `conversationFlagCount` says three, which is what step 3 reads. */
    const three = [0, 1, 2].map((i) => ({
      ...aged(one, now - (2 + i * 3) * HOUR),
      id: `${one.id}-pattern-${i}`,
      payload: { ...(one.payload as RiskFlagPayload), conversationFlagCount: 3 },
    }));
    return base(now, eventsFromFlags([...three, ...pool.slice(1, 7)], now), 0.4);
  },

  "flag-no-mentor-reply": (now, ts) => {
    const flags = flagPool(ts, now).slice(0, 7);
    const events = eventsFromFlags(flags, now);
    /* FORCED, and it is a fixture override rather than a derivation: whether a
       mentor replied is read off the conversation fixture, and the generator does
       not take "leave this one unanswered" as an input.
       ═══ AND IT IS FORCED ON A SINGLE-FLAG CONVERSATION ═══
       The first version marked events[0] whatever it was, and the seed's first
       flag sits on a conversation with two — so comparator step 3 (the pattern)
       decided the order and the row this fixture exists to show was third. The
       state the key names is "flagged message unanswered", not "unanswered AND a
       pattern", so the stamp goes on a row where step 3 is neutral. */
    /* THE PATTERN AXIS IS NEUTRALISED ACROSS THE WHOLE FIXTURE. Every flag in
       the seed's pool sits on a conversation with two, so comparator step 3 —
       which correctly outranks step 4 — decided the order and the unanswered row
       this key exists to show sat third. A fixture for one step has to hold the
       steps above it equal, or it is a fixture for a different step. */
    return base(
      now,
      events.map((e, j) => ({ ...e, patternCount: 1, mentorReplied: j !== 0 })),
      0.4
    );
  },

  "flag-false-positive-cluster": (now, ts) => {
    const flags = flagPool(ts, now).slice(0, 9);
    const events = eventsFromFlags(flags, now).map((e) => ({
      ...e,
      /* ONE CATEGORY FIRING REPEATEDLY — the shape a classifier regression takes,
         and the reason axis 2 exists. NEEDS-COPY-NICOLE. */
      category: "Low mood",
    }));
    return base(now, events, 0.4);
  },

  // ── Mentor practice ───────────────────────────────────────────────────────
  "mentor-offline": (now, ts) => {
    const facts = [shiftFacts(now, { offlineSince: now - 40 * MINUTE, waitingWhenOffline: 3 })];
    return base(now, [...practiceEventsFor(facts, now), ...eventsFromFlags(flagPool(ts, now).slice(0, 4), now)], 0.4);
  },

  "mentor-outreach-missed": (now, ts) => {
    const facts = [shiftFacts(now, { outreachSentAt: null, teensNeedingOutreach: 4 })];
    return base(now, [...practiceEventsFor(facts, now), ...eventsFromFlags(flagPool(ts, now).slice(0, 3), now)], 0.4);
  },

  "mentor-response-slow": (now, ts) => {
    const teen = ROSTER[4];
    const facts = [
      shiftFacts(now, {
        longestWait: { teenId: teen.id, teenName: teen.name, since: now - (MENTOR_TEEN_RESPONSE_SLA + 70 * MINUTE) },
      }),
    ];
    return base(now, [...practiceEventsFor(facts, now), ...eventsFromFlags(flagPool(ts, now).slice(0, 3), now)], 0.4);
  },

  "mentor-note-overdue": (now, ts) => {
    const teen = ROSTER[9];
    const facts = [
      shiftFacts(now, {
        notesDue: [{ teenId: teen.id, teenName: teen.name, callEndedAt: now - (MENTOR_NOTE_SLA + 5 * HOUR) }],
      }),
    ];
    return base(now, [...practiceEventsFor(facts, now), ...eventsFromFlags(flagPool(ts, now).slice(0, 3), now)], 0.4);
  },

  /* THE STUB, VISIBLE. The event exists so the queue and the pane are exercised;
     it states on its face that no automated measure produced it. */
  "mentor-conduct-flag": (now, ts) => base(
    now,
    [
      stubbedConductEvent({ mentorId: MENTOR_POOL[2].id, mentorName: MENTOR_POOL[2].name }, now - 3 * HOUR),
      ...eventsFromFlags(flagPool(ts, now).slice(0, 3), now),
    ],
    0.4
  ),

  "mentor-perf-escalation": (now, ts) => base(
    now,
    [
      {
        ...stubbedConductEvent({ mentorId: MENTOR_POOL[1].id, mentorName: MENTOR_POOL[1].name }, now - 5 * HOUR),
        id: "mp-lead-raised",
        /* NEEDS-COPY-NICOLE. Raised by a person, and it says who rather than
           implying a system produced it. */
        practice: { measure: "raised by a lead mentor", againstLabel: "human review", stubbed: true },
      },
      ...eventsFromFlags(flagPool(ts, now).slice(0, 4), now),
    ],
    0.4
  ),

  /* ON BREAK OR GONE, AND THE COVERAGE COST IS THE POINT — the events are the
     mentor's, the debt is the teens'. */
  "mentor-post-crisis": (now, ts) => {
    const facts = [shiftFacts(now, { offlineSince: now - 75 * MINUTE, waitingWhenOffline: 6 })];
    return {
      ...base(now, [...practiceEventsFor(facts, now), ...eventsFromFlags(flagPool(ts, now).slice(0, 5), now)], 0.15),
      escalations: [
        escalation(now, {
          triggeredMinsAgo: 260,
          acknowledgedAt: now - 258 * MINUTE,
          resolvedAt: now - 100 * MINUTE,
        }),
      ],
    };
  },
};

// ── Live layer ──────────────────────────────────────────────────────────────
// EVERY ONE OF THESE IS INERT UNTIL `LIVE_LAYER_ENABLED` IS TRUE. They are
// wired anyway: the states are the part that has to be right, and a fixture that
// cannot be looked at is a fixture nobody checks.

Object.assign(BUILDERS, {
  "live-offhours": (now: number, ts: string): MonitoringData => {
    const late = atHour(now, 23);
    return { ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 4), now), 0.6), clockOverride: late };
  },

  "live-transport-lost": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 6), now), 0.4),
    transport: "lost",
  }),

  /* ONLINE, GENUINELY QUIET — distinct from dormant and from degraded, which is
     the distinction the three states exist to make. */
  "live-quiet-shift": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 5), now), 0.5),
    clockOverride: atHour(now, 17),
  }),

  "live-busy-shift": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 10), now), 0.3),
    clockOverride: atHour(now, 18),
    /* NINE ITEMS AGAINST A CAP OF FIVE — the fixture exists to show the overflow
       count, not to show nine lines. */
    live: [
      liveItem("awaitingReply", "Ava M. waiting 14m — Brandon Forant", now - 14 * MINUTE, "tk-ava"),
      liveItem("wentActive", "Kai N. active after 3 days quiet", now - 2 * MINUTE, "tk-kai"),
      liveItem("awaitingReply", "Mei W. waiting 22m — Maria Lopez", now - 22 * MINUTE, "tk-mei"),
      liveItem("outreachWindow", "Outreach: 6 of 9 sent, 24m to cutoff", now - MINUTE, null),
      liveItem("flagArrived", "New flag — Priya R.", now - 40_000, "tk-priya"),
      liveItem("awaitingReply", "Noah B. waiting 9m — Omar Haddad", now - 9 * MINUTE, "tk-noah"),
      liveItem("wentActive", "Zara H. active after 2 days quiet", now - 5 * MINUTE, "tk-zara"),
      liveItem("mentorOffline", "Tasha Reyes offline — 2 waiting", now - 6 * MINUTE, null),
      liveItem("awaitingReply", "Eli F. waiting 31m — Brandy Forrestor", now - 31 * MINUTE, "tk-eli"),
    ],
  }),

  "live-response-clock": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 4), now), 0.5),
    clockOverride: atHour(now, 18),
    live: [liveItem("awaitingReply", "Ines M. waiting 4m — Maria Lopez", now - 4 * MINUTE, "tk-ines")],
  }),

  "live-mentor-drop": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 4), now), 0.5),
    clockOverride: atHour(now, 19),
    live: [liveItem("mentorOffline", "Omar Haddad offline mid-shift — 4 waiting", now - 3 * MINUTE, null)],
  }),

  "live-outreach-window": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 3), now), 0.5),
    clockOverride: atHour(now, 16),
    live: [liveItem("outreachWindow", "Outreach: 4 of 11 sent, 38m to cutoff", now - MINUTE, null)],
  }),

  /* MUST NOT STEAL THE PANE (locked decision 15). The fixture supplies the
     arrival; the band's own code is what refuses to move the selection. */
  "live-flag-arrival": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 6), now), 0.4),
    clockOverride: atHour(now, 18),
    live: [liveItem("flagArrived", "New flag — Devon A.", now - 20_000, "tk-devon")],
  }),

  "live-escalation-arrival": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 5), now), 0.4),
    clockOverride: atHour(now, 18),
    escalations: [escalation(now, { triggeredMinsAgo: 1 })],
    live: [liveItem("escalationTriggered", "Escalation — Santiago R.", now - 30_000, "tk-santiago")],
  }),

  "live-paused": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 5), now), 0.4),
    clockOverride: atHour(now, 18),
    paused: true,
    live: [liveItem("awaitingReply", "Hana T. waiting 7m — Daniel Okafor", now - 7 * MINUTE, "tk-hana")],
  }),

  // ── System and edge ───────────────────────────────────────────────────────
  /* THE RECORD CHANGES UNDER THE READER. The teen whose event is first in the
     queue is deactivated — so the pane has to say so rather than continue
     offering a disposition on a record that no longer exists. */
  "teen-deactivated-midreview": (now: number, ts: string): MonitoringData => {
    const events = eventsFromFlags(flagPool(ts, now).slice(0, 6), now);
    return { ...base(now, events, 0.4), teenDeactivated: events[0]?.teenId ?? null };
  },

  "loading-partial": (now: number, ts: string): MonitoringData => ({
    ...base(now, eventsFromFlags(flagPool(ts, now).slice(0, 6), now), 0.4),
    load: "partial",
  }),
});

/** ═══ THE ENTRY POINT ═══
 *  `id` null or unknown → derive from the active task scenario, so the five
 *  existing scenarios and Home's deep links keep working. */
export function monitoringData(
  id: string | null,
  tasksScenarioId: string,
  now: number
): MonitoringData {
  const build = id ? BUILDERS[id] : undefined;
  /* SEQUENCES RESET PER BUILD so ids are stable for a given (id, now) rather
     than depending on how many times the module has been called this session. */
  escSeq = 0;
  liveSeq = 0;
  const data = build ? build(now, tasksScenarioId) : fromTasksScenario(tasksScenarioId, now);
  /* ═══ A PINNED HOUR REBASES THE PERISHABLE ITEMS ═══
     The live fixtures build their items relative to the real clock ("waiting
     14m") and then pin the page's clock to an hour inside the shift so the band
     is not dormant. Measured, that made a 14-minute wait render as "2h ago": the
     band's ages were computed against the override while the items were stamped
     against `now`. The band is the one region whose whole contents are
     perishable, so an age it cannot state correctly is the one thing it must not
     get wrong. Rebasing here rather than in nine builders keeps the fixtures
     readable and the arithmetic in one place. */
  if (data.clockOverride != null) {
    const delta = data.clockOverride - now;
    return { ...data, live: data.live.map((i) => ({ ...i, at: i.at + delta })) };
  }
  return data;
}

/** Exported for the ack-clock fixtures' own test: the two escalation fixtures
 *  straddle `ESCALATION_ACK_SLA`, and a test that hardcoded 5 minutes would
 *  stop straddling it the moment the constant moved. */
export const ACK_SLA_FOR_FIXTURES = ESCALATION_ACK_SLA;
/** Same, for the dormant band: the fixture pins 23:00 and the window's end is
 *  the thing that makes 23:00 "outside". */
export const SHIFT_END_FOR_FIXTURES = MENTOR_ONLINE_HOURS.endHour;
