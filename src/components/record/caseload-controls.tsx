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

import { Minus, Plus } from "lucide-react";
import { SegmentedControl } from "@/components/record/segmented-control";
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
