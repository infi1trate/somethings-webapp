"use client";

// THE OBJECT INSPECTOR (A12). Right-hand pane, about the selected row's OBJECT.
//
// NOT THE EVENT PANE SPEC §11 REJECTED, and the difference is the whole design.
// §11 was right that a ledger row is one sentence with nothing behind it — so this
// pane never shows the event. It shows the teen, the mentor or the conversation the
// event happened to, which is what a supervisor stopping on a line actually wants.
//
// IT RENDERS WHAT THE DATA LAYER HANDS IT AND NOTHING ELSE. Three states, and the
// component cannot invent a fourth:
//   · detail === null and nothing selected → "Select an event to see context."
//   · detail === null and a row IS selected → the degraded message. There is no
//     object to describe, because `objectDetailFor` returned null rather than a
//     blanked shape.
//   · detail → the definition list it was given.
//
// THE FIELDS ARE A FLAT LIST, deliberately. Every per-objectType decision was made
// in `inspector.ts`; if a new fact needs a different layout, that is a signal the
// fact belongs somewhere other than this pane.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  DEGRADED_MESSAGE,
  NOTHING_SELECTED_MESSAGE,
  type ObjectDetail,
} from "@/lib/activity/inspector";
import { RecordAvatar } from "@/components/record/record-avatar";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function ObjectInspector({
  detail,
  hasSelection,
}: {
  detail: ObjectDetail | null;
  /** Whether a row is selected at all — it is what separates "nothing chosen yet"
   *  from "chosen, and you may not see it". */
  hasSelection: boolean;
}) {
  return (
    <aside
      /* TODO-COPY */
      aria-label="Context"
      className={cn(
        // `hidden xl:flex` HERE rather than on a wrapper div: this element is the
        // grid item, so it is what stretches to the row's height (A13 §4).
        "hidden overflow-hidden rounded-[var(--radius-elevated)] xl:flex xl:flex-col",
        "border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5"
      )}
    >
      {detail ? (
        <>
          <div className="flex items-center gap-2.5">
            {/* The same per-person tint the row uses, so the pane and the row it
                came from are visibly the same person. A conversation gets its
                teen's tint for the same reason. */}
            <RecordAvatar name={detail.title} size={30} />
            <div className="min-w-0">
              <h2 className="truncate font-display text-[17px] font-bold leading-[24px] text-[var(--text-primary)]">
                {detail.title}
              </h2>
              <p className="text-[12.5px] leading-[16px] text-[var(--text-secondary)]">
                {detail.subtitle}
              </p>
            </div>
          </div>

          <dl className="mt-4 space-y-3">
            {detail.fields.map((f) => (
              <div key={f.label}>
                <dt className="text-[11.5px] font-semibold uppercase leading-[16px] tracking-[0.04em] text-[var(--text-muted)]">
                  {f.label}
                </dt>
                <dd className="mt-0.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* THE ONE LINK OUT. `mt-auto` so it sits at the foot of the pane rather
              than floating under a short field list. */}
          <Link
            href={detail.href}
            className={cn(
              "mt-auto inline-flex min-h-9 items-center gap-1.5 self-start rounded-full pt-6 text-[13px] font-semibold",
              "text-[var(--text-primary)] underline decoration-[color:var(--border-contour)] underline-offset-2",
              "transition-colors hover:decoration-[color:var(--text-primary)]",
              RING
            )}
          >
            {detail.hrefLabel}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </>
      ) : (
        /* BOTH EMPTY STATES ARE STATEMENTS, not apologies, and neither says "you
           have no". A12 supplies both strings verbatim. */
        <p
          className="m-auto max-w-[26ch] text-center text-[13px] leading-[19px] text-[var(--text-secondary)]"
          /* The degraded message replaces content the reader just asked for, so it
             is announced; the resting empty state is not, because it is there
             before anyone asks. */
          role={hasSelection ? "status" : undefined}
        >
          {hasSelection ? DEGRADED_MESSAGE : NOTHING_SELECTED_MESSAGE}
        </p>
      )}
    </aside>
  );
}
