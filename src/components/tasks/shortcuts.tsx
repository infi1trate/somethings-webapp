"use client";

// THE KEYBOARD LAYER AND ITS SHEET (§7).
//
//   ↑ ↓ / j k   move through the list        (built in T3, in the tree)
//   Enter       focus the pane
//   1 – 4       switch tabs
//   u           undo, while the toast is live
//   ?           this sheet
//
// SCOPED TO THE PAGE, NOT THE DOCUMENT — and guarded against firing while someone
// is typing. A bare `u` listener on the window means a supervisor searching for
// "Naomi" undoes their last resolve on the second keystroke. The guard checks for
// an editable target and for an open dialog, because a modal owns the keyboard
// while it is up.
//
// THE SHEET IS A DIALOG, so the focus trap and Escape come from Radix rather than
// from a hand-rolled overlay — same reasoning as the Activity filter dialog.

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** TODO-COPY throughout. */
const SHORTCUTS: Array<{ keys: string[]; what: string }> = [
  { keys: ["↑", "↓"], what: "Move through the list" },
  { keys: ["j", "k"], what: "Move through the list" },
  { keys: ["→", "←"], what: "Expand or collapse a group" },
  { keys: ["Enter"], what: "Focus the review panel" },
  { keys: ["1", "2", "3", "4"], what: "Switch tabs" },
  { keys: ["u"], what: "Undo the last resolve, while the toast is up" },
  { keys: ["?"], what: "Show this list" },
];

/** True when the keystroke should be ignored because something else owns the
 *  keyboard: a text field, a contenteditable, or an open dialog.
 *
 *  THIS IS THE GUARD THAT MATTERS. Without it, typing a teen's name into a filter
 *  fires `u` and `1`–`4` on the way through. */
export function keyboardIsBusy(target: EventTarget | null): boolean {
  if (document.querySelector('[role="dialog"]')) return true;
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function useTaskShortcuts({
  onTab,
  onFocusPane,
  onUndo,
  onHelp,
}: {
  onTab: (index: number) => void;
  onFocusPane: () => void;
  onUndo: () => void;
  onHelp: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (keyboardIsBusy(e.target)) return;

      if (e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        onTab(Number(e.key) - 1);
        return;
      }
      if (e.key === "u") {
        e.preventDefault();
        onUndo();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        onHelp();
        return;
      }
      if (e.key === "Enter") {
        // Only when the list owns focus — Enter on a button must still press it.
        const active = document.activeElement as HTMLElement | null;
        if (active?.getAttribute("role") !== "treeitem") return;
        e.preventDefault();
        onFocusPane();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTab, onFocusPane, onUndo, onHelp]);
}

export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          {/* TODO-COPY */}
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            {/* TODO-COPY */}
            These work anywhere on this page, except while you are typing.
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.what + s.keys.join()}
              className="flex items-center justify-between gap-4"
            >
              <dt className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex min-w-[24px] items-center justify-center rounded-[6px] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="min-w-0 text-right text-[13px] leading-[18px] text-[var(--text-secondary)]">
                {s.what}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
