"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, Plus, Check, Loader2 } from "lucide-react";
import { readFileAsDataUrl, downscaleImageToWebP, clientId } from "@/lib/files";
import { suggestInterests } from "@/lib/suggest-interests";
import { INTEREST_OPTIONS } from "@/lib/options";
import { iconFor } from "@/lib/interest-icons";
import { cn } from "@/lib/utils";
import type { UploadedImage } from "@/lib/types";

interface Props {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  /** The mentor's chosen interests — used to suggest + order photo tags. */
  selected: string[];
  max?: number;
}

const TILT = [-2.5, 2, -1.5, 2.5, -2, 1.5]; // organic polaroid angles

export function ImageGalleryUpload({
  value,
  onChange,
  selected,
  max = 6,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Latest value — async (AI) callbacks resolve after re-renders, so they read
  // from here rather than a stale closure.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  // Picker order: the mentor's own interests first, then the rest of the set.
  const tagOptions = [
    ...selected.filter((s) => INTEREST_OPTIONS.includes(s)),
    ...INTEREST_OPTIONS.filter((o) => !selected.includes(o)),
  ];

  const patch = (id: string, change: (img: UploadedImage) => UploadedImage) =>
    onChange(valueRef.current.map((img) => (img.id === id ? change(img) : img)));

  const flagAnalyzing = (id: string, on: boolean) =>
    setAnalyzing((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = max - value.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const added: UploadedImage[] = await Promise.all(
      picked.map(async (file) => ({
        id: clientId("img"),
        name: file.name,
        // Downscale to keep the persisted draft under the localStorage quota;
        // fall back to the raw file if the browser can't decode it (e.g. HEIC).
        dataUrl: await downscaleImageToWebP(file).catch(() =>
          readFileAsDataUrl(file)
        ),
        interests: [],
      }))
    );
    onChange([...value, ...added]);
    // Ask the server (Claude vision, or mock) to suggest tags for each new photo.
    added.forEach((img) => {
      flagAnalyzing(img.id, true);
      void suggestInterests(img.dataUrl, selected)
        .then((tags) =>
          patch(img.id, (cur) => ({
            ...cur,
            interests: [...new Set([...cur.interests, ...tags])].slice(0, 5),
          }))
        )
        .finally(() => flagAnalyzing(img.id, false));
    });
  };

  const removePhoto = (id: string) => {
    onChange(value.filter((i) => i.id !== id));
    if (pickerFor === id) setPickerFor(null);
  };

  const toggleTag = (id: string, interest: string) =>
    patch(id, (cur) => ({
      ...cur,
      interests: cur.interests.includes(interest)
        ? cur.interests.filter((t) => t !== interest)
        : [...cur.interests, interest].slice(0, 5),
    }));

  const full = value.length >= max;

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {value.map((img, i) => {
        const isAnalyzing = analyzing.has(img.id);
        const open = pickerFor === img.id;
        return (
          <div
            key={img.id}
            className="w-[78%] max-w-[300px] shrink-0 snap-center space-y-3"
          >
            {/* Photo */}
            <div
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border-4 border-white bg-muted shadow-[0_8px_24px_rgba(31,30,29,0.16)]"
              style={{ transform: `rotate(${TILT[i % TILT.length]}deg)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={img.name}
                className="size-full object-cover"
              />
              <button
                type="button"
                aria-label={`Remove ${img.name}`}
                onClick={() => removePhoto(img.id)}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
              >
                <X className="size-4" />
              </button>
              {isAnalyzing && (
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                  <Loader2 className="size-3.5 animate-spin" />
                  Reading your photo…
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {img.interests.map((t) => {
                const Icon = iconFor(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-label={`Remove ${t} tag`}
                    onClick={() => toggleTag(img.id, t)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                  >
                    <Icon className="size-3.5" />
                    {t}
                    <X className="size-3 opacity-70" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPickerFor(open ? null : img.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium transition-colors",
                  open
                    ? "border-foreground/40 bg-accent text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:bg-accent"
                )}
              >
                <Plus className="size-3.5" />
                {img.interests.length === 0 ? "Add interest" : "Edit"}
              </button>
            </div>

            {/* Tag picker */}
            {open && (
              <div className="flex flex-wrap gap-1.5 rounded-xl border bg-muted/40 p-2.5">
                {tagOptions.map((o) => {
                  const on = img.interests.includes(o);
                  const Icon = iconFor(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(img.id, o)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all active:scale-95",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-foreground/30"
                      )}
                    >
                      {on ? (
                        <Check className="size-3" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/4] w-[78%] max-w-[300px] shrink-0 snap-center flex-col items-center justify-center gap-2 self-start rounded-2xl border-4 border-dashed border-white bg-muted/40 text-muted-foreground transition-colors hover:bg-muted"
          style={{ transform: `rotate(${TILT[value.length % TILT.length]}deg)` }}
        >
          <ImagePlus className="size-6" />
          <span className="text-sm font-medium">Add a photo</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
        }}
      />
    </div>
  );
}
