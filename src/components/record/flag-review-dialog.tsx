"use client";

// FLAG REVIEW MODAL — the mitigation path for an escalation or a risk flag.
// Three steps in one scroll: Context · Action · Close note.
//
// A MODAL, NOT INLINE, because reviewing a concern means reading a conversation
// and that cannot happen inside a card on a record page. The modal is where a
// supervisor gathers what they need and records what they did.
//
// MESSAGE CONTENT IS NEVER RENDERED HERE. Not in the context step, not anywhere.
// The concern is described, the categories are named, and the discussion opens in
// the conversation surface via an explicit link. That is the vocabulary law —
// events, not content — and it matters most in exactly this dialog, where the
// temptation to paste the offending line is strongest.
//
// SAME GATING GRAMMAR AS THE PROVIDER NOTE, and it is no longer a disabled
// button. Close is always live; pressing it with an empty note moves focus to the
// field, marks it invalid and announces the requirement from beside it. Both
// commit paths share `DecisionNote`, so the review card and this modal cannot
// drift apart. (`gateHelp` — the old "Add a note to enable Closing" line under a
// disabled primary — is deleted; see decision-footer.)
//
// CRISIS AND REFERRAL ARE OPTIONAL AND OFF BY DEFAULT. Defaults whisper: most
// reviews are neither, and a form that pre-opens both invites a supervisor to
// fill them in because they are there.

import { useRef, useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/settings/pill-button";
import { CategoryChip } from "@/components/record/task-card";
import { DecisionNote, noteReady } from "@/components/record/decision-footer";
import { clinicalDate } from "@/components/record/care-presentation";
import { chatHrefFor } from "@/lib/record/chat";
import type { FlagContext } from "@/lib/record/flag-context";
import {
  categoryLabel,
  CRISIS_TYPE,
  FLAG_OUTCOME,
  REFERRAL_TYPE,
  type CareFlagRecord,
  type CrisisType,
  type FlagOutcome,
  type ReferralType,
} from "@/lib/record/people-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;
const STEP = "border-t border-[var(--border-subtle)] pt-4";
const SELECT =
  "mt-1.5 h-9 w-full max-w-xs rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-2.5 text-[14px] text-[var(--text-primary)]";

/** What a close writes back. The caller owns persistence. */
export interface FlagClose {
  flagId: string;
  outcome: FlagOutcome;
  note: string;
  crisis?: { type: CrisisType };
  referral?: { type: ReferralType };
}

function Step({
  n,
  title,
  children,
  first = false,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div className={first ? undefined : STEP}>
      <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
        {`${n} · ${title}`}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export function FlagReviewDialog({
  open,
  onOpenChange,
  flag,
  context,
  teenName,
  now,
  onClose,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flag: CareFlagRecord | null;
  teenName: string;
  /** ═══ CONTEXT AT THE DECISION POINT (Phase 3) ═══
   *
   *  READ-ONLY, and prepared by the caller rather than queried here — the caller
   *  already holds the teen and the care store, so a query inside this modal would
   *  duplicate its reads and drift from them. Absent renders no section at all:
   *  a "no prior flags" empty state on a first flag is noise at a decision point.
   *
   *  IT INFORMS THE DECISION; IT IS NOT A SECOND PLACE TO ACT. Nothing in it is
   *  interactive except the link to full History. */
  context?: FlagContext;
  /** Fixed at the page's mount — see the note in FlagTask. */
  now: number;
  onClose: (d: FlagClose) => void;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Rendered unconditionally so Radix's Presence owns mount/unmount — the
          same reason the DSM-5 dialog does it. The stateful body sits inside, so
          every open starts clean without a reset-in-an-effect. */}
      <DialogContent
        className="sm:max-w-xl"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo?.current?.focus();
        }}
      >
        {flag && (
          <FlagReviewBody
            flag={flag}
            context={context}
            teenName={teenName}
            now={now}
            onClose={onClose}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FlagReviewBody({
  flag,
  context,
  teenName,
  now,
  onClose,
  onOpenChange,
}: {
  flag: CareFlagRecord;
  context?: FlagContext;
  teenName: string;
  now: number;
  onClose: (d: FlagClose) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [outcome, setOutcome] = useState<FlagOutcome>("supported");
  const [note, setNote] = useState("");
  const [crisisOn, setCrisisOn] = useState(false);
  const [crisisType, setCrisisType] = useState<CrisisType>("self_harm");
  const [referralOn, setReferralOn] = useState(false);
  const [referralType, setReferralType] = useState<ReferralType>("therapist");

  const ready = noteReady(note);
  // SAME PATTERN AS APPROVE: Close is always live, and pressing it empty puts
  // the error at the field with focus.
  const [noteError, setNoteError] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const kindWord = flag.kind === "escalation" ? "escalation" : "risk flag";
  const cats = flag.categories ?? [];

  return (
    <>
      <DialogHeader>
        {/* TODO-COPY */}
        <DialogTitle>{`Review this ${kindWord}`}</DialogTitle>
        <DialogDescription>
          {/* TODO-COPY */}
          Record what you did. Closing appends to the record and cannot be
          edited afterwards.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* ── 1 · CONTEXT ────────────────────────────────────────────────── */}
        {/* TODO-COPY */}
        <Step n={1} title="Context" first>
          <p className="text-[15px] leading-[22px] text-[var(--text-primary)]">
            {flag.reason}
          </p>

          {cats.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {/* NEVER the raw value — categoryLabel maps, or says
                  "Uncategorised". */}
              {cats.map((c) => (
                <CategoryChip key={c} label={categoryLabel(c)} />
              ))}
            </div>
          )}

          <p className="mt-2.5 text-[var(--text-muted)]" style={{ font: "var(--type-helper)" }}>
            {/* TODO-COPY. Source and timestamp. A machine's detection and a
                person's judgement read differently on purpose. */}
            {flag.source === "system"
              ? `System-detected from chat · ${clinicalDate(now - flag.daysAgo * 86_400_000)}`
              : `Raised by ${flag.raisedBy} · ${flag.raisedByRole} · ${clinicalDate(now - flag.daysAgo * 86_400_000)}`}
          </p>

          {/* THE DISCUSSION LEAVES. No message text renders here. */}
          <Link
            href={chatHrefFor(flag.conversationWith ?? "")}
            className={cn(
              "mt-2.5 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
              RING
            )}
          >
            <MessagesSquare className="size-3.5" aria-hidden />
            {/* TODO-COPY */}
            {`Open the discussion with ${teenName}`}
          </Link>

          {/* ═══ CONTEXT. Prior flags and the score that was in force. ═══
              
              INSIDE STEP 1 rather than as a step of its own: this is part of
              understanding the concern, not a separate task, and a third numbered
              step would imply an action the reader has to take.
              
              NO NESTED CARD — a hairline and vertical rhythm, per the house rule.
              Nothing here is a chip or a tint: the band is a word. */}
          {context &&
            (context.priorFlags.length > 0 || context.assessmentAtRaise) && (
              <div className="mt-3.5 border-t border-[color:var(--border-subtle)] pt-3">
                {context.assessmentAtRaise && (
                  <p
                    className="text-[var(--text-secondary)]"
                    style={{ font: "var(--type-row-label)" }}
                  >
                    {/* TODO-COPY. A FACT ABOUT A DATE, stated and not
                        interpreted — the score in force when this was raised,
                        which is not necessarily the latest on the record. The max
                        comes from INSTRUMENT_MAX, never a literal. */}
                    {`At the time this was raised: ${context.assessmentAtRaise.instrument} ${context.assessmentAtRaise.score} / ${context.assessmentAtRaise.max} · ${context.assessmentAtRaise.band} · ${clinicalDate(context.assessmentAtRaise.at)}`}
                  </p>
                )}

                {context.priorFlags.length > 0 && (
                  <div className={context.assessmentAtRaise ? "mt-2.5" : ""}>
                    <p
                      className="text-[var(--text-muted)]"
                      style={{ font: "var(--type-row-label)" }}
                    >
                      {/* TODO-COPY. Honest about the trim when there are more. */}
                      {context.priorTotal > context.priorFlags.length
                        ? `Earlier flags — most recent ${context.priorFlags.length} of ${context.priorTotal}`
                        : context.priorFlags.length === 1
                          ? "One earlier flag"
                          : `${context.priorFlags.length} earlier flags`}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {context.priorFlags.map((f) => (
                        <li
                          key={f.id}
                          className="text-[var(--text-secondary)]"
                          style={{ font: "var(--type-row-label)" }}
                        >
                          {`${clinicalDate(f.at)} · ${f.categories} · ${f.resolution}`}
                        </li>
                      ))}
                    </ul>
                    {/* THE ONLY LINK OUT. Full History, where the chain is
                        walkable — the relational lines do the rest. */}
                    <button
                      type="button"
                      onClick={() => {
                        // CLOSES, NEVER RESOLVES. `onClose` is the resolution
                        // path and carries an outcome; leaving to read history is
                        // a dismissal, so it goes through onOpenChange.
                        onOpenChange(false);
                        requestAnimationFrame(() => {
                          document
                            .querySelector('[data-record-section="care-timeline"]')
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }}
                      className={cn(
                        "mt-2 rounded-sm text-[12px] font-semibold text-[var(--text-primary)] underline underline-offset-2",
                        RING
                      )}
                    >
                      {/* TODO-COPY */}
                      See full history
                    </button>
                  </div>
                )}
              </div>
            )}
        </Step>

        {/* ── 2 · ACTION ─────────────────────────────────────────────────── */}
        {/* TODO-COPY */}
        <Step n={2} title="Action">
          <label
            htmlFor="flag-outcome"
            className="block text-[var(--text-muted)]"
            style={LABEL_STYLE}
          >
            {/* TODO-COPY */}
            Outcome
          </label>
          <select
            id="flag-outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as FlagOutcome)}
            className={cn(SELECT, RING)}
          >
            {FLAG_OUTCOME.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          {/* OPTIONAL AND OFF BY DEFAULT — defaults whisper. */}
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={crisisOn}
                onChange={(e) => setCrisisOn(e.target.checked)}
                className={cn("mt-0.5 size-4 shrink-0 accent-[var(--text-primary)]", RING)}
              />
              <span className="min-w-0">
                <span className="block text-[14px] leading-[20px] text-[var(--text-primary)]">
                  {/* TODO-COPY */}
                  Elevate to crisis
                </span>
                {crisisOn && (
                  <select
                    aria-label="Crisis type"
                    value={crisisType}
                    onChange={(e) => setCrisisType(e.target.value as CrisisType)}
                    className={cn(SELECT, RING)}
                  >
                    {CRISIS_TYPE.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            </label>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={referralOn}
                onChange={(e) => setReferralOn(e.target.checked)}
                className={cn("mt-0.5 size-4 shrink-0 accent-[var(--text-primary)]", RING)}
              />
              <span className="min-w-0">
                <span className="block text-[14px] leading-[20px] text-[var(--text-primary)]">
                  {/* TODO-COPY */}
                  Referral made
                </span>
                {referralOn && (
                  <select
                    aria-label="Referral type"
                    value={referralType}
                    onChange={(e) =>
                      setReferralType(e.target.value as ReferralType)
                    }
                    className={cn(SELECT, RING)}
                  >
                    {REFERRAL_TYPE.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            </label>
          </div>
        </Step>

        {/* ── 3 · CLOSE NOTE ─────────────────────────────────────────────── */}
        {/* TODO-COPY */}
        <Step n={3} title="Close note">
          <DecisionNote
            id={`close-note-${flag.id}`}
            inputRef={noteRef}
            error={noteError}
            /* TODO-COPY */
            label="What you did"
            value={note}
            onChange={(v) => {
              setNote(v);
              if (noteError && v.trim()) setNoteError(false);
            }}
            permanenceNoun="closure"
            /* TODO-COPY */
            placeholder="What you looked at, who you spoke to, and what happens next."
          />
        </Step>
      </div>

      <DialogFooter>
        <PillButton
          onClick={() => {
            if (!ready) {
              setNoteError(true);
              noteRef.current?.focus();
              return;
            }
            onClose({
              flagId: flag.id,
              outcome,
              note: note.trim(),
              crisis: crisisOn ? { type: crisisType } : undefined,
              referral: referralOn ? { type: referralType } : undefined,
            });
            onOpenChange(false);
          }}
        >
          {/* TODO-COPY */}
          Close
        </PillButton>
      </DialogFooter>
    </>
  );
}
