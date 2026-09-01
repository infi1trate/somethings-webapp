"use client";

// THE CONVERSATION EXCERPT — what was said around the flagged line.
//
// ═══ WHAT IT REPLACES ═══
//
// A styled `QuoteBlock` holding one string. That block answered "what was said";
// the question a supervisor is actually asked — "was this flagged correctly?" —
// is about what surrounds it. A line reading "idk it's fine" is unremarkable
// after a joke and worth a second look after a disclosure, and the quote could
// not tell those apart.
//
// The provenance the quote carried is not lost: the flagged message is still
// visibly the teen's own words, still attributed, still the exact string the AI
// rationale below quotes.
//
// ═══ IT IS A SCROLL REGION INSIDE A SCROLL REGION, AND THAT IS THE HARD PART ═══
//
// The pane scrolls. This scrolls. Nesting those is normally a mistake — it is
// the exact defect the care-update modal was rebuilt to remove — and it is
// correct here for one reason: the inner region is BOUNDED AND MARKED. It has a
// border, a fixed height and an obvious edge, so a reader can see which box their
// gesture belongs to. An unbounded nested scroller is ambiguous; a bounded one is
// a component.
//
// `overscroll-contain` is what keeps that promise: reaching the end of the
// excerpt does NOT hand the gesture to the pane behind it, so a reader scrolling
// the transcript never loses their place in the pane. Without it the two regions
// feel like one broken one.

import { useCallback, useEffect, useRef } from "react";
import { AlertTriangle, MessageSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationMessage } from "@/lib/tasks/conversation";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ~320px per the brief. Tall enough to hold roughly six exchanges — the amount
 *  it takes to read a turn of conversation — and short enough that the pane's own
 *  actions stay on screen beneath it. */
const REGION_H = "h-[320px]";

const SHELL =
  "rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)]";

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ═══ THE BUBBLE ═══
 *
 *  Simplified deliberately: sender, time, text. No avatars, no reactions, no read
 *  receipts — this is evidence for a decision, not a chat client, and every
 *  affordance that suggests otherwise invites a supervisor to try to reply from
 *  here.
 *
 *  ROLE IS A TINT AND A SIDE, not a label repeated on every line. The teen's
 *  messages sit left on the card surface; the mentor's sit right in a quieter
 *  fill. The name is still printed on every bubble because tint alone cannot
 *  carry it (1.4.1) and because a reader scanning for one speaker should not have
 *  to infer from alignment. */
function Bubble({
  m,
  flaggedRef,
}: {
  m: ConversationMessage;
  flaggedRef?: React.Ref<HTMLLIElement>;
}) {
  const mine = m.sender === "mentor";
  return (
    <li
      ref={flaggedRef}
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      <p className="flex items-center gap-1.5 px-1 text-[11.5px] leading-[16px] text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text-secondary)]">
          {m.senderName}
        </span>
        <time dateTime={new Date(m.at).toISOString()}>{timeOf(m.at)}</time>
      </p>
      <div
        className={cn(
          "relative max-w-[85%] rounded-[var(--radius-control)] px-3 py-2 text-[13.5px] leading-[19px]",
          mine
            ? "bg-[var(--surface-s2)] text-[var(--text-primary)]"
            : "bg-[var(--surface-card)] text-[var(--text-primary)]",
          // ═══ THE FLAGGED MESSAGE, MARKED THREE WAYS ═══
          // Tint, a gutter marker, and text in the accessible name. Colour is
          // never the only carrier (SC 1.4.1) — and here that is not a formality:
          // the whole point of the highlight is to say WHICH line the decision is
          // about, so a reader who cannot see the tint would otherwise be reading
          // an undifferentiated transcript.
          // `--band-amber-*` — THE RECORD'S OWN RISK-FLAG BAND, and an existing
          // token pair (7.24:1 in light, 5.73:1 in dark). The first version of
          // this reached for `--status-warning-bg`, WHICH DOES NOT EXIST: an
          // undefined custom property makes `background-color` resolve to
          // `rgba(0,0,0,0)`, so the "highlight" was transparent and the flagged
          // message looked like every other bubble. Nothing errors, nothing warns
          // — measured, not noticed. Zero new tokens is the rule; this is why.
          m.flagged &&
            "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)] ring-1 ring-[color:var(--band-amber-fg)]/25"
        )}
      >
        {/* THE GUTTER MARKER. `-left-6` put it 24px left of the bubble — which is
            OUTSIDE the region's own padding, so it was clipped away entirely
            (measured: marker at x=657, region edge at x=664). The region now
            carries `pl-9` to give the gutter real room, and the marker sits
            inside it. A marker nobody can see is not a second carrier. */}
        {m.flagged && (
          <span className="absolute -left-[26px] top-1.5">
            <AlertTriangle
              className="size-4 text-[var(--band-amber-fg)]"
              aria-hidden
            />
          </span>
        )}
        {m.flagged && <span className="sr-only">Flagged message. </span>}
        {m.text}
      </div>
    </li>
  );
}

/** Three bubble placeholders, at the heights real bubbles occupy — so resolving
 *  the excerpt does not move the pane under the reader's eye. */
export function ConversationExcerptSkeleton() {
  return (
    <div className={cn(SHELL, REGION_H, "overflow-hidden p-3")} aria-hidden>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1",
              i === 1 ? "items-end" : "items-start"
            )}
          >
            <div className="h-4 w-24 rounded bg-[var(--surface-s2)]" />
            <div
              className={cn(
                "h-[38px] rounded-[var(--radius-control)] bg-[var(--surface-s2)]",
                i === 1 ? "w-[55%]" : "w-[70%]"
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationExcerpt({
  conversation,
  teenName,
  href,
  state = "ready",
  onRetry,
  /** TODO-COPY. Escalations get context, not evidence — the label says which. */
  label,
}: {
  conversation: Conversation | null;
  teenName: string;
  href: string;
  state?: "ready" | "loading" | "error";
  onRetry?: () => void;
  label?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLLIElement>(null);

  /** ═══ ANCHOR WITHOUT SCROLLING THE PAGE ═══
   *
   *  `scrollIntoView` would scroll every ancestor that can scroll — the pane, and
   *  the page behind it — so opening a flag would yank the whole surface. Setting
   *  `scrollTop` on the region itself moves ONLY the region, which is the entire
   *  difference between anchoring and hijacking.
   *
   *  Centred rather than top-aligned: the messages BEFORE the flag are the ones
   *  that give it meaning, so landing with the flagged line at the top would hide
   *  the half that matters most. */
  const anchor = useCallback((smooth: boolean) => {
    const region = scrollRef.current;
    const el = anchorRef.current;
    if (!region || !el) return;
    /** ═══ RECTS, NOT `offsetTop` ═══
     *  `offsetTop` is measured from the nearest POSITIONED ancestor, and this
     *  region is static — so it returned an offset relative to something far up
     *  the tree, the computed target overshot `scrollHeight`, and the browser
     *  clamped it to the bottom. The excerpt opened at the END of the
     *  conversation while `scrollTop > 0` made it look anchored.
     *  The rect delta is relative to the region by construction, whatever either
     *  element's `position` happens to be. */
    const regionRect = region.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.top - regionRect.top;
    const top =
      region.scrollTop + delta - region.clientHeight / 2 + elRect.height / 2;
    region.scrollTo({
      top: Math.max(0, Math.min(top, region.scrollHeight - region.clientHeight)),
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  /** RE-ANCHORS WHEN THE ANCHOR CHANGES, which is the coalesced-flag case: picking
   *  a different child flag swaps `conversation` and must move the excerpt without
   *  the pane remounting. Keyed on the anchor id rather than on the object so a
   *  re-render with equal data does not re-scroll under the reader. */
  useEffect(() => {
    if (state !== "ready" || !conversation) return;
    // The first anchor is instant — a smooth scroll on open reads as the panel
    // settling and draws the eye to the motion instead of the message.
    anchor(false);
  }, [state, conversation?.anchorId, anchor, conversation]);

  const regionLabel =
    label ?? `Conversation excerpt, flagged message from ${teenName}`;

  if (state === "loading") return <ConversationExcerptSkeleton />;

  if (state === "error") {
    return (
      <div className={cn(SHELL, "flex flex-col items-start gap-2 p-4")}>
        <p className="text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
          {/* TODO-COPY. Names what failed, so it cannot be read as "this flag has
              no conversation" — an absence and a failure mean opposite things to
              someone deciding whether a flag was correct. */}
          Couldn&apos;t load the conversation.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] font-semibold text-[var(--text-primary)]",
              "transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            <RefreshCw className="size-3.5 shrink-0" aria-hidden />
            {/* TODO-COPY */}
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!conversation) return null;

  return (
    <div>
      <div
        ref={scrollRef}
        // FOCUSABLE AND LABELLED. A scroll region that keyboard users cannot
        // reach is the `scrollable-region-focusable` failure; `tabIndex={0}` plus
        // a group role and a name is what makes it operable and announced.
        tabIndex={0}
        role="group"
        aria-label={regionLabel}
        className={cn(
          SHELL,
          REGION_H,
          // `overscroll-contain` — see the module note. This is the line that
          // stops the excerpt from hijacking the pane's scroll at its edges.
          // `pl-9` — the gutter the flag marker lives in. See the marker's note.
          "overflow-y-auto overscroll-contain py-3 pl-9 pr-4",
          RING
        )}
      >
        {conversation.truncatedStart && (
          <p className="pb-3 text-center text-[12px] leading-[16px] text-[var(--text-muted)]">
            {/* TODO-COPY. A quiet edge marker, not a control: there is no
                pagination in v1, and a button that loaded nothing would be worse
                than a sentence that explains the boundary. */}
            Earlier messages in the full conversation
          </p>
        )}
        <ul className="space-y-4">
          {conversation.messages.map((m) => (
            <Bubble
              key={m.id}
              m={m}
              flaggedRef={m.id === conversation.anchorId ? anchorRef : undefined}
            />
          ))}
        </ul>
      </div>

      {/* PINNED BELOW, ALWAYS. The excerpt is a window; the way out of it is not
          something a reader should have to scroll to find. */}
      <Link
        href={href}
        className={cn(
          "mt-2.5 inline-flex items-center gap-1.5 rounded-sm py-1.5 text-[13px] font-semibold text-[var(--text-primary)]",
          "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
          RING
        )}
      >
        <MessageSquare className="size-3.5 shrink-0" aria-hidden />
        {/* TODO-COPY */}
        Open full conversation
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
