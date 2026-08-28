// THE GUARD ON §6's TIMING RULE — the spec's own words: "same protection level as
// the rejection-moment snapshot."
//
// The rule has four clauses and each one is a separate way to get it wrong:
//   1. nothing is written on the resolve click
//   2. the event is written when the window closes
//   3. undo within the window means NO EVENT IS EVER WRITTEN
//   4. a boundary (navigate away / session end) emits immediately
// plus the invariant that makes them safe: once written, never retracted.
//
// Fake timers throughout, so the window is exercised rather than waited out.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetLedgerForTests,
  activityLedger,
  eventTypeFor,
} from "@/lib/tasks/ledger";
import { UNDO_WINDOW_MS, resolveWithUndo } from "@/lib/tasks/resolve";
import { tasksScenario } from "@/lib/tasks/seed";
import type { TaskItem } from "@/lib/tasks/types";

const NOW = new Date("2026-08-26T20:05:00.000Z").getTime();

const items = () => tasksScenario("typical-shift", NOW);
const pick = (predicate: (i: TaskItem) => boolean): TaskItem => {
  const found = items().find((i) => i.status !== "resolved" && predicate(i));
  if (!found) throw new Error("fixture missing");
  return found;
};

const aFlag = () => pick((i) => i.domain === "riskFlag");
const aBilling = () => pick((i) => i.domain === "billing");
const anEscalation = () => pick((i) => i.domain === "escalation");

beforeEach(() => {
  __resetLedgerForTests();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("§6 clause 1 — nothing is written on the resolve click", () => {
  it("the ledger is empty immediately after resolving", () => {
    resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    expect(activityLedger()).toHaveLength(0);
  });

  it("still empty one millisecond before the window closes", () => {
    resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(activityLedger()).toHaveLength(0);
  });
});

describe("§6 clause 2 — the event is written when the window closes", () => {
  it("exactly one event, of the right type, after the window", () => {
    const item = aFlag();
    resolveWithUndo({ item, decidedAt: NOW });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    const ledger = activityLedger();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].eventType).toBe("RISK_FLAG_CLOSED");
    expect(ledger[0].payload.taskId).toBe(item.id);
  });

  it("a billing resolve writes BILLING_REVIEW_COMPLETE", () => {
    resolveWithUndo({ item: aBilling(), decidedAt: NOW });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(activityLedger()[0].eventType).toBe("BILLING_REVIEW_COMPLETE");
  });

  it("the event's timestamp is when the supervisor decided, not when the timer fired", () => {
    // §6 governs WHEN the write happens; the stamp is the decision's own. If these
    // were the same instant, every ledger row would be six seconds late.
    resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(activityLedger()[0].occurredAt).toBe(new Date(NOW).toISOString());
  });

  it("waiting far past the window does not write a second event", () => {
    resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 10);
    expect(activityLedger()).toHaveLength(1);
  });

  it("onCommitted fires once, with the event", () => {
    const onCommitted = vi.fn();
    resolveWithUndo({ item: aFlag(), decidedAt: NOW, onCommitted });
    expect(onCommitted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onCommitted.mock.calls[0][0].eventType).toBe("RISK_FLAG_CLOSED");
  });
});

describe("§6 clause 3 — undo within the window means NO EVENT IS EVER WRITTEN", () => {
  it("the ledger stays empty, then and later", () => {
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 100);
    handle.undo();
    expect(activityLedger()).toHaveLength(0);
    // AND THE TIMER IS DEAD. A cancelled undo that left the timer running would
    // write the event a moment later and look like a race rather than a bug.
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 5);
    expect(activityLedger()).toHaveLength(0);
  });

  it("undo reports that nothing was committed", () => {
    const onUndone = vi.fn();
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW, onUndone });
    handle.undo();
    expect(onUndone).toHaveBeenCalledWith({ alreadyCommitted: false });
  });

  it("undoing twice is idempotent", () => {
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    handle.undo();
    handle.undo();
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 2);
    expect(activityLedger()).toHaveLength(0);
  });

  it("a flush after an undo writes nothing — undone is terminal", () => {
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    handle.undo();
    handle.flush();
    expect(activityLedger()).toHaveLength(0);
  });
});

describe("§6 clause 4 — a boundary emits immediately", () => {
  it("flush writes the event without waiting for the window", () => {
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    handle.flush();
    expect(activityLedger()).toHaveLength(1);
  });

  it("flush then the window elapsing does not double-write", () => {
    // The race: a flush on unmount while the timer is still armed.
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    handle.flush();
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 3);
    expect(activityLedger()).toHaveLength(1);
    expect(handle.phase).toBe("emitted");
  });

  it("flushing twice writes once", () => {
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    handle.flush();
    handle.flush();
    expect(activityLedger()).toHaveLength(1);
  });
});

describe("§6 invariant — once written, never retracted by this surface", () => {
  it("undo after the window leaves the ledger alone and says so", () => {
    const onUndone = vi.fn();
    const handle = resolveWithUndo({ item: aFlag(), decidedAt: NOW, onUndone });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(activityLedger()).toHaveLength(1);

    handle.undo();
    // THE LEDGER IS UNCHANGED.
    expect(activityLedger()).toHaveLength(1);
    // And the caller is told, because the UI copy has to be honest about it.
    expect(onUndone).toHaveBeenCalledWith({ alreadyCommitted: true });
  });

  it("the ledger module exposes no way to remove an event", async () => {
    const mod = await import("@/lib/tasks/ledger");
    const names = Object.keys(mod);
    for (const forbidden of ["removeActivityEvent", "deleteActivityEvent", "retract", "clearLedger"]) {
      expect(names).not.toContain(forbidden);
    }
    // The one reset that exists is named as a test seam and nothing else.
    expect(names).toContain("__resetLedgerForTests");
  });
});

describe("locked decision 3 — escalations never resolve inline", () => {
  it("resolveWithUndo refuses an escalation loudly rather than no-opping", () => {
    // A silent no-op would hide the bug while the row vanished from the list.
    expect(() => resolveWithUndo({ item: anEscalation(), decidedAt: NOW })).toThrow(
      /never resolve inline/
    );
    expect(activityLedger()).toHaveLength(0);
  });

  it("there is no ledger event type for the escalation domain", () => {
    expect(eventTypeFor(anEscalation())).toBeNull();
  });
});

describe("pane detail rides along on the event", () => {
  it("flaggedCorrectly reaches the payload", () => {
    resolveWithUndo({
      item: aFlag(),
      decidedAt: NOW,
      detail: { flaggedCorrectly: false },
    });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(activityLedger()[0].payload.flaggedCorrectly).toBe(false);
  });

  it("the event carries the ACTIVITY domain, not the Tasks one", () => {
    // Row 208: passing "riskFlag" to Activity would silently match nothing.
    resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(activityLedger()[0].payload.domain).toBe("risk");
  });
});

// ═══ PAUSE / RESUME (§7's "pause timer on focus") ═══════════════════════════
//
// sonner does not pause on keyboard focus, so the window's own timer does. These
// assert the property that makes the pause safe: a pause never GRANTS time.

describe("pause and resume", () => {
  it("holds the window open while paused", () => {
    const onCommitted = vi.fn();
    const h = resolveWithUndo({ item: aFlag(), decidedAt: NOW, onCommitted });
    vi.advanceTimersByTime(3000);
    h.pause();
    // Ten times the window, paused. Nothing is written.
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 10);
    expect(h.phase).toBe("pending");
    expect(onCommitted).not.toHaveBeenCalled();
    expect(activityLedger()).toHaveLength(0);
  });

  it("resumes with the time that was left, not a fresh window", () => {
    const onCommitted = vi.fn();
    const h = resolveWithUndo({ item: aFlag(), decidedAt: NOW, onCommitted });
    vi.advanceTimersByTime(5000);
    h.pause();
    vi.advanceTimersByTime(60_000);
    h.resume();
    // 1s was left. Not 6.
    vi.advanceTimersByTime(999);
    expect(onCommitted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it("reports the remaining time", () => {
    const h = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    expect(h.remainingMs()).toBe(UNDO_WINDOW_MS);
    vi.advanceTimersByTime(2000);
    expect(h.remainingMs()).toBe(UNDO_WINDOW_MS - 2000);
    h.pause();
    vi.advanceTimersByTime(9000);
    // Paused time does not count against the window.
    expect(h.remainingMs()).toBe(UNDO_WINDOW_MS - 2000);
  });

  it("is idempotent in both directions", () => {
    const onCommitted = vi.fn();
    const h = resolveWithUndo({ item: aFlag(), decidedAt: NOW, onCommitted });
    h.pause();
    h.pause();
    h.resume();
    h.resume();
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 10);
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it("does nothing once the phase has left pending", () => {
    const h = resolveWithUndo({ item: aFlag(), decidedAt: NOW });
    h.flush();
    expect(h.phase).toBe("emitted");
    h.pause();
    h.resume();
    expect(h.phase).toBe("emitted");
    expect(h.remainingMs()).toBe(0);
    expect(activityLedger()).toHaveLength(1);
  });

  it("undo still works while paused, and writes nothing", () => {
    const onUndone = vi.fn();
    const h = resolveWithUndo({ item: aFlag(), decidedAt: NOW, onUndone });
    h.pause();
    h.undo();
    expect(h.phase).toBe("undone");
    expect(onUndone).toHaveBeenCalledWith({ alreadyCommitted: false });
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 3);
    expect(activityLedger()).toHaveLength(0);
  });
});
