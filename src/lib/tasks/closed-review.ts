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
import type { TierBand } from "@/lib/tasks/bands";
import type { ListEntry } from "@/lib/tasks/list";

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

const startOfDay = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Whole calendar days between two instants, by local date — not by
 *  `(now - at) / 24h`, which miscounts across midnight and across DST. */
export function calendarDaysAgo(at: number, now: number): number {
  const a = new Date(startOfDay(at));
  const b = new Date(startOfDay(now));
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000
  );
}

/** ═══ THE DATE GROUPS (§1) ═══
 *  `Today` · `Yesterday` · a weekday for 2–6 days ago · then a date.
 *  "THIS WEEK" IS THE LAST SEVEN DAYS, not the calendar week: on a Tuesday the
 *  calendar week holds two days, and a weekday name older than six days would
 *  name two different dates. Within six days a weekday is never ambiguous. */
export function closedDayGroup(at: number, now: number): { key: string; label: string } {
  const days = calendarDaysAgo(at, now);
  const key = String(startOfDay(at));
  /* TODO-COPY, the two words. */
  if (days <= 0) return { key, label: "Today" };
  if (days === 1) return { key, label: "Yesterday" };
  const d = new Date(at);
  if (days <= 6) return { key, label: d.toLocaleDateString("en-US", { weekday: "long" }) };
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return {
    key,
    label: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    }),
  };
}

const time = (at: number) =>
  new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** ═══ THE CLOSED COLUMN (§3) ═══
 *  `grouped`: the date header already says the day, so the row says the time.
 *  Ungrouped (a column sort is active): today → time, the last six days →
 *  weekday and time, older → the date. Absolute throughout — this is a record. */
export function closedLabel(at: number, now: number, grouped: boolean): string {
  if (grouped) return time(at);
  const days = calendarDaysAgo(at, now);
  if (days <= 0) return time(at);
  const d = new Date(at);
  if (days <= 6) return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time(at)}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** The footer's stamp: `Oct 6, 2026, 11:22 AM`. Never relative. */
export function absoluteStamp(at: number): string {
  return new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ═══ THE DATE BANDS (§1) ═══
 *  A partition of the already-ordered list, by the day each review closed —
 *  the same `TierBand` the virtualized list renders every other grouping
 *  through, so the headers, the sticky behaviour and the keyboard order come
 *  with it. Bands appear in first-appearance order, which on the default
 *  most-recent-first list is Today → Yesterday → … → oldest.
 *  An entry with no record (a wiring mistake, not a state) lands in a band of
 *  its own rather than being dropped — a closed review must never vanish. */
export function closedDayBands(
  entries: readonly ListEntry[],
  byId: ReadonlyMap<string, ClosedCareReview> | undefined,
  now: number
): TierBand[] {
  const bands = new Map<string, TierBand>();
  for (const e of entries) {
    if (e.kind !== "item") continue;
    const r = byId?.get(e.item.id);
    const g = r ? closedDayGroup(r.submittedAt, now) : { key: "unknown", label: "Closed" };
    let band = bands.get(g.key);
    if (!band) {
      band = { id: `closed-${g.key}`, label: g.label, entries: [], taskCount: 0 };
      bands.set(g.key, band);
    }
    band.entries.push(e);
    band.taskCount++;
  }
  return [...bands.values()];
}
