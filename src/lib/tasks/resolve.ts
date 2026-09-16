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
import { isEscalationTask } from "@/lib/tasks/escalation-state";
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
  /** HOLD THE WINDOW OPEN while the reader is reaching for Undo.
   *
   *  §7 asks for the undo timer to pause on focus, and sonner does not do it: it
   *  pauses on pointer hover, pointer drag and page-hidden only (2.0.7 —
   *  `expanded || interacting || isDocumentHidden`). Keyboard focus pauses
   *  nothing. So a reader who tabs toward Undo watches it vanish mid-reach, which
   *  is the one group that needs the window most.
   *
   *  The remaining time is preserved rather than restarted, so pausing cannot be
   *  used — deliberately or accidentally — to extend the window indefinitely and
   *  then resume with a full 6 seconds. Idempotent in both directions. */
  pause(): void;
  resume(): void;
  /** Milliseconds left in the window; 0 once the phase has left `pending`. Exposed
   *  for tests and for anything that wants to render the window. */
  remainingMs(): number;
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
 *  ═══ WHAT LOCKED DECISION 3 ACTUALLY FORBIDS (revised, arch-G) ═══
 *
 *  This threw for EVERY item in the escalation domain: "escalations never resolve
 *  inline". That was right while Tasks had no escalation task type — the only
 *  thing an escalation-domain item could have meant was the escalation itself.
 *
 *  arch-G made the OBLIGATIONS tasks. An `activeEscalation` row is "record what
 *  you did", an `escalationDocumentation` row is "file the note", and completing
 *  either of those closes THE TASK. Neither closes the escalation, whose
 *  lifecycle belongs to the record on Monitoring — which is the thing decision 3
 *  protects, and it is still protected: nothing here can write an ESCALATION_*
 *  event, and the surface has no control that resolves a record.
 *
 *  MEASURED, and this is why the guard had to change rather than be worked
 *  around: with it in place, pressing "Record response" threw on every click.
 *  The pane looked like it had recorded nothing because it HAD recorded nothing,
 *  and a probe asserting "the response does not auto-advance" passed for the
 *  wrong reason — nothing advanced because nothing resolved. A guard that turns
 *  a feature into a no-op is worse than one that fails loudly, and this one did
 *  both at once.
 *
 *  ═══ AND THEY WRITE NO LEDGER EVENT — DELIBERATELY, FOR NOW ═══
 *
 *  `eventTypeFor` returns null for the escalation domain and nothing here
 *  invents a type. The three that exist are ESCALATION_RAISED / _CLOSED /
 *  _OVERDUE, and writing any of them for a completed TASK would assert a
 *  lifecycle change this surface did not make — precisely decision 3's
 *  violation, arriving through the ledger instead of through the UI.
 *
 *  So the window runs, undo works, the row retires, and Activity shows nothing
 *  until two event types exist for the obligations themselves. That is a gap row
 *  and a question for the Activity surface's owner, not something to paper over
 *  with the closest available label. */
export function resolveWithUndo(opts: ResolveOptions): ResolveHandle {
  const { item, decidedAt, detail, windowMs = UNDO_WINDOW_MS } = opts;

  if (item.domain === "escalation" && !isEscalationTask(item)) {
    /* STILL LOUD for anything else that arrives in this domain. If a third
       escalation task type lands without being added to `isEscalationTask`,
       this is where it stops — rather than silently resolving something nobody
       decided was resolvable here. */
    throw new Error(
      `resolveWithUndo: escalations never resolve inline (locked decision 3). Got ${item.taskType} (${item.id}).`
    );
  }
  if (item.domain !== "escalation" && !eventTypeFor(item)) {
    throw new Error(
      `resolveWithUndo: no ledger event type for domain "${item.domain}".`
    );
  }

  // BUILT NOW, WRITTEN LATER. The draft is held in this closure and nowhere else,
  // so there is no partially-resolved state anyone else can observe or act on.
  const draft = buildResolveEvent(item, decidedAt, detail);

  let phase: Phase = "pending";
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** What is left of the window. Decremented on pause, not recomputed on resume —
   *  see `pause` in the interface for why that matters. */
  let remaining = windowMs;
  /** When the running timer was started, so a pause can subtract correctly.
   *  `null` while paused. */
  let startedAt: number | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    startedAt = null;
  };

  const startTimer = () => {
    if (phase !== "pending" || timer !== null) return;
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = null;
      startedAt = null;
      remaining = 0;
      commit();
    }, remaining);
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

  startTimer();

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
    pause() {
      if (phase !== "pending" || timer === null) return;
      if (startedAt !== null) {
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
      }
      clearTimer();
    },
    resume() {
      if (phase !== "pending" || timer !== null) return;
      if (remaining <= 0) {
        // The window ran out while paused is impossible — a paused window does not
        // run — but a `pause()` at the very last millisecond can land here. Commit
        // rather than start a zero-length timer, which would fire on a later tick
        // and read as a hang.
        commit();
        return;
      }
      startTimer();
    },
    remainingMs() {
      if (phase !== "pending") return 0;
      if (startedAt === null) return remaining;
      return Math.max(0, remaining - (Date.now() - startedAt));
    },
  };
}
