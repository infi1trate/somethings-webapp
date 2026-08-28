"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/** ═══ THE SHEET VARIANT (Phase 4) ═══
 *
 *  A bottom-anchored dialog. Not a different component: a phone-shaped position
 *  for the same overlay, so everything a caller already relies on — the focus
 *  trap, Esc, the overlay click, `DialogBody`, the height bound — is unchanged.
 *
 *  WHY BOTTOM-ANCHORED AT ALL. A centred dialog on a 390×844 viewport puts its
 *  content in the middle of the screen and its close control at the top-right,
 *  which is the single hardest point to reach with a right thumb (Fitts). A
 *  sheet rises from the edge the thumb is already at, and its top edge is where
 *  the reader's eye already is after tapping something at the bottom.
 *
 *  THE CLOSE MOVES TO THE BOTTOM, and that is the one real departure from the
 *  centred dialog's convention. On a sheet bounded at `90dvh` the top-right
 *  corner is ~760px up a phone screen — further from the thumb than the centred
 *  dialog's corner was. So the sheet renders ONE close control, full-width and
 *  pinned below the scrolling body, inside the safe area.
 *
 *  THE COST, NAMED: it spends ~56px of sheet height that the content could have
 *  used, and it means the same component closes from a different place depending
 *  on variant. Both are worth it — a close affordance that is visible at every
 *  scroll position and reachable without a hand-shuffle beats one that is
 *  conventionally placed and practically unreachable. Esc and the overlay tap
 *  still work, so this is an addition to the dismiss paths, not a replacement. */
const SHEET_POSITION = [
  // Anchored to the bottom, overriding the centred variant's transform.
  "top-auto bottom-0 left-0 translate-x-0 translate-y-0",
  // Full-bleed: a sheet with side gutters reads as a floating card that happens
  // to be low, not as a surface attached to the edge of the screen.
  "w-full max-w-none sm:max-w-none",
  // Only the top corners — the bottom two are off-screen.
  "rounded-t-2xl rounded-b-none",
  // ABOVE THE DEV BAR, same as the bottom nav. `0px` fallback keeps this right
  // the day the harness is gone.
  "bottom-[var(--dev-bar-h,0px)]",
  // Slide from the bottom rather than the centred variant's zoom.
  "data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 data-open:zoom-in-100 data-closed:zoom-out-100",
].join(" ")

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "center",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** `"sheet"` anchors the dialog to the bottom of the viewport — see the note
   *  above `SHEET_POSITION`. Everything else about the dialog is identical. */
  variant?: "center" | "sheet"
}) {
  const isSheet = variant === "sheet"
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-variant={variant}
        className={cn(
          // RC-6: HEIGHT BOUND + SCROLL. There was neither, so a dialog taller than
          // the viewport simply ran off it — no scroll by wheel, drag or keyboard.
          //
          // `90dvh`, NOT `90vh`: on mobile Safari `vh` is the *largest* viewport,
          // so a `90vh` dialog is taller than the visible area whenever the URL bar
          // is showing — which is exactly when someone is reading it.
          //
          // THE BOUND IS ON THE CONTENT so nothing can clip regardless of how a
          // caller structures its children. A caller that wants its header and
          // footer to stay put while only the middle scrolls wraps that middle in
          // <DialogBody>; without one, the whole dialog scrolls, which is a worse
          // read than a pinned header but still strictly better than losing content.
          "fixed top-1/2 left-1/2 z-50 grid max-h-[90dvh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 grid-rows-[minmax(0,1fr)] gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          isSheet && SHEET_POSITION,
          className
        )}
        // THE SAFE AREA IS A STYLE, NOT A CLASS, because it has to ADD to the
        // padding the centred variant already set (`p-4`) rather than replace
        // it: a notched phone needs the home-indicator strip cleared BELOW the
        // sheet's own bottom padding, or the close button sits in it.
        style={
          isSheet
            ? {
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
                ...props.style,
              }
            : props.style
        }
        {...props}
      >
        {children}
        {/* THE CENTRED VARIANT'S CORNER X. Suppressed on a sheet, which closes
            from the bottom instead — one close control, never two. */}
        {showCloseButton && !isSheet && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
        {showCloseButton && isSheet && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            {/* `shrink-0` so it never gets compressed by a tall body, and
                `min-h-11` for the 44px floor. Full width because a thumb aiming
                at the bottom of a sheet should not have to aim horizontally. */}
            <Button
              variant="outline"
              className="min-h-11 w-full shrink-0"
            >
              <XIcon className="size-4" aria-hidden />
              {/* TODO-COPY */}
              Close
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      // `shrink-0` so a <DialogBody> beside it absorbs the overflow rather than
      // the header being compressed. Inert when there is no body.
      className={cn("flex shrink-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

/** THE SCROLL REGION, for a dialog tall enough that its header and footer should
 *  stay put while the middle moves.
 *
 *  OPT-IN, DELIBERATELY. `DialogContent` already carries the height bound and its
 *  own overflow, so no caller can clip whether or not it uses this — this is the
 *  upgrade from "the whole dialog scrolls" to "only the body does", and it is
 *  worth taking on the tall ones (a review modal, a picker) and not worth the
 *  markup on a two-line confirm.
 *
 *  `min-h-0` is the load-bearing class: a grid/flex child defaults to its content
 *  height and will not shrink below it, so without this the region grows past the
 *  bound and the header scrolls away anyway. */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // `shrink-0` for the same reason as the header — see DialogHeader.
        "-mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
