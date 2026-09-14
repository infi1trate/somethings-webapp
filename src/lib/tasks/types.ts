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
export type TaskDomain = "escalation" | "riskFlag" | "billing" | "routineFlag";

/** THE DOMAIN ORDER. Fixed, and the only place it is written down.
 *  Escalations · Risk flags · Billing · Routine review.
 *
 *  IT WAS "THE TAB ORDER" AND THERE ARE NO TABS. arch-A removed the tab row from
 *  Tasks; arch-B's Monitoring has no tab row by design. The order still governs
 *  every fixed-order render (the count table, the partial-failure list), so the
 *  constant stays and only the sentence describing it moves. */
export const TASK_DOMAINS: TaskDomain[] = [
  "escalation",
  "riskFlag",
  "billing",
  "routineFlag",
];

/** TODO-COPY. Domain labels.
 *
 *  ═══ `routineFlag` WAS `monitoring`, AND THE RENAME WAS NOT COSMETIC (arch-B) ═══
 *
 *  This domain has only ever meant ONE thing: the lowest flag tier. It was called
 *  `monitoring` because the old four-tab Tasks page gave that tier its own tab and
 *  named the tab after the activity. arch-B builds a SURFACE called Monitoring
 *  which holds every flag tier and the escalation lifecycle — so keeping the name
 *  here would have meant a page called Monitoring whose Imminent rows are, in the
 *  data model, not monitoring. One word, two scopes, in the same reader's head.
 *
 *  So the domain is named for what it holds and the surface keeps the word. */
export const DOMAIN_LABEL: Record<TaskDomain, string> = {
  escalation: "Escalations",
  riskFlag: "Risk flags",
  billing: "Billing",
  routineFlag: "Routine review",
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
  routineFlag: "routine review",
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
 *  `routineFlag` maps to Activity's `risk`: a routine-tier flag review IS a risk
 *  flag event in the ledger — the tier is what differs, not the domain. Tasks
 *  split it into its own tab because the lowest tier is a different job; the
 *  ledger does not, because it is the same event. */
export const ACTIVITY_DOMAIN_OF: Record<TaskDomain, string> = {
  escalation: "escalation",
  riskFlag: "risk",
  billing: "billing",
  routineFlag: "risk",
};

/** Task types. A DOMAIN CAN HOLD MULTIPLE TYPES (locked decision 6) — the tab is
 *  a workflow domain, not a task type. */
export type TaskType =
  // ── Escalations
  | "activeEscalation"
  | "escalationDocumentation"
  // ── Risk flags
  | "imminentFlagReview"
  | "clinicalFlagReview"
  // ── Billing
  | "intakeBillingReview"
  | "monthlyReReview"
  // ── Routine review — the lowest flag tier, its own domain.
  | "routineFlagReview";

export const DOMAIN_OF_TYPE: Record<TaskType, TaskDomain> = {
  activeEscalation: "escalation",
  // THE OLD "FOLLOW-UPS & DOCUMENTATION" ZONE IS DISSOLVED (§2.2): documentation
  // lives in Escalations and monthly re-reviews live in Billing. There is no
  // fifth tab and there must not be one.
  escalationDocumentation: "escalation",
  imminentFlagReview: "riskFlag",
  clinicalFlagReview: "riskFlag",
  intakeBillingReview: "billing",
  monthlyReReview: "billing",
  routineFlagReview: "routineFlag",
};

/** TIER RANK — the ladder the priority sort reads (§3), ASC.
 *
 *  1 escalation · 2 imminent · 3 clinical review · 4 billing · 5 routine review ·
 *  6 documentation
 *
 *  NOTE THE TAIL, because it looks like a mistake and is not: escalation
 *  DOCUMENTATION ranks 6 — BELOW routine review — while living in the
 *  highest-tier domain. Writing up a closed escalation is genuinely the least
 *  urgent thing on the page; the domain it belongs to says nothing about the
 *  urgency of finishing its paperwork. Anyone "fixing" this to 1 or 2 has
 *  confused the domain with the task. */
export const TIER_RANK: Record<TaskType, number> = {
  activeEscalation: 1,
  imminentFlagReview: 2,
  clinicalFlagReview: 3,
  intakeBillingReview: 4,
  monthlyReReview: 4,
  routineFlagReview: 5,
  escalationDocumentation: 6,
};

export type TaskStatus = "open" | "inProgress" | "resolved";

// ── Payloads (§5) ───────────────────────────────────────────────────────────

/** A RISK FLAG, AT ANY TIER. One anatomy for all three — the TIER IS SHOWN IN THE
 *  HEADER ONLY (§5), never as a per-row chip inside a tier-filtered list (alarm
 *  budget, §3.3).
 *
 *  ═══ THE TIER IS NOT A COLOUR ANY MORE (arch-B) ═══
 *
 *  It was `"red" | "orange" | "green"`. `bands.ts` had already rejected that
 *  vocabulary at the display layer — "the band names the URGENCY, not the colour
 *  chip… a reader who is colourblind gets the same sentence" — but the DATA kept
 *  the colours, so every consumer translated one to the other and the pane ended
 *  up printing "Red flag" under a header reading "Imminent".
 *
 *  Two of these three values now match `lib/record/risk-taxonomy.ts` exactly
 *  (`imminent`, `clinicalReview`). The third is `routine` where the record says
 *  `generalMonitoring`, because arch-B renamed this tier and the record is out of
 *  scope — logged rather than reconciled. */
export interface RiskFlagPayload {
  kind: "riskFlag";
  tier: "imminent" | "clinicalReview" | "routine";
  /** "Message" — the surface the flag came from. */
  sourceType: string;
  /** PLAIN-LANGUAGE playbook categories. Raw enum values never reach here. */
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
  tierRank: number;
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
   *  a fact about now. */
  slaDeadline: number;
  status: TaskStatus;
  /** Set when resolved — drives the "Closed today" counters. */
  resolvedAt?: number;
  payload: TaskPayload;
}

/** BREACH, DERIVED. The only definition, so a card, a row and a pane header can
 *  never disagree about whether something is late. */
export function isBreached(item: TaskItem, now: number): boolean {
  return now > item.slaDeadline;
}

/** Milliseconds until the SLA runs out; negative once breached. The priority
 *  sort's fourth key. */
export function slaRemaining(item: TaskItem, now: number): number {
  return item.slaDeadline - now;
}

/** An ACTIVE escalation — the sort's first key and the Respond strip's contents.
 *  Documentation-due is NOT active: it is the paperwork after the fact. */
export function isActiveEscalation(item: TaskItem): boolean {
  return item.taskType === "activeEscalation";
}
