"use client";

// PreviewDisclosure — the ONE way a phone preview appears on a narrow screen.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT THIS REPLACES (RC-2). Six surfaces wrapped their preview in
// `hidden lg:…` and deleted it below 1024px, because `PhonePreviewShell` was
// `w-[360px] shrink-0` and could not shrink. On `/admin/review` the deleted
// thing was the artifact under review — a reviewer on a tablet was approving a
// profile they could not see. The frame is fluid as of Phase 4; this is the
// other half: below `lg` the preview becomes REACHABLE rather than absent.
//
// ═══ THE TIER IS `lg` (1024px), UNCHANGED ═══
//
// Deliberately not retuned to `aside` (1152px). Every one of these surfaces
// shows the preview inline at `lg` today, and moving the threshold up would take
// it away from 1024–1151px where it currently works. So no width loses anything
// it has now, and every width below 1024 gains access. The arithmetic supports
// keeping it: at 1024 with the 92px rail the editor's content column still gets
// ~476px beside a 360px preview; at 768 it would get ~328px, which is why the
// sheet — not a squeezed two-column — is the answer below `lg`.
//
// ═══ THE PATTERN IS `onboarding-layout.tsx`'s, WITH ONE DELIBERATE DIFFERENCE ═══
//
// That file's mobile path is the reference: a trigger that opens the preview in
// a dialog. Reused exactly, now on the `sheet` variant.
//
// WHAT DIFFERS: its trigger is a viewport-FIXED pill. Here the trigger is
// INLINE, in the flow where the preview column sits at `lg`. A fixed pill on
// these six surfaces would land on top of the Phase 2 bottom tab bar, and on
// `/admin/review` and `/admin/profile-update` on top of the decision footer —
// three pieces of fixed bottom chrome competing for the same 56px. The
// onboarding wizard has neither, which is why the pill is right there and stays.
// ═══════════════════════════════════════════════════════════════════════════

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function PreviewDisclosure({
  triggerLabel,
  title,
  caption,
  stickyTop = "lg:top-6",
  className,
  children,
}: {
  /** The inline trigger's text below `lg`. */
  triggerLabel: string;
  /** The sheet's heading — always rendered, never `sr-only`. A sheet that rises
   *  from the bottom of the screen has no context around it, so it has to say
   *  what it is. */
  title: string;
  /** Optional line under the inline preview at `lg` — e.g. "Teens see this
   *  when they browse." Repeated inside the sheet so the two read the same. */
  caption?: React.ReactNode;
  /** The sticky offset for the `lg` column, which differs per surface. */
  stickyTop?: string;
  className?: string;
  /** The preview itself — frame and content. Rendered in both branches; exactly
   *  one is in the accessibility tree at a time, because the other's ancestor is
   *  `display:none`. */
  children: React.ReactNode;
}) {
  return (
    <>
      {/* ── `lg` AND UP: the inline sticky column, as it was ─────────────── */}
      <div
        className={cn(
          "hidden lg:sticky lg:flex lg:flex-col lg:items-center lg:gap-3",
          stickyTop,
          className
        )}
      >
        {children}
        {caption}
      </div>

      {/* ── BELOW `lg`: a trigger and a sheet ───────────────────────────── */}
      <div className="lg:hidden">
        <Dialog>
          <DialogTrigger asChild>
            {/* `min-h-11` for the 44px floor. Full width so it reads as the
                section it replaces rather than as a stray button. */}
            <Button variant="outline" className="min-h-11 w-full">
              <Eye className="size-4" aria-hidden />
              {triggerLabel}
            </Button>
          </DialogTrigger>
          <DialogContent variant="sheet">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {/* THE BODY SCROLLS, THE HEADING AND THE CLOSE DO NOT. A phone frame
                bounded at `90dvh` is taller than the sheet on most phones — the
                frame's own aspect ratio guarantees it — so this is the case
                `DialogBody` exists for. Without it the heading and the close
                button scroll away and the sheet has no visible exit. */}
            <DialogBody className="flex flex-col items-center gap-3">
              {children}
              {caption}
            </DialogBody>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
