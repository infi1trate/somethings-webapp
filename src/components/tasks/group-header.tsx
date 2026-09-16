"use client";

// ═══ THE GROUP HEADER — ONE COMPONENT, BOTH SURFACES, NEVER FORKED ═══
//
// ═══ WHY IT IS STICKY, AND WHY THAT IS LOAD-BEARING RATHER THAN POLISH ═══
//
// arch-D takes the task type off the Tasks row and the tier off the Monitoring
// row, because a chip that is identical on every row in its neighbourhood is not
// information (§3.3). THIS is where that information went. A reader forty rows
// into "Clinical review" has nothing else on screen telling them which tier they
// are in — so a header that scrolled away would not be a lost nicety, it would be
// the removal of a fact with no replacement.
//
// It sticks to the LIST'S OWN SCROLLER, which is why the scroll lives on the
// worklist card rather than on the page column: a sticky element sticks to its
// scrolling ancestor, and with the scroll outside the card these headers stuck to
// a box whose top edge the reader could not see and scrolled away like rows.
//
// ═══ ONE TREATMENT FOR EVERY HEADER ON A SURFACE ═══
//
// The defect arch-D was asked to fix: on Tasks the first header appeared to sit
// in a bordered band while later ones read as inline dividers. MEASURED, both
// were the same component with byte-identical computed styles — sticky, top 0,
// z 10, 34px, 12px/400, `--text-muted`, zero borders. THE FRAME SUPPLIED THE
// DIFFERENCE: the first header sits at the top of a card with a 1px border, a
// 20px radius and `overflow-hidden`, so the card wrapped it on three sides, while
// later headers were bounded by the rows' own `border-t` hairlines.
//
// So the fix is not to change a treatment but to stop borrowing one. Every header
// draws its own hairline above itself and none inherits the card's. That also
// earns its keep when the header is stuck: it is the line that separates a
// pinned header from the row sliding underneath it, which the borrowed frame
// could never do because it was not attached to the header at all.
//
// ═══ SENTENCE CASE, TABULAR FIGURES, NO MONO, NO UPPERCASE ═══
//
// All caps strips the ascenders and descenders that make "Imminent" recognisable
// in peripheral vision, which is exactly how a reader forty rows down uses it.
// `tabular-nums` because the counts tick down as a supervisor works, and
// proportional figures shift the whole line each time one does.
//
// `--type-field-label`, not a hand-rolled size: the token exists and this is the
// stop it names. Its weight is 400 and that is not a compromise — Lausanne ships
// 400 ONLY, measured (a 14px string is 154.75px wide at 400, 500, 600 and 700
// alike), so a `font-semibold` here would be a declaration with no rendering
// behind it.

import { useEffect, useState } from "react";
import { bandHeaderLabel, retiredBandLabel, type TierBand } from "@/lib/tasks/bands";
import { cn } from "@/lib/utils";

/** The header's own height, and the virtualizer's constant for it. Exported so
 *  the offset arithmetic and the rendered box cannot drift apart. */
export const GROUP_HEADER_H = 34;

/** How long a cleared band's rows take to compress away. The brief's number.
 *  Short enough to read as the list settling, long enough to be seen at all. */
export const RETIRE_MS = 160;

const SHELL =
  "sticky top-0 z-10 flex items-center border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 [font:var(--type-field-label)] [letter-spacing:var(--type-field-label-tracking)] text-[var(--text-muted)]";

export function WorklistGroupHeader({
  label,
  /** ═══ THE BUCKET CARRIES THE BREACH (arch-G, G1) ═══
   *  Breach was expressed three times on one row: this header said "Overdue",
   *  the row carried an Overdue chip, and the deadline column said "overdue by
   *  9h". The header is the right owner — it is the thing that groups them — so
   *  it takes the treatment and the rows drop the chip. Text and ink, never ink
   *  alone: the word "Overdue" is in the label. */
  tone = "quiet",
  /** Null while the rows have not arrived — the band NAMES itself and withholds
   *  the number, because a placeholder count is a figure that is wrong for 240ms
   *  and the name is the half already known. */
  count,
  className,
}: {
  label: string;
  count: number | null;
  className?: string;
  tone?: "quiet" | "breach" | "respond";
}) {
  return (
    <div
      aria-hidden
      style={{ height: GROUP_HEADER_H }}
      className={cn(
        SHELL,
        tone === "breach" && "bg-[var(--band-clay-bg)] text-[var(--band-clay-fg)]",
        /* THE ONE SATURATED FILL IN THE TASKS LIST (arch-G, G2) — a live
           escalation's bucket, and nothing else on the surface. */
        tone === "respond" &&
          "bg-[var(--task-respond-bg)] text-[var(--task-respond-fg)] font-semibold",
        className
      )}
    >
      <span className="tabular-nums">
        {count === null ? label : `${label} — ${count}`}
      </span>
      {count === null && (
        <span className="ml-2 inline-block h-2 w-6 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
      )}
    </div>
  );
}

/** The header of a band that is on its way out. Same shell, different sentence.
 *
 *  IT WAS A SECOND COPY OF THE SHELL, ninety characters of class string declared
 *  twice — which is how two things that must look identical stop doing so. It
 *  renders `WorklistGroupHeader` now and differs only in what it says. */
export function RetiredGroupHeader({
  label,
  closedToday,
}: {
  label: string;
  closedToday: number;
}) {
  return <WorklistGroupHeader label={retiredBandLabel(label, closedToday)} count={null} />;
}

/** ═══ A BAND ON ITS WAY OUT ═══
 *
 *  Mounts at the height its rows occupied and compresses to zero, so the list
 *  settles rather than jumps. The header stays for a beat and reports the
 *  clearance as a fact — see `retiredBandLabel` for why it does not celebrate.
 *
 *  `motion-reduce:transition-none` is not decoration: a 160ms height collapse is
 *  exactly the kind of unrequested movement `prefers-reduced-motion` exists to
 *  suppress, and with it the band simply appears cleared and then goes. */
export function RetiringBand({
  label,
  closedToday,
  height,
}: {
  label: string;
  closedToday: number;
  /** The height its rows occupied, which is what compresses to zero. */
  height: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // A frame later, so the browser has a start value to animate FROM. Setting
    // both heights in one commit animates nothing.
    const id = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div role="group" aria-label={retiredBandLabel(label, closedToday)}>
      <RetiredGroupHeader label={label} closedToday={closedToday} />
      <div
        aria-hidden
        style={{
          height: collapsed ? 0 : height,
          transitionProperty: "height",
          transitionDuration: `${RETIRE_MS}ms`,
          transitionTimingFunction: "ease-out",
        }}
        className="overflow-hidden motion-reduce:transition-none"
      />
    </div>
  );
}

/** The header line a band's accessible label uses, so the group's name and the
 *  rendered header cannot disagree. Re-exported rather than re-derived. */
export { bandHeaderLabel };
export type { TierBand };
