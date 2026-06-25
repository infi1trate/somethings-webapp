"use client";

import { useEffect, useRef } from "react";
import { ImagePlus, X, type LucideIcon } from "lucide-react";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { INTEREST_OPTIONS } from "@/lib/options";
import { iconFor } from "@/lib/interest-icons";
import { downscaleImageToWebP, readFileAsDataUrl } from "@/lib/files";
import type { InterestEntry } from "@/lib/types";

interface Props {
  value: InterestEntry[];
  onChange: (next: InterestEntry[]) => void;
  /** How many photos the step nudges toward (for the progress hint). */
  photosNeeded?: number;
}

export function InterestsDeckField({ value, onChange, photosNeeded = 3 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null); // interest a photo is being added to
  // Image processing is async — read the latest value here so a slow downscale
  // doesn't write onto a stale list.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const names = value.map((e) => e.name);
  const withPhoto = value.filter((e) => e.photo).length;

  const patch = (name: string, change: (e: InterestEntry) => InterestEntry) =>
    onChange(valueRef.current.map((e) => (e.name === name ? change(e) : e)));

  // Toggle interests → keep entries (and their photos), append new, drop removed.
  const onChips = (next: string[]) => {
    const byName = new Map(value.map((e) => [e.name, e]));
    onChange(next.map((n) => byName.get(n) ?? { name: n, photo: null }));
  };

  const pickPhotoFor = (name: string) => {
    targetRef.current = name;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const name = targetRef.current;
    targetRef.current = null;
    if (!file || !name) return;
    const dataUrl = await downscaleImageToWebP(file).catch(() =>
      readFileAsDataUrl(file)
    );
    patch(name, (e) => ({ ...e, photo: dataUrl }));
  };

  const clearPhoto = (name: string) => {
    patch(name, (e) => ({ ...e, photo: null }));
  };

  // Picker order: the mentor's chosen interests first, then the rest.
  const chipOptions = [
    ...names.filter((n) => INTEREST_OPTIONS.includes(n)),
    ...INTEREST_OPTIONS.filter((o) => !names.includes(o)),
  ];

  return (
    <div className="space-y-5">
      <MultiSelectChips
        options={chipOptions}
        value={names}
        onChange={onChips}
        max={8}
      />

      {value.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Add a photo of you doing each
            </p>
            <p className={cnCount(withPhoto, photosNeeded)}>
              {withPhoto}/{photosNeeded} photos
            </p>
          </div>

          {/* One labeled card per selected interest — every interest↔photo pair
              is visible at once, so the 1:1 bond is explicit (vs. one-at-a-time
              swiping). A grid (not a scroll row) also keeps this clearly distinct
              from the vibe step. */}
          <div className="grid grid-cols-2 gap-3">
            {value.map((entry) => (
              <div
                key={entry.name}
                className="aspect-[3/4] animate-in fade-in zoom-in-95 duration-300"
              >
                <InterestCard
                  entry={entry}
                  Icon={iconFor(entry.name)}
                  onPickPhoto={() => pickPhotoFor(entry.name)}
                  onClearPhoto={() => clearPhoto(entry.name)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

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

function cnCount(have: number, need: number) {
  return have >= need
    ? "text-xs font-medium tabular-nums text-emerald-600"
    : "text-xs font-medium tabular-nums text-muted-foreground";
}

function InterestCard({
  entry,
  Icon,
  onPickPhoto,
  onClearPhoto,
}: {
  entry: InterestEntry;
  Icon: LucideIcon;
  onPickPhoto: () => void;
  onClearPhoto: () => void;
}) {
  // Keep taps on controls from starting a deck drag.
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div className="relative size-full overflow-hidden rounded-3xl border-4 border-white bg-muted shadow-[0_14px_34px_rgba(31,30,29,0.2)]">
      {entry.photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.photo}
            alt={entry.name}
            className="size-full object-cover"
          />
          <button
            type="button"
            onPointerDown={stop}
            onClick={onClearPhoto}
            aria-label="Remove photo"
            className="absolute right-2.5 top-2.5 z-10 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          >
            <X className="size-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onPointerDown={stop}
          onClick={onPickPhoto}
          className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#b164ff]/15 to-[#71e0ff]/20 px-6 text-center transition-colors hover:from-[#b164ff]/25 hover:to-[#71e0ff]/30"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-white text-foreground shadow-sm">
            <ImagePlus className="size-7" />
          </span>
          <span className="text-sm font-medium text-foreground/80">
            Add a photo of you doing{" "}
            <span className="font-semibold text-foreground">{entry.name}</span>
          </span>
        </button>
      )}

      {/* Interest pill — top-left, like the teen profile */}
      <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-black/35 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
        <Icon className="size-4" />
        {entry.name}
      </span>
    </div>
  );
}
