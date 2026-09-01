"use client";

// THE PINNED FOOTER — one primary way out, plus secondary actions.
//
// ═══════════════════════════════════════════════════════════════════════════
// NOTHING HERE MAY MUTATE THE SELECTED EVENT. (Activity standing rule 13.)
// ═══════════════════════════════════════════════════════════════════════════
//
// Activity never hosts the control that changes an event's state — that
// authority belongs to Tasks. Every action in this footer is one of exactly
// three kinds:
//
//   · NAVIGATIONAL — go to the record, the conversation, the task.
//   · REFERENTIAL  — copy a link to this event. Reads, does not write.
//   · ADDITIVE     — add a note, which appends a NEW event to the ledger and
//                    leaves the selected one untouched. An append is not a
//                    mutation: the row being read is byte-identical afterwards,
//                    and the note stands beside it as its own entry.
//
// A "Close flag", "Resolve", "Approve" or "Dismiss" button does not belong here
// no matter how convenient it would be — the ledger's premise is that rows never
// change, and a surface that edits them from a side panel breaks the guarantee
// every other rule on this page depends on.
//
// If a future action does not fit one of the three kinds above, it is a Tasks
// action and belongs on that surface.

import Link from "next/link";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export interface SecondaryAction {
  label: string;
  /** Referential or additive only — see the rule above. */
  onClick: () => void;
  icon?: React.ReactNode;
}

export function PaneActions({
  /** The one open-out link. Navigational by definition. */
  primary,
  secondary = [],
}: {
  primary: { href: string; label: string };
  secondary?: SecondaryAction[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Link
        href={primary.href}
        className={cn(
          // The pane's one emphasised control. Not a filled button: a filled
          // button in a footer reads as "commit", and nothing in this footer
          // commits anything.
          "inline-flex min-h-9 items-center gap-1.5 rounded-sm py-1 text-[13.5px] font-semibold text-[var(--text-primary)]",
          "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
          RING
        )}
      >
        {primary.label}
        <span aria-hidden>→</span>
      </Link>

      {secondary.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {secondary.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] text-[var(--text-secondary)]",
                "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
