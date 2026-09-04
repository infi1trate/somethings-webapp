"use client";

// THE PROVENANCE MARK — one component wherever this record shows generated text.
//
// ═══ WHAT IT REPLACES, AND WHY THAT WAS WORTH REPLACING ═══
//
// Three separate disclaimer sentences, set as body copy, each ~20 words:
//   · "AI-generated from assessment history, risk flag log, presentation
//      history, theme extraction (mocked — no pipeline). Context for a coding
//      decision — not itself a clinical determination."
//   · "Theme extraction is mocked — no pipeline exists."
//   · "AI-generated from survey history and mentorship signal."
//
// They were correct and they were the wrong shape. A reader who has seen one
// stops reading all of them, which is the failure mode that matters: by the
// third cycle the sentence is furniture, and the one thing it must convey — this
// text was generated — has stopped landing. Set at body size and full width, it
// also took more visual weight than the finding it qualified.
//
// So: a small badge that is ALWAYS VISIBLE and cannot be skimmed past, plus the
// full note one interaction away for the reader who wants it. The attribution
// becomes glanceable; the explanation stays available.
//
// ═══ THE MARK IS AN INFO ICON; THE "AI" TAG LIVES IN THE PANEL ═══
//
// It used to be an always-visible "✨ AI" pill beside the icon, on the argument
// that attribution must be unskippable. The product owner's call, 2026-08-31:
// the tag repeated on five sections of one card and read as clutter, so the icon
// carries the affordance and the tag sits inside the panel it opens, at the top,
// where it labels the note rather than the heading.
//
// WHAT THIS COSTS, STATED PLAINLY: attribution is now one interaction away
// rather than visible at rest. That is a real reduction against the earlier
// reading of guardrail 6 ("attribution visible without scrolling") — the icon is
// visible, the WORD "AI" is not. The tag is still unconditional once the panel
// is open, and there is still no prop to suppress it; a generated block cannot
// render without one. Recorded as design-system-gaps row 335.
//
// ═══ THE MECHANICS MOVED TO `HoverNote` ═══
//
// The pointer timing, the pin-on-click, the Escape and outside-click dismissal
// and the panel shell — everything that makes this conformant with WCAG 1.4.13
// — now live in `hover-note.tsx`, because the flag-priority chip needs the same
// behaviour with different content and a second copy of that code is how one of
// the two quietly stops being conformant. What stays here is what this component
// is actually about: the trigger's glyph, and the AI-tagged note it reveals.

import { Info, Sparkles } from "lucide-react";
import { HoverNote } from "@/components/record/hover-note";

/** THE ONE NOTE, in one place. Every surface that shows generated text on this
 *  record says the same thing, because a second wording is a second policy.
 *
 *  TODO-COPY. Kept close to the sentence it replaces — it is the reviewed
 *  wording — minus the parenthetical about the theme pipeline, which was a note
 *  about implementation state rather than about provenance and did not survive
 *  the move (see the removal note in `care-summary-doc.tsx`). */
export const PROVENANCE_NOTE =
  // "Generated", not "AI-generated": the tag directly above this sentence
  // already says AI, and the panel read "AI / AI-generated from…" — the reader
  // is told twice in eleven characters. The tag carries the attribution now, so
  // the sentence carries the sources.
  "Generated from assessment history, risk flag log, presentation history, and theme extraction. Context for a coding decision — not itself a clinical determination.";

export function Provenance({
  /** The tag shown at the top of the panel. TODO-COPY. */
  label = "AI",
  /** Overrides the note for a block drawing on something narrower. Keep these
   *  rare: divergent wordings are how one policy becomes several. */
  note = PROVENANCE_NOTE,
  /** ═══ WHAT THE TRIGGER ANNOUNCES ═══
   *  Defaults to the generated-text wording, because that is what this mark is
   *  for and what every existing consumer means by it. Overridden where the
   *  panel carries a plain fact about the record instead — the survey lock date
   *  on the presentation card is not generated text, and a screen reader being
   *  told it was would be the component lying on that surface's behalf. */
  triggerLabel = "About this generated text",
  className,
}: {
  label?: string;
  note?: string;
  triggerLabel?: string;
  className?: string;
}) {
  return (
    <HoverNote
      triggerLabel={triggerLabel}
      className={className}
      trigger={<Info className="size-3.5" aria-hidden />}
      triggerClassName={[
        "size-5 justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
        // 20px BOX, 44px TARGET. The pseudo-element extends the hit area without
        // reflowing a line it shares with a heading — the same technique
        // `touch-target.ts` uses, spelled out here because this component is
        // inline in running text on one of its call sites.
        "after:absolute after:-inset-y-3 after:-inset-x-2 after:content-['']",
      ].join(" ")}
    >
      {/* THE TAG, AS THE PANEL'S OWN LABEL. It comes first because it is the
          subject of the sentence under it: the note explains what "AI" means
          here, so reading them in the other order asks the reader to hold an
          explanation before knowing what it explains. */}
      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-[var(--surface-s2)] px-1.5 py-0.5 text-[11px] font-semibold leading-[14px] text-[var(--text-secondary)]">
        <Sparkles className="size-3 shrink-0" aria-hidden />
        {label}
      </span>
      <span className="block text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {note}
      </span>
    </HoverNote>
  );
}
