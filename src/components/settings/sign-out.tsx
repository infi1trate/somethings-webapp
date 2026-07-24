"use client";

// Sign out (settings-02) — a STUB. This prototype has no auth/session, so
// "signing out" can't clear a real credential; the honest simulation is to
// leave the app for the public landing ("/"), which renders the signed-out
// world. Extracted here (not inline in the Security section) because
// settings-04's sidebar popover footer reuses the exact same action + confirm.
// If a real session lands, this is the one seam to rewire.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The sign-out action itself (stub). Returns a callback so triggers in
 *  different surfaces (Security row, sidebar popover) share one behavior. */
export function useSignOut() {
  const router = useRouter();
  return useCallback(() => {
    // No session to clear in the prototype — leave for the public landing.
    router.push("/");
    toast("Signed out.");
  }, [router]);
}

/** Controlled confirm dialog — the caller owns `open` and provides the
 *  trigger, so the same confirmation wraps both the Security row and the
 *  settings-04 popover footer. */
export function SignOutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign out of Somethings?</DialogTitle>
          <DialogDescription>
            You&apos;ll need to sign back in to pick up where you left off.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Stay signed in
          </Button>
          <Button className="min-h-11" onClick={onConfirm}>
            Sign out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
