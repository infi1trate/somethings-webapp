"use client";

// THE SCENARIO SWITCHER (§2.4).
//
// The data and the registry landed in T1 (a data-only phase); the control needs a
// shell to sit in, so it arrives here with the shell.
//
// SAME VISUAL CONVENTION AS THE EXISTING DEV CHROME (§2.4): dashed border, an
// explicit "Prototype scenarios" label, collapsible, bottom-right — matching the
// Activity ledger's simulator, which is the convention this codebase now has. It
// is dressed as prototype chrome so nobody reviewing a screenshot mistakes it for
// product.
//
// bottom-20 rather than bottom-4: the dev persona toggle is also fixed bottom
// chrome and the two overlap at narrow widths. The Activity simulator already had
// to make the same allowance.

import { useState } from "react";
import { TASK_SCENARIOS } from "@/lib/tasks/seed";
import type { ListState } from "@/components/tasks/worklist";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function TaskScenarioSwitcher({
  activeId,
  onSelect,
  listState,
  onListState,
  activeDomainLabel,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  /** Per-domain list state (§4). The switcher writes it for the ACTIVE tab only,
   *  which is what makes "other tabs unaffected" demonstrable rather than
   *  claimed — switch to error, then switch tabs and watch the others load. */
  listState: ListState;
  onListState: (s: ListState) => void;
  activeDomainLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-[260px]">
      <div className="rounded-[var(--radius-surface)] border border-dashed border-[color:var(--border-contour)] bg-[var(--surface-card)] p-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-sm px-1 py-0.5 text-left",
            "text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]",
            RING
          )}
        >
          {/* TODO-COPY — dev chrome, not product. */}
          Prototype scenarios
          <span aria-hidden>{open ? "–" : "+"}</span>
        </button>
        {open && (
          <ul className="mt-1.5 space-y-0.5">
            {TASK_SCENARIOS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={s.id === activeId ? "true" : undefined}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-[12.5px] leading-[16px] transition-colors",
                    s.id === activeId
                      ? "bg-[var(--surface-s2)] font-semibold text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  {s.label}
                  <span className="block text-[11px] leading-[14px] text-[var(--text-muted)]">
                    {s.description}
                  </span>
                </button>
              </li>
            ))}
            {/* LIST STATE, for the active tab only. Loading and error are not
                properties of the fixtures — there is no fetch here — so they have
                to be simulated to be designed at all (§7's states audit needs
                every one reachable from this switcher). */}
            <li className="mt-2 border-t border-dashed border-[color:var(--border-contour)] pt-2">
              <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {/* TODO-COPY */}
                {activeDomainLabel} list state
              </p>
              <div className="flex flex-wrap gap-1 px-1">
                {(["ready", "loading", "error"] as ListState[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onListState(st)}
                    aria-current={st === listState ? "true" : undefined}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11.5px] transition-colors",
                      st === listState
                        ? "bg-[var(--surface-s2)] font-semibold text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                      RING
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
