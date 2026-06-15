"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { readFileAsDataUrl, downscaleImageToWebP, clientId } from "@/lib/files";
import type { UploadedImage } from "@/lib/types";

interface Props {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  max?: number;
}

const TILT = [-3, 2.5, -1.5, 3, -2, 1.5]; // organic polaroid angles

export function ImageGalleryUpload({ value, onChange, max = 6 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = max - value.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const added = await Promise.all(
      picked.map(async (file) => ({
        id: clientId("img"),
        name: file.name,
        // Downscale to keep the persisted draft under the localStorage quota;
        // fall back to the raw file if the browser can't decode it (e.g. HEIC).
        dataUrl: await downscaleImageToWebP(file).catch(() =>
          readFileAsDataUrl(file)
        ),
      }))
    );
    onChange([...value, ...added]);
  };

  const remove = (id: string) => onChange(value.filter((i) => i.id !== id));
  const full = value.length >= max;

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {value.map((img, i) => (
        <div
          key={img.id}
          className="group relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-xl border-4 border-white bg-muted shadow-[0_4px_16px_rgba(31,30,29,0.14)]"
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
            onClick={() => remove(img.id)}
            className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}

      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/4] w-32 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-4 border-dashed border-white bg-muted/40 text-muted-foreground transition-colors hover:bg-muted"
          style={{ transform: `rotate(${TILT[value.length % TILT.length]}deg)` }}
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">Add photo</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
