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
  Trash2,
  X,
} from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { Textarea } from "@/components/ui/textarea";
import { downscaleImageToWebP, readFileAsDataUrl, clientId } from "@/lib/files";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/record/segmented-control";
import type { FirstMessage, FirstMessages, StorySlide } from "@/lib/types";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// 44px targets (WCAG 2.5.8 at the spec's bar — Phase 8 sweep).
const ICON_BTN =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-press)] hover:text-[var(--text-primary)] disabled:opacity-35 disabled:hover:bg-transparent";

// REMOVE, NOT AN X. The delete control used to be a bare X sitting between the
// two reorder arrows — three identical icon buttons in a row, where the
// destructive one read as "close" or "cancel" rather than "take this image off
// the story". It now says the word, carries a trash glyph, and is tinted with
// the error colour so it stops looking like a sibling of the arrows.
const REMOVE_BTN =
  "flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-[var(--state-error)] transition-colors hover:bg-[var(--alert-critical-bg)]";

// Tiles widened from 132px so the control row fits on ONE line: two 44px arrows
// plus a labelled Remove need ~164px, and at 132 they overflowed the tile. The
// bigger image is the better half of the trade anyway — a staff reader opens
// this editor to judge what a teen will see.
// `max-w-full` so a tile in the wrapping list cannot exceed its column. 168px
// already fits a 320px viewport; this is the floor for a narrower container.
const TILE_W = "w-[168px] max-w-full";

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

  const add = () => {
    const text = compose.trim();
    if (!text) return;
    setList([...list, { id: clientId("fm"), text }]);
    setCompose("");
  };

  return (
    <div className="space-y-4">
      {/* Online/Offline is a SEGMENTED CONTROL, not underline tabs. Underline
          tabs are the page-level scope (this screen already has a row of them
          above); repeating that treatment inside a card flattens the hierarchy —
          the two rows read as peers when one is subordinate. A contained pill
          reads as local. semantics="tabs" because these DO switch a visible
          panel, so aria-controls + role="tabpanel" apply. */}
      <SegmentedControl
        size="md"
        semantics="tabs"
        ariaLabel="First-message channel"
        options={CHANNELS.map((c) => ({
          value: c.id,
          label: `${c.label} (${value[c.id].length})`,
          controls: `fm-panel-${c.id}`,
        }))}
        value={channel}
        onChange={setChannel}
      />

      {/* The panel the segments control. Keyed by channel so React remounts it
          on switch, and labelled by its segment for the tabs pattern. */}
      <div
        id={`fm-panel-${channel}`}
        role="tabpanel"
        aria-label={`${channel === "online" ? "Online" : "Offline"} first messages`}
        className="space-y-4"
      >
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
              className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5"
            >
              {/* ═══ THE GRAB HANDLE IS HIDDEN ON TOUCH (Phase 5, item 4) ═══
                  
                  HTML5 `draggable` + `onDragStart` NEVER FIRE on a touch screen —
                  they are mouse-only DOM events, so on a phone this handle
                  advertised an interaction that could not happen. A cursor that
                  says "grab me" and then does nothing is worse than no affordance
                  at all (Nielsen #1: the system's state must be visible, and it
                  was lying).
                  
                  REMOVED RATHER THAN REPLACED WITH A TOUCH DRAG, because the
                  keyboard alternative below (↑/↓/delete, `:157–182`) is already
                  built, already satisfies SC 2.5.7 Dragging Movements, and works
                  identically under touch — those are real buttons. There is
                  nothing to add; there was only something to stop implying.
                  
                  `(pointer: coarse)` rather than a viewport width: a tablet with
                  a mouse should keep the handle, and a narrow desktop window
                  should too. The question is the input device, not the size.
                  
                  THE `title=` GOES WITH IT. A native tooltip never appears on
                  touch and is unreachable by keyboard, so it could not have
                  carried this information anyway — and with the handle gone on
                  touch, the only readers who see it are the ones whose cursor
                  already tells them. */}
              <span
                aria-hidden
                className="mt-1 cursor-grab text-[var(--text-muted)] [@media(pointer:coarse)]:hidden"
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
    </div>
  );
}

// ── First moment story ──────────────────────────────────────────────────────

// A story IS three vertical images (user decision) — so three slots, not six,
// and the tiles carry the phone's aspect rather than a 3:4 crop.
const MAX_SLIDES = 3;
const SLIDE_ASPECT = "aspect-[9/16]";

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
    setAnnounce(`Moved to image ${to + 1} of ${value.length}`);
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
          {/* TODO-COPY. Staff-facing now: the mentor never sees this editor. */}
          No story on file yet. Add three vertical images.
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
            className={cn("group relative", TILE_W)}
          >
            <div className={cn("relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-muted", SLIDE_ASPECT)}>
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
            {/* Keyboard reorder alternative (2.5.7) + remove — all 44px
                targets, in a control row under the tile (Phase 8 sweep). The
                arrows stay paired on the left and Remove sits apart on the
                right, so the destructive control isn't one of three lookalikes.
                Arrows are HIDDEN on a single slide: nowhere to move it. */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move image ${i + 1} earlier`}
                className={cn(ICON_BTN, RING, value.length < 2 && "hidden")}
              >
                <ArrowLeft className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                aria-label={`Move image ${i + 1} later`}
                className={cn(ICON_BTN, RING, value.length < 2 && "hidden")}
              >
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== s.id))}
                /* TODO-COPY */
                aria-label={`Remove image ${i + 1}`}
                className={cn(REMOVE_BTN, RING)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove
              </button>
            </div>
          </li>
        ))}

        {value.length < MAX_SLIDES && (
          <li className={TILE_W}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              aria-label="Add a slide"
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:border-[var(--button-border-default)] hover:text-[var(--text-primary)]",
                SLIDE_ASPECT,
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
