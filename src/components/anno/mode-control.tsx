"use client";

// THE MODE CONTROL — R1. Lives in the dev bar's annotation cluster (group 3).
//
// ═══ A RADIOGROUP, BECAUSE THE STATES ARE EXCLUSIVE ═══
//
// Off / View / Place are three readings of one question, so this is one control
// with three options — the same shape as the bar's existing role switch, and the
// same visual treatment. Three separate toggles would permit combinations that
// mean nothing and would make the reader assemble the mode in their head.
//
// ═══ IT FITS THE RESERVATION anno-03 MADE ═══
//
// 132px at `md` and up, 60px below — the widths `dev-bar.tsx` exports and
// `devBarSlotWidthsAgree()` guards. Below `md` the labels drop to initials and
// the unresolved count survives, which is the collapse anno-03 specified.

import { useEffect, useState } from "react";
import { annotationStore } from "@/lib/anno";
import { MessageSquare } from "lucide-react";
import {
  MODE_HINT,
  MODE_LABEL,
  setDrawerOpen,
  setMode,
  useAnnoMode,
  useDrawerOpen,
  type AnnoMode,
} from "@/lib/anno/mode";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const ORDER: AnnoMode[] = ["off", "view", "place"];

/** Below `md` there is room for one character each. `Off` keeps its O, `View` its
 *  V, `Place` its P — no two collide, so nothing needs inventing. */
const SHORT: Record<AnnoMode, string> = { off: "O", view: "V", place: "P" };

/** ═══ THE COUNT IS FETCHED HERE, NOT PASSED IN ═══
 *
 *  The dev bar hosts this control but should know nothing about comments, so the
 *  count is this component's own business. Fetched regardless of mode — a reader
 *  with the layer Off still benefits from knowing there is something to turn on,
 *  and hiding the count until they turn it on is how a feature stays undiscovered.
 *
 *  A failed fetch resolves to 0 rather than surfacing an error: the badge is an
 *  invitation, and a store outage is the layer's problem to report, not the
 *  badge's. */
function useUnresolvedCount(): { n: number; reachable: boolean } {
  const [n, setN] = useState(0);
  /** ═══ DISABLED IS A MEASURED STATE, NOT A GUESS ═══
   *  The control goes disabled only after a real failed read. Starting disabled
   *  would hide the feature on every cold load; starting enabled and staying
   *  enabled through an outage would offer a mode that cannot work. */
  const [reachable, setReachable] = useState(true);
  useEffect(() => {
    let alive = true;
    const store = annotationStore();
    const count = (cs: readonly { deletedAt: string | null; status: string }[]) =>
      cs.filter((c) => !c.deletedAt && c.status === "open").length;

    /* ONE request, at mount. After that the subscription reads the cache — see
       the note in `anno-layer.tsx` on why a subscriber must not call `list()`. */
    store
      .list()
      .then((cs) => {
        if (!alive) return;
        setN(count(cs));
        setReachable(true);
      })
      .catch(() => {
        if (!alive) return;
        setN(0);
        setReachable(false);
      });
    const unsub = store.subscribe(() => {
      if (alive) setN(count(store.snapshot()));
    });
    /* `alive` has to be flipped by the cleanup, not just declared. Without this
       an in-flight `list()` can resolve after unmount and setState on a dead
       component — lint caught it as a never-reassigned binding, which is the same
       defect seen from the other side. */
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return { n, reachable };
}

export function AnnoModeControl() {
  const mode = useAnnoMode();
  const drawerOpen = useDrawerOpen();
  const { n: unresolved, reachable } = useUnresolvedCount();

  return (
    <div className="flex items-center gap-1">
      <div
        role="radiogroup"
        aria-label="Comment layer"
        className="flex shrink-0 items-center gap-0.5"
      >
        {ORDER.map((m) => {
          const on = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMode(m)}
              /* Off stays available during an outage — a reviewer must always be
                 able to turn the layer off, even when nothing else works. */
              disabled={!reachable && m !== "off"}
              title={
                !reachable && m !== "off"
                  ? "Comment store unreachable — the layer can't load or save."
                  : MODE_HINT[m]
              }
              className={cn(
                // THE ROLE SWITCH'S OWN CLASSES, deliberately identical — the bar
                // introduces nothing new visually.
                "rounded-full px-2 py-1 font-semibold transition-colors",
                on
                  ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                "disabled:opacity-40 disabled:hover:bg-transparent",
                RING
              )}
            >
              <span className="hidden md:inline">{MODE_LABEL[m]}</span>
              <span className="md:hidden">{SHORT[m]}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ THE DRAWER TOGGLE CARRIES THE COUNT ═══
          The badge belongs to the thing that opens the list, not to the mode
          switch — the count is an answer to "is there anything to read", and the
          toggle is where you go to read it. It survives the icon-only collapse,
          per anno-03's Appendix B note. Hidden at zero: a badge reading 0 claims
          something is there.

          ALWAYS ENABLED, even during an outage — the drawer is where the store
          error is explained, so disabling the way in would hide the explanation. */}
      <button
        type="button"
        aria-label={
          unresolved > 0
            ? `Comments — ${unresolved} unresolved`
            : "Comments"
        }
        title={unresolved > 0 ? `Comments — ${unresolved} unresolved` : "Comments"}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(!drawerOpen)}
        data-anno-drawer-toggle
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 transition-colors",
          drawerOpen
            ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <MessageSquare className="size-3.5" aria-hidden />
        {unresolved > 0 && (
          <span
            aria-hidden
            className="rounded-full px-1 text-[10.5px] font-semibold tabular-nums"
            style={{ background: "#7b5bd6", color: "#ffffff", boxShadow: "0 0 0 1px #6e6b67" }}
          >
            {unresolved}
          </span>
        )}
      </button>
    </div>
  );
}
