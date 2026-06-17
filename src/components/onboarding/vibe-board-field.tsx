"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, ImageOff, Loader2, RefreshCw, Check } from "lucide-react";
import { downscaleImageToWebP, readFileAsDataUrl, clientId } from "@/lib/files";
import { VIBE_PROMPTS } from "@/lib/onboarding/guidance";
import { cn } from "@/lib/utils";
import type { VibePhoto } from "@/lib/types";

interface Props {
  value: VibePhoto[];
  onChange: (next: VibePhoto[]) => void;
}

// ~3 reads as a board (soft — photos are invited, never required), ~8 stays
// scannable. EMPTY_PROMPTS = how many prompted frames to offer at once ("a varied
// few" — never surface all 20+; the per-frame shuffle rotates the rest in).
const CEILING = 8;
const EMPTY_PROMPTS = 4;

const FRAME = "aspect-[3/4] w-[132px] shrink-0 rounded-2xl";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type Pending = { id: string; status: "loading" | "error"; prompt: string | null };

// Resolve only if the data URL actually renders — so a corrupt/unsupported file
// surfaces the per-image error state instead of committing a broken frame.
function decodes(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("decode failed"));
    img.src = src;
  });
}

export function VibeBoardField({ value, onChange }: Props) {
  // Prompts currently captioning the empty prompted frames.
  const [prompts, setPrompts] = useState<string[]>(() =>
    VIBE_PROMPTS.slice(0, EMPTY_PROMPTS)
  );
  const [pending, setPending] = useState<Pending[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null); // prompt framing the current pick
  const cursorRef = useRef(EMPTY_PROMPTS); // next prompt in the interleaved queue
  // Async (image-processing) callbacks resolve after re-renders — read latest here.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  // Next prompt from the interleaved queue (the cursor guarantees a fresh,
  // not-currently-shown one until the whole 20+ set is exhausted).
  const pickNext = () => VIBE_PROMPTS[cursorRef.current++ % VIBE_PROMPTS.length];
  // Keep a varied few prompted frames available (a consumed prompt isn't reused).
  const replenish = () =>
    setPrompts((prev) =>
      prev.length < EMPTY_PROMPTS ? [...prev, pickNext()] : prev
    );

  const freeSlots = CEILING - value.length - pending.length;
  const atCeiling = freeSlots <= 0;
  const noPromptShown = freeSlots >= 1; // always offer free curation while there's room
  const promptedShown = Math.max(
    0,
    Math.min(prompts.length, freeSlots - (noPromptShown ? 1 : 0))
  );

  const openPicker = (prompt: string | null) => {
    targetRef.current = prompt;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const prompt = targetRef.current;
    targetRef.current = null;
    if (!file) return; // picker cancelled — leave the frame + its prompt as-is
    // A prompted frame is being answered → consume its prompt slot.
    if (prompt) setPrompts((prev) => prev.filter((p) => p !== prompt));
    const id = clientId("vibe");
    setPending((p) => [...p, { id, status: "loading", prompt }]);
    try {
      // Same UGC handling as the other photo steps: downscale to WebP (quota),
      // fall back to the raw file if the browser can't decode it (e.g. HEIC).
      const photo = await downscaleImageToWebP(file).catch(() =>
        readFileAsDataUrl(file)
      );
      await decodes(photo); // confirm it renders before committing
      setPending((p) => p.filter((x) => x.id !== id));
      // The prompt rides along as the photo's caption — never validated against it.
      onChange([...valueRef.current, { id, photo, prompt }]);
      if (prompt) replenish();
    } catch {
      // One bad image must not block the board — flag just this frame.
      setPending((p) =>
        p.map((x) => (x.id === id ? { ...x, status: "error" } : x))
      );
    }
  };

  const shuffle = (prompt: string) => {
    const fresh = pickNext();
    setPrompts((prev) => prev.map((p) => (p === prompt ? fresh : p)));
  };

  const remove = (id: string) =>
    onChange(valueRef.current.filter((v) => v.id !== id));

  const dismissError = (id: string) => {
    const errored = pending.find((x) => x.id === id);
    setPending((p) => p.filter((x) => x.id !== id));
    if (errored?.prompt) replenish(); // restore the slot it came from
  };

  return (
    // min-w-0 so this can shrink inside the grid FormItem — lets the board's
    // overflow-x-auto scroll instead of widening the whole step column.
    <div className="min-w-0 space-y-4">
      {/* The board — a row of frames seen all at once. Each empty frame carries
          its OWN prompt as the caption: tap it to fill THAT frame; shuffle to
          swap the prompt; one frame is prompt-free for unguided picks. The prompt
          is only ever a suggestion — any photo is fine, never validated. */}
      <div
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Your vibe board"
      >
        {/* Answered frames — the image, with its prompt as a small caption */}
        {value.map((v, i) => (
          <div
            key={v.id}
            role="listitem"
            className={cn(
              FRAME,
              "relative overflow-hidden border-4 border-white bg-muted shadow-[0_6px_18px_rgba(31,30,29,0.14)]"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.photo}
              alt={v.prompt ? `Vibe — ${v.prompt}` : `Vibe photo ${i + 1}`}
              className="size-full object-cover"
            />
            {v.prompt && (
              <div className="absolute inset-x-0 bottom-0 flex items-start gap-1 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2 pb-1.5 pt-6">
                <Check className="mt-px size-3 shrink-0 text-white/90" aria-hidden />
                <span className="text-[10.5px] font-medium leading-tight text-white">
                  {v.prompt}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(v.id)}
              aria-label="Remove this photo"
              className={cn(
                "absolute right-1 top-1 z-10 flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              )}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}

        {/* In-flight frames — loading / per-image error */}
        {pending.map((p) => (
          <div
            key={p.id}
            role="listitem"
            className={cn(
              FRAME,
              "relative flex flex-col items-center justify-center gap-2 border-4 border-white bg-muted px-2 text-center text-muted-foreground shadow-[0_6px_18px_rgba(31,30,29,0.1)]"
            )}
          >
            {p.status === "loading" ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                <span role="status" className="sr-only">
                  Adding a photo…
                </span>
              </>
            ) : (
              <>
                <ImageOff className="size-5" aria-hidden />
                <p className="text-[11px] leading-tight">
                  That one didn&apos;t load — try another.
                </p>
                <button
                  type="button"
                  onClick={() => dismissError(p.id)}
                  aria-label="Dismiss this photo"
                  className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full bg-black/45 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <X className="size-4" />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Empty prompted frames — the prompt IS the caption; shuffle swaps it */}
        {prompts.slice(0, promptedShown).map((prompt) => (
          <div key={prompt} role="listitem" className={cn("relative", FRAME)}>
            <button
              type="button"
              onClick={() => openPicker(prompt)}
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-foreground/25 bg-foreground/[0.02] px-2.5 pb-3 pt-12 text-center transition-colors hover:border-foreground/45 hover:bg-foreground/[0.04]",
                RING
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/55">
                <Plus className="size-4" aria-hidden />
              </span>
              <span className="text-[12px] font-medium leading-snug text-foreground/75">
                {prompt}
              </span>
            </button>
            <button
              type="button"
              onClick={() => shuffle(prompt)}
              aria-label="Swap this prompt for another"
              className={cn(
                "absolute right-1 top-1 z-10 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground",
                RING
              )}
            >
              <RefreshCw className="size-4" aria-hidden />
            </button>
          </div>
        ))}

        {/* Free-curation frame — no prompt, just bring your own */}
        {noPromptShown && (
          <div role="listitem" className={cn("relative", FRAME)}>
            <button
              type="button"
              onClick={() => openPicker(null)}
              aria-label="Add your own photo, no prompt"
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-foreground/25 bg-foreground/[0.02] px-2.5 text-center transition-colors hover:border-foreground/45 hover:bg-foreground/[0.04]",
                RING
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/55">
                <Plus className="size-4" aria-hidden />
              </span>
              <span className="text-[12px] font-medium leading-snug text-foreground/75">
                Add your own
              </span>
              <span className="text-[10.5px] text-muted-foreground">no prompt</span>
            </button>
          </div>
        )}
      </div>

      {atCeiling && (
        <p className="text-center text-xs text-muted-foreground">
          That&apos;s a full board — remove one to swap it out.
        </p>
      )}

      {/* ── Vibe reflection slot (v2 — OUT of scope for now) ─────────────────
          A short, dismissable read of the BOARD could later sit here, just below
          the board. For whoever builds it: reflect the BOARD, not the person;
          keep it editable ("sounds right" / "not quite"); use provisional
          language ("so far this reads…"); NO completion/strength meter. Don't
          build the model call now — just leave this slot. */}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
