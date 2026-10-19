"use client";

// THE UNDO WINDOW'S WIRING, SHARED BY EVERY WORKLIST SURFACE.
//
// ═══ WHY THIS IS A HOOK AND NOT COPIED INTO THE SECOND SURFACE ═══
//
// arch-B adds Monitoring, which resolves flags exactly as Tasks resolves billing
// reviews: mark resolved, advance, open a six-second window, toast. Everything
// about WHICH row comes next differs between the two surfaces — teen groups,
// bands, an escalation region — and none of the timing does.
//
// The timing is also the part where a divergence would be invisible and serious.
// §6 is a rule about when an event reaches the activity ledger, and the two ways
// it goes wrong are a pending write lost on navigation and a window that keeps
// running while a keyboard user is reading the toast. Neither shows up on screen:
// the first looks like a successful resolve, the second looks like an Undo button
// that stopped working. Two copies of that would eventually be two behaviours,
// and nobody would notice which page had which.
//
// SO THE SPLIT IS: this owns the pending handle, the boundary flush, the focus
// pause and the toast. The caller owns the list — what to mark, where to move,
// and what the toast is called.
//
// NOTHING HERE APPENDS TO THE LEDGER. `resolveWithUndo` does that, when the
// window closes.

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UNDO_WINDOW_MS, resolveWithUndo, type ResolveHandle } from "@/lib/tasks/resolve";
import type { TaskItem } from "@/lib/tasks/types";

export interface ResolveUndoOptions {
  /** What the toast says for this item — "Flag closed", "Billing review
   *  completed". The verb matches the work so a reader resolving several in a row
   *  can tell which one the toast is about. */
  toastLabel: (item: TaskItem) => string;
  /** Put the row back. Called on undo, whether or not the event was written. */
  onRestore: (item: TaskItem) => void;
  /** Take the row out and move the selection. Called once, synchronously, before
   *  the window opens. */
  onResolved: (item: TaskItem, detail: Record<string, unknown>) => void;
  /** ═══ THE WINDOW CLOSED AND THE EVENT WAS WRITTEN (arch-F, F4) ═══
   *  The same instant the ledger write happens — §6's rule — which is when a
   *  closed item may finally become a closed record. Not called on undo: an
   *  undone item was never completed and must never appear there. */
  onCommitted?: (item: TaskItem, detail: Record<string, unknown>) => void;
}

export interface ResolveUndoApi {
  /** Resolve an item and open its undo window. */
  resolve: (item: TaskItem, detail: Record<string, unknown>) => void;
  /** Undo whatever is pending, if anything. Bound to `u`. */
  undo: () => void;
}

export function useResolveUndo(opts: ResolveUndoOptions): ResolveUndoApi {
  const pending = useRef<ResolveHandle | null>(null);
  /** ═══ THE CALLBACKS, BEHIND A REF, WRITTEN IN AN EFFECT ═══
   *
   *  The ref is what lets the two document listeners below mount once for the
   *  life of the surface: a caller rebuilds these handlers on every render —
   *  any page holding list state does — and re-registering `focusin`/`focusout`
   *  on every keystroke would be both wasteful and a source of missed events.
   *
   *  THE WRITE IS IN AN EFFECT, NOT IN THE RENDER BODY. `latest.current = opts`
   *  during render is what the compiler's lint rejects, and it is right to:
   *  React may render without committing, so a ref written in render can end up
   *  holding callbacks from a render that never happened. In an effect it is
   *  written once per commit.
   *
   *  THE STALENESS THIS COSTS IS ZERO IN PRACTICE, and worth stating rather than
   *  assuming: every read below happens from a user event or a timer, both of
   *  which run after the commit that set this. There is no path that resolves an
   *  item in the same tick as the render that changed the handler. */
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  /** BOUNDARY EMIT (§6). Unmount and page-hide both count as "the session ended
   *  before the window closed", so the pending event is written rather than lost.
   *  Easy to forget and invisible when missing: without it, closing the tab five
   *  seconds after a resolve silently discards it. */
  useEffect(() => {
    const flush = () => pending.current?.flush();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  /** §7'S FOCUS PAUSE ON THE UNDO TOAST.
   *
   *  ONE LISTENER FOR THE PAGE, aimed at whatever resolve is pending, rather than
   *  handlers on a button sonner renders itself. Scoped by containment so focus
   *  moving BETWEEN elements inside the toast does not resume and re-pause. */
  useEffect(() => {
    const region = () => document.querySelector("[data-sonner-toaster]");
    /** TELL SONNER THE READER IS PRESENT, in the only vocabulary it has.
     *
     *  sonner pauses a toast's timer while `expanded` is true, and sets that from
     *  pointer presence alone — `onMouseEnter` / `onMouseMove` to set,
     *  `onMouseLeave` to clear. There is no focus equivalent and no imperative
     *  pause API, and the toast's duration is captured into a ref at mount, so
     *  re-issuing it with a longer duration does not move a live timer either.
     *
     *  So focus is translated into the presence signal sonner already understands.
     *  `mouseout` rather than `mouseleave` because React derives `onMouseLeave`
     *  from the bubbling event. */
    const signalPresence = (present: boolean) => {
      const ol = region();
      if (!ol) return;
      ol.dispatchEvent(
        present
          ? new MouseEvent("mousemove", { bubbles: true })
          : new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })
      );
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!region()?.contains(e.target as Node)) return;
      if (!pending.current) return;
      // BOTH CLOCKS PAUSE TOGETHER. The window owns the ledger write and sonner
      // owns the visible affordance; if only one paused, the Undo button and the
      // thing it undoes would disagree about how long is left.
      pending.current.pause();
      signalPresence(true);
    };
    const onFocusOut = (e: FocusEvent) => {
      const r = region();
      if (!r?.contains(e.target as Node)) return;
      if (r.contains(e.relatedTarget as Node | null)) return;
      if (!pending.current) return;
      pending.current.resume();
      signalPresence(false);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const resolve = useCallback(
    (item: TaskItem, detail: Record<string, unknown>) => {
      // ONE PENDING RESOLVE AT A TIME. A second resolve flushes the first,
      // because two live windows means two toasts and an ambiguous `u`.
      pending.current?.flush();

      latest.current.onResolved(item, detail);

      const handle = resolveWithUndo({
        item,
        decidedAt: Date.now(),
        detail,
        onCommitted: () => {
          if (pending.current === handle) pending.current = null;
          /* AFTER the handle is cleared, so a consumer that resolves again from
             this callback cannot flush a window that has already closed. */
          latest.current.onCommitted?.(item, detail);
        },
        onUndone: ({ alreadyCommitted }) => {
          if (pending.current === handle) pending.current = null;
          latest.current.onRestore(item);
          if (alreadyCommitted) {
            // HONEST ABOUT THE LEDGER. §6: an event, once written, is never
            // retracted. The row comes back; the record already shows the close.
            /* TODO-COPY */
            toast("Restored. The activity record still shows the close.");
          }
        },
      });
      pending.current = handle;

      /* SONNER OWNS THE VISIBLE LIFETIME; THE WINDOW OWNS THE LEDGER WRITE. Same
         duration, and the focus effect above pauses both together — see there for
         why the pause is expressed as a presence signal rather than a new
         duration or a `toast.dismiss`. */
      toast(latest.current.toastLabel(item), {
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: () => handle.undo() },
      });
    },
    []
  );

  const undo = useCallback(() => pending.current?.undo(), []);

  return { resolve, undo };
}
