"use client";

// THE KEYBOARD LAYER AND ITS SHEET (§7).
//
//   ↑ ↓ / j k   move through the list        (built in T3, in the tree)
//   y / n       answer "was this flagged correctly?" — and resolve
//   Enter       confirm the billing code, or focus the pane
//   1 – 4       switch tabs
//   u           undo, while the toast is live
//   ?           this sheet
//
// ═══ WHY y / n EXIST (Part 3) ═══
//
// At fifty flags a shift, the resolve is the whole job: read the excerpt, decide,
// move on. With a pointer that is scroll, aim, click, and the aim is the expensive
// part — two 36px targets at the bottom of a pane, fifty times. `y` and `n` remove
// the aim entirely, and because the list auto-advances the whole loop becomes read,
// press, read, press, without the hand ever leaving the keyboard.
//
// EITHER ANSWER RESOLVES. `n` is not "skip" and not "leave it open" — it is the
// same resolve carrying the opposite feedback, exactly like the footer's two
// buttons (§5). A key that quietly meant something different from the button it
// mirrors would be worse than no key at all.
//
// ═══ ENTER DOES TWO THINGS, AND THAT IS A DELIBERATE OVERLOAD ═══
//
// §7 gave Enter to "focus the review panel"; Part 3 asks it to confirm a billing
// code. Both are "do the obvious thing with what is selected", and they never
// apply at once: a billing item HAS a primary confirm, and a flag or an escalation
// does not. So Enter confirms when there is something to confirm and focuses the
// pane otherwise — resolved by the page, which is the only place that knows which
// kind of item is selected.
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
  /* TODO-COPY. Listed with the modifier spelled out rather than as a glyph pair,
     because this sheet is read on both platforms and `⌘` alone would be wrong on
     one of them. */
  { keys: ["⌘/Ctrl", "↵"], what: "Submit the open review" },
  { keys: ["→", "←"], what: "Expand or collapse a group" },
  { keys: ["y"], what: "Flagged correctly — resolve" },
  { keys: ["n"], what: "Not flagged correctly — resolve" },
  { keys: ["Enter"], what: "Confirm the billing code, or focus the panel" },
  { keys: ["1", "2", "3", "4"], what: "Switch tabs" },
  { keys: ["u"], what: "Undo the last resolve, while the toast is up" },
  { keys: ["?"], what: "Show this list" },
];

/** True when the keystroke should be ignored because something else owns the
 *  keyboard: a text field, a contenteditable, or an open dialog.
 *
 *  THIS IS THE GUARD THAT MATTERS. Without it, typing a teen's name into a filter
 *  fires `u` and `1`–`4` on the way through. */
/** ═══ A DIALOG OWNS THE KEYBOARD, WHOEVER IS TYPING ═══
 *
 *  Split out of `keyboardIsBusy` because the two halves of that guard are not
 *  wanted together any more. `⌘/Ctrl+Enter` submits the billing review and MUST
 *  work while the caret is in one of its textareas — that is the whole point of
 *  the shortcut — but must NOT fire while the DSM-5 picker is open over the top
 *  of it. So the dialog half is its own predicate and the typing half stays
 *  behind `keyboardIsBusy`. */
export function dialogIsOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"]'));
}

export function keyboardIsBusy(target: EventTarget | null): boolean {
  if (dialogIsOpen()) return true;
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
  onAnswer,
  onEnter,
  onSubmit,
  onUndo,
  onHelp,
}: {
  onTab: (index: number) => void;
  onFocusPane: () => void;
  /** "Was this flagged correctly?" — the footer's two buttons, as keys. A no-op
   *  when the selected item is not a flag. */
  onAnswer: (correct: boolean) => void;
  /** Returns true if it consumed the key. False falls through to focusing the
   *  pane.
   *
   *  IT NO LONGER COMMITS A BILLING CODE. It used to: Enter on a list row
   *  confirmed the code outright, which was the fastest route through the
   *  undocumented commit this build removes. Billing now returns false here and
   *  the key does what it does for every other domain — moves the keyboard into
   *  the pane, where the review is. */
  onEnter: () => boolean;
  /** `⌘/Ctrl+Enter` — submit the open review. Runs the same three-field gate the
   *  footer's button runs, so a keyboard commit cannot skip it. */
  onSubmit?: () => void;
  onUndo: () => void;
  onHelp: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* ═══ THE ONE MODIFIED COMBO, HANDLED BEFORE THE MODIFIER BAIL ═══
         Everything else in this layer is a bare key and bails on modifiers, so
         `⌘/Ctrl+Enter` would never have reached it. It deliberately does NOT go
         through `keyboardIsBusy`: submitting from inside the textarea you have
         just filled in is the point of the shortcut. It does respect
         `dialogIsOpen`, because the DSM-5 picker sits over the review and Enter
         in a search field belongs to the search.
         NO BARE-ENTER EQUIVALENT, by decision: the consequence is a code on a
         minor's billing record, and the textareas own Enter. */
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (dialogIsOpen()) return;
        if (!onSubmit) return;
        e.preventDefault();
        onSubmit();
        return;
      }
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
      /* `y` AND `n` ARE INERT IN A TEXT INPUT — and that is not a nicety here.
         Two of the commonest letters in English resolve a minor's risk flag; a
         supervisor typing "Naomi" into any field would fire `n` and close
         whatever was selected. `keyboardIsBusy` above is the guard, and it also
         covers the DSM-5 code search, which is an input inside a dialog. */
      if (e.key === "y" || e.key === "n") {
        e.preventDefault();
        onAnswer(e.key === "y");
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
        // Confirm first; fall through to focusing the pane when there is nothing
        // to confirm. See the module note on the overload.
        if (onEnter()) return;
        onFocusPane();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTab, onFocusPane, onAnswer, onEnter, onSubmit, onUndo, onHelp]);
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
