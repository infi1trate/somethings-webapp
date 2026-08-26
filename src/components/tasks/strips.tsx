"use client";

// THE TWO PINNED STRIPS — Respond (§3.2) and Next-up (§3.1).
//
// ═══ THE ALARM BUDGET LIVES AND DIES HERE ═══
// The Respond strip is THE ONLY SURFACE IN THE TASKS PAGE using the filled
// saturated red/rose treatment (§3.2 + §3.3). Not the cards, not the rows, not the
// pane, not the breach chip. If a second filled-red thing appears anywhere on this
// page, the strip stops meaning anything — that is the entire reason the budget is
// written as a rule rather than a preference.
//
// The Next-up strip is the ONLY DIRECTIVE ELEMENT on the page (§3.1), and its CTA
// is the page's single primary button. Everything else is tonal secondary. Two
// primary buttons on a worklist is two answers to "what should I do now", which is
// the question this strip exists to answer.

import Link from "next/link";
import { AlertTriangle, Check, Phone } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { RecordButton } from "@/components/record/record-button";
import { DOMAIN_LABEL, isBreached, type TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. Elapsed since open, in the house format — mono figures so a live
 *  counter does not jitter as digits change width. */
export function elapsedLabel(openedAt: number, now: number): string {
  const ms = Math.max(0, now - openedAt);
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** THE ESCALATION FLOW ROUTE.
 *
 *  TODO-DATA / BLOCKER §8.4: no escalation surface exists in this repo — audited.
 *  The Care tab has a flag REVIEW modal, which is a different thing (it closes a
 *  flag; it does not run an escalation). So this is a stub route and the gap is
 *  logged (design-system-gaps.md row 213). The link shape is what the real
 *  surface will inherit. */
export function escalationHref(escalationId: string): string {
  return `/app/escalation/${encodeURIComponent(escalationId)}`;
}

// ── Respond strip (§3.2) ────────────────────────────────────────────────────

export function RespondStrip({
  escalations,
  now,
}: {
  escalations: TaskItem[];
  now: number;
}) {
  // ESCALATIONS ARE NEVER ONLY INSIDE A TAB (locked decision 10). This renders
  // above the tabs and is identical from every one of them, because it is fed the
  // whole item set rather than the active domain.
  if (escalations.length === 0) return null;

  return (
    <section
      /* TODO-COPY */
      aria-label="Open escalations"
      className="overflow-hidden rounded-[var(--radius-elevated)]"
      style={{
        // THE ONE FILLED SATURATED TREATMENT ON THIS PAGE. Nothing else here may
        // use it.
        //
        // `--task-respond-bg`, not `--alert-critical-accent`: the alert token
        // INVERTS in dark mode to a bright tangelo, where white text on it
        // measures 2.78:1 and fails AA. The respond token is defined in `:root`
        // only and does not theme — an alarm should be the same object in both
        // modes. Row 214.
        backgroundColor: "var(--task-respond-bg)",
      }}
    >
      <ul className="divide-y divide-[color-mix(in_oklab,var(--task-respond-fg)_20%,transparent)]">
        {escalations.map((item) => {
          const p = item.payload;
          const is911 = p.kind === "escalation" ? p.is911 : false;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <AlertTriangle
                className="size-4 shrink-0 text-[var(--task-respond-fg)]"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-[20px] text-[var(--task-respond-fg)]">
                  {item.teenDisplayName}
                </span>
                <span className="block text-[12px] leading-[16px] text-[color-mix(in_oklab,var(--task-respond-fg)_75%,transparent)]">
                  {/* TODO-COPY */}
                  to {item.mentorName}
                </span>
              </span>

              {/* 911 / NON-911. Icon plus text — never colour alone, and on a
                  saturated ground colour could not carry it anyway. */}
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--task-respond-fg)_20%,transparent)] px-2 py-0.5 text-[11.5px] font-semibold leading-[16px] text-[var(--task-respond-fg)]">
                <Phone className="size-3 shrink-0" aria-hidden />
                {/* TODO-COPY */}
                {is911 ? "911 dispatched" : "No 911"}
              </span>

              {/* LIVE ELAPSED COUNTER, mono. */}
              <span
                className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--task-respond-fg)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {elapsedLabel(item.openedAt, now)}
              </span>

              <Link
                href={escalationHref(
                  p.kind === "escalation" ? p.escalationId : item.objectId
                )}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full bg-[var(--task-respond-fg)] px-3.5 text-[13px] font-semibold",
                  "text-[var(--task-respond-bg)] transition-opacity hover:opacity-90",
                  RING
                )}
              >
                {/* TODO-COPY */}
                Open escalation
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Next-up strip (§3.1) ───────────────────────────────────────────────────

/** TODO-COPY. `Next: Riley's escalation · 12m open`.
 *
 *  The possessive uses the DISPLAY NAME, which is first name + last initial
 *  (locked decision 11) — so this reads "Riley T.'s escalation". Trimming to the
 *  bare first name for the possessive would be a second name format on one
 *  surface, and the display name is the one the rows use. */
function nextUpSentence(item: TaskItem, now: number): string {
  const noun =
    item.taskType === "activeEscalation"
      ? "escalation"
      : item.taskType === "escalationDocumentation"
        ? "escalation write-up"
        : item.domain === "billing"
          ? "billing review"
          : item.domain === "monitoring"
            ? "flag review"
            : "flag review";
  const first = item.teenDisplayName.split(" ")[0];
  return `${first}'s ${noun} · ${elapsedLabel(item.openedAt, now)} open`;
}

export function NextUpStrip({
  item,
  now,
  /** True when the Next-up item is already the one selected in the pane. */
  isCurrent,
  onOpen,
}: {
  item: TaskItem | null;
  now: number;
  isCurrent: boolean;
  onOpen: (item: TaskItem) => void;
}) {
  // PRESENT WHENEVER ANY ITEM IS OPEN (§3.1). Null means nothing is open, which
  // is the whole-page empty state's business, not this strip's.
  if (!item) return null;
  const breached = isBreached(item, now);

  return (
    <section
      /* TODO-COPY */
      aria-label="Next up"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-2.5"
    >
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
        {/* TODO-COPY */}
        Next
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
        {nextUpSentence(item, now)}
      </span>
      {breached && <BreachedInline />}
      <span className="shrink-0 rounded-full bg-[var(--surface-s2)] px-2 py-0.5 text-[11.5px] leading-[16px] text-[var(--text-secondary)]">
        {DOMAIN_LABEL[item.domain]}
      </span>

      {isCurrent ? (
        // A QUIET CONFIRMATION, NOT A COMPETING BUTTON (§3.1). When the reader is
        // already on this item, a live primary CTA would be inviting them to do
        // the thing they are doing.
        <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 px-1 text-[13px] font-semibold text-[var(--text-secondary)]">
          <Check className="size-4 shrink-0" aria-hidden />
          {/* TODO-COPY */}
          You&apos;re on it
        </span>
      ) : (
        // THE PAGE'S SINGLE PRIMARY BUTTON. Everything else on this page is tonal
        // secondary — see the module note.
        <PillButton
          onClick={() => onOpen(item)}
          className="h-9 shrink-0 px-5 text-[14px]"
        >
          {/* TODO-COPY */}
          Open
        </PillButton>
      )}
    </section>
  );
}

/** The breach chip, inline in the Next-up strip. Same compact pattern the cards
 *  and rows use (§3.3) — imported there rather than redefined, and re-declared
 *  here only because this instance carries no count. */
function BreachedInline() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-[16px]"
      style={{
        backgroundColor: "var(--band-clay-bg)",
        color: "var(--band-clay-fg)",
      }}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      {/* TODO-COPY */}
      Overdue
    </span>
  );
}

/** A tonal secondary button for the tasks surface. Re-exported from the record's
 *  own secondary so the two cannot drift — every button on this page except the
 *  Next-up CTA is one of these. */
export { RecordButton as TaskSecondaryButton };
