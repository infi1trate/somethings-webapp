"use client";

import { useEffect, useRef } from "react";
import { PillButton } from "@/components/settings/pill-button";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Row lifecycle — parent owns the machine; this component is presentational.
 *  read → (Edit) → edit → (Save) → saving → saved-back-in-read | error
 *  Esc cancels edit/error (never mid-save); focus returns to the Edit button. */
export type EditRowState = "read" | "edit" | "saving" | "error" | "saved";

interface EditRowProps {
  label: string;
  /** Read-state display of the current value ("—" when empty). */
  value: React.ReactNode;
  /** Small clarifier under the value (e.g. “Teens see this as your chat avatar”). */
  hint?: string;
  /** Status chip beside the label (e.g. “In review” — update-review flow). */
  chip?: React.ReactNode;
  /** Full-width callout above the value in read state (review-team note). */
  banner?: React.ReactNode;
  /** Extra read-state action left of Edit (e.g. “Discard change”). */
  secondaryAction?: React.ReactNode;
  /** Locked field: no Edit affordance and NO per-row support text (§4 Phase 9
   *  — the group hosting locked rows renders ONE group-level support line). */
  locked?: boolean;
  state: EditRowState;
  onEditStart: () => void;
  onCancel: () => void;
  /** Save (and error-state retry). Optional for customActions rows that still
   *  want the error line's "Try again" — pass their retry here. */
  onSave?: () => void;
  errorMessage?: string;
  saveDisabled?: boolean;
  /** The editor renders its own action buttons (e.g. phone/email change flows)
   *  — suppress the default Save/Cancel footer. */
  customActions?: boolean;
  /** Editor content shown in edit/saving/error states. */
  children?: React.ReactNode;
  className?: string;
}

// Dense settings row — revised §4 (Phase 2.5): label + current value + a
// right-aligned "Edit" affordance; editing swaps the row content inline.
// Grouped by the parent inside a hairline-divided container. Row spacing and
// the Edit affordance are interim treatments (design-system-gaps.md #29).
export function EditRow({
  label,
  value,
  hint,
  chip,
  banner,
  secondaryAction,
  locked = false,
  state,
  onEditStart,
  onCancel,
  onSave,
  errorMessage = "That didn't save. Try again.",
  saveDisabled = false,
  customActions = false,
  children,
  className,
}: EditRowProps) {
  const editing = state === "edit" || state === "saving" || state === "error";
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(editing);

  // Focus follows the mode: entering edit → first control; leaving → back to
  // the Edit button (WCAG 2.4.3 — no dropped focus).
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
    return (
      <div className={cn("px-[var(--card-pad)] py-2", className)}>
        {banner && <div className="mb-2 mt-1">{banner}</div>}
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
                {label}
              </span>
              {chip}
            </div>
            <div className="truncate text-[15px] leading-[20px] text-[var(--text-primary)]">
              {value}
            </div>
            {hint && (
              <div className="text-[12px] leading-[16px] text-[var(--text-muted)]">
                {hint}
              </div>
            )}
          </div>
          {state === "saved" && (
            <span
              role="status"
              className="shrink-0 text-[14px] leading-[20px] text-[var(--text-secondary)]"
            >
              Saved.
            </span>
          )}
          {secondaryAction}
          {locked ? null : (
            <button
              ref={editBtnRef}
              type="button"
              onClick={onEditStart}
              aria-label={`Edit ${label}`}
              className={cn(
                "flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              Edit
            </button>
          )}
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
      className={cn("px-[var(--card-pad)] py-4", className)}
    >
      <div className="text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="mt-3 space-y-4">
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

        {!customActions && (
          <div className="flex items-center gap-3">
            <PillButton
              onClick={onSave}
              loading={state === "saving"}
              disabled={saveDisabled}
            >
              {state === "saving" ? "Saving…" : "Save"}
            </PillButton>
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
        )}
      </div>
    </div>
  );
}
