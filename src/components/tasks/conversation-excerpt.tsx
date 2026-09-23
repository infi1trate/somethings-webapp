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

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
import { startsCluster } from "@/lib/chat/clustering";
import { TranscriptBubble } from "@/components/chat/transcript-bubble";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationMessage } from "@/lib/tasks/conversation";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ~340px. Tall enough to hold roughly six exchanges — the amount it takes to
 *  read a turn of conversation — and short enough that the pane's own actions
 *  stay on screen beneath it.
 *
 *  IT WAS 320px AND THE AUDIT ASKED FOR 340. Both are inside "~340"; the raise is
 *  taken because the pane's footer is pinned now (Part 1.2), so the twenty pixels
 *  come out of the body's scroll rather than out of the resolve actions. */
const REGION_H = "h-[340px]";

const SHELL =
  "rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)]";

/* `timeOf` AND `Bubble` MOVED to `chat/transcript-bubble.tsx` (addendum §2.4),
   so the escalation timeline renders the same transcript this does rather than
   a second one. `needsHeader` below stays here — see that module's note on why
   the flagged-message break is this surface's alone. */

/** ═══ TIMESTAMP CLUSTERING (Part 5) ═══
 *
 *  Every bubble carried a name-and-time line. In a transcript where one person
 *  sends four messages in ninety seconds, that is four identical headers — the
 *  same name, times a minute apart — and the effect is that the transcript reads
 *  as eight things instead of four, with the reader's eye caught by a label that
 *  never changes.
 *
 *  So a header appears when it is NEWS: the speaker changed, or enough time
 *  passed that the gap itself is information. Five minutes is the threshold —
 *  short enough that a genuine pause in a conversation shows, long enough that a
 *  burst of consecutive messages stays one block. Consecutive messages from one
 *  speaker inside that window are visibly one turn, which is how they were
 *  written.
 *
 *  The FIRST message always gets one, and so does the flagged one: the anchor is
 *  the line the whole pane is about and it must be attributable on sight, even if
 *  it happens to be the third message of a burst. */
/** ═══ THE SHARED RULE, PLUS THIS SURFACE'S OWN REASON (Phase 6) ═══
 *
 *  This held a second `const CLUSTER_MS = 5 * 60_000` and a second copy of the
 *  three branches. The threshold now has one definition in
 *  `lib/chat/clustering.ts` — see its note on why two constants for one clinical
 *  judgment was the part that mattered.
 *
 *  THE FLAGGED BREAK IS NOT PART OF THE SHARED RULE and stays here. It is not a
 *  different answer to "does the cluster break" — it is an ADDITIONAL reason
 *  this surface needs a header: the anchor is the line the whole pane is about
 *  and it must be attributable on sight, even when it is the third message of a
 *  burst. The mentor's thread has no anchor, so it has no such reason. */
function needsHeader(
  m: ConversationMessage,
  prev: ConversationMessage | undefined
): boolean {
  if (m.flagged) return true;
  return startsCluster(m, prev);
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
  /** ═══ SCROLLING IS OPTIONAL, AND ON MONITORING IT IS OFF ═══
   *
   *  The scrolling version is a scroll region inside the pane's scroll region —
   *  defensible here (bounded, marked, `overscroll-contain`) and still a third
   *  scroll region on the page, which Monitoring's locked decision 4 does not
   *  allow. So that surface renders a WINDOW: the flagged message with a few
   *  turns either side, no inner overflow, and the pane's own scroll carrying it.
   *
   *  NOT A SECOND COMPONENT. This is the only transcript renderer the supervisor
   *  surfaces have, and a fork for a scrollbar would be the fourth
   *  message-bubble implementation in the codebase.
   *
   *  THE UNSCROLLED VERSION IS ALSO NOT FOCUSABLE, deliberately: `tabIndex={0}`
   *  plus `role="group"` exists to make a SCROLLABLE region operable by keyboard
   *  (`scrollable-region-focusable`). A block that does not scroll has nothing to
   *  operate, and a focus stop that does nothing is noise in the tab order. */
  scroll = true,
  /** How many turns either side of the flagged message the window holds. Six
   *  total fits the pane without pushing the disposition control off screen —
   *  measured at 1440×1000 with the footer pinned. */
  windowTurns = 3,
}: {
  conversation: Conversation | null;
  teenName: string;
  href: string;
  state?: "ready" | "loading" | "error";
  onRetry?: () => void;
  label?: string;
  scroll?: boolean;
  windowTurns?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLLIElement>(null);
  /** ONE BLOOM PER SELECTION. Keyed by the anchor id rather than a boolean, so
   *  the effect below can set it for the anchor it just scrolled to and a
   *  re-render with the same anchor cannot fire a second one. */
  const [bloomFor, setBloomFor] = useState<string | null>(null);
  /** ═══ THE ROLE CAPTION, DISMISSED FOR GOOD ═══
   *  A supervisor learns "left is the teen, right is the mentor" once and then
   *  reads it fifty more times a shift. Dismissible, and the dismissal sticks for
   *  the session — `localStorage` was considered and rejected: this is a
   *  prototype with no per-user store on this surface, and a preference that
   *  outlives the session but is written nowhere a reader can see or reset is a
   *  worse trade than one they re-dismiss tomorrow. */
  const [captionOpen, setCaptionOpen] = useState(true);

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
    /* AND THEN THE BLOOM, one frame later. In the same commit the ring would
       mount already-wide and there would be nothing to transition FROM — the
       same reason the retiring band in the worklist waits a frame. Cleared after
       the transition so the ring does not sit permanently expanded. */
    const id = conversation.anchorId;
    const on = requestAnimationFrame(() => setBloomFor(id));
    const off = window.setTimeout(() => setBloomFor(null), 320);
    return () => {
      cancelAnimationFrame(on);
      window.clearTimeout(off);
    };
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

  /** THE WINDOW. Centred on the anchor rather than on the array's middle — the
   *  flagged message is the reason the block is here. */
  const anchorIdx = conversation.messages.findIndex((m) => m.id === conversation.anchorId);
  const from = scroll ? 0 : Math.max(0, anchorIdx - windowTurns);
  const to = scroll ? conversation.messages.length : Math.min(conversation.messages.length, anchorIdx + windowTurns + 1);
  const shown = conversation.messages.slice(from, to);
  /* THE EDGE MARKER IS TRUE IN ONE MORE CASE NOW: the fixture was truncated, OR
     the window cut into it. Both mean "there is more above this". */
  const cutAbove = conversation.truncatedStart || from > 0;

  return (
    <div>
      <div
        ref={scrollRef}
        // FOCUSABLE AND LABELLED. A scroll region that keyboard users cannot
        // reach is the `scrollable-region-focusable` failure; `tabIndex={0}` plus
        // a group role and a name is what makes it operable and announced.
        tabIndex={scroll ? 0 : undefined}
        role={scroll ? "group" : undefined}
        aria-label={scroll ? regionLabel : undefined}
        className={cn(
          SHELL,
          scroll && REGION_H,
          // `overscroll-contain` — see the module note. This is the line that
          // stops the excerpt from hijacking the pane's scroll at its edges.
          // `pl-9` — the gutter the flag marker lives in. See the marker's note.
          scroll && "overflow-y-auto overscroll-contain",
          "py-3 pl-9 pr-4",
          scroll && RING
        )}
      >
        {cutAbove && (
          /* ═══ A QUIET EDGE MARKER, CENTRED ON A RULE ═══
             It was a centred sentence with nothing to centre it against, which at
             the top of a scroll region reads as a first message from nobody. A
             hairline running the width with the words sitting in a gap in it says
             "the transcript starts here" as a boundary rather than as content.
             Still not a control: there is no pagination in v1, and a button that
             loaded nothing would be worse than a sentence that explains the
             edge. */
          <p
            className="mb-4 flex items-center gap-2.5 text-[11.5px] leading-[16px] text-[var(--text-muted)]"
            aria-hidden={false}
          >
            <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
            {/* TODO-COPY */}
            <span className="shrink-0">Earlier messages not shown</span>
            <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
          </p>
        )}
        <ul className="space-y-4">
          {shown.map((m, i) => (
            <TranscriptBubble
              key={m.id}
              m={m}
              header={needsHeader(m, shown[i - 1])}
              blooming={bloomFor === m.id}
              flaggedRef={m.id === conversation.anchorId ? anchorRef : undefined}
            />
          ))}
        </ul>
      </div>

      {/* ═══ ONE LINE, ONCE ═══
          Left is the teen, right is the mentor. The alignment and tint carry it
          after the first read, and the names are on the bubbles regardless — so
          this is an onboarding line, not a legend, and it goes away when it has
          done its job. Sits BELOW the region rather than inside it, so dismissing
          it cannot change the transcript's scroll position. */}
      {captionOpen && (
        <p className="mt-2 flex items-center gap-2 text-[11.5px] leading-[16px] text-[var(--text-muted)]">
          {/* TODO-COPY */}
          <span className="min-w-0">
            {teenName} on the left, mentor on the right.
          </span>
          <button
            type="button"
            onClick={() => setCaptionOpen(false)}
            className={cn(
              "shrink-0 rounded-sm font-semibold text-[var(--text-secondary)] underline decoration-[color:var(--border-contour)] underline-offset-2 hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {/* TODO-COPY */}
            Hide
          </button>
        </p>
      )}

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
