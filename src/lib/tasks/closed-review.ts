// ═══════════════════════════════════════════════════════════════════════════
// A CLOSED CARE REVIEW, AS A RECORD (Closed-tab pack §0.1 / §2.1 / §2.3)
//
// ═══ WHY THIS EXISTS — THE DATA LOSS, MEASURED ═══
//
// Submitting a review persisted `{ id, at }` and nothing else. The form handed
// its commit the assessment, both prose fields and their provenance; the page
// dropped all of it, and the draft that held the same text was cleared on the
// same commit. So a closed review re-rendered as an EMPTY FORM — a supervisor's
// attested clinical text, gone, on a clinical record.
//
// The `{ id, at }` shape was a deliberate choice, and its reasoning was "so it
// never becomes a second copy of clinical data that can drift from the fixture
// it points at". The reasoning had it backwards: the FIXTURE is what drifts
// (every relative date moves daily, every scenario switch rebuilds the ids), and
// a record is the one thing that must not. So this is now the record itself.
//
// ═══ A SNAPSHOT, NOT A POINTER (§2.3) ═══
//
// Everything the supervisor was looking at when they submitted is copied in:
// the task as it stood (`snapshot.item`, payload included — the mentor, the
// metrics, the code on record) and the review the shared module rendered
// (`snapshot.review` — recommendation, rationale, assessment). A closed record
// renders from these and NEVER from the live fixture, so a new assessment, a
// regenerated rationale or a changed mentor cannot rewrite what was attested.

import type { CareUpdateBody, PresentationReview } from "@/lib/record/care-demo";
import type { FieldProvenance } from "@/lib/record/field-provenance";
import { proposalKindFor } from "@/lib/record/proposal-kind";
import { CARE_REVIEW_RESPONSE_MS } from "@/lib/tasks/care-overdue";
import type { BillingPayload, TaskItem } from "@/lib/tasks/types";

/** What the supervisor decided, in four readings (§3.1, answered 2026-10-06). */
export type ClosedOutcome = "changed" | "kept" | "renewed" | "assigned";

export interface ClosedCareReview {
  /** The task id — the same id the Open list used, so a record and the item it
   *  closed are one key. */
  id: string;
  submittedAt: number;
  submittedBy: { name: string; role: string };
  decision: {
    outcome: ClosedOutcome;
    /** The code the supervisor COMMITTED, which may not be the model's. */
    code: string;
    statement: string;
    recommendedCode: string;
    priorCode: string | null;
  };
  body: CareUpdateBody;
  provenance: { clinical: FieldProvenance; diagnostic: FieldProvenance };
  snapshot: {
    /** The task as it stood at submission. `payload` is always `billing`. */
    item: TaskItem;
    /** The review the shared module rendered, verbatim. */
    review: PresentationReview;
  };
}

/** ═══ THE OUTCOME, FROM THREE CODES ═══
 *  `proposalKindFor` already says what was ASKED; this says what was DONE.
 *  A renewal is a proposal to keep the code on record, so keeping it is
 *  `renewed`; a change proposal that ends on the prior code is `kept`. Anything
 *  that ends on a code other than the one on record is `changed` — including a
 *  renewal the supervisor overrode with `Change presentation`. */
export function outcomeFor(
  priorCode: string | null,
  recommendedCode: string,
  committedCode: string
): ClosedOutcome {
  const kind = proposalKindFor(priorCode, recommendedCode);
  if (kind === "assign") return "assigned";
  if (committedCode === priorCode) return kind === "renewal" ? "renewed" : "kept";
  return "changed";
}

/** TODO-COPY, all four. The verb leads; the code follows as a lozenge. */
export const OUTCOME_VERB: Record<ClosedOutcome, string> = {
  changed: "Changed to",
  kept: "Kept",
  renewed: "Renewed",
  assigned: "Assigned",
};

/** One record from one commit. Pure, so the snapshot rule is testable. */
export function buildClosedReview(input: {
  item: TaskItem;
  review: PresentationReview;
  committedCode: string;
  committedStatement: string;
  body: CareUpdateBody;
  provenance: { clinical: FieldProvenance; diagnostic: FieldProvenance };
  submittedAt: number;
  submittedBy: { name: string; role: string };
}): ClosedCareReview {
  const p = input.item.payload as BillingPayload;
  const priorCode = p.current?.code ?? null;
  /* DEEP COPIES. `structuredClone` rather than spreads: the payload and the
     review both nest, and a record holding a reference into a live fixture
     object is a pointer wearing a snapshot's name. */
  const item = structuredClone({ ...input.item, status: "resolved" as const });
  const review = structuredClone(input.review);
  return {
    id: input.item.id,
    submittedAt: input.submittedAt,
    submittedBy: { ...input.submittedBy },
    decision: {
      outcome: outcomeFor(priorCode, p.recommended.code, input.committedCode),
      code: input.committedCode,
      statement: input.committedStatement,
      recommendedCode: p.recommended.code,
      priorCode,
    },
    body: structuredClone(input.body),
    provenance: { ...input.provenance },
    snapshot: { item: { ...item, resolvedAt: input.submittedAt }, review },
  };
}

/** §3.3, answered: lateness persists on the record. The same 48 hours and the
 *  same reception anchor `wasLate` uses, read off the SNAPSHOT so it cannot move. */
export function closedLate(r: ClosedCareReview): boolean {
  return r.submittedAt - r.snapshot.item.openedAt > CARE_REVIEW_RESPONSE_MS;
}

/** ═══ ONE DEFINITION OF "NO LONGER OPEN" (§0.3) ═══
 *  The rail badge read 16 with 9 open: it counted the fixture, and nothing
 *  between the fixture and the count knew a review had been submitted. The
 *  page had the same blind spot across a reload — it knew only the reviews
 *  closed during the current mount.
 *  So the page, the rail and Today all run their items through this: an item
 *  with a closed record is `resolved` as of its submission, and every open
 *  filter downstream (`openTasks`, `sortedOpen`) already excludes that. Three
 *  callers, one rule, no second expression to disagree with. */
export function withClosures(
  items: readonly TaskItem[],
  closed: readonly Pick<ClosedCareReview, "id" | "submittedAt">[]
): TaskItem[] {
  if (closed.length === 0) return items as TaskItem[];
  const at = new Map(closed.map((r) => [r.id, r.submittedAt]));
  return items.map((i) => {
    const t = at.get(i.id);
    return t === undefined ? i : { ...i, status: "resolved" as const, resolvedAt: t };
  });
}

// ── Dates ──────────────────────────────────────────────────────────────────

/** ═══ THE REVIEW DATE (Closed-tab follow-up, 2026-10-06) ═══
 *  `Oct 6 · 1:53 PM`, with the year only when it is not the current one
 *  (`Sep 29, 2025 · 4:46 PM`). ABSOLUTE IN EVERY CASE — no `Today`, no
 *  `Yesterday`, no weekday: this is a record, and a relative word on a record
 *  is a fact that changes meaning overnight.
 *  IT REPLACES THE DATE GROUPS. They were an addition the pack itself
 *  withdrew; with no header above a row carrying the day, the row has to be
 *  complete on its own, so there is one format and no `grouped` switch. */
export function reviewDateLabel(at: number, now: number): string {
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

/** The footer's stamp: `Oct 6, 2026, 11:22 AM`. Never relative — and always
 *  with the year, because the footer is the record's signature line. */
export function absoluteStamp(at: number): string {
  return new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
