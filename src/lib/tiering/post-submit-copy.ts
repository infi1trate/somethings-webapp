// ═══════════════════════════════════════════════════════════════════════════
// THE POST-SUBMIT CARD'S COPY — one source
//
// ═══ THE ASSESSMENT-SENT CARD (FCP-3 Figma 6106:12079, 2026-10-28) ═══
// SUPERSEDES pack v11.0 §7's "an acknowledgement, not an achievement: no
// celebration, no success-green, no check animation". The design leads with a
// check and "Nice work." — the mentor has just done the hardest part, and the
// next instruction lands better after it is acknowledged. Still no animation.
//
// GATED (Nicole): every string here is the design's. The suggestion
// generation and its non-clinical boundary are Dr. Nissan's
// (`lib/chat/stay-close.ts`).

export const POST_SUBMIT = {
  /** The node's title, beside the check. */
  sent: "Assessment sent",
  /** The card's headline. */
  headline: (name: string) => `Nice work. Now stay with ${name}`,
  body: "Your supervisor has everything they need and will join shortly. For now, your only job is to stay present — keep things slow, warm, and steady.",
  /** Above Ava's lines. */
  suggestions: "If you need words, try one of these",
  copy: "Copy",
  copied: "Copied",
  /** The danger block, and the card's one filled button. */
  danger: (name: string) => `If ${name} is in immediate danger`,
  dangerDetail: "Contact emergency services",
  emergency: "Contact emergency services",
} as const;
