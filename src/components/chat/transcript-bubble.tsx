"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ONE TRANSCRIPT BUBBLE, TWO SUPERVISOR SURFACES (addendum §2.4)
//
// ═══ WHY IT LEFT `conversation-excerpt.tsx` ═══
//
// The escalation timeline rendered messages as an italic-quote list — a time
// gutter, a source lozenge, and the message in quotation marks — while Risk
// Flags rendered the same kind of content as bubbles. Two readings of one
// conversation, on two surfaces a supervisor moves between during the same
// incident. The Q4 unification decision settled that; it never reached the
// timeline, which predates it and which Phase 6 only de-forked the STATE of.
//
// So the bubble moves here and both surfaces import it. This is the same
// argument `lib/chat/clustering.ts` makes about the five-minute threshold: a
// judgment about how a teen's messages should be read is one judgment, and if
// it is ever revised it must be revised once.
//
// ═══ WHAT DID NOT MOVE, AND WHY THAT IS NOT A FORK ═══
//
// The excerpt's `needsHeader` — which also breaks a cluster at the FLAGGED
// message — stays with the excerpt. It is not a different clustering rule; it
// is an additional reason that surface needs a header, because the anchor is
// the line the whole pane is about. The timeline has no anchor and so has no
// such reason, and both callers still answer the shared question with
// `startsCluster`.
//
// THE TIMELINE DOES NOT GET THE BLOOM either: that highlight exists to tell a
// reader who was scrolled into the middle of a transcript where they were put,
// and the timeline opens at the top.
// ═══════════════════════════════════════════════════════════════════════════

import { AlertTriangle } from "lucide-react";
import type { ConversationMessage } from "@/lib/tasks/conversation";
import { cn } from "@/lib/utils";

/** THE SURFACE'S CLOCK FORMAT for a transcript. Exported because a caller that
 *  renders a header outside a bubble — the timeline's ledger rows — must print
 *  the same shape of time beside it. */
export function transcriptTime(at: number): string {
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
export function TranscriptBubble({
  m,
  header,
  blooming,
  flaggedRef,
}: {
  m: ConversationMessage;
  /** False for a message clustered under the one above it. See `needsHeader`. */
  header: boolean;
  /** The one-shot highlight when this excerpt is anchored. See `bloom`. */
  blooming?: boolean;
  flaggedRef?: React.Ref<HTMLLIElement>;
}) {
  const mine = m.sender === "mentor";
  return (
    <li
      ref={flaggedRef}
      className={cn(
        "flex flex-col gap-1",
        mine ? "items-end" : "items-start",
        // A clustered message sits closer to the one it continues than to the
        // next turn — the spacing is what makes the cluster read as one block,
        // and it is the reason dropping the header does not just leave a gap.
        !header && "-mt-2.5"
      )}
    >
      {header && (
        <p className="flex items-center gap-1.5 px-1 text-[11.5px] leading-[16px] text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">
            {m.senderName}
          </span>
          {/* `tabular-nums`: the times sit in a column down one edge of the
              transcript, and proportional figures make that column ragged. */}
          <time className="tabular-nums" dateTime={new Date(m.at).toISOString()}>
            {transcriptTime(m.at)}
          </time>
        </p>
      )}
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
            "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)] ring-1 ring-[color:var(--band-amber-fg)]/25",
          /* ═══ THE ANCHOR BLOOM (Part 5) ═══
             The excerpt opens already scrolled to the flagged line, which means
             the reader's eye arrives with no idea that anything moved — the
             transcript simply starts in the middle. A single soft ring, widened
             for ~200ms and eased away, says "this is the line, and this is where
             you were put". Once per selection: it fires on the anchor effect, not
             on every render, so a re-render never re-blooms and a supervisor
             working through fifty flags sees it once each, not repeatedly.
             `motion-reduce` drops it entirely rather than shortening it. */
          m.flagged && "transition-[box-shadow] duration-200 ease-out motion-reduce:transition-none",
          m.flagged && blooming && "shadow-[0_0_0_6px_var(--band-amber-bg)]"
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

