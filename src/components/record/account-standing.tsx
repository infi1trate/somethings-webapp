"use client";

// ACCOUNT STANDING — the status control and the two account-level actions that
// belong beside it, on a person's Account tab.
//
// WHY A CONTROL AND NOT A ROW. A teen's standing used to render here as a
// read-only pill reading "Active" / "Inactive" — a BINARY, in a product whose
// vocabulary has three states, so "paused" was unreachable from the one page
// that owns a person's standing. Admins, supervisors and lead mentors are all
// accountable for it, so all three can set it here.
//
// Every change goes through a CONFIRM naming what it affects. Standing is an
// account fact, and the adjacent surfaces (a mentor's mentee list, matching)
// read it — so the dialog says which of those move and which do not.
//
// DEACTIVATE AND LOCK ARE DIFFERENT THINGS:
//   deactivated — not an active user. Reversible.
//   locked      — cannot sign up AGAIN; their email and phone are blocked, so
//     the block outlives the account.
// Locking is therefore only offered once someone is deactivated — blocking the
// contact details of an active user would be incoherent — and it sits with
// deactivation rather than in a menu, because a reader deciding one is deciding
// between both.

import { useRef, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import { STATUS_LABELS } from "@/lib/record/mentor-status";
import type { AccountLock } from "@/lib/record/guardian";
import type { MentorLifecycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

export type TeenStanding = "active" | "paused" | "deactivated";

/** TODO-COPY. Sentence case, and each option says what it MEANS — a bare
 *  "Paused" in a select gives a reader no way to tell it from "Deactivated". */
const TEEN_OPTIONS: {
  value: TeenStanding;
  label: string;
  meaning: string;
}[] = [
  { value: "active", label: "Active", meaning: "On the platform and matchable." },
  {
    value: "paused",
    label: "Paused",
    meaning: "Still matched, but out of matching for now.",
  },
  {
    value: "deactivated",
    label: "Deactivated",
    meaning: "Not an active user. Pairings end.",
  },
];

const CHIP: Record<TeenStanding, string> = {
  active: "bg-[var(--status-positive-bg)] text-[var(--status-positive-fg)]",
  paused: "bg-[var(--status-attention-bg)] text-[var(--status-attention-fg)]",
  deactivated: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
};

export function AccountStanding({
  name,
  /** Teen standing, or null for staff (whose lifecycle is a different enum). */
  standing,
  onStandingChange,
  /** Staff lifecycle, shown read-only here — it is set from the Supervision
   *  roster, which is where a supervisor is already working. */
  staffStatus,
  lock,
  onLockChange,
  actor,
  actorRole,
  blocked,
  canEdit,
}: {
  name: string;
  standing: TeenStanding | null;
  onStandingChange?: (next: TeenStanding) => void;
  staffStatus?: MentorLifecycleStatus | null;
  lock: AccountLock | null;
  onLockChange?: (lock: AccountLock | null) => void;
  actor: string;
  actorRole: string;
  blocked: { email?: string; phone?: string };
  canEdit: boolean;
}) {
  const [pending, setPending] = useState<TeenStanding | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const deactivated =
    standing === "deactivated" || staffStatus === "deactivated";
  const locked = !!lock;

  return (
    <section aria-label="Standing" data-record-section="account-standing">
      <div className="rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
              {/* TODO-COPY */}
              Standing
            </p>
            {standing && (
              <p className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1",
                    CHIP[standing]
                  )}
                  style={{ font: "var(--type-label-sm)" }}
                >
                  {TEEN_OPTIONS.find((o) => o.value === standing)?.label}
                </span>
                <span
                  className="text-[var(--text-secondary)]"
                  style={{ font: "var(--type-helper)" }}
                >
                  {TEEN_OPTIONS.find((o) => o.value === standing)?.meaning}
                </span>
              </p>
            )}
            {staffStatus && (
              <p className="mt-1.5 text-[var(--text-primary)] text-[14px] leading-[20px]">
                {STATUS_LABELS[staffStatus]}
                <span className="ml-2 text-[var(--text-muted)] text-[13px]">
                  {/* TODO-COPY — staff standing is set where a supervisor is
                      already working, rather than in two places. */}
                  Set from the Supervision list
                </span>
              </p>
            )}
          </div>

          {/* The control. Absent below the tiers that own standing — never a
              disabled select. */}
          {standing && canEdit && onStandingChange && (
            <label className="shrink-0">
              <span className="sr-only">{`Set ${name}'s standing`}</span>
              <select
                value={standing}
                onChange={(e) => setPending(e.target.value as TeenStanding)}
                className={cn(
                  "h-9 rounded-[var(--radius-control)] border border-[color:var(--button-border-default)] bg-[var(--surface-card)] px-3",
                  "text-[13px] font-semibold text-[var(--text-primary)]",
                  RING
                )}
              >
                {TEEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* LOCK — only once deactivated. */}
        {canEdit && onLockChange && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--border-subtle)] pt-3.5">
            <p
              className="min-w-0 text-[var(--text-secondary)]"
              style={{ font: "var(--type-helper)" }}
            >
              {/* TODO-COPY. Says what a lock IS, and why it is unavailable when
                  it is — an unexplained disabled control teaches nothing. */}
              {/* Names what was ACTUALLY blocked. Riley has no email on file, so
                  "email and phone are blocked" claimed a block that doesn't
                  exist — and a block a reader can't see the shape of is one they
                  can't undo confidently. */}
              {locked
                ? `${name} is locked. ${
                    [lock.blocked.email, lock.blocked.phone]
                      .filter(Boolean)
                      .join(" and ") || "Their contact details"
                  } is blocked, so they can't sign up again.`
                : deactivated
                  ? "Locking blocks their email and phone, so they can't sign up again. Deactivation alone doesn't."
                  : `Locking is available once ${name} is deactivated.`}
            </p>
            <button
              type="button"
              disabled={!deactivated && !locked}
              onClick={(e) => {
                returnFocusTo.current = e.currentTarget;
                setLockOpen(true);
              }}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors",
                locked
                  ? "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]"
                  : "border-[color:var(--state-error)] text-[var(--state-error)] hover:bg-[var(--alert-critical-bg)]",
                "disabled:cursor-not-allowed disabled:border-[color:var(--border-subtle)] disabled:text-[var(--text-muted)] disabled:hover:bg-transparent",
                RING
              )}
            >
              {locked ? (
                <Unlock className="size-3.5" aria-hidden />
              ) : (
                <Lock className="size-3.5" aria-hidden />
              )}
              {/* TODO-COPY */}
              {locked ? "Unlock account" : "Lock account"}
            </button>
          </div>
        )}
      </div>

      {/* Standing change — names what moves and what doesn't. */}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        returnFocusTo={returnFocusTo}
        /* TODO-COPY */
        title={`Set ${name} to ${
          TEEN_OPTIONS.find((o) => o.value === pending)?.label.toLowerCase() ?? ""
        }?`}
        description={
          /* TODO-COPY — the second sentence is the one that matters: it names
             the surface that moves. */
          pending === "deactivated"
            ? "They stop being an active user, and their pairing moves to Past mentees. Nothing is deleted, and you can set them active again."
            : pending === "paused"
              ? "They stay matched to their mentor and stay on that list, grouped under Paused. They come out of matching for new pairings."
              : "They go back to being an active user and are matchable again."
        }
        confirmLabel="Change standing"
        onConfirm={() => {
          if (!pending || !onStandingChange) return;
          onStandingChange(pending);
          // TODO-COPY
          toast(`${name} is now ${pending}.`);
          setPending(null);
        }}
      />

      {/* Lock / unlock. */}
      <ConfirmDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        returnFocusTo={returnFocusTo}
        /* TODO-COPY */
        title={locked ? `Unlock ${name}?` : `Lock ${name} out of signing up?`}
        description={
          /* TODO-COPY — names the blocked identifiers, because a block a reader
             can't see the shape of is a block they can't undo confidently. */
          locked
            ? `Their email and phone stop being blocked. ${name} could sign up again.`
            : `This blocks ${[blocked.email, blocked.phone].filter(Boolean).join(" and ") || "their contact details"} from creating a new account. Deactivation on its own doesn't do this. You can unlock later.`
        }
        confirmLabel={locked ? "Unlock" : "Lock account"}
        tone={locked ? "default" : "destructive"}
        onConfirm={() => {
          if (!onLockChange) return;
          onLockChange(
            locked
              ? null
              : {
                  lockedAt: Date.now(),
                  actor,
                  actorRole,
                  blocked,
                }
          );
          // TODO-COPY
          toast(locked ? "Unlocked." : "Locked. They can't sign up again.");
          setLockOpen(false);
        }}
      />
    </section>
  );
}
