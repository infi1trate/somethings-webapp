"use client";

// CONFIRM DIALOG — extracted, because there were four hand-rolled copies of this
// shape (mentee-table, deactivate-action, sign-out, caseload) and this pass adds
// three more. One component means the focus fix below exists once.
//
// FOCUS RESTORE. The shared components/ui/dialog.tsx primitive does NOT return
// focus to the trigger on close in this app — measured by A/B under a real
// Escape keypress: without an explicit handler, focus lands on <body> with the
// trigger still mounted, which drops a keyboard user at the top of the page.
// The owner captures the trigger AT CLICK TIME (reading activeElement once the
// dialog is open is already too late) and hands it here.
//
// SAYS WHAT HAPPENS AND WHAT DOESN'T. On a record where "end this pairing" and
// "change this person's account" were one click apart, the second sentence is
// the one that matters: naming what is NOT affected is what makes the first
// sentence trustworthy.

import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  /** The affirmative label. Names the ACT ("Unmatch"), never "OK" or "Yes". */
  confirmLabel,
  /** Ending a relationship is not destruction — nothing is deleted, so the
   *  default is a plain confirm. Pass "destructive" only for actual teardown. */
  tone = "default",
  onConfirm,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => void;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        // NO onOpenAutoFocus OVERRIDE. Radix's default focuses the dialog
        // CONTENT — which is exactly right here: focus lands inside the trap
        // without arming the affirmative button, so a confirm never opens with
        // the commit key already under the reader's finger. An earlier override
        // that preventDefault'd and re-focused `e.currentTarget` left focus
        // OUTSIDE the dialog entirely (measured), breaking both the trap and
        // Escape.
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo?.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            {/* TODO-COPY */}
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "destructive" ? "destructive" : "default"}
            className="min-h-11"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
