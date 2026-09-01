"use client";

// THE MEDIA FRAME — sized before the bytes arrive.
//
// ═══ THIS IS PHASE 1 WORK ON PURPOSE ═══
//
// Media loading is the kind of thing that gets deferred to a polish pass, and by
// then the thread has been built around images that are always already there. The
// result is the pattern this replaces: a spinner in a box of unknown size, then a
// reflow when the image lands, then everything below it jumping — in a scroll
// container that is pinned to the bottom, so the jump moves the message the reader
// was in the middle of.
//
// The fix is not a better spinner. It is that `MessageMedia` carries `w` and `h`
// as DATA, so the frame can reserve its exact final space on first paint. Nothing
// moves when the image resolves, because nothing was ever the wrong size.
//
// A SPINNER IS WHAT YOU SHOW WHEN YOU DO NOT KNOW HOW MUCH ROOM TO LEAVE. Knowing
// removes the need for one, which is why there isn't one here.
//
// ═══ WIDTH IS CAPPED, HEIGHT FOLLOWS ═══
//
// A photo from a phone is 1200×1600 and a bubble is at most ~420px wide, so the
// frame scales to the cap and derives its height from the real aspect ratio. A
// very tall image is additionally capped by height, because a 3:1 portrait would
// otherwise push the whole conversation off the screen — and when that cap bites
// the image is cropped rather than letterboxed, since a letterbox on a chat photo
// reads as a rendering fault.

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { MessageMedia } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

/** The widest a media bubble gets. Below the bubble's own max so an image never
 *  reaches the bubble's edges. */
const MAX_W = 300;
/** And the tallest. A portrait photo hits this before it hits MAX_W. */
const MAX_H = 380;

/** The frame's rendered box, from the record's own dimensions. Exported because
 *  the Swaps activity (Phase 3) lays out two of these side by side and needs the
 *  same arithmetic. */
export function frameBox(media: MessageMedia): { w: number; h: number } {
  const ratio = media.h / media.w;
  let w = Math.min(MAX_W, media.w);
  let h = Math.round(w * ratio);
  if (h > MAX_H) {
    h = MAX_H;
    w = Math.round(h / ratio);
  }
  return { w, h };
}

export function MediaFrame({
  media,
  className,
}: {
  media: MessageMedia;
  className?: string;
}) {
  const { w, h } = frameBox(media);
  const [failed, setFailed] = useState(false);
  const showImage = !!media.src && !failed;

  return (
    <div
      data-slot="media-frame"
      /* The RECORD's own dimensions, exposed so the probe can check the rendered
         box against them instead of against a number typed into the probe — which
         would only ever prove the probe and the component agree. */
      data-w={media.w}
      data-h={media.h}
      // THE BOX IS SET IN THE STYLE ATTRIBUTE, not by a class, because it is
      // per-image data rather than a design decision — and an arbitrary Tailwind
      // value per image would mint a class per photo.
      style={{ width: w, height: h }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-inset)] bg-[var(--surface-s2)]",
        className
      )}
    >
      {showImage ? (
        /* A plain <img>, deliberately. `next/image` wants a configured loader and
           either a static import or a remote-pattern allowlist, and there is no
           asset pipeline here to point it at — see Phase 0, conflict 8. The
           width/height are already on the record, which is the one thing
           next/image would otherwise be buying us, so the swap is a one-line
           change on the day real assets land. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.src}
          alt={media.alt}
          width={w}
          height={h}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        /* ═══ THE PLACEHOLDER IS THE HONEST STATE, NOT A LOADING STATE ═══
           There are no photo assets in this prototype (Phase 0, conflict 8), so a
           media message renders a correctly-proportioned frame carrying the alt
           text. It says what the photo IS, which is what a screen-reader user gets
           from a real one — so this branch and the loaded branch convey the same
           thing to the same reader.
           It is deliberately NOT animated. A pulse here would claim something is
           on its way, and nothing is. */
        <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
          <ImageOff
            className="size-4 shrink-0 text-[var(--text-muted)]"
            aria-hidden
          />
          <p
            className="line-clamp-3 text-[var(--text-secondary)]"
            style={{ font: "var(--type-field-label)" }}
          >
            {media.alt}
          </p>
        </div>
      )}
    </div>
  );
}
