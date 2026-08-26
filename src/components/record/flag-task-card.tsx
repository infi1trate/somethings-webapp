"use client";

// THE ESCALATION / RISK-FLAG CARD. Moved off Care (it is record-level work, not
// clinical-presentation work) and rebuilt around two things the previous version
// got wrong.
//
// 1 · THE BAND CARRIES BOTH ACTIONS. Review is the primary and it is FILLED;
//     Open chat sits beside it as a secondary. Previously Review was a secondary
//     pill in the band and Open chat was a tertiary button in the BODY, which
//     split one decision across two altitudes of the card: a supervisor read the
//     concern, reached down to open the chat, came back up to act. Both live in
//     the band now, in the same place on every card type.
//
//     ON RULE 4 — "one filled button per region". The REGION IS THE CARD. Each
//     card is one self-contained piece of work with exactly one primary verb, and
//     Review is genuinely it: a supervisor's job here is to review the discussion
//     and decide. Reading the whole "Action required" stack as one region would
//     mean the second and third escalations on a record get a quieter Review than
//     the first, which ranks by position rather than by what the work is. Severity
//     still never colours a button — the fill is ink, from `--text-primary`.
//
// 2 · MESSAGE CONTENT NEVER APPEARS. Not in the concern, not in the summary, not
//     in the expanded group. `reason` and `momentSummary.text` are both
//     descriptions of events; if a fixture ever reads like a quote, the fixture is
//     the bug. The chat link is the only route to what was actually said.
//
// GROUPED CARDS. Multiple flags out of one conversation render as ONE card with
// one Review, expandable to the individual categories. A classifier does not
// raise one tidy flag per conversation — it raises one per match — so the
// ungrouped version of this page was four cards deep on a single evening's chat.
// Grouping keys on `conversationId` (the thread) and never on `conversationWith`
// (the person), which on a teen's own record is the same value on every flag they
// have; see the field comment in people-demo.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MessageSquare, Sparkles, ShieldAlert } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { RecordButton } from "@/components/record/record-button";
import { CategoryChip, TaskCard } from "@/components/record/task-card";
import { clinicalDate } from "@/components/record/care-presentation";
import { chatHrefFor } from "@/lib/record/chat";
import { categoryLabel, type CareFlagRecord } from "@/lib/record/people-demo";
import type { AlertInstance } from "@/lib/record/record-alerts";
import { alertDef } from "@/lib/record/alerts";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** 11.5px muted — the eyebrow scale, below the 12px field-label stop. */
const EYEBROW = "text-[11.5px] leading-[16px] text-[var(--text-muted)]";

// ── The moment summary inset ────────────────────────────────────────────────

/** A SYSTEM OR AI DESCRIPTION OF THE FLAGGED MOMENT.
 *
 *  A TONAL INSET, NOT A NESTED CARD (rule 3): no border, no shadow, no contour —
 *  a fill and a radius, which is what makes it read as a recessed area of this
 *  card rather than a second card sitting on it.
 *
 *  PROVENANCE ABOVE THE TEXT, ALWAYS, and it distinguishes the two things this
 *  can be. A classifier reporting what it matched and a model writing prose about
 *  an exchange earn different trust, and a reader must be able to tell which one
 *  they are reading before they read it — not after.
 *
 *  TYPOGRAPHICALLY SUBORDINATE to the concern: 13.5px against the concern's 15px,
 *  secondary ink against primary. The supervisor's colleague wrote the concern; a
 *  machine wrote this. */
function MomentSummary({
  summary,
}: {
  summary: NonNullable<CareFlagRecord["momentSummary"]>;
}) {
  const ai = summary.provenance === "ai";
  return (
    <div className="mt-3 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3.5 py-3">
      <p className={cn("flex items-center gap-1.5", EYEBROW)}>
        {ai ? (
          <Sparkles className="size-3 shrink-0" aria-hidden />
        ) : (
          <ShieldAlert className="size-3 shrink-0" aria-hidden />
        )}
        {/* TODO-COPY */}
        {ai ? "AI-generated summary" : "System-detected from chat"}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-[20px] text-[var(--text-secondary)]">
        {summary.text}
      </p>
    </div>
  );
}

// ── Categories ──────────────────────────────────────────────────────────────

/** MAPPED DISPLAY NAMES ONLY. Raw values cannot reach here — every value goes
 *  through `categoryLabel`, which returns "Uncategorised" for anything the
 *  product has not learned to name. An uncategorised safety flag is still a
 *  safety flag, so it is never silently dropped either. */
function Categories({ values }: { values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {values.map((c) => (
        <CategoryChip key={c} label={categoryLabel(c)} />
      ))}
    </div>
  );
}

// ── The card ────────────────────────────────────────────────────────────────

export function FlagTaskCard({
  instance,
  teenName,
  now,
  onReview,
}: {
  instance: Extract<AlertInstance, { kind: "flag" }>;
  teenName: string;
  /** Fixed at the page's mount. `Date.now()` in render scope is impure and the
   *  lint rule is right to reject it — a re-render would move every date. */
  now: number;
  /** Supervisor tier only; ABSENT below, never disabled. */
  onReview?: (flag: CareFlagRecord, trigger: HTMLElement) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const def = alertDef(instance.alertId);
  const flags = instance.flags;
  /** The flag a single Review acts on. TODO: the review modal is single-flag
   *  today, so a grouped Review opens the NEWEST member. Reviewing a whole
   *  conversation at once is a modal change, out of scope here — reported. */
  const primary = flags[0];
  const grouped = flags.length > 1;
  const severity = def?.severity ?? "warning";

  // THE QUALIFIER. Overdue is expressed as STATE ON THIS CARD, never as a second
  // card — the registry keeps a separate `_overdue` entry so a feed can emit two
  // events, and the record collapses them (see collapseOverdue).
  const overdue = instance.overdueDays > 0;
  const parts: string[] = [];
  if (grouped) parts.push(`${flags.length} flags`);
  parts.push(overdue ? /* TODO-COPY */ "Overdue" : /* TODO-COPY */ "Open");
  if (overdue)
    parts.push(
      instance.overdueDays === 1 ? "1 day" : `${instance.overdueDays} days`
    );
  // "Crisis" is the ONLY extra chrome a crisis elevation gets — the word does the
  // work.
  if (flags.some((f) => f.crisis)) parts.push(/* TODO-COPY */ "Crisis");

  const chatWith = primary.conversationWith ?? "";
  const openChat = () => {
    // TODO-DATA: this lands at the top of the thread. Deep-linking to the flagged
    // MOMENT needs a moment id on the flag and an anchor in the chat route —
    // neither exists yet, and inventing an anchor the chat surface ignores would
    // be a link that silently does the wrong thing. Linking to the conversation
    // is the honest version until the messaging layer lands.
    router.push(chatHrefFor(chatWith));
  };

  return (
    <TaskCard
      tone={severity}
      section="record-task-flag"
      ariaLabel={`${def?.label ?? "Flag"} — ${overdue ? "overdue" : "open"}`}
      type={def?.label ?? "Flag"}
      meta={parts.join(" · ")}
      actions={
        <>
          {/* PRIMARY, FILLED — see the rule-4 note at the top of this file. Only
              at supervisor tier: below it the button is ABSENT, not disabled. */}
          {onReview && (
            <PillButton
              onClick={(e) => onReview(primary, e.currentTarget)}
              className="h-9 px-5 text-[14px]"
            >
              {/* TODO-COPY — the ellipsis says a modal opens. */}
              Review…
            </PillButton>
          )}
          {/* SECONDARY, beside it, on every card type in the same place.
              READ-WIDE: this one is NOT gated. Every tier may open and read the
              conversation; only the supervisor tier decides anything about it. */}
          <RecordButton onClick={openChat} aria-label={`Chat with ${teenName}`}>
            <MessageSquare className="size-4" aria-hidden />
            {/* TODO-COPY. Deliberately the SAME label as the header CTA: a
                supervisor's job on a teen's record is to open and review the
                discussion, not to compose a message. Not differentiated. */}
            Open chat
          </RecordButton>
        </>
      }
      footer={
        primary.source === "system"
          ? /* TODO-COPY */ `System-detected from chat · ${clinicalDate(now - primary.daysAgo * 86_400_000)}`
          : /* TODO-COPY */ `Raised by ${primary.raisedBy} · ${primary.raisedByRole} · ${clinicalDate(now - primary.daysAgo * 86_400_000)}`
      }
    >
      {/* THE CONCERN, at body scale, in plain language. Never message content. */}
      <p className="text-[15px] leading-[22px] text-[var(--text-primary)]">
        {grouped
          ? /* TODO-COPY */ `${flags.length} flags in this conversation`
          : primary.reason}
      </p>

      {primary.momentSummary && (
        <MomentSummary summary={primary.momentSummary} />
      )}

      {/* UNGROUPED: the categories are the whole story, so they sit inline. */}
      {!grouped && <Categories values={primary.categories ?? []} />}

      {/* GROUPED: one disclosure to the individual flags. Collapsed by default —
          the count and the summary are what a supervisor needs to decide whether
          to open the chat at all; the breakdown is for when they have. */}
      {grouped && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full -ml-2 px-2",
              "text-[13px] font-semibold text-[var(--text-primary)]",
              "transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {/* TODO-COPY */}
            {open ? "Hide flags" : `Show all ${flags.length}`}
            <ChevronRight
              className={cn("size-3.5 transition-transform", open && "rotate-90")}
              aria-hidden
            />
          </button>

          {open && (
            <ul className="mt-1">
              {flags.map((f) => (
                <li
                  key={f.id}
                  // Hairlines BETWEEN rows only, no surrounding card — the same
                  // rhythm the survey table uses.
                  className="border-t border-[color:var(--border-subtle)] py-3 first:border-t-0"
                >
                  <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
                    {f.reason}
                  </p>
                  <Categories values={f.categories ?? []} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </TaskCard>
  );
}
