"use client";

// DSM-5 CHANGE FLOW (MO-9.1 Prompt C, Phase 4) — supervisor tier only.
//
// TWO STEPS, ALWAYS. Search, then a confirm screen showing before → after. A
// diagnosis change on a minor's record does not happen on a single click, so
// selecting a row NEVER commits: it advances to confirm, and confirming only
// POPULATES the review slot's recommendation. The provider-note requirement
// still stands between that and the record — every path that changes a code goes
// through the same approve-with-note gate.
//
// The lookup lives behind lib/record/dsm5.ts (one module, mock fixture, real
// source TBD per the PRD). This component knows nothing about where codes come
// from beyond `searchDsm5` / `commonDsm5`.
//
// Radix Dialog gives the focus trap and Escape; the search input takes initial
// focus because typing is the only thing anyone opens this to do.

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/settings/pill-button";
import { searchDsm5, type Dsm5Entry } from "@/lib/record/dsm5";
import type { PresentationRef } from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** One side of the before → after comparison. */
function Side({
  label,
  value,
}: {
  label: string;
  value: PresentationRef | null;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[var(--text-muted)]" style={LABEL_STYLE}>
        {label}
      </p>
      {value ? (
        <>
          <p className="font-display text-[15px] font-bold leading-[20px] text-[var(--text-primary)]">
            {value.statement}
          </p>
          <p className="mt-0.5 text-[13px] leading-[18px] tabular-nums text-[var(--text-secondary)]">
            {value.code}
          </p>
        </>
      ) : (
        <p className="text-[15px] leading-[20px] text-[var(--text-muted)]">
          {/* TODO-COPY */}
          Not yet assigned
        </p>
      )}
    </div>
  );
}

export function Dsm5SearchDialog({
  open,
  onOpenChange,
  current,
  onSelect,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is on record — the "before" half of the confirm step. */
  current: PresentationRef | null;
  /** Fires ONLY from confirm, and only populates the recommendation. */
  onSelect: (entry: Dsm5Entry) => void;
  /** The control that opened this, captured by the owner at click time. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  // The ref lives OUT here so it survives the body's remounts and the initial
  // focus handler can reach the input.
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent is rendered UNCONDITIONALLY — Radix's own Presence mounts
          and unmounts it, which is what keeps focus restore working: gating it on
          `open` ourselves tore the content out before Radix could return focus to
          the trigger, dumping a keyboard user at the top of the app. The stateful
          body sits INSIDE, so it still gets fresh state on every open (no
          reset-in-an-effect, no stale selection from last time). */}
      <DialogContent
        className="sm:max-w-lg"
        // FOCUS RESTORE, EXPLICIT AND CAPTURED AT CLICK TIME. Radix's default
        // close-autofocus did not return focus to the trigger in this app
        // (measured: focus landed on <body> with the trigger still mounted), and
        // capturing activeElement in onOpenAutoFocus is too late — focus has
        // already moved by then. The owner captures the trigger in its click
        // handler and hands it down. Without this, a keyboard user is dropped at
        // the top of a long clinical page every time they escape this dialog.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          // Typing is the only reason anyone opens this.
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo?.current?.focus();
        }}
      >
        <Dsm5SearchBody
          current={current}
          onSelect={onSelect}
          onOpenChange={onOpenChange}
          inputRef={inputRef}
        />
      </DialogContent>
    </Dialog>
  );
}

function Dsm5SearchBody({
  current,
  onSelect,
  onOpenChange,
  inputRef,
}: {
  current: PresentationRef | null;
  onSelect: (entry: Dsm5Entry) => void;
  onOpenChange: (open: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Dsm5Entry | null>(null);

  const results = useMemo(() => searchDsm5(query), [query]);
  const browsing = query.trim() === "";

  return (
      <>
        {picked ? (
          <>
            <DialogHeader>
              {/* TODO-COPY */}
              <DialogTitle>Confirm the presentation change</DialogTitle>
              <DialogDescription>
                {/* TODO-COPY — this described the retired pending flow ("moves
                    this into the review, where it still needs your provider
                    note"). Confirming now opens the care update that documents
                    the change, and the change is applied when that saves. */}
                Confirming opens the care update that documents this change.
                Nothing changes on the record until you save it.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3.5">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-4 sm:flex-nowrap">
                {/* TODO-COPY */}
                <Side label="On record" value={current} />
                <ArrowRight
                  className="mt-5 hidden size-4 shrink-0 text-[var(--text-muted)] sm:block"
                  aria-hidden
                />
                {/* TODO-COPY */}
                <Side
                  label="Changing to"
                  value={{ statement: picked.statement, code: picked.code }}
                />
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className={cn(
                  "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
                  RING
                )}
              >
                {/* TODO-COPY */}
                Back to search
              </button>
              <PillButton
                onClick={() => {
                  onSelect(picked);
                  onOpenChange(false);
                }}
              >
                {/* TODO-COPY — "Confirm", not "Save": nothing is saved here. */}
                Confirm
              </PillButton>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              {/* TODO-COPY */}
              <DialogTitle>Find a presentation</DialogTitle>
              <DialogDescription>
                {/* TODO-COPY */}
                Search by code or by wording. Nothing changes until you confirm.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search presentations by code or wording"
                /* TODO-COPY */
                placeholder="F41.1, or “generalized anxiety”"
                className={cn(
                  "h-11 w-full rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] pl-9 pr-3",
                  "text-[15px] leading-[20px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  RING
                )}
              />
            </div>

            {/* Common presentations BEFORE the user types — an empty box that
                asks a supervisor to recall a code from memory is a worse start
                than the handful this population actually presents with. */}
            <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
              {/* TODO-COPY */}
              {browsing
                ? "Common presentations"
                : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
            </p>

            <ul
              className="max-h-72 overflow-y-auto rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] [&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]"
              aria-label="Presentation results"
            >
              {results.length === 0 ? (
                <li className="px-3.5 py-4 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                  {/* TODO-COPY */}
                  No presentation matches that. Try a code like F41, or a word
                  from the wording.
                </li>
              ) : (
                results.map((r) => {
                  const isCurrent = r.code === current?.code;
                  return (
                    <li key={r.code}>
                      <button
                        type="button"
                        onClick={() => setPicked(r)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--tint-hover)]",
                          RING
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          {/* Statement primary, code secondary — a code is not
                              readable by everyone who reads this record. */}
                          <span className="block text-[15px] leading-[20px] text-[var(--text-primary)]">
                            {r.statement}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-[18px] tabular-nums text-[var(--text-muted)]">
                            {r.code}
                          </span>
                        </span>
                        {isCurrent && (
                          <span
                            className="shrink-0 rounded-full bg-[var(--surface-s1)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]"
                          >
                            {/* TODO-COPY — so nobody "changes" to what's already
                                on record without noticing. */}
                            On record
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </>
  );
}
