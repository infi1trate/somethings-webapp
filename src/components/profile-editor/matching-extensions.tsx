"use client";

// §4 Phase 3 matching-profile extensions: "First messages" and "First moment
// story" section editors. Both are chat-delivered content — they never render
// in the phone preview. Edits write straight to the draft (matching-editor
// paradigm), so dirty detection + the Send-for-review CTA pick them up via
// PROFILE_SECTIONS. Reordering has a keyboard alternative (up/down // earlier/
// later buttons) per §6 / WCAG 2.5.7; moves are announced to screen readers.

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  GripVertical,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { Textarea } from "@/components/ui/textarea";
import { downscaleImageToWebP, readFileAsDataUrl, clientId } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { FirstMessage, FirstMessages, StorySlide } from "@/lib/types";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// 44px targets (WCAG 2.5.8 at the spec's bar — Phase 8 sweep).
const ICON_BTN =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] disabled:opacity-35 disabled:hover:bg-transparent";

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ── First messages ──────────────────────────────────────────────────────────

type Channel = "online" | "offline";
const CHANNELS: { id: Channel; label: string }[] = [
  { id: "online", label: "Online" },
  { id: "offline", label: "Offline" },
];

export function FirstMessagesEditor({
  value,
  onChange,
}: {
  value: FirstMessages;
  onChange: (next: FirstMessages) => void;
}) {
  const [channel, setChannel] = useState<Channel>("online");
  const [compose, setCompose] = useState("");
  const [announce, setAnnounce] = useState("");
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragFrom = useRef<number | null>(null);

  const list = value[channel];
  const setList = (next: FirstMessage[]) =>
    onChange({ ...value, [channel]: next });

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    setList(arrayMove(list, index, to));
    setAnnounce(`Moved to position ${to + 1} of ${list.length}`);
  };

  const selectChannel = (i: number) => {
    const c = CHANNELS[(i + CHANNELS.length) % CHANNELS.length];
    segRefs.current[CHANNELS.indexOf(c)]?.focus();
    setChannel(c.id);
  };

  const add = () => {
    const text = compose.trim();
    if (!text) return;
    setList([...list, { id: clientId("fm"), text }]);
    setCompose("");
  };

  return (
    <div className="space-y-4">
      {/* Online/Offline segmented control — arrow-key navigable (§6). */}
      <div
        role="tablist"
        aria-label="First-message channel"
        className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-s1)] p-1"
      >
        {CHANNELS.map((c, i) => {
          const active = channel === c.id;
          const count = value[c.id].length;
          return (
            <button
              key={c.id}
              ref={(el) => {
                segRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setChannel(c.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  selectChannel(i + 1);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  selectChannel(i - 1);
                }
              }}
              className={cn(
                "min-h-11 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                RING,
                active
                  ? "bg-[var(--text-primary)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Reorderable message list — drag handle + keyboard up/down (2.5.7). */}
      {list.length === 0 ? (
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Nothing here yet. Add your first {channel} message below.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((m, i) => (
            <li
              key={m.id}
              draggable
              onDragStart={() => {
                dragFrom.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom.current !== null && dragFrom.current !== i) {
                  setList(arrayMove(list, dragFrom.current, i));
                }
                dragFrom.current = null;
              }}
              className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2.5"
            >
              <span
                aria-hidden
                className="mt-1 cursor-grab text-[var(--text-muted)]"
                title="Drag to reorder"
              >
                <GripVertical className="size-4" />
              </span>
              <p className="min-w-0 flex-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
                {m.text}
              </p>
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move message ${i + 1} up`}
                  className={cn(ICON_BTN, RING)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === list.length - 1}
                  aria-label={`Move message ${i + 1} down`}
                  className={cn(ICON_BTN, RING)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setList(list.filter((x) => x.id !== m.id))}
                  aria-label={`Delete message ${i + 1}`}
                  className={cn(ICON_BTN, RING)}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      {/* Composer */}
      <div className="space-y-2">
        <Textarea
          aria-label={`New ${channel} message`}
          rows={2}
          placeholder="hey! so glad you reached out…"
          value={compose}
          onChange={(e) => setCompose(e.target.value)}
        />
        <PillButton onClick={add} disabled={!compose.trim()}>
          Add message
        </PillButton>
      </div>
    </div>
  );
}

// ── First moment story ──────────────────────────────────────────────────────

const MAX_SLIDES = 6;

export function StorySlidesEditor({
  value,
  onChange,
}: {
  value: StorySlide[];
  onChange: (next: StorySlide[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [announce, setAnnounce] = useState("");
  const dragFrom = useRef<number | null>(null);

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= value.length) return;
    onChange(arrayMove(value, index, to));
    setAnnounce(`Moved to slide ${to + 1} of ${value.length}`);
  };

  const onFile = async (file?: File) => {
    if (!file || value.length >= MAX_SLIDES) return;
    setProcessing(true);
    try {
      const photo = await downscaleImageToWebP(file).catch(() =>
        readFileAsDataUrl(file)
      );
      onChange([...value, { id: clientId("slide"), photo }]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Nothing here yet. Add your first slide.
        </p>
      )}

      <ul className="flex flex-wrap gap-3" aria-label="Story slides, in order">
        {value.map((s, i) => (
          <li
            key={s.id}
            draggable
            onDragStart={() => {
              dragFrom.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom.current !== null && dragFrom.current !== i) {
                onChange(arrayMove(value, dragFrom.current, i));
              }
              dragFrom.current = null;
            }}
            className="group relative w-[132px]"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.photo}
                alt={`Slide ${i + 1}`}
                className="size-full object-cover"
              />
              <span className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 text-[10px] font-medium leading-4 text-white">
                {i + 1}
              </span>
            </div>
            {/* Keyboard reorder alternative (2.5.7) + delete — all 44px
                targets, in a control row under the tile (Phase 8 sweep). */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move slide ${i + 1} earlier`}
                className={cn(ICON_BTN, RING)}
              >
                <ArrowLeft className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== s.id))}
                aria-label={`Delete slide ${i + 1}`}
                className={cn(ICON_BTN, RING)}
              >
                <X className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                aria-label={`Move slide ${i + 1} later`}
                className={cn(ICON_BTN, RING)}
              >
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}

        {value.length < MAX_SLIDES && (
          <li className="w-[132px]">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              aria-label="Add a slide"
              className={cn(
                "flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:border-[var(--button-border-default)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              {processing ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              <span className="text-[11px] font-medium leading-tight">
                Add slide
              </span>
            </button>
          </li>
        )}
      </ul>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

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
