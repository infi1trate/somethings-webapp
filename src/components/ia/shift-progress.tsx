"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE SHIFT TRACK (addendum §2.11, §3.4)
//
// One component, on Risk Flags and on Care Reviews. What it measures differs
// per surface and the SHAPE of the measurement does not: how much of the set
// that arrived this shift has been through a supervisor's hands.
//
// ═══ THE CLINICAL RISK, AND THE TWO RULES THAT COME FROM IT (§3.4) ═══
//
// A completion mechanic rewards throughput, and the failure mode on this
// surface is a supervisor dispositioning faster to finish the bar — on a queue
// of self-harm flags. That is not hypothetical, so two things follow:
//
//  1 · MEASURE COVERAGE, NOT SPEED. No elapsed time, no per-item timing, no
//      rate, no streak, no day-over-day comparison, no comparison to anybody
//      else. Every one of those rewards going faster; coverage rewards going
//      THROUGH. There is no clock in this file.
//  2 · INVEST IN THE ENDING, NOT THE FILLING (Peak-End). The satisfying moment
//      is the completion state, not the bar creeping up — and it cannot be
//      farmed by rushing, because it appears only when the set is actually
//      complete.
//
// ═══ NEVER EXPRESSED AS A REMAINDER ═══
//
// "38 left" is an inbox. The coverage view had this rule before it became Chat
// and it is the one thing that outlived that destination: progress with its
// unit, never a count of what is not done.
//
// ═══ NEVER GREEN ═══
//
// Green on a safety surface reads as a clinical all-clear — "this teen is
// fine" — rather than as task completion. The track runs from the surface step
// to PRIMARY INK, which is the same neutral-to-accent ramp the coverage meter
// used and the one channel on this page that carries no clinical meaning.
//
// ═══ WHAT MAKES IT READ AS AN INSTRUMENT RATHER THAN A QUEST ═══
//
// One continuous track, not segments — segments read as points scored, and a
// row of pips invites counting them. Tabular figures. The NUMERAL carries the
// weight, not the colour. Motion only on change.

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShiftProgress {
  /** How many of the shift's set have been through review. */
  done: number;
  /** The set that arrived this shift. Zero is a real state — see the render. */
  total: number;
}

export function ShiftTrack({
  progress,
  /** NEEDS-COPY-NICOLE. What the figures COUNT, in the surface's own noun —
   *  "flags reviewed", "reviews completed". Never "left", never "remaining". */
  unit,
  /** NEEDS-COPY-NICOLE. The completion line. States the coverage achieved
   *  rather than congratulating: a supervisor who has just been through forty
   *  self-harm flags does not need to be told well done by a progress bar. */
  completeLine,
  className,
}: {
  progress: ShiftProgress;
  unit: string;
  completeLine: string;
  className?: string;
}) {
  const { done, total } = progress;
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  /** ═══ MOTION ON INCREMENT ONLY ═══
   *  The track animates when the figure CHANGES and is inert otherwise. A
   *  transition declared unconditionally also animates the first paint, which
   *  reads as the page filling itself in — the opposite of "no idle motion".
   *  `motion-reduce` drops it entirely rather than shortening it. */
  const [moved, setMoved] = useState(false);
  const last = useRef(done);
  useEffect(() => {
    if (last.current === done) return;
    last.current = done;
    setMoved(true);
    const off = window.setTimeout(() => setMoved(false), 240);
    return () => window.clearTimeout(off);
  }, [done]);

  /* ═══ NOTHING ARRIVED IS NOT ZERO PROGRESS ═══
     An empty set with a track at 0% says a supervisor has done none of the
     work; what is true is that there was none. The component renders nothing,
     and the header's metrics still state the counts. */
  if (total === 0) return null;

  return (
    <div
      data-anno-ref="shift-track"
      data-progress={`${done}/${total}`}
      data-complete={complete ? "true" : "false"}
      className={cn("w-full max-w-[16rem] min-w-0", className)}
    >
      <p className="flex items-baseline justify-end gap-1.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
        {complete ? (
          /* ═══ THE ENDING, AND IT IS QUIET ═══
             No confetti, no sound, no badge, no streak, no comparison. A mark
             and a sentence stating the coverage that was achieved. The mark is
             `--text-primary`, not green: see the module note. */
          <span
            data-anno-ref="shift-complete"
            className="flex items-center gap-1.5 text-[var(--text-primary)]"
          >
            <Check className="size-3.5 shrink-0" aria-hidden />
            {completeLine}
          </span>
        ) : (
          <>
            <span
              className="font-semibold tabular-nums text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {done} of {total}
            </span>
            {unit}
          </>
        )}
      </p>
      <div
        /* `role="img"` WITH A NAME, not `progressbar`: nothing here is loading,
           and a progressbar role tells a screen reader to expect completion of
           an operation it is waiting on. The name states the fraction in
           words, so the track is never the only carrier. */
        role="img"
        aria-label={`${done} of ${total} ${unit}`}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-s2)]"
      >
        <div
          className={cn(
            "h-full rounded-full bg-[var(--text-primary)]",
            moved && "transition-[width] duration-200 ease-out motion-reduce:transition-none"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
