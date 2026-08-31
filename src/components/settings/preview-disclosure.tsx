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

import { useState } from "react";
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
  overlay = "sheet",
  open,
  onOpenChange,
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
  /** ═══ WHERE THE OVERLAY COMES FROM, AND WHY THERE ARE TWO ═══
   *
   *  `"sheet"` (default) rises from the bottom — every surface that had this
   *  component keeps it, so nothing already shipped changes.
   *
   *  `"side"` slides in from the right edge at full height. It exists because a
   *  bottom sheet is the wrong shape for a TALL PORTRAIT DEVICE FRAME: bounded
   *  at `90dvh` minus the sheet's own heading and close control, the frame
   *  either scrolls inside a box that is already the height of the screen — two
   *  nested scrolls in one axis — or renders too small to read. See the note on
   *  `SIDE_POSITION` in `ui/dialog.tsx`.
   *
   *  THE COST, NAMED: two mobile presentations now exist for one pattern, which
   *  this file's own premise argued against. The premise is still right about
   *  the thing it was defending — a preview must never be ABSENT below `lg` —
   *  and that is unchanged on all six surfaces. What varies is the edge it
   *  arrives from, chosen by the shape of the content. */
  overlay?: "sheet" | "side";
  /** ═══ AN EXTERNALLY PLACED TRIGGER ═══
   *
   *  Pass `open`/`onOpenChange` and the inline full-width button is not
   *  rendered; the caller opens the overlay from wherever it belongs — a page
   *  header, a toolbar, a card's title row.
   *
   *  WHY THIS IS NEEDED AT ALL. The inline trigger sits where the preview column
   *  sits at `lg`, which on a stacking layout is BELOW the whole editor. On a
   *  phone that means scrolling past every field before finding the preview of
   *  the thing being edited — reachable in the DOM and unreachable in practice.
   *  A header-aligned CTA is the fix, and a header is not this component's to
   *  render, so the state is lifted instead. `PreviewTrigger` below is the
   *  matching button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The preview itself — frame and content. Mounted in ONE branch at a time;
   *  see `showInline` below for why that is stricter than it used to be. */
  children: React.ReactNode;
}) {
  const controlled = open !== undefined;
  /** ═══ THE COMPONENT ALWAYS KNOWS WHETHER IT IS OPEN ═══
   *
   *  Uncontrolled callers used to let Radix hold the state internally, which
   *  meant this component could not know. It has to: see `showInline`. */
  const [selfOpen, setSelfOpen] = useState(false);
  const isOpen = controlled ? open : selfOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setSelfOpen(next);
    onOpenChange?.(next);
  };
  /** ═══ NEVER BOTH COPIES OF `children` IN THE DOCUMENT ═══
   *
   *  Both branches used to render `children` at all times, on the grounds that
   *  only one is ever in the accessibility tree — the other's ancestor is
   *  `display:none`. True for a11y, and NOT enough: a phone preview defines
   *  document-global SVG ids for its silhouette, so a second copy duplicates
   *  them and every `url(#…)` in it resolves to the FIRST copy's defs — which,
   *  with that copy hidden, means referencing into a `display:none` subtree.
   *  Both copies render identically, so nothing looks wrong; an id sweep found
   *  it. Fixed here rather than by making the preview's ids per-instance,
   *  because that file deliberately renders some filters once and documents
   *  duplicate global ids as accepted. design-system-gaps row 309.
   *
   *  The overlay only opens below `lg` (both triggers are `lg:hidden`), so this
   *  never takes the inline column away from a width that was using it. A resize
   *  to `lg` while open leaves the panel showing and the column absent until it
   *  is closed, which is the correct read of "one preview at a time". */
  const showInline = !isOpen;
  return (
    <>
      {/* ── `lg` AND UP: the inline sticky column, as it was ─────────────── */}
      {/* The wrapper still renders when the overlay is open — only its contents
          are withheld — so the grid column it occupies does not collapse and the
          layout behind the panel cannot shift under it. */}
      <div
        className={cn(
          "hidden lg:sticky lg:flex lg:flex-col lg:items-center lg:gap-3",
          stickyTop,
          className
        )}
      >
        {showInline && (
          <>
            {children}
            {caption}
          </>
        )}
      </div>

      {/* ── BELOW `lg`: a trigger and an overlay ────────────────────────── */}
      {/* NO WRAPPER WHEN CONTROLLED. The `lg:hidden` div is what hides the inline
          trigger above `lg`; with the trigger elsewhere there is nothing left in
          here to hide, and an empty `lg:hidden` div in the grid would occupy a
          row of its own on a stacking layout. Radix portals the overlay, so it
          is unaffected either way. */}
      <ConditionalWrapper wrap={!controlled}>
        <Dialog open={isOpen} onOpenChange={setOpen}>
          {!controlled && (
            <DialogTrigger asChild>
              {/* `min-h-11` for the 44px floor. Full width so it reads as the
                  section it replaces rather than as a stray button. */}
              <Button variant="outline" className="min-h-11 w-full">
                <Eye className="size-4" aria-hidden />
                {triggerLabel}
              </Button>
            </DialogTrigger>
          )}
          <DialogContent variant={overlay}>
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
      </ConditionalWrapper>
    </>
  );
}

/** Wraps in the `lg:hidden` div only when the inline trigger needs hiding. */
function ConditionalWrapper({
  wrap,
  children,
}: {
  wrap: boolean;
  children: React.ReactNode;
}) {
  return wrap ? <div className="lg:hidden">{children}</div> : <>{children}</>;
}

/** ═══ THE HEADER-ALIGNED CTA ═══
 *
 *  The counterpart to `PreviewDisclosure`'s controlled mode: a compact button a
 *  page places in its own header row, on the same line as the heading the
 *  preview belongs to.
 *
 *  COMPACT AND ICON-LED, where the inline trigger is full-width. It shares a row
 *  with a heading rather than standing in for a section, so it has to read as a
 *  control beside a title and not as a call to action interrupting one. The label
 *  stays visible rather than becoming an icon-only button — "what does the eye do
 *  here" is not a question a mentor should have to answer by tapping.
 *
 *  `lg:hidden` LIVES HERE, not at the call site, so a page cannot mount it and
 *  forget: above `lg` the inline column is showing the preview already, and a
 *  second way to open the same thing beside it is noise. */
export function PreviewTrigger({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn("min-h-11 shrink-0 lg:hidden", className)}
    >
      <Eye className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
