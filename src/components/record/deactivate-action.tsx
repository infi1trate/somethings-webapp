"use client";

// DEACTIVATE ACTION — the destructive account control, surfaced in the
// Organization tab beside Status rather than living only behind the header's
// overflow menu. Deactivation IS a status change, so it belongs where status
// is; the overflow keeps its copy for people who go looking there.
//
// The warning is slight by design: a short consequence line inline, and a
// confirm dialog naming what happens and that it's reversible. Reactivating
// asks too, but in a plain (non-destructive) voice — it puts someone back into
// matching, which is worth a beat but isn't dangerous.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function DeactivateAction({
  name,
  deactivated,
  noun = "account",
  onConfirm,
}: {
  name: string;
  deactivated: boolean;
  /** What is being deactivated, for the copy: "account" | "teen". */
  noun?: string;
  /** Called with the NEXT active state (true = reactivated). */
  onConfirm: (nextActive: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] px-[var(--surface-pad-x)] py-3.5">
        <p
          className="min-w-0 text-[var(--text-secondary)]"
          style={{ font: "var(--type-helper)" }}
        >
          {deactivated
            ? `${name} is deactivated — they're out of matching until you turn them back on.`
            : `Removes ${name} from matching. Existing mentorships pause rather than end.`}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            "inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)] " +
            (deactivated
              ? "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]"
              : "border-[color:var(--state-error)] text-[var(--state-error)] hover:bg-[var(--alert-critical-bg)]")
          }
        >
          {deactivated ? "Reactivate" : `Deactivate ${noun}`}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deactivated ? `Reactivate ${name}?` : `Deactivate ${name}?`}
            </DialogTitle>
            <DialogDescription>
              {deactivated
                ? "They'll be matchable again right away."
                : "They'll be removed from matching right away, and teens won't see their profile. Active mentorships are paused, not ended. You can reactivate them later — nothing is deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={deactivated ? "default" : "destructive"}
              className="min-h-11"
              onClick={() => {
                onConfirm(deactivated);
                toast(deactivated ? "Reactivated." : "Deactivated.");
                setOpen(false);
              }}
            >
              {deactivated ? "Reactivate" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
