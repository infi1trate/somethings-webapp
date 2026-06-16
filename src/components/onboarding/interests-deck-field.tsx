"use client";

import { useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  X,
  Loader2,
  Check,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { SwipeDeck } from "@/components/onboarding/swipe-deck";
import { INTEREST_OPTIONS } from "@/lib/options";
import { iconFor } from "@/lib/interest-icons";
import { downscaleImageToWebP, readFileAsDataUrl } from "@/lib/files";
import { suggestInterests } from "@/lib/suggest-interests";
import type { InterestEntry } from "@/lib/types";

interface Props {
  value: InterestEntry[];
  onChange: (next: InterestEntry[]) => void;
  /** How many photos the step nudges toward (for the progress hint). */
  photosNeeded?: number;
}

type Verdict =
  | { state: "checking" }
  | { state: "match" }
  | { state: "mismatch"; suggested: string };

export function InterestsDeckField({ value, onChange, photosNeeded = 3 }: Props) {
  const [index, setIndex] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null); // interest a photo is being added to
  // Async (AI) callbacks resolve after re-renders — read latest from here.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const names = value.map((e) => e.name);
  const withPhoto = value.filter((e) => e.photo).length;

  const patch = (name: string, change: (e: InterestEntry) => InterestEntry) =>
    onChange(valueRef.current.map((e) => (e.name === name ? change(e) : e)));

  const setVerdict = (name: string, v: Verdict | null) =>
    setVerdicts((prev) => {
      const next = { ...prev };
      if (v) next[name] = v;
      else delete next[name];
      return next;
    });

  // Toggle interests → keep entries (and their photos), append new, drop removed.
  const onChips = (next: string[]) => {
    const byName = new Map(value.map((e) => [e.name, e]));
    const merged = next.map((n) => byName.get(n) ?? { name: n, photo: null });
    onChange(merged);
    const added = next.find((n) => !byName.has(n));
    if (added) {
      const i = merged.findIndex((e) => e.name === added);
      if (i >= 0) setIndex(i);
    } else {
      setIndex((cur) => Math.max(0, Math.min(cur, merged.length - 1)));
    }
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
    // Confirm the photo actually matches the chosen interest.
    setVerdict(name, { state: "checking" });
    const shows = await suggestInterests(dataUrl, [name]);
    setVerdict(
      name,
      shows.length === 0 || shows.includes(name)
        ? { state: "match" }
        : { state: "mismatch", suggested: shows[0] }
    );
  };

  const clearPhoto = (name: string) => {
    patch(name, (e) => ({ ...e, photo: null }));
    setVerdict(name, null);
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
            <p
              className={cnCount(withPhoto, photosNeeded)}
            >
              {withPhoto}/{photosNeeded} photos
            </p>
          </div>

          <SwipeDeck
            count={value.length}
            index={Math.min(index, value.length - 1)}
            onIndexChange={setIndex}
            className="mx-auto aspect-[3/4] w-[84%] max-w-[300px]"
            renderCard={(i) => {
              const entry = value[i];
              if (!entry) return null;
              return (
                <InterestCard
                  entry={entry}
                  Icon={iconFor(entry.name)}
                  verdict={verdicts[entry.name]}
                  onPickPhoto={() => pickPhotoFor(entry.name)}
                  onClearPhoto={() => clearPhoto(entry.name)}
                  onKeep={() => setVerdict(entry.name, { state: "match" })}
                />
              );
            }}
          />
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
  verdict,
  onPickPhoto,
  onClearPhoto,
  onKeep,
}: {
  entry: InterestEntry;
  Icon: LucideIcon;
  verdict?: Verdict;
  onPickPhoto: () => void;
  onClearPhoto: () => void;
  onKeep: () => void;
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

      {/* AI match-confirm */}
      {entry.photo && verdict && (
        <div className="absolute inset-x-2.5 bottom-2.5" onPointerDown={stop}>
          {verdict.state === "checking" && (
            <div className="flex items-center justify-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              <Loader2 className="size-3.5 animate-spin" />
              Checking your photo…
            </div>
          )}
          {verdict.state === "match" && (
            <div className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              <Check className="size-3.5" />
              Looks like {entry.name}
            </div>
          )}
          {verdict.state === "mismatch" && (
            <div className="space-y-2 rounded-2xl bg-black/70 p-2.5 text-white backdrop-blur">
              <p className="flex items-center gap-1.5 text-xs leading-snug">
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                This reads more like {verdict.suggested} — keep it?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onKeep}
                  className="flex-1 rounded-full bg-white/20 px-2 py-1 text-xs font-medium transition-colors hover:bg-white/30"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={onPickPhoto}
                  className="flex-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-white/90"
                >
                  Replace
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
