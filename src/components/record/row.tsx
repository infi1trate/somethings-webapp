"use client";

// RecordRow (record Phases 2–3) — the record's OPEN row anatomy: label in a
// fixed left column (13px secondary), value beside it (14px primary), edit
// affordance far right. Typography for attributes of a person; containers
// are for collections — so rows carry hairline dividers only, never boxes.
// Settings keep EditRow untouched (invariant 8); this replaces it on the
// record ONLY. Same lifecycle vocabulary as EditRow (read / edit / saving /
// error / saved) so the existing row state machines (StaffFieldRow,
// PhotoRowCore, SlotRow) drop in, and the same a11y contract: focus moves to
// the first control on entering edit and back to the affordance on exit;
// Escape cancels (never mid-save).
//
// Phase 3 affordances — one of three, visually distinct; the same field
// shows the same affordance everywhere it appears:
//   Edit (pencil + text)                staff-editable via the record path
//   Request change (corner-up-right)    review-mediated, existing flow only
//   lock badge (lock + muted label)     read-only, tooltip says why
// Role gating HIDES affordances (locked prop); layout never changes by role.

import { useEffect, useRef } from "react";
import { ChevronRight, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Text-link affordance treatment (Edit / Request change) — visually small,
 *  ≥44px effective target (WCAG 2.5.8). */
export const ROW_LINK = cn(
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm text-[13px] font-medium leading-[18px] text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
  RING
);

/** Muted "Not recorded" for empty values — never a bare em dash. Catches the
 *  registry summaries' "—" strings centrally (they're shared with settings
 *  and stay untouched). */
export function displayOrEmpty(v: React.ReactNode): React.ReactNode {
  return v == null || v === "" || v === "—" ? (
    <span className="text-[var(--text-muted)]">Not recorded</span>
  ) : (
    v
  );
}

/** Affordance calming (surface pass, Phase 3) — on fine pointers the labeled
 *  affordance rests as a quiet chevron and reveals on row hover; keyboard
 *  focus reveals identically (the control stays focusable at opacity-0, so
 *  Tab reaches it and group-focus-within flips the reveal — WCAG 2.4.7 /
 *  2.1.1). Coarse pointers never see the chevron: the label is always
 *  visible, exactly the pre-pass behavior. Pure CSS via Tailwind v4's
 *  pointer-fine variant — no JS pointer detection. The label's width is
 *  always reserved (opacity swap, absolute chevron) so nothing reflows. */
function RevealOnHover({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center">
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 hidden text-[var(--text-muted)] transition-opacity pointer-fine:inline-flex pointer-fine:group-hover:opacity-0 pointer-fine:group-focus-within:opacity-0"
      >
        <ChevronRight className="size-4" />
      </span>
      <span className="inline-flex transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
        {children}
      </span>
    </span>
  );
}

/** Locked affordance: lock + muted label, tooltip explains why. Native
 *  title tooltip is the interim — no tooltip primitive exists in ui/
 *  (gaps.md #82); the reason is also in the accessible name. ALWAYS visible
 *  on every device — a lock that appears on hover reads as a bug. */
export function LockBadge({
  label,
  reason,
}: {
  label: string;
  reason: string;
}) {
  return (
    <span
      title={reason}
      tabIndex={0}
      aria-label={`${label} — ${reason}`}
      className={cn(
        "inline-flex min-h-11 shrink-0 cursor-default items-center gap-1.5 rounded-sm text-[13px] font-medium leading-[18px] text-[var(--text-muted)]",
        RING
      )}
    >
      <Lock className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export type RecordRowState = "read" | "edit" | "saving" | "error" | "saved";

export interface RecordRowProps {
  label: string;
  /** Read-state display — pass through displayOrEmpty at the call site. */
  value: React.ReactNode;
  /** Muted line under the value (the record's audit line). */
  hint?: string;
  /** Status chip (In review / Changes requested) — right cluster. */
  chip?: React.ReactNode;
  /** Prebuilt affordance (e.g. the Request change link) — right cluster. */
  secondaryAction?: React.ReactNode;
  /** Role gating: hide the Edit affordance, change nothing else. */
  locked?: boolean;
  /** Locked-field treatment (org-managed etc.) — lock icon + label + why. */
  lock?: { label: string; reason: string };
  state: RecordRowState;
  onEditStart: () => void;
  onCancel: () => void;
  onSave?: () => void;
  errorMessage?: string;
  saveDisabled?: boolean;
  /** Editor content shown in edit/saving/error states. */
  children?: React.ReactNode;
}

export function RecordRow({
  label,
  value,
  hint,
  chip,
  secondaryAction,
  locked = false,
  lock,
  state,
  onEditStart,
  onCancel,
  onSave,
  errorMessage = "That didn't save. Try again.",
  saveDisabled = false,
  children,
}: RecordRowProps) {
  const editing = state === "edit" || state === "saving" || state === "error";
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(editing);

  // Focus follows the mode (WCAG 2.4.3) — same contract as EditRow.
  useEffect(() => {
    if (editing && !wasEditing.current) {
      const el = bodyRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, [role="combobox"], button:not([data-row-cancel])'
      );
      el?.focus();
    } else if (!editing && wasEditing.current) {
      editBtnRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  if (!editing) {
    const editAffordance =
      lock || locked ? null : (
        <button
          ref={editBtnRef}
          type="button"
          onClick={onEditStart}
          aria-label={`Edit ${label}`}
          className={ROW_LINK}
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </button>
      );
    return (
      // ~12px vertical row padding lives on the text columns; the affordance
      // keeps its own ≥44px target and centers against them. `group` drives
      // the hover/focus reveal; the hover tint is one step down (canvas tone
      // inside the card) and only ever applies on hover-capable devices
      // (Tailwind v4 gates hover: behind media (hover:hover)).
      <div
        className={cn(
          "group flex items-center gap-4 rounded-lg transition-colors",
          // Tint only rows that actually reveal something — a hover tint on
          // an inert row implies interactivity it doesn't have.
          (secondaryAction || editAffordance) &&
            "hover:bg-[var(--surface-s1)] focus-within:bg-[var(--surface-s1)]"
        )}
      >
        <span className="w-[120px] shrink-0 self-start py-3 text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {label}
        </span>
        <div className="min-w-0 flex-1 py-3">
          <div className="text-[14px] leading-[20px] text-[var(--text-primary)]">
            {value}
          </div>
          {hint && (
            <div className="mt-0.5 text-[12px] leading-[16px] text-[var(--text-muted)]">
              {hint}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {state === "saved" && (
            <span
              role="status"
              className="text-[13px] leading-[18px] text-[var(--text-secondary)]"
            >
              Saved.
            </span>
          )}
          {chip}
          {/* Edit / Request change calm to a chevron at rest (fine pointers
              only); lock badges and chips never hide. */}
          {(secondaryAction || editAffordance) && (
            <RevealOnHover>
              <span className="flex items-center gap-3">
                {secondaryAction}
                {editAffordance}
              </span>
            </RevealOnHover>
          )}
          {lock && <LockBadge label={lock.label} reason={lock.reason} />}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={bodyRef}
      role="group"
      aria-label={`Editing ${label}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && state !== "saving") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="flex items-start gap-4"
    >
      <span className="w-[120px] shrink-0 py-3 text-[13px] leading-[18px] text-[var(--text-secondary)]">
        {label}
      </span>
      <div className="min-w-0 flex-1 space-y-4 py-3">
        {children}

        {state === "error" && (
          <div className="flex items-center gap-3 text-[14px] leading-[20px] text-[var(--state-error)]">
            <span>{errorMessage}</span>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className={cn(
                  "rounded-sm font-medium underline underline-offset-2",
                  RING
                )}
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* Outline Save — the header primary is the page's ONE filled
            button (Phase 2 restraint rules). */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            disabled={saveDisabled || state === "saving"}
            className="min-h-11 rounded-full px-5"
          >
            {state === "saving" ? "Saving…" : "Save"}
          </Button>
          <button
            data-row-cancel
            type="button"
            onClick={onCancel}
            disabled={state === "saving"}
            className={cn(
              "inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)] disabled:opacity-50",
              RING
            )}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
