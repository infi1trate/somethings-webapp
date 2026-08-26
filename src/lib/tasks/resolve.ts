// ═══════════════════════════════════════════════════════════════════════════
// THE UNDO-WINDOW TIMING RULE (§6). LOAD-BEARING — same protection level as the
// rejection-moment snapshot.
//
//   ACTIVITY EVENTS ARE EMITTED WHEN THE UNDO WINDOW CLOSES, NEVER ON THE
//   RESOLVE CLICK.
//
//   · Undo within the window means NO EVENT IS EVER WRITTEN. Not written and
//     retracted — never written.
//   · If the user navigates away or the session ends before the window closes,
//     emit IMMEDIATELY on that boundary. A resolve that reached a boundary is a
//     resolve the user meant; losing it would be worse than emitting early.
//   · An event, once written, is NEVER RETRACTED by this surface. So `undo` after
//     the window has closed changes the worklist and leaves the ledger alone.
//
// THE WHOLE RULE LIVES IN THIS FILE, in `resolveWithUndo`, and it is a state
// machine with three terminal-or-pending states rather than a pile of booleans —
// because the failure mode is a second code path that emits, and a machine makes
// "emitted" a place you can only arrive at once.
//
// If you are adding a resolve path, call this. Do not append to the ledger
// directly; `appendActivityEvent` exists for this function and the tests.
// ═══════════════════════════════════════════════════════════════════════════

import type { ActivityEvent } from "@/lib/activity/events";
import {
  appendActivityEvent,
  buildResolveEvent,
  eventTypeFor,
} from "@/lib/tasks/ledger";
import type { TaskItem } from "@/lib/tasks/types";

/** The undo window. 6s per §5. */
export const UNDO_WINDOW_MS = 6000;

type Phase = "pending" | "emitted" | "undone";

export interface ResolveHandle {
  /** The item this resolve concerns — for the toast's copy and for reselection. */
  readonly item: TaskItem;
  readonly phase: Phase;
  /** Cancel. Before the window closes: nothing is ever written. After: the
   *  worklist restores the item and the LEDGER IS LEFT ALONE. */
  undo(): void;
  /** BOUNDARY EMIT — navigate away, unmount, session end. Idempotent. */
  flush(): void;
}

export interface ResolveOptions {
  item: TaskItem;
  /** When the supervisor decided. Stamped onto the event, distinct from when the
   *  event is WRITTEN — see buildResolveEvent. */
  decidedAt: number;
  /** Pane-supplied detail: `flaggedCorrectly`, the confirmed code, and so on. */
  detail?: Record<string, unknown>;
  windowMs?: number;
  /** Fires when the window closes and the event has been written — the worklist
   *  uses it to retire the undo toast. */
  onCommitted?: (event: ActivityEvent | null) => void;
  /** Fires when undo lands, whichever phase it lands in. `alreadyCommitted` tells
   *  the caller whether the ledger already holds the event, because the UI copy
   *  differs: an undo that beat the window is silent, one that did not has to be
   *  honest that the record already shows it. */
  onUndone?: (info: { alreadyCommitted: boolean }) => void;
}

/** START A RESOLVE. Returns the handle; nothing is written yet.
 *
 *  ESCALATIONS ARE REFUSED. Locked decision 3: escalations link out to the
 *  escalation flow and never resolve inline. Rather than trusting every caller to
 *  remember, this throws — an escalation reaching here is a bug, and a silent
 *  no-op would hide it while the row vanished from the list. */
export function resolveWithUndo(opts: ResolveOptions): ResolveHandle {
  const { item, decidedAt, detail, windowMs = UNDO_WINDOW_MS } = opts;

  if (item.domain === "escalation") {
    throw new Error(
      `resolveWithUndo: escalations never resolve inline (locked decision 3). Got ${item.taskType} (${item.id}).`
    );
  }
  if (!eventTypeFor(item)) {
    throw new Error(
      `resolveWithUndo: no ledger event type for domain "${item.domain}".`
    );
  }

  // BUILT NOW, WRITTEN LATER. The draft is held in this closure and nowhere else,
  // so there is no partially-resolved state anyone else can observe or act on.
  const draft = buildResolveEvent(item, decidedAt, detail);

  let phase: Phase = "pending";
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timer = null;
    commit();
  }, windowMs);

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  /** THE ONLY PLACE AN EVENT IS WRITTEN. Guarded by the phase, so it cannot run
   *  twice — a flush racing the timer must not double-append. */
  function commit() {
    if (phase !== "pending") return;
    phase = "emitted";
    clearTimer();
    if (draft) appendActivityEvent(draft);
    opts.onCommitted?.(draft);
  }

  return {
    item,
    get phase() {
      return phase;
    },
    undo() {
      if (phase === "pending") {
        // NEVER WRITTEN. The draft is discarded with the closure.
        phase = "undone";
        clearTimer();
        opts.onUndone?.({ alreadyCommitted: false });
        return;
      }
      if (phase === "emitted") {
        // ALREADY IN THE LEDGER, and this surface does not retract. The worklist
        // may still restore the row — the two are different records and only one
        // of them is append-only.
        opts.onUndone?.({ alreadyCommitted: true });
        return;
      }
      // Already undone. Idempotent.
    },
    flush() {
      commit();
    },
  };
}
