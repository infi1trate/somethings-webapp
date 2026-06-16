"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, X, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downscaleImageToWebP, readFileAsDataUrl, clientId } from "@/lib/files";
import { VIBE_PROMPTS, VIBE_CATCHALL } from "@/lib/onboarding/guidance";
import { cn } from "@/lib/utils";
import type { VibePhoto } from "@/lib/types";

interface Props {
  value: VibePhoto[];
  onChange: (next: VibePhoto[]) => void;
}

// Board scope: ~3 reads as a board (soft, never enforced — photos are invited),
// ~8 stays scannable. SCOPE = how many ghost frames show up front so the whole
// board is clear at a glance. (Verify against real density at the frame size.)
const CEILING = 8;
const SCOPE = 5;

const FRAME = "aspect-[3/4] w-[108px] shrink-0 rounded-2xl";

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
  const [promptIndex, setPromptIndex] = useState(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const advanceRef = useRef(false); // advance the prompt after this pick?
  // Async (image processing) callbacks resolve after re-renders — read latest here.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const total = value.length + pending.length;
  const atCeiling = total >= CEILING;
  const promptsLeft = promptIndex < VIBE_PROMPTS.length;
  const activePrompt = promptsLeft ? VIBE_PROMPTS[promptIndex] : VIBE_CATCHALL;
  const ghostCount = atCeiling
    ? 0
    : Math.min(CEILING, Math.max(SCOPE, total + 1)) - total;

  const nextPrompt = () =>
    setPromptIndex((i) => Math.min(i + 1, VIBE_PROMPTS.length));

  const openPicker = (advance: boolean) => {
    advanceRef.current = advance;
    fileRef.current?.click();
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (advanceRef.current) nextPrompt(); // answering a prompt slides up the next
    advanceRef.current = false;
    const prompt = activePrompt;
    const room = CEILING - (valueRef.current.length + pending.length);
    const picked = Array.from(files).slice(0, Math.max(0, room));
    for (const file of picked) {
      const id = clientId("vibe");
      setPending((p) => [...p, { id, status: "loading", prompt }]);
      try {
        // Same UGC handling as the other photo steps: downscale to WebP so the
        // persisted draft stays under the localStorage quota; fall back to the
        // raw file if the browser can't decode it (e.g. HEIC).
        const photo = await downscaleImageToWebP(file).catch(() =>
          readFileAsDataUrl(file)
        );
        await decodes(photo); // confirm it renders before committing to the board
        setPending((p) => p.filter((x) => x.id !== id));
        onChange([...valueRef.current, { id, photo, prompt }]);
      } catch {
        // One bad image must not block the board — flag just this frame.
        setPending((p) =>
          p.map((x) => (x.id === id ? { ...x, status: "error" } : x))
        );
      }
    }
  };

  const remove = (id: string) =>
    onChange(valueRef.current.filter((v) => v.id !== id));
  const dismissError = (id: string) =>
    setPending((p) => p.filter((x) => x.id !== id));

  return (
    // min-w-0 so this can shrink inside the grid FormItem — lets the board row's
    // overflow-x-auto scroll instead of widening the whole step column.
    <div className="space-y-5 min-w-0">
      {/* The board — a row of frames seen all at once. Filling it IS the
          progress; frames are tappable in any order, skipping leaves them empty. */}
      <div
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Your vibe board"
      >
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
            <button
              type="button"
              onClick={() => remove(v.id)}
              aria-label="Remove this photo"
              className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}

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
                  className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full bg-black/45 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <X className="size-4" />
                </button>
              </>
            )}
          </div>
        ))}

        {Array.from({ length: ghostCount }).map((_, i) => (
          <button
            key={`ghost-${i}`}
            type="button"
            onClick={() => openPicker(false)}
            aria-label="Add a photo to your vibe board"
            className={cn(
              FRAME,
              "flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-foreground/25 bg-foreground/[0.02] text-muted-foreground transition-colors hover:border-foreground/45 hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
          >
            <Plus className="size-5" aria-hidden />
            <span className="text-xs font-medium">Add</span>
          </button>
        ))}
      </div>

      {/* ── Vibe reflection slot (v2 — OUT of scope for now) ─────────────────
          A short, dismissable read of the BOARD could later sit here, just below
          the board. For whoever builds it: reflect the BOARD, not the person;
          keep it editable ("sounds right" / "not quite"); use provisional
          language ("so far this reads…"); NO completion/strength meter or
          percentage. Don't build the model call now — just leave this slot. */}

      {/* The prompt deck — feeds in below the board, one at a time. With nothing
          added yet, this IS the empty state: an invitation, not "you have none." */}
      {atCeiling ? (
        <p className="rounded-2xl border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          That&apos;s a full board — looking good. Remove one to swap it out.
        </p>
      ) : (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pull from your camera roll
          </p>
          <p
            key={promptIndex}
            className="text-lg font-medium leading-snug text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
          >
            {activePrompt}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => openPicker(true)}
              className="h-11 flex-1"
            >
              <ImagePlus className="size-4" />
              Pick a photo
            </Button>
            {promptsLeft && (
              <Button
                type="button"
                variant="ghost"
                onClick={nextPrompt}
                className="h-11"
              >
                Skip
              </Button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
