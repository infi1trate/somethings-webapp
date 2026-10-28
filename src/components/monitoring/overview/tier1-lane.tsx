"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TIER 1 QUEUE (Monitoring v4, §2) — the same in list and card view
//
// ═══ SUPERSEDES the live lane (proto/monitoring-merge → v3) ═══ Its rows were
// a run-on of mixed elements — status text, chips, flags, a dashed
// "Requested" tag — with no column discipline, and its "0:00 left" was a
// failure shown as a countdown. The section is an escalation queue now:
//
//   CONTAINER  ONE soft region for the whole section — `t1-soft` at 40%,
//              20px radius, 12px in, no border — so the alarm lives in one
//              place, not six. Rows inside: white (`surface-raised`), 14px,
//              a 1px `t1` contour at 50%, 8px apart, `--el-soft`.
//   ROW, 64    Teen · Stage · Signals · Response · Holder · Action, under
//              column headers of its own (12/16 tertiary) aligned to the
//              cells — the table's global headers do not describe these.
//   SORT       by response state: overdue (longest first), awaiting (least
//              time first), confirmed (oldest first) — `compareT1`.
//
// Tier 1 is NEVER cards: card view renders this same queue (cards are for
// Tiers 2–3). The empty state is the dashed lane, "Nothing in crisis".

import { Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { monitoringEntryHref } from "@/lib/monitoring/entry-href";
import type { Tier } from "@/lib/monitoring/tiers";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { markJoined, useJoined, useNowTick } from "@/lib/monitoring/t1-live";
import {
  T1_STEPS,
  T1_STEP_LABEL,
  responseText,
  t1Rows,
  type T1Action,
  type T1Holder,
  type T1Response,
  type T1Row,
  type T1Stage,
} from "@/lib/monitoring/t1-queue";
import { TierAvatar, TierGroupHeader, TierTag } from "@/components/monitoring/overview/tier-bits";
import { cn } from "@/lib/utils";

const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The six columns, shared by the header row and every row, so the cells
 *  align. Below the queue's width the container scrolls sideways. */
const COLS = "grid grid-cols-[minmax(190px,1.6fr)_minmax(200px,1.5fr)_minmax(84px,0.6fr)_minmax(150px,1.1fr)_minmax(96px,0.7fr)_112px] items-center gap-x-4";
/** TODO-COPY. */
const HEADERS = ["Teen", "Stage", "Signals", "Response", "Holder", ""] as const;

/** ═══ THE STAGE STEPPER ═══ Four 8px dots on a 1px line. Done: filled
 *  `text-primary`. Current: `t1`, and LARGER (10px) — so the state is never
 *  colour alone — with its label under the row. Future: an outlined
 *  `border-strong` ring. Spoken as one line ("Step 3 of 4, Confirmed:
 *  Awaiting confirmation"). */
function Stepper({ stage }: { stage: T1Stage }) {
  const at = T1_STEPS.indexOf(stage.step);
  return (
    <div data-t1-stage={stage.step} className="min-w-0">
      <div aria-hidden className="flex items-center">
        {T1_STEPS.map((s, i) => (
          <span key={s} className="flex items-center">
            {i > 0 && <span className={cn("h-px w-5", i <= at ? "bg-[var(--text-primary)]" : "bg-[var(--border-strong)]")} />}
            <span
              data-step={s}
              data-step-state={i < at ? "done" : i === at ? "current" : "future"}
              title={T1_STEP_LABEL[s]}
              className={cn(
                "shrink-0 rounded-full",
                i < at && "size-2 bg-[var(--text-primary)]",
                i === at && "size-2.5 bg-[var(--t1)]",
                i > at && "size-2 border border-[color:var(--border-strong)] bg-[var(--surface-raised)]"
              )}
            />
          </span>
        ))}
      </div>
      <p data-t1-stage-label className="mt-1 truncate text-[13px] leading-[16px] text-[var(--text-secondary)]">
        <span className="sr-only">
          Step {at + 1} of {T1_STEPS.length}, {T1_STEP_LABEL[stage.step]}:{" "}
        </span>
        {stage.label}
      </p>
    </div>
  );
}

/** ═══ THE RESPONSE, AS A STATE ═══ "0:42 to confirm" (tabular, secondary);
 *  past the window "Overdue 14m" in `t1-ink` with a small dot — the dot and
 *  the word, never the colour alone; confirmed, the quiet tertiary line. */
function Response({ r }: { r: T1Response }) {
  return (
    <p data-t1-response={r.kind} className={cn("flex min-w-0 items-center gap-1.5 text-[13px] leading-[16px] tabular-nums", r.kind === "overdue" ? "font-display text-[var(--t1-text)]" : r.kind === "window" ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]")}>
      {r.kind === "overdue" && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--t1-ink)]" />}
      <span className="truncate">{responseText(r)}</span>
    </p>
  );
}

/** Who has it: "You", another supervisor's name in a soft chip, or "—". */
function Holder({ h }: { h: T1Holder }) {
  if (h.kind === "you")
    return (
      <span data-t1-holder="you" className="text-[13px] leading-[16px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        You
      </span>
    );
  if (h.kind === "other")
    return (
      <span data-t1-holder="other" title={h.name} className="inline-flex h-6 max-w-full min-w-0 items-center truncate rounded-full bg-[var(--surface-sunken)] px-2.5 text-[13px] text-[var(--text-secondary)]">
        {h.name}
      </span>
    );
  return (
    <span data-t1-holder="none" className="text-[13px] text-[var(--text-muted)]">
      <span aria-hidden>—</span>
      <span className="sr-only">Nobody yet</span>
    </span>
  );
}

/** ═══ ONE ACTION ═══ A 36px pill, right-aligned. JOIN is the one red
 *  fill on the page besides the container: `t1` under `--text-inverse` —
 *  white on #d2372a, 4.86:1. In dark `--text-inverse` turns near-black and
 *  `t1-ink` equals `t1`, so it reads 6.3:1 (measured). Observe and Resume
 *  are outlined. No timer in the button: the Response cell says it. */
const ACTION_LABEL: Record<T1Action, string> = { join: "Join", observe: "Observe", resume: "Resume" };
function Action({ action, teen, onGo }: { action: T1Action; teen: string; onGo: () => void }) {
  return (
    <button
      type="button"
      data-t1-action={action}
      onClick={onGo}
      /* TODO-COPY */
      aria-label={`${ACTION_LABEL[action]} — ${teen}`}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-[14px] leading-none transition",
        action === "join"
          ? "bg-[var(--t1)] font-display text-[var(--text-inverse)] hover:brightness-110 dark:bg-[var(--t1-ink)]"
          : "border border-[color:var(--border-contour)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      {ACTION_LABEL[action]}
    </button>
  );
}

type QueueRow = T1Row;

function Row({ row }: { row: QueueRow }) {
  const router = useRouter();
  const t = row.teen;
  const link = monitoringEntryHref(t);
  /* Presence on the avatar only (§3): the mentor or a supervisor is in
     the session. */
  const present = !!t.presence || row.holder.kind !== "none";
  const go = () => {
    if (row.action === "join") markJoined(row.id);
    if (link) router.push(link.href);
  };
  return (
    <div
      role="row"
      data-t1-row={t.id}
      data-t1-escalation={row.id}
      /* The hero's In-crisis button lands focus here. */
      tabIndex={-1}
      aria-label={`${t.teen}, Tier 1 — ${row.stage.label}, ${responseText(row.response)}`}
      className={cn(
        COLS,
        "min-h-16 rounded-[14px] border border-[color:color-mix(in_srgb,var(--t1)_50%,transparent)] bg-[var(--surface-raised)] px-4 py-2 shadow-[var(--el-soft)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      )}
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <TierAvatar name={t.teen} live={present} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            {/* "15 semibold": weight is not a channel (Lausanne ships 400
                only), so the emphasis is the face. */}
            <span data-t1-name className="truncate font-display text-[15px] leading-[20px] font-bold text-[var(--text-primary)]">
              {t.teen}
            </span>
            <TierTag tier={1} />
          </p>
          <p data-t1-mentor className="truncate text-[13px] leading-[16px] text-[var(--text-secondary)]">
            {t.mentor}
          </p>
        </div>
      </div>
      <div role="cell" className="min-w-0">
        <Stepper stage={row.stage} />
      </div>
      <div role="cell" className="min-w-0">
        {/* Icon-led, as elsewhere; zero in `text-muted` (AA — Bloom's
            text/disabled is ~1.5:1, and `--text-disabled` does not exist). */}
        <span data-t1-flags className={cn("inline-flex items-center gap-1 font-mono text-[13px] tabular-nums", t.riskFlags.count ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>
          <Flag aria-hidden className="size-3.5" strokeWidth={2} />
          {t.riskFlags.count}
          {/* The window is a word, not a figure: the sans (mono is for numerals). */}
          {t.riskFlags.window && <span className="font-sans text-[var(--text-secondary)]">· {t.riskFlags.window}</span>}
          <span className="sr-only"> risk flags</span>
        </span>
      </div>
      <div role="cell" className="min-w-0">
        <Response r={row.response} />
      </div>
      <div role="cell" className="min-w-0">
        <Holder h={row.holder} />
      </div>
      <div role="cell" className="flex justify-end">
        <Action action={row.action} teen={t.teen} onGo={go} />
      </div>
    </div>
  );
}

/** ═══ AN EMPTY TIER, IN EITHER VIEW (Monitoring v3, §3 · §6) ═══ The Tier
 *  1 lane's empty treatment, for any tier: a 1px dashed contour, no fill. */
const EMPTY_LINE: Record<Tier, string> = { 1: "Nothing in crisis", 2: "Nobody at Tier 2 right now", 3: "Nobody at Tier 3 right now", 4: "Nobody at Tier 4" };
export function EmptyTierLane({ tier }: { tier: Tier }) {
  return (
    <div
      data-t1-empty={tier === 1 || undefined}
      data-tier-empty={tier}
      tabIndex={tier === 1 ? -1 : undefined}
      className="flex min-h-16 items-center justify-center rounded-[20px] border border-dashed border-[color:var(--border-default)] px-4 text-[15px] leading-[20px] text-[var(--text-secondary)] outline-none"
    >
      {/* TODO-COPY */}
      {EMPTY_LINE[tier]}
    </div>
  );
}

export function Tier1Lane({ teens, heldBy, now }: { teens: MonitoringTeen[]; heldBy?: Readonly<Record<string, string>>; now: number }) {
  const tick = useNowTick(now);
  const rows = t1Rows(teens, tick, useJoined(), heldBy);
  return (
    /* The section header sits ABOVE the soft container, not inside it. */
    <section aria-labelledby="tier-1-heading" data-tier-group={1}>
      <TierGroupHeader tier={1} count={rows.length} id="tier-1-heading" />
      {rows.length === 0 ? (
        <EmptyTierLane tier={1} />
      ) : (
        <div
          data-t1-queue
          /* RELATIVE: the rows' sr-only spans are absolute, and without a
             containing block inside the scroller they escape its clip and
             widen a 375 canvas to 753 (measured). */
          className="relative overflow-x-auto rounded-[20px] bg-[color-mix(in_srgb,var(--t1-soft)_40%,transparent)] p-3"
        >
          <div role="table" aria-label="Tier 1 queue" className="min-w-[880px] space-y-2">
            <div role="rowgroup">
              <div role="row" data-t1-headers className={cn(COLS, "px-4 pt-1 pb-0.5")}>
                {HEADERS.map((h, i) => (
                  <div key={i} role="columnheader" className={cn("text-[12px] leading-[16px] font-medium text-[var(--text-tertiary)]", i === HEADERS.length - 1 && "sr-only")}>
                    {h || "Action"}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup" className="space-y-2">
              {rows.map((r) => (
                <Row key={r.id} row={r} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
