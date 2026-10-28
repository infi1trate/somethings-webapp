// ═══════════════════════════════════════════════════════════════════════════
// THE POST-SUBMIT CARD'S COPY (pack v11.0 §7) — one source
//
// GATED (Nicole): parts 1 and 2 of the card. The suggestion generation and
// its non-clinical boundary are Dr. Nissan's (`lib/chat/stay-close.ts`).
// An acknowledgement in a crisis, not an achievement: no celebration, no
// success-green, no check animation.

export const POST_SUBMIT = {
  /** Part 1 — the node's title. */
  sent: "Assessment sent.",
  reviewing: (supervisor: string) => `${supervisor} has it and is reviewing.`,
  /** Part 2 — what to do now. */
  orient: (name: string) => `Stay in the conversation with ${name}. These can help keep it going.`,
  suggestions: "Suggested by Ava",
  use: "Use",
  used: "In message box",
  /** Part 3 — the card's one filled button. */
  message: (supervisor: string) => `Message ${supervisor} in Support`,
} as const;
