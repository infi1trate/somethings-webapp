"use client";

// THE FILTER DIALOG. A modal, not a popover.
//
// WHY MODAL. The brief specifies modal dialog semantics, and the reason holds:
// filters are APPLIED ON CLOSE, so there is a moment where what you have chosen
// and what the list shows disagree. A popover that dismisses on any outside click
// makes that moment ambiguous — did clicking the feed apply my choices or discard
// them? A modal has one way out and applies on the way.
//
// FOCUS TRAP AND ESCAPE COME FROM RADIX. Reusing the project's own Dialog rather
// than hand-rolling: it already has the focus trap, the Escape handler, the
// scroll lock and the `onCloseAutoFocus` hook every other dialog in this codebase
// uses to hand focus back to its trigger.
//
// THE CONTROLS ARE HAND-ROLLED ON BLOOM TOKENS. `components/ui/checkbox.tsx` is
// shadcn's and sits on shadcn's token system (`border-input`, `bg-primary`,
// `text-primary-foreground`). Every record surface is on Bloom tokens, and mixing
// the two is how a control ends up ALMOST matching the panel it sits in — the same
// reasoning recorded at the top of record-button.tsx. So these are buttons with
// `role="checkbox"`, which is also what lets the whole row be the target rather
// than a 16px box.
//
// LOCAL DRAFT STATE, COMMITTED ON CLOSE, AND SEEDED BY REMOUNT. The stateful
// body is a separate component INSIDE DialogContent, so Radix's Presence
// unmounts it on close and `useState(applied)` seeds fresh on every open — the
// pattern flag-review-dialog.tsx already documents ("the stateful body sits
// inside, so every open starts clean without a reset-in-an-effect"). The
// alternative, reseeding in an effect, is a synchronous setState inside an effect
// and eslint is right to reject it.

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/settings/pill-button";
import { DOMAIN_FILTERS, toggleDomain, type ActivityFilters } from "@/lib/activity/filters";
import { TEENS, staffFirstName } from "@/lib/activity/seed";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const GROUP_LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";

/** A full-width pressable row with a checkbox affordance. The ROW is the target:
 *  a 16px box beside a label is a target a reader has to aim at, and there is no
 *  reason for the label not to work. */
function CheckRow({
  checked,
  onToggle,
  label,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors",
        "hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          checked
            ? "border-[color:var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverse)]"
            : "border-[color:var(--border-contour)] bg-[var(--surface-card)]"
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] leading-[20px] text-[var(--text-primary)]">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[12px] leading-[16px] text-[var(--text-muted)]">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

/** TEEN TYPEAHEAD — caseload-scoped, and first names only for a DATA reason
 *  rather than a policy one. Standing rule 6 was retired on 2026-08-28 (gap row
 *  284), but the activity fixture stores no surnames for anyone, teens or staff,
 *  so there is nothing fuller to offer here. Fix the fixture and this follows.
 *
 *  Scoped to the caseload rather than the whole roster on purpose: this filter
 *  exists to narrow your own list, and offering every teen in the org as a
 *  suggestion would turn a filter into a directory. */
function TeenTypeahead({
  caseloadTeenIds,
  value,
  onChange,
}: {
  caseloadTeenIds: string[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const options = caseloadTeenIds
    .map((id) => ({
      id,
      name: Object.values(TEENS).find((t) => t.id === id)?.firstName ?? id,
    }))
    // No surname exists to match against — the fixtures contain none.
    .filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const selected = value
    ? Object.values(TEENS).find((t) => t.id === value)?.firstName
    : null;

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-s2)] px-2.5 py-1 text-[13px] text-[var(--text-primary)]">
          {selected}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQ("");
          }}
          className={cn(
            "rounded-full px-2 py-1 text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          {/* TODO-COPY */}
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="px-2">
      <label className="sr-only" htmlFor="activity-teen-filter">
        {/* TODO-COPY */}
        Filter by teen
      </label>
      <input
        id="activity-teen-filter"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        /* TODO-COPY */
        placeholder="Start typing a first name…"
        className={cn(
          "w-full rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3.5 py-2",
          "text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]",
          RING
        )}
      />
      {q.trim().length > 0 && (
        <ul className="mt-1.5 max-h-40 overflow-y-auto">
          {options.length === 0 ? (
            <li className="px-2 py-1.5 text-[13px] text-[var(--text-muted)]">
              {/* TODO-COPY. Non-blaming, with a next step (standing rule 5). */}
              No one on your caseload matches that. Try fewer letters.
            </li>
          ) : (
            options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onChange(o.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  {o.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** STAFF TYPEAHEAD — A5. Renders only in network scope; HIDDEN, not disabled,
 *  in caseload scope. A disabled control advertises a filter that cannot apply
 *  here, which is the same objection standing rule 1 makes about greyed-out
 *  actions. */
function StaffTypeahead({
  staffIds,
  value,
  onChange,
}: {
  staffIds: string[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const selected = value ? staffFirstName(value) : null;
  return (
    <div className="px-2">
      {selected ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[var(--surface-s2)] px-2.5 py-1 text-[13px] text-[var(--text-primary)]">
            {selected}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              "rounded-full px-2 py-1 text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {/* TODO-COPY */}
            Change
          </button>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {staffIds.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                className={cn(
                  "rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-2.5 py-1 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {staffFirstName(id)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FilterDialog({
  open,
  onOpenChange,
  applied,
  onApply,
  caseloadTeenIds,
  /** A5: present only in network scope. Absent hides the staff group entirely. */
  networkStaffIds,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applied: ActivityFilters;
  onApply: (next: ActivityFilters) => void;
  caseloadTeenIds: string[];
  networkStaffIds?: string[];
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  /** The draft lives in `FilterBody` so it cannot outlive one open. This ref is
   *  how the closing handler reads it — the body writes on every change, and
   *  close-by-Escape and close-by-Done both commit the same value. */
  const draftRef = useRef<ActivityFilters>(applied);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // APPLIED ON CLOSE — including on Escape and on the overlay. There is no
        // Cancel: the brief says applied on close, and a dialog with both an
        // apply-on-close contract and a Cancel button has two contradictory ways
        // out. "Reset" beside the trigger is how you undo.
        if (!next) onApply(draftRef.current);
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo?.current?.focus();
        }}
      >
        <FilterBody
          applied={applied}
          caseloadTeenIds={caseloadTeenIds}
          networkStaffIds={networkStaffIds}
          onDraftChange={(d) => {
            draftRef.current = d;
          }}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** MOUNTED FRESH ON EVERY OPEN by Radix's Presence, which is what seeds `draft`
 *  from `applied` without an effect. */
function FilterBody({
  applied,
  caseloadTeenIds,
  networkStaffIds,
  onDraftChange,
  onDone,
}: {
  applied: ActivityFilters;
  caseloadTeenIds: string[];
  networkStaffIds?: string[];
  onDraftChange: (d: ActivityFilters) => void;
  onDone: () => void;
}) {
  const [draft, setDraftState] = useState<ActivityFilters>(applied);
  const setDraft = (fn: (f: ActivityFilters) => ActivityFilters) => {
    setDraftState((prev) => {
      const next = fn(prev);
      onDraftChange(next);
      return next;
    });
  };

  return (
      <>
        <DialogHeader>
          {/* TODO-COPY */}
          <DialogTitle>Filter activity</DialogTitle>
          <DialogDescription>
            {/* TODO-COPY */}
            Filters narrow the view you are in. Switching views clears them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <h3 className={cn(GROUP_LABEL, "px-2")}>
              {/* TODO-COPY */}
              Workflow domain
            </h3>
            <div className="mt-1.5" role="group" aria-label="Workflow domain">
              {DOMAIN_FILTERS.map((d) => (
                <CheckRow
                  key={d.id}
                  checked={draft.domains.includes(d.id)}
                  onToggle={() => setDraft((f) => toggleDomain(f, d.id))}
                  label={d.label}
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className={cn(GROUP_LABEL, "px-2")}>
              {/* TODO-COPY */}
              Additional filters
            </h3>
            <div className="mt-1.5" role="group" aria-label="Additional filters">
              <CheckRow
                checked={draft.includeActions}
                onToggle={() =>
                  setDraft((f) => ({ ...f, includeActions: !f.includeActions }))
                }
                /* TODO-COPY */
                label="Include actions"
                hint="Brings items waiting on someone into the list."
              />
              <CheckRow
                checked={draft.showCleared}
                onToggle={() =>
                  setDraft((f) => ({ ...f, showCleared: !f.showCleared }))
                }
                /* TODO-COPY */
                label="Cleared items"
                hint="Shows what you cleared. Nothing was deleted."
              />
            </div>

            <div className="mt-3 space-y-1.5">
              <h4 className={cn(GROUP_LABEL, "px-2")}>
                {/* TODO-COPY */}
                Specific teen
              </h4>
              <TeenTypeahead
                caseloadTeenIds={caseloadTeenIds}
                value={draft.teenId}
                onChange={(id) => setDraft((f) => ({ ...f, teenId: id }))}
              />
            </div>

            {/* NETWORK SCOPE ONLY — hidden, not disabled. */}
            {networkStaffIds && networkStaffIds.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <h4 className={cn(GROUP_LABEL, "px-2")}>
                  {/* TODO-COPY */}
                  Specific staff
                </h4>
                <StaffTypeahead
                  staffIds={networkStaffIds}
                  value={draft.staffId}
                  onChange={(id) => setDraft((f) => ({ ...f, staffId: id }))}
                />
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <PillButton onClick={onDone} className="h-10 px-5 text-[14px]">
            {/* TODO-COPY. The only way out that is not Escape — and it does the
                same thing Escape does, because filters apply on close. */}
            Done
          </PillButton>
        </DialogFooter>
      </>
  );
}
