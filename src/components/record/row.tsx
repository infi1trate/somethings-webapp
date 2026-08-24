"use client";

// RecordRow (rebuilt in the visual-quality pass, Prompt 2) — the record's
// grouped-list row. Three-zone grid: label (fixed 168px, row-label token,
// top-aligned to the value's first line), value (flex, row-value token,
// wraps freely), trailing (fixed, right-aligned, vertically centered).
//
// THE ROW IS THE AFFORDANCE (Variant A): the entire row is a button; press
// opens the field's edit/detail surface (inline editor for staff-editable
// fields, the review console for review-mediated fields with an open lane).
// The trailing chevron is honest — it only renders on pressable rows.
// Hover/focus-visible show an INSET rounded highlight (canvas tone, 10px
// radius, 8px in from the card edges, row height minus 4px) — the macOS
// list pattern, never a full-bleed tint. Rows are keyboard-focusable and
// Enter/Space activate (native button). Hit target = the full row, ≥52px.
//
// Variant B (no reachable surface, locked fields, role-gated viewers): no
// chevron, no highlight, no pointer cursor. Locked fields keep the lock +
// reason label in the trailing zone, always visible. Nothing on this page
// may look pressable without being pressable, or the reverse.
//
// Separators are the CARD's job (one rule: `divide-y` top borders, inset by
// card padding, lightest token, square ends — the row box itself carries NO
// radius, so end-caps stay square; the highlight lives on a pseudo-layer).
//
// Same lifecycle vocabulary as before (read / edit / saving / error /
// saved) so the existing state machines (StaffFieldRow, PhotoRowCore,
// SlotRow) drop in unchanged; focus returns to the row on exit (WCAG 2.4.3)
// and Escape cancels (never mid-save).

import { useEffect, useRef } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

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
        "inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-sm font-medium text-[var(--text-muted)]",
        RING
      )}
      style={{ font: "var(--type-row-label)", fontWeight: 500 }}
    >
      <Lock className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export type RecordRowState = "read" | "edit" | "saving" | "error" | "saved";

/** Shared three-zone grid: 168px label · flexible value · trailing. */
const ROW_GRID = "grid grid-cols-[168px_minmax(0,1fr)_auto] gap-x-6";

export interface RecordRowProps {
  label: string;
  /** Read-state display — pass through displayOrEmpty at the call site. */
  value: React.ReactNode;
  /** Muted line under the value (the record's audit line). */
  hint?: string;
  /** Status chip (In review / Changes requested) — trailing, always visible. */
  chip?: React.ReactNode;
  /** Explicit press destination (review-mediated rows: the console deep
   *  link). When omitted, pressable rows fall back to onEditStart. */
  onPress?: () => void;
  /** Role gating: no press surface for this viewer — Variant B. */
  locked?: boolean;
  /** Locked-field treatment (org-managed etc.) — Variant B with a why. */
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
  onPress,
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
  const rowRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(editing);

  // Focus follows the mode (WCAG 2.4.3): entering edit → first control;
  // leaving → back to the row itself.
  useEffect(() => {
    if (editing && !wasEditing.current) {
      const el = bodyRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, [role="combobox"], button:not([data-row-cancel])'
      );
      el?.focus();
    } else if (!editing && wasEditing.current) {
      rowRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  if (!editing) {
    // Variant A when a press surface exists; Variant B otherwise.
    const press = onPress ?? (locked || lock ? undefined : onEditStart);

    const zones = (
      <>
        <span
          className="self-start pt-[3px] text-[var(--text-muted)]"
          style={{
            font: "var(--type-field-label)",
            letterSpacing: "var(--type-field-label-tracking)",
          }}
        >
          {label}
        </span>
        <span className="min-w-0 self-start">
          <span
            className="block text-[var(--text-primary)]"
            // fontVariantNumeric must ride in the SAME style object — the
            // font shorthand resets it, and inline style outranks the
            // tabular-nums utility class.
            style={{
              font: "var(--type-row-value)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </span>
          {hint && (
            <span
              className="mt-0.5 block text-[var(--text-muted)]"
              style={{ font: "var(--type-helper)" }}
            >
              {hint}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3 self-center">
          {state === "saved" && (
            <span
              role="status"
              className="text-[var(--text-secondary)]"
              style={{ font: "var(--type-row-label)" }}
            >
              Saved.
            </span>
          )}
          {chip}
          {lock && <LockBadge label={lock.label} reason={lock.reason} />}
          {press && (
            <ChevronRight
              className="size-3.5 shrink-0 text-[var(--text-muted)]"
              aria-hidden
            />
          )}
        </span>
      </>
    );

    if (press) {
      return (
        // OVERLAY-BEHIND-CONTENT, not a <button> wrapper. Wrapping the row in a
        // button made any interactive child invalid HTML — <button> inside
        // <button>, <a> inside <button> — and React reported a hydration error
        // the moment a display callback rendered SpotifyChip's copy button and
        // its "open in Spotify" link. It also swallowed those clicks into the
        // row's own navigation.
        //
        // So the row is a DIV with `pointer-events-none`, the row's press target
        // is a full-bleed button sitting BEHIND the content, and any genuinely
        // interactive child opts back in with `pointer-events-auto`. Pointer
        // events inherit, so the grid children need no change and the layout is
        // untouched.
        <div
          className={cn(
            // `isolate` scopes the overlay's negative z-index to this row.
            "group relative isolate min-h-13 w-full pointer-events-none py-3.5",
            ROW_GRID
          )}
        >
          {/* The press target AND the inset highlight, one element. 8px in from
              the card edges, row height minus 4px, 10px radius; carries the
              focus ring. -z-10 keeps it behind the row content. */}
          <button
            ref={rowRef}
            type="button"
            onClick={press}
            aria-label={`${label} — open`}
            className="pointer-events-auto absolute -inset-x-4 inset-y-0.5 -z-10 cursor-pointer rounded-[10px] transition-colors hover:bg-[var(--surface-s1)] focus-visible:bg-[var(--surface-s1)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[color:var(--focus-ring)]"
          />
          {zones}
        </div>
      );
    }

    return (
      <div className={cn("min-h-13 w-full py-3.5", ROW_GRID)}>{zones}</div>
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
      className={cn("w-full py-3.5", ROW_GRID)}
    >
      <span
        className="self-start pt-[2px] text-[var(--text-secondary)]"
        style={{ font: "var(--type-row-label)" }}
      >
        {label}
      </span>
      <div className="col-span-2 min-w-0 space-y-4">
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

        {/* Outline Save — the header primary stays the page's ONE filled
            button. */}
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
