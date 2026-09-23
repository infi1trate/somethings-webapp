// TASKS WORKLIST — the data model. Supervisor persona, v1.
//
// IT IS A WORKLIST, NOT AN INBOX (locked decision 1). Sorted by PRIORITY, never by
// arrival time. The word does not appear in this module, in any symbol, or in any
// string it produces — and if you are here to add a "mark all read" or an
// arrival-ordered view, that is the inbox model arriving through the back door.
//
// Note what follows from that: there is no `receivedAt`, no unread flag, and no
// per-viewer read overlay anywhere in this surface. Those belong to the Activity
// ledger, which IS arrival-ordered and IS per-viewer. Two surfaces, two models,
// deliberately not one.
//
// BREACH IS ALWAYS DERIVED, never stored — `now > slaDeadline`. A stored boolean
// would be wrong the moment the clock moved past it and nobody re-ran the writer,
// and a worklist whose breach state is stale is worse than one with none.

/** The four workflow DOMAINS — the tabs. Fixed order, never reordered
 *  (locked decision 7).
 *
 *  ═══ DEVIATION FROM LOCKED DECISION 6 — LOGGED, NOT SILENT ═══
 *  Decision 6 says "Domain names match the Activity page filter domains exactly."
 *  They cannot, because the two sets are not the same set:
 *
 *    Activity (already shipped, lib/activity/events.ts):
 *      escalation · risk · billing · review · lifecycle
 *    Tasks (this spec, §2.1):
 *      escalation · riskFlag · billing · routineFlag
 *
 *  Two names differ (`risk` vs `riskFlag`), Activity has two domains Tasks does
 *  not (`review`, `lifecycle`), and Tasks has one Activity does not
 *  (`routineFlag`). Renaming Activity's would be a change to a shipped surface,
 *  which the strangler rules forbid; renaming these would contradict §2.1's own
 *  field list.
 *
 *  So: these names follow §2.1, and `ACTIVITY_DOMAIN_OF` below is the explicit
 *  mapping used for every Activity deep link. See design-system-gaps.md row 208. */
/** ═══ `routineFlag` IS GONE — IT WAS A TIER WEARING A DOMAIN (Phase 4) ═══
 *
 *  This union held FOUR domains and one of them was not a domain. `routineFlag`
 *  existed because the old four-tab Tasks page gave the lowest severity tier its
 *  own tab; `riskFlag` held the other two tiers. So the same event — a message
 *  the classifier flagged — landed in one of two "workflow domains" according to
 *  a severity this system assigned it and could not compute.
 *
 *  The ledger never believed it: `ACTIVITY_DOMAIN_OF` mapped BOTH to Activity's
 *  single `risk`, with the note "a routine-tier flag review IS a risk flag event
 *  — the tier is what differs, not the domain". That note was the argument for
 *  this change, written two phases before it. */
export type TaskDomain = "escalation" | "riskFlag" | "billing";

/** THE DOMAIN ORDER. Fixed, and the only place it is written down.
 *  Escalations · Risk flags · Billing · Routine review.
 *
 *  IT WAS "THE TAB ORDER" AND THERE ARE NO TABS. arch-A removed the tab row from
 *  Tasks; arch-B's Monitoring has no tab row by design. The order still governs
 *  every fixed-order render (the count table, the partial-failure list), so the
 *  constant stays and only the sentence describing it moves. */
export const TASK_DOMAINS: TaskDomain[] = ["escalation", "riskFlag", "billing"];

/** TODO-COPY. Domain labels.
 *
 *  `Risk flags` IS THE RAIL'S DESTINATION NAME, lowercased for a sentence. One
 *  name per destination reaches the reader — the rule that fixed four page
 *  headings this restructure — and with `routineFlag` gone there is no second
 *  flag label to disagree with it. */
export const DOMAIN_LABEL: Record<TaskDomain, string> = {
  escalation: "Escalations",
  riskFlag: "Risk flags",
  billing: "Billing",
};

/** TODO-COPY. The same labels for a count of one, lowercase.
 *
 *  WHY THIS EXISTS: anywhere a count sits next to a domain name, the tab label
 *  disagrees with it — "1 escalations", "1 risk flags". The tab labels themselves
 *  never change (locked decision 7: tabs never reorder or rename), so the singular
 *  is a second table rather than a transform on the first.
 *
 *  `billing` and `routine review` are mass nouns and read the same either way; they are
 *  listed anyway so the record stays total and nobody has to remember which two
 *  domains are exceptions. */
export const DOMAIN_LABEL_ONE: Record<TaskDomain, string> = {
  escalation: "escalation",
  riskFlag: "risk flag",
  billing: "billing",
};

/** TODO-COPY. A count and its domain, in agreement. */
export function domainCountLabel(domain: TaskDomain, n: number): string {
  return n === 1 ? DOMAIN_LABEL_ONE[domain] : DOMAIN_LABEL[domain].toLowerCase();
}

/** THE MAPPING DECISION 6 ASKED FOR, made explicit because the names could not
 *  be made identical. Every Activity deep link from this surface routes through
 *  here rather than passing a Tasks domain string that Activity would silently
 *  fail to match.
 *
 *  ═══ THE TWO-TO-ONE ROW IS GONE, AND IT IS WHY THIS PHASE HAPPENED ═══
 *  This table used to map BOTH `riskFlag` and `routineFlag` to Activity's single
 *  `risk`, under the note "the tier is what differs, not the domain". The ledger
 *  had the right model the whole time; Tasks had a severity taxonomy promoted to
 *  IA. Now both sides have three domains and the mapping is one-to-one. */
export const ACTIVITY_DOMAIN_OF: Record<TaskDomain, string> = {
  escalation: "escalation",
  riskFlag: "risk",
  billing: "billing",
};

/** Task types. A DOMAIN CAN HOLD MULTIPLE TYPES (locked decision 6) — the tab is
 *  a workflow domain, not a task type. */
/** ═══ ONE FLAG TYPE, WHERE THERE WERE THREE (Phase 4) ═══
 *
 *  `imminentFlagReview` · `clinicalFlagReview` · `routineFlagReview` were the
 *  severity tiers this system assigned to individual flags, promoted to the data
 *  model. They drove four queues, a tier rank, a set of tier bands and two
 *  domains — the whole of what this restructure calls tier-as-IA.
 *
 *  THE CLASSIFIER EMITS CATEGORIES, NOT SEVERITY. That is arch-mon's finding and
 *  nothing has changed it: no upstream signal distinguished these three, so the
 *  seed picked one per fixture and every surface downstream treated the pick as
 *  clinical fact. One flag type is the honest shape.
 *
 *  ═══ THE PLAYBOOK'S TIER SURVIVES, AND IT IS A DIFFERENT THING ═══
 *  `lib/record/risk-taxonomy.ts` groups 21 REAL categories into three tiers. That
 *  is a clinical grouping of published categories, reviewed and owned, and a
 *  flag's tier is now DERIVED from its category through `tierOf` — read-only,
 *  never assigned, never stored on the payload. The difference is the difference
 *  between reading a taxonomy and inventing one. */
export type TaskType =
  // ── Escalations
  | "activeEscalation"
  | "escalationDocumentation"
  // ── Risk flags — one type, whatever the category
  | "riskFlagReview"
  // ── Billing
  | "intakeBillingReview"
  | "monthlyReReview";

/** ═══ A STRING FROM OUTSIDE THE PROGRAM, CHECKED ═══
 *
 *  arch-C's stage links carry a task type in the URL, which means a stale
 *  bookmark, a truncated copy-paste or a hand-edited address can deliver
 *  anything at all. Validated against the real table rather than cast: an
 *  unrecognised value lands on the surface's default view, which is what a link
 *  that no longer means anything should do.
 *
 *  `DOMAIN_OF_TYPE` is the table because it is exhaustive over `TaskType` by its
 *  own type — a new task type cannot be added without appearing here, so this
 *  cannot fall behind. */
export function asTaskType(value: string | null | undefined): TaskType | null {
  return value && value in DOMAIN_OF_TYPE ? (value as TaskType) : null;
}

export const DOMAIN_OF_TYPE: Record<TaskType, TaskDomain> = {
  activeEscalation: "escalation",
  // THE OLD "FOLLOW-UPS & DOCUMENTATION" ZONE IS DISSOLVED (§2.2): documentation
  // lives in Escalations and monthly re-reviews live in Billing. There is no
  // fifth tab and there must not be one.
  escalationDocumentation: "escalation",
  riskFlagReview: "riskFlag",
  intakeBillingReview: "billing",
  monthlyReReview: "billing",
};

/** TIER RANK — the ladder the priority sort reads (§3), ASC.
 *
 *  1 escalation · 2 risk flag · 3 billing · 4 documentation
 *
 *  NOTE THE TAIL, because it looks like a mistake and is not: escalation
 *  DOCUMENTATION ranks 6 — BELOW routine review — while living in the
 *  highest-tier domain. Writing up a closed escalation is genuinely the least
 *  urgent thing on the page; the domain it belongs to says nothing about the
 *  urgency of finishing its paperwork. Anyone "fixing" this to 1 or 2 has
 *  confused the domain with the task. */
/** ═══ RENAMED, BECAUSE IT NEVER RANKED TIERS AGAIN (Phase 4) ═══
 *  It was `TIER_RANK`, and three of its six rows were the flag tiers. With one
 *  flag type it ranks TASK TYPES by urgency and the name says so. The tail's
 *  reasoning is unchanged and still looks like a mistake: escalation
 *  DOCUMENTATION ranks last while living in the escalation domain, because
 *  writing up a closed escalation is genuinely the least urgent thing here.
 *  Anyone "fixing" that has confused the domain with the task. */
export const TYPE_URGENCY_RANK: Record<TaskType, number> = {
  activeEscalation: 1,
  riskFlagReview: 2,
  intakeBillingReview: 3,
  monthlyReReview: 3,
  escalationDocumentation: 4,
};

export type TaskStatus = "open" | "inProgress" | "resolved";

// ── Payloads (§5) ───────────────────────────────────────────────────────────

/** A RISK FLAG. ONE ANATOMY, NO TIER.
 *
 *  ═══ THE `tier` FIELD IS GONE (Phase 4) ═══
 *
 *  It was `"imminent" | "clinicalReview" | "routine"`, and before that
 *  `"red" | "orange" | "green"`. Its history is the whole argument for removing
 *  it rather than renaming it a fourth time: the display layer rejected the
 *  colours, so the data kept them and every consumer translated; arch-mon
 *  rejected the severity, so the data kept it and the field's own comment
 *  admitted "Monitoring no longer reads this… recommend it move to the seed's
 *  own shape when Home has its pass". This is that pass, and the recommendation
 *  was too generous — nothing should write it anywhere, because nothing upstream
 *  produces it.
 *
 *  ═══ A FLAG'S TIER IS STILL ANSWERABLE, AND IT IS A DERIVATION ═══
 *  `tierOf(categoryId)` from `lib/record/risk-taxonomy.ts`, over the 21
 *  published categories. Read-only, computed at the point of use, never stored.
 *  The playbook's grouping is a clinical judgment somebody owns; the old field
 *  was a guess this file made. */
export interface RiskFlagPayload {
  kind: "riskFlag";
  /** "Message" — the surface the flag came from. */
  sourceType: string;
  /** ═══ PLAYBOOK CATEGORY IDS (Phase 4) ═══
   *  `RISK_CATEGORIES[].id` — `"PASSIVE_SUICIDAL_IDEATION"`, not "Low mood".
   *  These were free text ("Self-harm language", "Family conflict"), which is why
   *  `FLAG_CATEGORY_RANK` could not be keyed on them and comparator step 2 was a
   *  no-op with nothing to rank.
   *  RAW IDS NEVER REACH A READER: `riskCategory(id).label` is the rendered
   *  string, and `unknownCategories` is how a value outside the playbook is
   *  surfaced rather than printed. */
  categories: string[];
  /** THE QUOTED EXCERPT. Renders ONLY inside the detail pane (locked decision
   *  12) — no message snippets in list rows, ever. Held on the payload rather
   *  than fetched by the pane so the "list rows must not show it" rule is a
   *  rendering discipline rather than a data accident. */
  flaggedExcerpt: string;
  /** The AI rationale paragraph. Attributed as system-generated in the pane. */
  aiRationale: string;
  /** "Was this flagged correctly?" — OPEN PRODUCT QUESTION (§8.3): model feedback
   *  pipeline, audit log, or both? Written to the payload until answered. Null
   *  until the supervisor answers; the answer does not change the resolve path,
   *  because either answer resolves the item. */
  flaggedCorrectly: boolean | null;
  /** Coalescing display hint — how many flags share this conversation. Derived at
   *  seed time and asserted in the consistency test. */
  conversationFlagCount: number;
}

export interface BillingPayload {
  kind: "billing";
  isReReview: boolean;
  current: { code: string; statement: string } | null;
  survey: { instrument: string; score: number; max: number; takenAt: number };
  mentorStats: { daysInMentorship: number; messagesLast30: number; videoLast30: number };
  aiSummary: string;
  recommended: { code: string; statement: string };
}

export interface EscalationPayload {
  kind: "escalation";
  /** 911 dispatched or not — the only chip this row type carries besides overdue. */
  is911: boolean;
  flaggedBy: string;
  emergencyContact: string;
  /** NOTHING ON THE ESCALATION PANE MUTATES STATE (§5). The pane is read-only and
   *  its single footer action routes out to the escalation flow. */
  escalationId: string;
}

export interface DocumentationPayload {
  kind: "documentation";
  escalationId: string;
  /** When the escalation closed — the 24h documentation clock starts here, not at
   *  the escalation's open time. */
  closedAt: number;
  /** ═══ WHEN THE ESCALATION WAS RAISED (arch-G, G6) ═══
   *
   *  TODO-DATA. Added because the record's timeline needs the escalation's
   *  WINDOW, and this payload carried only its close. MEASURED before the field
   *  existed: a documentation pane's timeline held three entries and no
   *  messages, and it stamped "Escalation opened" and "Acknowledged by the
   *  supervisor" at the CLOSE instant — the window was `[closedAt, closedAt]`,
   *  a single point, so every message and every flag fell outside it and the two
   *  system entries asserted a moment that was 20 hours wrong.
   *
   *  OPTIONAL, AND ABSENCE IS HANDLED RATHER THAN DEFAULTED. A task whose data
   *  does not carry the trigger instant cannot state when the escalation opened,
   *  so the timeline says so instead of borrowing the close time. Defaulting was
   *  the bug. */
  triggeredAt?: number;
}

export type TaskPayload =
  | RiskFlagPayload
  | BillingPayload
  | EscalationPayload
  | DocumentationPayload;

// ── The item ────────────────────────────────────────────────────────────────

export interface TaskItem {
  id: string;
  domain: TaskDomain;
  taskType: TaskType;
  /** ═══ RENAMED FROM `tierRank` (Phase 4) ═══
   *  It was never a tier rank for three of its values and stopped being one for
   *  any of them when the flag types collapsed. `TYPE_URGENCY_RANK`. */
  urgencyRank: number;
  teenId: string;
  /** FIRST NAME + LAST INITIAL, MAXIMUM (locked decision 11). "Riley T." — never
   *  a surname. Stored pre-formatted so no renderer has to remember the rule and
   *  no full name exists on this surface to leak. */
  teenDisplayName: string;
  mentorId: string;
  mentorName: string;
  /** THE COALESCING KEY, with taskType: flags group by (taskType, objectId).
   *  Conversation id for flags, survey id for billing. Matches the Activity
   *  spec's coalescing key so one conversation's flags group the same way on both
   *  surfaces. */
  objectId: string;
  openedAt: number;
  /** COMPUTED AT CREATION from the taskType's SLA (see sla.ts). Stored because it
   *  is a fact about when the clock started; BREACH is not stored, because that is
   *  a fact about now.
   *
   *  ═══ NULL FOR A RISK FLAG (Phase 4) ═══
   *  Nothing published states a review deadline for a flag. It used to carry one
   *  anyway — 24h / 48h / 7d by tier — and the field's presence is what let five
   *  surfaces render a breach off a number this codebase invented. `null` means
   *  the question has no answer yet, not that the answer is far away, and
   *  `isBreached` returns false rather than guessing. */
  slaDeadline: number | null;
  status: TaskStatus;
  /** Set when resolved — drives the "Closed today" counters. */
  resolvedAt?: number;
  payload: TaskPayload;
}

/** BREACH, DERIVED. The only definition, so a card, a row and a pane header can
 *  never disagree about whether something is late. */
export function isBreached(item: TaskItem, now: number): boolean {
  /* NO DEADLINE, NO BREACH. `now > null` coerces to `now > 0` — true for every
     item ever — so the absence has to be checked before the comparison rather
     than after it. That coercion is exactly how a null SLA would have silently
     marked every flag breached. */
  if (item.slaDeadline == null) return false;
  return now > item.slaDeadline;
}

/** Milliseconds until the SLA runs out; negative once breached. The priority
 *  sort's fourth key.
 *
 *  ═══ `Infinity` FOR AN ITEM WITH NO DEADLINE (Phase 4) ═══
 *  Not 0, and not null. This is a comparator key: an item with no deadline can
 *  never be more urgent by deadline than one that has a real one, so it sorts
 *  LAST among its peers and the step falls through to the key below it. Zero
 *  would have put every flag at the head of the queue as though it breached this
 *  instant — which is what `null - now` would also have produced (`NaN`, and a
 *  NaN comparator is a silently unstable sort). */
export function slaRemaining(item: TaskItem, now: number): number {
  if (item.slaDeadline == null) return Infinity;
  return item.slaDeadline - now;
}

/** An ACTIVE escalation — the sort's first key and the Respond strip's contents.
 *  Documentation-due is NOT active: it is the paperwork after the fact. */
export function isActiveEscalation(item: TaskItem): boolean {
  return item.taskType === "activeEscalation";
}
