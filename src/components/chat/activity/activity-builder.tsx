"use client";

// BUILDING A SET, ONE CARD AT A TIME, WITH A REVIEW BEFORE IT GOES.
//
// ═══ WHY ONE CARD AT A TIME ═══
//
// The alternative is a list of eight prompts with checkboxes, which is faster for a
// mentor who already knows what they want and much worse for the one who does not:
// eight simultaneous decisions, no default, and a "Select all" that is the easiest
// thing on the screen. What a mentor actually does is read a prompt and think "yes,
// that one" or "not for them" — one decision at a time, in order.
//
// It also makes the decision about THIS TEEN. A prompt read on its own gets judged
// against the person it would go to; the same prompt in a list of eight gets judged
// against the other seven.
//
// ═══ THE ACTIONS ARE LABELLED, AND THEY ARE NOT A THUMB PAIR ═══
//
// "Include" and "Skip", as words, side by side. Not a tick and a cross, which is
// what the surface this replaces used, and which has no agreed meaning — a cross on
// a prompt could plausibly mean "delete this prompt from the library".
//
// Nothing is destructive and nothing is irreversible: Back returns to the previous
// card with its decision intact, and the review step is where a set actually gets
// sent. So neither action needs a confirmation, which is why neither has one.
//
// ═══ REVIEW IS A SEPARATE STEP, NOT A CONFIRM DIALOG ═══
//
// The mentor sees exactly what will arrive, in order, with the chance to remove any
// of it. A dialog asking "Send 3 questions?" tests whether they meant to press the
// button; a review step tests whether the SET IS RIGHT, which is the question that
// matters when the recipient is a fifteen-year-old who will read all of it.

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Send, X } from "lucide-react";
import { ITEM_POOL } from "@/lib/chat/activities";
import { ActivityCover } from "@/components/chat/activity/activity-cover";
import { PanelSection } from "@/components/chat/rail/rail-panel";
import type { ActivityDef, SentArtifactItem } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** How many prompts a mentor is offered. More than the set's own `count`, so
 *  skipping is real — a deck of exactly three where all three must be kept is not a
 *  choice, it is a formality with extra steps. */
const DECK = 6;

type Step = "deck" | "review";

export function ActivityBuilder({
  def,
  onCancel,
  onSend,
}: {
  def: ActivityDef;
  onCancel: () => void;
  onSend: (items: SentArtifactItem[]) => void;
}) {
  /** The deck, fixed at mount. Slicing the pool per render would reshuffle the
   *  cards under a mentor mid-decision. */
  const deck = useMemo(
    () => ITEM_POOL[def.id].slice(0, DECK).map((text, i) => ({ id: `i${i + 1}`, text })),
    [def.id]
  );

  const [step, setStep] = useState<Step>("deck");
  const [at, setAt] = useState(0);
  /** Kept ids, in the order they were kept — which is the order they will arrive
   *  in, and the order the review step shows. */
  const [kept, setKept] = useState<string[]>([]);

  const card = deck[at];
  const target = def.meta.count;
  const full = kept.length >= target;
  const last = at >= deck.length - 1;

  const decide = (include: boolean) => {
    const next = include ? [...kept, card.id] : kept;
    setKept(next);
    /* ═══ THE DECK ENDS WHEN THE SET IS FULL, NOT WHEN THE CARDS RUN OUT ═══
       Asking a mentor to keep pressing Skip through three more prompts after they
       have chosen their three is asking them to do work with no outcome. */
    if (next.length >= target || last) {
      setStep("review");
      return;
    }
    setAt((i) => i + 1);
  };

  const back = () => {
    if (at === 0) {
      onCancel();
      return;
    }
    const prev = at - 1;
    // Undo the previous card's decision, so going back genuinely returns to it
    // rather than leaving a keep behind that the review step would still show.
    setKept((k) => k.filter((id) => id !== deck[prev].id));
    setAt(prev);
  };

  const items = kept.map((id) => deck.find((d) => d.id === id)!);

  // ── Review ───────────────────────────────────────────────────────────────
  if (step === "review") {
    return (
      <div className="space-y-4">
        <PanelSection label={`${def.name} · review`}>
          <p
            className="text-[var(--text-secondary)]"
            style={{ font: "var(--type-body)" }}
          >
            {/* TODO-COPY. Names the recipient's experience, not the mechanism:
                what a mentor is checking is what SHE will see. */}
            {items.length === 0
              ? "You haven't kept any yet. Go back and pick at least one."
              : `This is what they'll get, in this order.`}
          </p>
        </PanelSection>

        {items.length > 0 && (
          <ol className="space-y-2">
            {items.map((item, i) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="mt-px shrink-0 tabular-nums text-[var(--text-muted)]"
                  style={{ font: "var(--type-field-label)" }}
                >
                  {i + 1}
                </span>
                <span
                  className="min-w-0 flex-1 text-[var(--text-primary)]"
                  style={{ font: "var(--type-body)" }}
                >
                  {item.text}
                </span>
                {/* REMOVABLE HERE, which is what makes this a review rather than a
                    confirmation. Named, because an X on its own could mean the
                    prompt or the whole set. */}
                <button
                  type="button"
                  aria-label={`Remove: ${item.text}`}
                  title="Remove"
                  onClick={() => setKept((k) => k.filter((id) => id !== item.id))}
                  className={cn(
                    "-my-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)]",
                    "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                    RING
                  )}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStep("deck");
              // Back into the deck at the card after the last one seen, so a
              // mentor adding one more does not re-read what they already judged.
              setAt(Math.min(at, deck.length - 1));
            }}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 text-[var(--text-primary)]",
              "transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
            style={{ font: "var(--type-body)" }}
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            {/* TODO-COPY */}
            Back
          </button>
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => onSend(items)}
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 transition-colors",
              items.length === 0
                ? "bg-[var(--surface-s2)] text-[var(--text-muted)]"
                : "bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90",
              RING
            )}
            style={{ font: "var(--type-button)" }}
          >
            <Send className="size-3.5 shrink-0" aria-hidden />
            {/* ═══ THE BUTTON NAMES WHAT IT WILL SEND ═══
                "Send" alone is the same words whether one card is kept or three, so
                the last check before something reaches a teen is a button that
                cannot be wrong. TODO-COPY. */}
            Send {items.length} {def.meta.unit}
            {items.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    );
  }

  // ── Deck ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ActivityCover def={def} variant="detail" />

      <PanelSection
        label={`Card ${at + 1} of ${deck.length}`}
        action={
          <span
            className="tabular-nums text-[var(--text-muted)]"
            style={{ font: "var(--type-field-label)" }}
          >
            {/* TODO-COPY. Progress against the SET, not against the deck — what a
                mentor is tracking is how many they have chosen. */}
            {kept.length}/{target} kept
          </span>
        }
      >
        {/* ═══ ONE CARD ═══
            A tinted inset at the panel's own radius, tall enough that a two-line
            prompt does not change the panel's height — a deck that resizes between
            cards makes the action row move under the mentor's cursor. */}
        <div
          aria-live="polite"
          className="flex min-h-[104px] items-center rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-4 py-4"
        >
          <p
            className="text-[var(--text-primary)]"
            style={{
              font: "var(--type-message)",
              letterSpacing: "var(--type-message-tracking)",
            }}
          >
            {card.text}
          </p>
        </div>
      </PanelSection>

      {/* ═══ LABELLED ACTIONS, NOT A THUMB PAIR ═══ */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => decide(false)}
          className={cn(
            "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-[color:var(--border-contour)] text-[var(--text-primary)]",
            "transition-colors hover:bg-[var(--tint-hover)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        >
          <X className="size-4 shrink-0" aria-hidden />
          {/* TODO-COPY. "Skip", not "No" — the mentor is not judging the prompt,
              they are deciding it is not for this teen right now. */}
          Skip
        </button>
        <button
          type="button"
          disabled={full}
          onClick={() => decide(true)}
          className={cn(
            "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full transition-colors",
            full
              ? "bg-[var(--surface-s2)] text-[var(--text-muted)]"
              : "bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90",
            RING
          )}
          style={{ font: "var(--type-button)" }}
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {/* TODO-COPY */}
          Include
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={back}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[var(--text-secondary)]",
            "transition-colors hover:text-[var(--text-primary)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          {/* TODO-COPY. The first card's Back leaves the builder, which is why the
              label does not promise a card. */}
          {at === 0 ? "All activities" : "Previous"}
        </button>
        {kept.length > 0 && (
          <button
            type="button"
            onClick={() => setStep("review")}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-2 text-[var(--text-secondary)]",
              "underline decoration-[color:var(--border-contour)] underline-offset-2",
              "transition-colors hover:text-[var(--text-primary)]",
              RING
            )}
            style={{ font: "var(--type-body)" }}
          >
            {/* TODO-COPY. An early exit for a mentor who has what they want and
                does not need the rest of the deck. */}
            Review {kept.length}
          </button>
        )}
      </div>

      {/* THE METADATA LINE IS NOT REPEATED HERE. It was, and a screenshot showed
          "3 questions · ~2 min" twice in one 320px panel — once on the cover at the
          top and once at the bottom. The cover's is the one a mentor reads before
          starting; a second copy below the actions is the same fact competing with
          itself. */}
    </div>
  );
}
