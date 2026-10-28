"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AFTER THE ASSESSMENT IS SENT (pack v11.0 §7) — the mentor's waiting node
//
// ═══ SUPERSEDES (Supersession 6) ═══ "Brandy has this. Stay with Jordan."
// and its `WaitingModule` are deleted, not orphaned: the card quoted the
// supervisor's latest Support message into a space that would usually hold
// none, so it fabricated a presence; the rotating steadying line was filler;
// the Support door sat detached in the hero. Three parts, one card:
//
//   1  CONFIRMATION   "Assessment sent." (the node's title, Label/Large)
//                     and "{Supervisor} has it and is reviewing." Quiet — no
//                     success-green, no check animation.
//   2  WHAT TO DO NOW one orienting line, then Ava's conversation paths:
//                     casual, explicitly non-clinical (`stay-close.ts`), each
//                     with a quiet "Use" that drops it into the composer and
//                     sends nothing. A sent one carries its provenance.
//   3  THE ONE FILLED BUTTON  "Message {supervisor} in Support" — it moved
//                     here because this is the moment the mentor needs it;
//                     the hero's ghost door steps aside while this card
//                     shows (one door per state). Support opens beside chat
//                     and Care (§3.2).
//
// Copy: `lib/tiering/post-submit-copy.ts` (Nicole). Generation: Dr. Nissan.

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { stayCloseNudges } from "@/lib/chat/stay-close";
import { POST_SUBMIT } from "@/lib/tiering/post-submit-copy";
import { BODY, LABEL, Primary, RING } from "@/components/chat/escalation/controls";
import { cn } from "@/lib/utils";

export function PostSubmitCard({
  name,
  supervisorName,
  teenLines,
  onUseSuggestion,
  onSupport,
}: {
  name: string;
  supervisorName: string;
  teenLines: string[];
  /** Drops a suggestion into the composer, marked as Ava's. */
  onUseSuggestion: (text: string) => void;
  /** Opens the supervisor's Support thread beside chat and Care. */
  onSupport?: () => void;
}) {
  const suggestions = stayCloseNudges(teenLines, name);
  /* "Used" is this card's state alone — the suggestion is never stored. */
  const [used, setUsed] = useState<ReadonlySet<string>>(new Set());
  return (
    <div data-post-submit className="space-y-4">
      <p data-post-submit-reviewing className="m-0 text-[var(--text-secondary)]" style={BODY}>
        {POST_SUBMIT.reviewing(supervisorName)}
      </p>
      <section data-suggestions aria-labelledby="post-submit-orient" className="space-y-2">
        <p id="post-submit-orient" className="m-0 text-[var(--text-primary)]" style={BODY}>
          {POST_SUBMIT.orient(name)}
        </p>
        {/* ═══ THE AVA PROVENANCE MARK ═══ The house idiom: the Sparkles
            glyph and the words. */}
        <p data-ava-mark className="m-0 inline-flex items-center gap-1.5 text-[var(--text-muted)]" style={LABEL}>
          <Sparkles aria-hidden className="size-3.5" />
          {POST_SUBMIT.suggestions}
        </p>
        <ul className="space-y-1.5">
          {suggestions.map((n) => {
            const isUsed = used.has(n.id);
            return (
              <li key={n.id} data-suggestion={n.id} data-suggestion-used={isUsed || undefined} className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] px-3 py-2">
                <span className={cn("min-w-0 flex-1 break-words", isUsed ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]")} style={BODY}>
                  {n.text}
                </span>
                {/* A QUIET text button — the card's one filled button is
                    the Support door below. */}
                <button
                  type="button"
                  data-suggestion-use={n.id}
                  onClick={() => {
                    onUseSuggestion(n.text);
                    setUsed((u) => new Set(u).add(n.id));
                  }}
                  aria-label={`${POST_SUBMIT.use}: ${n.text}`}
                  className={cn("inline-flex min-h-8 shrink-0 items-center rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
                  style={LABEL}
                >
                  {isUsed ? POST_SUBMIT.used : POST_SUBMIT.use}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {onSupport && (
        <Primary slot="post-submit-support" onClick={onSupport}>
          {POST_SUBMIT.message(supervisorName)}
        </Primary>
      )}
    </div>
  );
}
