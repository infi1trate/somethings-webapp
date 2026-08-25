"use client";

// SHARED PRESENTATION PRIMITIVES.
//
// WAS the presentation spine + cadence card. Prompt A Phase 2 merged both into
// ONE card (care-summary.tsx), so the four components that used to live here —
// PresentationCard, PresentationReference, CadenceCard, PresentationSpine — are
// gone. What remains is what other surfaces import: the clinical date formatter
// (care-review-card, care-update-compose, care-summary, care-ai-summary) and the
// statement/code pair.
//
// CLINICAL DATES ARE EXPLICIT DATES. The elapsed-time standard ("3d", "2 weeks")
// governs secondary lines everywhere else in this product and is deliberately
// SUSPENDED for the provenance line: "assigned 4 months ago" is unusable to
// anyone reconciling this record against an outside provider's notes, and a
// diagnosis date is a fact of record rather than a recency signal. The cadence
// COUNTDOWN keeps the elapsed framing, because a countdown is a distance and not
// a date of record — so the cadence card deliberately carries both forms.


import { type PresentationRef } from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

/** Clinical dates read in full — see the module note on the suspended
 *  elapsed-time standard. */
export const clinicalDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Statement at display weight, code beneath at a smaller size. The plain
 *  statement leads because a code is not readable by the mentor who reads this
 *  page most often. */
export function Statement({
  value,
  size = "display",
}: {
  value: PresentationRef;
  size?: "display" | "compact";
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "font-display font-bold text-[var(--text-primary)]",
          size === "display"
            ? "text-[22px] leading-[28px]"
            : "text-[15px] leading-[20px]"
        )}
      >
        {value.statement}
      </p>
      <p
        className={cn(
          "mt-0.5 tabular-nums text-[var(--text-secondary)]",
          size === "display" ? "text-[14px] leading-[20px]" : "text-[13px] leading-[18px]"
        )}
      >
        {value.code}
      </p>
    </div>
  );
}
