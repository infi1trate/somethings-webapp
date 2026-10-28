"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AFTER THE ASSESSMENT IS SENT — the mentor's waiting node
//
// ═══ THE ASSESSMENT-SENT CARD (FCP-3 Figma 6106:12079, 2026-10-28) ═══
// SUPERSEDES pack v11.0 §7's three parts (confirmation · Ava's paths with
// "Use" · "Message {supervisor} in Support"). The node's title is the
// eyebrow — a check and "Assessment sent" (`Node`'s `eyebrow` tone) — and
// the card is, top to bottom:
//
//   HEADLINE   "Nice work. Now stay with {name}" (Title/Large) and one body
//              paragraph: the supervisor has it; your job is to stay present.
//   WORDS      "If you need words, try one of these", then Ava's lines
//              (`stay-close.ts`, Dr. Nissan's boundary) in sunken wells, each
//              with "Copy". COPY, NOT INSERT: the line goes to the clipboard
//              and is remembered by the page (`onCopySuggestion`), so a sent
//              message still carrying it records its provenance —
//              `ai_inserted` as written, `ai_assisted` once edited — exactly
//              as "Use" did (pack v11.0 §7.2, answered: the model stands).
//   DANGER     a hairline, then "If {name} is in immediate danger · Contact
//              emergency services", and the card's ONE filled button.
//
// ═══ THE RED BUTTON IS THE ONE EMERGENCY DOOR, NOT A SECOND ONE ═══ Pack
// v3.0 deleted the in-panel red button so the banner's Emergency info would be
// the one door. This button opens that same door — Care's Emergency info tab,
// 911 first — rather than dialling from here; and it wears the 911 link's own
// fill (`--alert-critical-accent`, white on it 5.24:1). The design's lighter
// red is blush/700, 3.16:1 under white: below AA for a 16px label.
// RED ONLY IN TIER 1–2 CONTEXTS (Tiering & Escalation, a canon rule): on a
// Tier 3 or Platform escalation the same button wears the panel's neutral
// ink fill — still the card's one filled button, and still the same door.
//
// ═══ THE SUPPORT DOOR GOES BACK TO THE HERO ═══ This card no longer carries
// "Message {supervisor} in Support", so the hero's ghost door no longer steps
// aside while it shows (`rail/care.tsx`): one Support door in every state.

import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { stayCloseNudges } from "@/lib/chat/stay-close";
import { POST_SUBMIT } from "@/lib/tiering/post-submit-copy";
import { BODY, RING } from "@/components/chat/escalation/controls";
import { cn } from "@/lib/utils";

/** Writes to the clipboard where the browser allows it. A refusal (no
 *  permission, an insecure context) still counts as offered: the page
 *  remembers the line either way. */
function toClipboard(text: string) {
  try {
    void navigator.clipboard?.writeText(text).catch(() => {});
  } catch {
    /* No clipboard on this device. */
  }
}

export function PostSubmitCard({
  name,
  teenLines,
  alert = true,
  onCopySuggestion,
  onEmergency,
}: {
  name: string;
  teenLines: string[];
  /** A Tier 1–2 escalation: the emergency button is red. Otherwise neutral. */
  alert?: boolean;
  /** The line was copied: remember it, so a message carrying it is marked Ava's. */
  onCopySuggestion: (text: string) => void;
  /** Opens Care's Emergency info tab — the one emergency door. */
  onEmergency?: () => void;
}) {
  const suggestions = stayCloseNudges(teenLines, name);
  /* "Copied" is this card's state alone — the suggestion is never stored. */
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div data-post-submit className="space-y-6">
      <div className="space-y-2">
        <h3 data-post-submit-headline className="m-0 text-[var(--text-primary)]" style={{ font: "var(--type-title-lg)" }}>
          {POST_SUBMIT.headline(name)}
        </h3>
        <p data-post-submit-body className="m-0 text-[var(--text-secondary)]" style={BODY}>
          {POST_SUBMIT.body}
        </p>
      </div>

      <section data-suggestions aria-labelledby="post-submit-words" className="space-y-2">
        <p id="post-submit-words" className="m-0 text-[var(--text-muted)]" style={{ font: "var(--type-label-sm)" }}>
          {POST_SUBMIT.suggestions}
        </p>
        <ul className="m-0 list-none space-y-2 p-0">
          {suggestions.map((n) => {
            const isCopied = copied === n.id;
            return (
              <li key={n.id} data-suggestion={n.id} data-suggestion-copied={isCopied || undefined} className="flex items-center gap-3 rounded-[var(--radius-inset)] bg-[var(--surface-sunken)] py-2 pr-2 pl-4">
                <q data-suggestion-text className="min-w-0 flex-1 py-1.5 break-words text-[var(--text-secondary)]" style={BODY}>
                  {n.text}
                </q>
                <button
                  type="button"
                  data-suggestion-copy={n.id}
                  onClick={() => {
                    toClipboard(n.text);
                    onCopySuggestion(n.text);
                    setCopied(n.id);
                  }}
                  aria-label={`${isCopied ? POST_SUBMIT.copied : POST_SUBMIT.copy}: ${n.text}`}
                  className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-inset)] px-2 font-display text-[14px] leading-[20px] font-bold text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
                >
                  {isCopied ? <Check aria-hidden className="size-4" strokeWidth={2} /> : <Copy aria-hidden className="size-4" strokeWidth={2} />}
                  {isCopied ? POST_SUBMIT.copied : POST_SUBMIT.copy}
                </button>
              </li>
            );
          })}
        </ul>
        {/* One polite line when a copy lands — the label change is silent. */}
        <p data-suggestion-live role="status" aria-live="polite" className="sr-only">
          {copied ? "Copied to the clipboard" : ""}
        </p>
      </section>

      <div data-post-submit-danger className="space-y-4 border-t border-[color:var(--border-subtle)] pt-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--text-primary)]" strokeWidth={2} />
          <p className="m-0">
            <span className="block font-display text-[14px] leading-[20px] font-bold text-[var(--text-primary)]">{POST_SUBMIT.danger(name)}</span>
            <span className="block text-[var(--text-secondary)]" style={BODY}>
              {POST_SUBMIT.dangerDetail}
            </span>
          </p>
        </div>
        {onEmergency && (
          <button
            type="button"
            data-exchange-primary="post-submit-emergency"
            onClick={onEmergency}
            className={cn("flex min-h-12 w-full items-center justify-center rounded-full px-4 transition-opacity hover:opacity-90", alert ? "bg-[var(--alert-critical-accent)]" : "bg-[var(--text-primary)]", "text-[var(--text-inverse)]", RING)}
            style={{ font: "var(--type-button)" }}
          >
            {POST_SUBMIT.emergency}
          </button>
        )}
      </div>
    </div>
  );
}
