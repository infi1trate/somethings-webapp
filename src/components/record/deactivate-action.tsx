"use client";

// DEACTIVATE ACTION — the band below the Organization card (Figma 2218:8660):
// a sentence on the left saying where the person stands, the account actions on
// the right. Deactivation IS a status change, so it belongs where status is;
// the header's overflow keeps its own copy for people who go looking there.
//
// LOCKING LIVES HERE TOO, beside Deactivate, because a reader deciding one is
// deciding between both — and because the two are genuinely different things:
//
//   deactivated — not an active user. Reversible.
//   locked      — cannot sign up AGAIN. Their email and phone are blocked, so
//                 the block outlives the account.
//
// The Lock button is therefore ABSENT until someone is deactivated: blocking the
// contact details of an active user is incoherent, and an inert button that
// never explains itself teaches nothing. The sentence carries the reason.
//
// Unlock exists. A lock stops a real person returning, and blocking the wrong
// address with no remedy is a worse failure than the one locking prevents.
//
// The warning is slight by design: a short consequence line inline, and a
// confirm naming what happens. Reactivating asks too, but in a plain voice —
// it puts someone back into matching, worth a beat but not dangerous.

import { useRef, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import type { AccountLock } from "@/lib/record/guardian";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const BTN =
  "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors";
const BTN_QUIET =
  "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]";
const BTN_DANGER =
  "border-[color:var(--state-error)] text-[var(--state-error)] hover:bg-[var(--alert-critical-bg)]";

export function DeactivateAction({
  name,
  deactivated,
  noun = "account",
  onConfirm,
  lock = null,
  onLockChange,
  blocked,
  actor,
  actorRole,
}: {
  name: string;
  deactivated: boolean;
  /** What is being deactivated, for the copy: "account" | "teen". */
  noun?: string;
  /** Called with the NEXT active state (true = reactivated). */
  onConfirm: (nextActive: boolean) => void;
  /** Omit the lock props entirely on surfaces that don't own locking. */
  lock?: AccountLock | null;
  onLockChange?: (lock: AccountLock | null) => void;
  /** The identifiers a lock would block — named in the copy, because a block a
   *  reader can't see the shape of is one they can't undo confidently. */
  blocked?: { email?: string; phone?: string };
  actor?: string;
  actorRole?: string;
}) {
  const [open, setOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const locked = !!lock;
  const lockable = !!onLockChange && (deactivated || locked);

  const blockedNames =
    [lock?.blocked.email ?? blocked?.email, lock?.blocked.phone ?? blocked?.phone]
      .filter(Boolean)
      .join(" and ") || "their contact details";

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] px-[var(--surface-pad-x)] py-3.5">
        <p
          className="min-w-0 text-[var(--text-secondary)]"
          style={{ font: "var(--type-helper)" }}
        >
          {/* TODO-COPY */}
          {locked
            ? `${name} is deactivated and locked — ${blockedNames} is blocked, so they can't sign up again.`
            : deactivated
              ? `${name} is deactivated — they're out of matching until you turn them back on.`
              : `Removes ${name} from matching. Existing mentorships pause rather than end.`}
        </p>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Lock sits BESIDE deactivate, and only once it means something. */}
          {lockable && (
            <button
              type="button"
              onClick={(e) => {
                returnFocusTo.current = e.currentTarget;
                setLockOpen(true);
              }}
              className={cn(BTN, locked ? BTN_QUIET : BTN_DANGER, RING)}
            >
              {locked ? (
                <Unlock className="size-3.5" aria-hidden />
              ) : (
                <Lock className="size-3.5" aria-hidden />
              )}
              {/* TODO-COPY */}
              {locked ? "Unlock account" : "Lock account"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              returnFocusTo.current = e.currentTarget;
              setOpen(true);
            }}
            className={cn(BTN, deactivated ? BTN_QUIET : BTN_DANGER, RING)}
          >
            {deactivated ? "Reactivate" : `Deactivate ${noun}`}
          </button>
        </span>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        returnFocusTo={returnFocusTo}
        title={deactivated ? `Reactivate ${name}?` : `Deactivate ${name}?`}
        description={
          deactivated
            ? "They'll be matchable again right away."
            : "They'll be removed from matching right away, and teens won't see their profile. Active mentorships are paused, not ended. You can reactivate them later — nothing is deleted."
        }
        confirmLabel={deactivated ? "Reactivate" : "Deactivate"}
        tone={deactivated ? "default" : "destructive"}
        onConfirm={() => {
          onConfirm(deactivated);
          toast(deactivated ? "Reactivated." : "Deactivated.");
        }}
      />

      {lockable && (
        <ConfirmDialog
          open={lockOpen}
          onOpenChange={setLockOpen}
          returnFocusTo={returnFocusTo}
          /* TODO-COPY */
          title={locked ? `Unlock ${name}?` : `Lock ${name} out of signing up?`}
          description={
            /* TODO-COPY */
            locked
              ? `${blockedNames} stops being blocked. ${name} could sign up again.`
              : `This blocks ${blockedNames} from creating a new account. Deactivation on its own doesn't do this. You can unlock later.`
          }
          confirmLabel={locked ? "Unlock" : "Lock account"}
          tone={locked ? "default" : "destructive"}
          onConfirm={() => {
            onLockChange?.(
              locked
                ? null
                : {
                    lockedAt: Date.now(),
                    actor: actor ?? "Staff",
                    actorRole: actorRole ?? "Staff",
                    blocked: blocked ?? {},
                  }
            );
            // TODO-COPY
            toast(locked ? "Unlocked." : "Locked. They can't sign up again.");
          }}
        />
      )}
    </>
  );
}
