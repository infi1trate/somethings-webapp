"use client";

// CaseloadControls (caseload prompt) — the ONE caseload adjuster, shared by
// the lead's mentee modal and the record's Mentorship tab so the two surfaces
// genuinely match. Deliberately SUBTLE: adjusting capacity is a secondary
// action wherever this renders — helper-size type, quiet controls, immediate
// optimistic writes (no Save button).
//
//   Automatic — capacity adjusts by the matching algorithm. TODO-DATA: no
//     algorithm exists in this prototype; the mode is an honest stub (the
//     helper line says what it WOULD do, and the value holds).
//   Custom    — the lead sets total mentee slots by hand with a stepper.
//     Capacity can't drop below the mentor's current mentees.

import { ChevronDown, Minus, Plus } from "lucide-react";
import { SegmentedControl } from "@/components/record/segmented-control";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOnboardingStore, type Caseload } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";

const MAX_TOTAL = 20;

const STEP_BTN =
  "flex size-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Resolve a mentor's caseload: the stored override, else automatic at the
 *  caller-supplied default capacity. */
export function useCaseload(mentorId: string, defaultTotal: number): Caseload {
  const stored = useOnboardingStore((s) => s.caseloads[mentorId]);
  return stored ?? { mode: "automatic", total: defaultTotal };
}

/** CASELOAD READOUT — "3 of 4 mentees" beside the Mentees heading, pressable
 *  when the viewer may adjust it.
 *
 *  This REPLACES an inline row that carried a segmented control, a stepper and
 *  a full helper sentence in the card header: three controls' worth of chrome
 *  permanently on screen to express one number that rarely changes. Now the
 *  number is the affordance and the machinery appears on demand — the popover
 *  has room for the helper copy the header never did.
 *
 *  A read-only viewer gets the same readout with no press surface: nothing here
 *  may look pressable without being pressable. */
export function CaseloadPopover({
  mentorId,
  mentorName,
  currentCount,
  defaultTotal,
  editable,
}: {
  mentorId: string;
  mentorName: string;
  /** Active mentees right now — the floor for custom capacity. */
  currentCount: number;
  /** Capacity when no override is stored. */
  defaultTotal: number;
  editable: boolean;
}) {
  const caseload = useCaseload(mentorId, defaultTotal);
  const label = `${currentCount} of ${caseload.total} mentees`;

  if (!editable) {
    return (
      <p
        className="text-[var(--text-secondary)] tabular-nums"
        style={{ font: "var(--type-row-label)" }}
      >
        {label}
      </p>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Caseload: ${label}. Adjust.`}
          className={cn(
            // Negative margin so the resting readout sits on the same optical
            // line as plain text — the hit area grows, the layout doesn't move.
            "-mx-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 tabular-nums text-[var(--text-secondary)] transition-colors",
            "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          )}
          style={{ font: "var(--type-row-label)" }}
        >
          {label}
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-4">
        <div>
          <p className="font-display text-[14px] font-bold leading-[20px] text-[var(--text-primary)]">
            Caseload
          </p>
          <p
            className="mt-0.5 text-[var(--text-muted)]"
            style={{ font: "var(--type-helper)" }}
          >
            How many mentees {mentorName} holds at once.
          </p>
        </div>
        {/* Stacked in here — the popover has the width the header didn't. */}
        <CaseloadControls
          mentorId={mentorId}
          currentCount={currentCount}
          defaultTotal={defaultTotal}
          className="flex-col items-start gap-3"
        />
      </PopoverContent>
    </Popover>
  );
}

export function CaseloadControls({
  mentorId,
  currentCount,
  defaultTotal,
  className,
}: {
  mentorId: string;
  /** Active mentees right now — the floor for custom capacity. */
  currentCount: number;
  /** Capacity when no override is stored. */
  defaultTotal: number;
  className?: string;
}) {
  const caseload = useCaseload(mentorId, defaultTotal);
  const setCaseload = useOnboardingStore((s) => s.setCaseload);

  const min = Math.max(1, currentCount);
  const setMode = (mode: Caseload["mode"]) =>
    setCaseload(mentorId, { ...caseload, mode });
  const step = (delta: number) =>
    setCaseload(mentorId, {
      ...caseload,
      total: Math.min(MAX_TOTAL, Math.max(min, caseload.total + delta)),
    });

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <SegmentedControl
        size="sm"
        ariaLabel="Caseload mode"
        options={[
          { value: "automatic" as const, label: "Automatic" },
          { value: "custom" as const, label: "Custom" },
        ]}
        value={caseload.mode}
        onChange={setMode}
      />
      {caseload.mode === "custom" ? (
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={caseload.total <= min}
            aria-label="Decrease caseload"
            title={
              caseload.total <= min
                ? "Caseload can't drop below current mentees"
                : "Decrease caseload"
            }
            className={STEP_BTN}
          >
            <Minus className="size-3.5" aria-hidden />
          </button>
          <span
            aria-live="polite"
            className="min-w-8 text-center text-[14px] font-medium tabular-nums text-[var(--text-primary)]"
          >
            {caseload.total}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={caseload.total >= MAX_TOTAL}
            aria-label="Increase caseload"
            className={STEP_BTN}
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
          <span
            className="text-[var(--text-muted)]"
            style={{ font: "var(--type-helper)" }}
          >
            mentee slots
          </span>
        </span>
      ) : (
        <span
          className="min-w-0 text-[var(--text-muted)]"
          style={{ font: "var(--type-helper)" }}
        >
          Caseload adjusts automatically with matching activity.
        </span>
      )}
    </div>
  );
}
