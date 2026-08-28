"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { touchTarget } from "@/lib/touch-target";
import { cn } from "@/lib/utils";

interface SwipeDeckProps {
  count: number;
  index: number;
  onIndexChange: (i: number) => void;
  renderCard: (i: number) => React.ReactNode;
  /** Sizing for the card footprint, e.g. "mx-auto aspect-[3/4] w-[84%]". */
  className?: string;
  /** Show arrow + dot controls (default true). Pass false for a swipe-only deck. */
  controls?: boolean;
}

// Rotations for the cards peeking behind the front one — gives the messy,
// hand-stacked polaroid feel.
const TILTS = [3, -2.5, 2];

/**
 * A stacked, swipe-one-at-a-time card deck (z-index stack). The front card is
 * draggable left/right; past a threshold it advances. Cards are positioned
 * purely by their offset from `index`, so changing the index animates the whole
 * stack via CSS transitions. No external deps. Interactive controls inside a
 * card should call `e.stopPropagation()` on pointerdown so taps don't start a drag.
 */
export function SwipeDeck({
  count,
  index,
  onIndexChange,
  renderCard,
  className,
  controls = true,
}: SwipeDeckProps) {
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const go = (i: number) => onIndexChange(Math.max(0, Math.min(count - 1, i)));

  const onDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    setDrag(e.clientX - startX.current);
  };
  const onUp = () => {
    if (startX.current == null) return;
    const w = wrapRef.current?.clientWidth ?? 300;
    const threshold = Math.max(48, w * 0.22);
    if (drag < -threshold) go(index + 1);
    else if (drag > threshold) go(index - 1);
    startX.current = null;
    setDragging(false);
    setDrag(0);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={wrapRef} className={cn("relative select-none", className)}>
        {Array.from({ length: count }).map((_, i) => {
          const offset = i - index;
          const front = offset === 0;
          let transform = "";
          let z = 1;
          let opacity = 1;
          let pe: "auto" | "none" = "none";

          if (offset < 0) {
            // already swiped past — parked off to the left
            transform = "translateX(-120%) rotate(-8deg)";
            opacity = 0;
            z = 0;
          } else if (front) {
            transform = `translateX(${drag}px) rotate(${drag * 0.025}deg)`;
            z = 50;
            pe = "auto";
          } else {
            const o = Math.min(offset, 3);
            transform = `translateY(${o * 9}px) scale(${1 - o * 0.05}) rotate(${TILTS[(i + o) % TILTS.length]}deg)`;
            z = 40 - o;
            opacity = o > 2 ? 0 : 1;
          }

          return (
            <div
              key={i}
              className={cn(
                "absolute inset-0",
                !(front && dragging) && "transition-all duration-300 ease-out"
              )}
              style={{ transform, zIndex: z, opacity, pointerEvents: pe }}
              onPointerDown={front ? onDown : undefined}
              onPointerMove={front ? onMove : undefined}
              onPointerUp={front ? onUp : undefined}
              onPointerCancel={front ? onUp : undefined}
            >
              {renderCard(i)}
            </div>
          );
        })}
      </div>

      {controls && count > 1 && (
        // ═══ TARGET SIZES (SC 2.5.8) — Phase 5, item 4 ═══
        //
        // THE DOTS WERE 8×8px. That is a third of the 24×24 the success criterion
        // requires as a floor, and it was latent only until Phase 4 turned these
        // controls on for the profile preview — the one consumer this component
        // has. The arrows were 32×32, over the SC floor but under the 44px HIG
        // guidance `03-DEFINITION-OF-DONE.md` asks for.
        //
        // THE VISUALS ARE UNCHANGED. Both fixes are transparent `::after`
        // extensions via the Phase 0 helper: an 8px dot keeps its 8px of ink and
        // gains a 24px hit area around it, and the 32px arrows gain 44px. Growing
        // the ink instead would have turned a discreet indicator row into chrome
        // that competes with the photo it belongs to.
        //
        // `gap-3`/`gap-1.5` ARE WIDE ENOUGH for the extensions not to overlap:
        // the dots' `-inset-2` reaches 8px each side into a 6px gap, so adjacent
        // dot targets do touch — acceptable here because they are the same
        // control moving one step, not two different destinations, and a mis-tap
        // costs one swipe. The arrows are separated by the whole dot row.
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous"
            className={cn(
              "flex size-8 items-center justify-center rounded-full border bg-card text-foreground/70 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30",
              touchTarget(32)
            )}
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to card ${i + 1}`}
                className={cn(
                  "relative h-2 rounded-full transition-all",
                  // 8px of ink, 24px of target — the SC 2.5.8 floor, reached
                  // without changing what the reader sees.
                  "after:absolute after:-inset-2 after:content-['']",
                  i === index ? "w-5 bg-foreground" : "w-2 bg-foreground/25"
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === count - 1}
            aria-label="Next"
            className={cn(
              "flex size-8 items-center justify-center rounded-full border bg-card text-foreground/70 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30",
              touchTarget(32)
            )}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
