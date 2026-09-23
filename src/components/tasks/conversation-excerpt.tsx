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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MessageSquare, RefreshCw } from "lucide-react";
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

/** ═══ THE MEDIA QUERY, READ AT THE MOMENT OF THE SCROLL ═══
 *  Not captured in state: a reader can change the OS setting while the pane is
 *  open, and a value cached at mount would keep animating at them. Guarded for
 *  SSR, where `matchMedia` does not exist. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

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
  /** ═══ THE HOST SCROLLER, WHEN THE TRANSCRIPT IS NOT ITS OWN (§2.7) ═══
   *
   *  On Monitoring the transcript IS the pane's scroll region — §2.7's
   *  reconciliation with locked decision 4, which allows two regions on the
   *  page and no more. So the excerpt renders with no overflow of its own and
   *  scrolls, anchors and observes against the element the pane hands it.
   *
   *  WITHOUT IT the component is unchanged: Tasks still gets the bounded,
   *  `overscroll-contain` region it has always had. */
  hostRef,
  /** Reveal an older page. Absent = no upward loading, which is Tasks. */
  onNeedOlder,
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
  hostRef?: React.RefObject<HTMLElement | null>;
  onNeedOlder?: () => void;
}) {
  const ownRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLLIElement>(null);
  /** The element that actually scrolls: this component's own region on Tasks,
   *  the pane's on Monitoring. Every scroll read and write below goes through
   *  it, so the two modes share one implementation of anchoring. */
  const scrollerOf = useCallback(
    () => (hostRef ? hostRef.current : ownRef.current),
    [hostRef]
  );
  /** ═══ WHERE THE FLAGGED MESSAGE IS, RELATIVE TO THE VIEWPORT (§2.7) ═══
   *  Null when it is visible, which is what hides the return control — a pill
   *  offering to take a reader to what they are already looking at is chrome
   *  with a direction on it. */
  const [anchorOff, setAnchorOff] = useState<"above" | "below" | null>(null);
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
    const region = scrollerOf();
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
      /* ═══ `prefers-reduced-motion` IS AN INSTANT JUMP, NOT A SHORTER ONE ═══
         §2.7 is explicit. A smooth scroll across sixty messages is exactly the
         vestibular case the media query exists for, and `behavior: "smooth"`
         does not respect it on its own. */
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  }, [scrollerOf]);

  /** RE-ANCHORS WHEN THE ANCHOR CHANGES, which is the coalesced-flag case:
   *  picking a different child flag swaps `conversation` and must move the
   *  excerpt without the pane remounting.
   *
   *  ═══ KEYED ON THE ANCHOR ID ALONE, AND THE OBJECT IS DELIBERATELY NOT A
   *  DEPENDENCY (addendum §2.7) ═══
   *
   *  `conversation` was in this list, and `buildConversation` runs in render —
   *  so every render produced a new object and this effect re-anchored on it.
   *  Harmless while the transcript was a fixed window. With upward loading it
   *  is the bug §2.7 exists to prevent: MEASURED, loading an older page moved
   *  the reader from `scrollTop 0` to `2265`, snapping them back to the
   *  flagged message they had scrolled away from. The layout effect below was
   *  holding the position correctly and this was overwriting it one tick
   *  later.
   *  So the anchor moves when the ANCHOR moves, and nothing else. */
  const anchorId = conversation?.anchorId ?? null;
  useEffect(() => {
    if (state !== "ready" || !anchorId) return;
    // The first anchor is instant — a smooth scroll on open reads as the panel
    // settling and draws the eye to the motion instead of the message.
    anchor(false);
    /* AND THEN THE BLOOM, one frame later. In the same commit the ring would
       mount already-wide and there would be nothing to transition FROM — the
       same reason the retiring band in the worklist waits a frame. Cleared after
       the transition so the ring does not sit permanently expanded. */
    const on = requestAnimationFrame(() => setBloomFor(anchorId));
    const off = window.setTimeout(() => setBloomFor(null), 320);
    return () => {
      cancelAnimationFrame(on);
      window.clearTimeout(off);
    };
  }, [state, anchorId, anchor]);

  /** ═══ IS THE FLAGGED MESSAGE ON SCREEN, AND WHICH WAY IS IT ═══
   *
   *  An `IntersectionObserver` rooted on the SCROLLER, not on the viewport:
   *  the pane is itself inside the page, so a viewport-rooted observer would
   *  report the anchor as visible whenever the pane was, which is always.
   *
   *  THE DIRECTION COMES FROM THE RECTS rather than from the observer's
   *  `boundingClientRect` alone, because a reader who has scrolled past the
   *  flag needs "above", and an observer entry says only "not intersecting". */
  useEffect(() => {
    const region = scrollerOf();
    const el = anchorRef.current;
    if (!region || !el || state !== "ready") return;
    const read = () => {
      const r = region.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      /* FULLY OUT, not partially: a pill that appears as the last line of the
         flagged message leaves the top of the viewport is a pill that
         flickers while a reader reads. */
      if (e.bottom < r.top) setAnchorOff("above");
      else if (e.top > r.bottom) setAnchorOff("below");
      else setAnchorOff(null);
    };
    read();
    region.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      region.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [state, anchorId, scrollerOf]);

  /** ═══ OLDER MESSAGES LOAD ON UPWARD SCROLL ═══
   *  A threshold rather than the exact top, so the load starts before the
   *  reader hits the edge and the transcript does not visibly stall. */
  const pendingGrowth = useRef<number | null>(null);
  useEffect(() => {
    const region = scrollerOf();
    if (!region || !onNeedOlder || state !== "ready") return;
    const onScroll = () => {
      if (region.scrollTop >= 120) return;
      /* ═══ THE HEIGHT IS CAPTURED HERE, NOT IN THE LAYOUT EFFECT ═══
         Measuring "before" from the previous render is what the first
         implementation did, and it did not work: this component's layout
         effect runs BEFORE its host's ref is attached — a parent's ref
         attaches after a child's effects — so the first measurement it ever
         took was already the post-growth height and the correction was
         skipped. MEASURED: the watched line moved 1400px when the reader had
         scrolled 160.
         Capturing at the moment of the REQUEST ties the number to the event
         instead of to render order. */
      pendingGrowth.current = region.scrollHeight;
      onNeedOlder();
    };
    region.addEventListener("scroll", onScroll, { passive: true });
    return () => region.removeEventListener("scroll", onScroll);
  }, [scrollerOf, onNeedOlder, state]);

  /** ═══ SCROLL ANCHORING, AND IT IS MANDATORY (§2.7) ═══
   *
   *  Prepending messages grows `scrollHeight` above the reader's position, so
   *  without this the transcript jumps by exactly the height of what loaded —
   *  on the surface where the reader is mid-sentence in a teen's disclosure.
   *
   *  `useLayoutEffect`, NOT `useEffect`: the correction has to happen in the
   *  same frame as the DOM growth, or the jump is painted and then undone,
   *  which is worse than the jump.
   *
   *  MEASURED BY DELTA rather than by re-anchoring on the flagged message:
   *  re-anchoring would ALSO move a reader who had deliberately scrolled away
   *  from it, which is the opposite of anchoring. */
  const count = conversation?.messages.length ?? 0;
  useLayoutEffect(() => {
    const region = scrollerOf();
    const before = pendingGrowth.current;
    if (!region || before == null) return;
    pendingGrowth.current = null;
    const grew = region.scrollHeight - before;
    if (grew <= 0) return;
    region.scrollTop += grew;
  }, [count, scrollerOf]);

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

  /** ═══ THE WINDOW, AND IT IS GONE WHERE THE TRANSCRIPT SCROLLS (§2.7) ═══
   *
   *  It clipped to a few turns either side of the anchor, because the
   *  Monitoring pane could not afford a scroll region and a full transcript
   *  rendered inline would have pushed the disposition off screen. The
   *  transcript IS the pane's scroll region now, so there is nothing to clip
   *  for: `hostRef` present means the reader scrolls, and clipping would make
   *  "continuous scroll" a window with a scrollbar on it.
   *
   *  THE WINDOW SURVIVES FOR THE THIRD CASE — no scroll and no host, which is
   *  a transcript rendered inline somewhere that cannot scroll at all. */
  const windowed = !scroll && !hostRef;
  const anchorIdx = conversation.messages.findIndex((m) => m.id === conversation.anchorId);
  const from = windowed ? Math.max(0, anchorIdx - windowTurns) : 0;
  const to = windowed
    ? Math.min(conversation.messages.length, anchorIdx + windowTurns + 1)
    : conversation.messages.length;
  const shown = conversation.messages.slice(from, to);
  /* THE EDGE MARKER IS TRUE IN ONE MORE CASE NOW: the fixture was truncated, OR
     the window cut into it. Both mean "there is more above this". */
  /* THE MARKER RENDERS AT BOTH EDGES-OF-MEANING: more is coming, or this is
     the beginning. Only a windowed render with nothing cut shows nothing. */
  const cutAbove = !windowed || conversation.truncatedStart || from > 0;

  return (
    <div>
      <div
        ref={ownRef}
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
            {/* ═══ IT SAYS WHICH EDGE THIS IS (§2.7) ═══
                TODO-COPY. "Earlier messages not shown" was true of a window
                and is a lie at the beginning of a conversation, where there
                is nothing earlier to show. With upward loading the marker has
                two meanings and has to pick one. */}
            <span className="shrink-0">
              {conversation.truncatedStart
                ? "Loading earlier messages as you scroll"
                : "The start of this conversation"}
            </span>
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

      {/* ═══ RETURN TO THE FLAG (§2.7) ═══
          ONLY WHEN IT IS OFF SCREEN, and it names the direction: a reader who
          has scrolled up forty messages and one who has scrolled past the flag
          need opposite moves, and an unlabelled "return" would be a coin flip.
          STICKY, NOT FIXED. Fixed would position against the viewport and sit
          over whatever the page has there; sticky keeps it inside the
          transcript's own flow, above the footer rather than on it. It is also
          why it cannot compete with the disposition: the footer is a sibling
          BELOW this, so the pill can never overlap it.
          LOW WEIGHT, and dismissible by doing the thing — pressing it returns
          to the flag, which makes the anchor visible, which hides the pill. */}
      {anchorOff && (
        <div className="pointer-events-none sticky bottom-2 z-10 flex justify-center">
          <button
            type="button"
            data-return-to-flag={anchorOff}
            onClick={() => {
              anchor(true);
              /* RE-BLOOM ON RETURN. The highlight is what says "this is the
                 line" — the same one-shot ring the excerpt opens with, for
                 the same reason: a reader who has just been moved needs to
                 know where they were put. */
              const id = conversation.anchorId;
              requestAnimationFrame(() => setBloomFor(id));
              window.setTimeout(() => setBloomFor(null), 320);
            }}
            className={cn(
              "pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3",
              "border border-[color:var(--border-contour)] bg-[var(--surface-card)]",
              "text-[12.5px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-tile)]",
              "hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {anchorOff === "above" ? (
              <ArrowUp className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="size-3.5 shrink-0" aria-hidden />
            )}
            {/* TODO-COPY. The direction is in the words as well as the glyph. */}
            Flagged message {anchorOff}
          </button>
        </div>
      )}

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
