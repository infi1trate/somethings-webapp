"use client";

// ═══ THE PERSISTENT DISCLOSURE (WORKSTREAM D) ═══
//
// One component, because there are TWO read surfaces for the same record and
// they render it through entirely different code. The Care update card renders
// `CareUpdateBodyView`; History turns the record into a `CareEvent` and renders
// its prose through the timeline's generic disclosure. Nothing was shared
// between them — so a disclosure written once for the card would have been
// absent from History, which is the surface a reviewer, an auditor or a
// subpoena reads.
//
// WHY A SUFFIX AND NOT A BADGE. A badge sits beside the field label and reads as
// a category the field belongs to. This is a fact about how one piece of text
// came to exist, so it belongs at the end of that text, in the register of a
// footnote — quiet, findable, and never competing with the clinical prose above
// it. Defaults whisper.
//
// `authored` RENDERS NOTHING AT ALL, and that is a decision rather than an
// omission. There is no "written by a human" badge: absence is the default state
// of clinical documentation, and marking it would imply the marked ones are the
// norm and the unmarked ones exceptional. It also means the vast majority of
// records carry no new furniture.
//
// THE TWO PHRASES ARE NOT INTERCHANGEABLE. `ai_inserted` says a model's draft is
// sitting in the record unedited; `ai_assisted` says a person wrote it with help.
// A reader deciding how much weight to give a diagnostic statement needs the
// difference, so `PROVENANCE_PHRASE` keeps them distinct and a test asserts they
// stay distinct.

import { HoverNote } from "@/components/record/hover-note";
import {
  PROVENANCE_PHRASE,
  discloses,
  type FieldProvenance,
} from "@/lib/record/field-provenance";
import { cn } from "@/lib/utils";

/** What the tooltip says, per state. TODO-COPY, both.
 *
 *  THE `ai_inserted` NOTE NAMES THE CONSEQUENCE rather than repeating the
 *  phrase: a reader who opens this is asking "so what do I do with that", and
 *  "nobody has revised it" is the answer that changes their reading. */
const PROVENANCE_DETAIL: Record<
  Exclude<FieldProvenance, "authored">,
  string
> = {
  ai_inserted:
    "This text came from the AI notes generated for the record, and the author placed it here without changing a word. It has been read and signed off, but not rewritten — weigh it as you would any unedited machine output.",
  /* NARROWED WITH THE REMOVAL OF "IMPROVE MY DRAFT". This used to cover two
     cases — model text a person edited, and a person's text a model revised.
     Only the first is reachable now, so the note says the first rather than
     hedging across both. */
  ai_assisted:
    "This text came from the AI notes generated for the record, and the author edited it before signing. The wording is theirs; the starting point was not.",
};

/** The per-field suffix. Renders nothing for `authored`.
 *
 *  `inline` PUTS IT ON THE PROSE'S LAST LINE instead of its own — used by
 *  History, whose rows are already dense and whose disclosure is a single
 *  pre-line block per field. The card gives it its own line, where there is room
 *  and the field is being read closely. */
export function FieldProvenanceNote({
  state,
  inline = false,
  className,
}: {
  state: FieldProvenance | undefined;
  inline?: boolean;
  className?: string;
}) {
  // UNDEFINED IS `authored`. Every record written before C4 has no such key,
  // and the absence means the same thing the value does — see
  // `CareUpdateProvenance`. Treating it as unknown would put a disclosure on
  // every legacy record, which is the loudest possible wrong answer.
  if (!state || !discloses(state)) return null;
  const detail = PROVENANCE_DETAIL[state];

  return (
    <span
      className={cn(
        inline ? "ml-1.5 inline-flex" : "mt-1 flex",
        "flex-wrap items-center gap-x-1 text-[11.5px] leading-[16px] text-[var(--text-muted)] italic",
        className
      )}
    >
      {PROVENANCE_PHRASE[state]}
      <HoverNote
        triggerLabel={`About: ${PROVENANCE_PHRASE[state]}`}
        /* ═══ A 16px GLYPH IN A 24px TARGET ═══
           The suffix is a footnote on a line of 11.5px italic text, and a 24px
           disc beside it would out-weigh the words it annotates — so the mark
           stays 16px. But WCAG 2.2 §2.5.8 wants 24px, and the alternative was
           this feature carrying two different ⓘ sizes (the draft panel's is a
           full 24px, in a control cluster where it belongs).
           `p-1 -m-1` resolves both: the box is 24px, the glyph is unchanged, and
           the negative margin hands the padding back so the footnote still sits
           4px under the prose. The spacing exception would have carried the bare
           16px anyway — nearest other target measured at 103px — but "legal on
           an exception" is a worse answer than "meets the minimum". */
        triggerClassName="-m-1 size-4 box-content justify-center rounded-full p-1 not-italic text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]"
        trigger={<span aria-hidden>ⓘ</span>}
      >
        <span className="block text-[12px] leading-[17px] text-[var(--text-secondary)]">
          {detail}
        </span>
      </HoverNote>
    </span>
  );
}

/** Whether a record discloses anything on ANY field — for a caller that needs to
 *  know before it renders a container. Kept here rather than in
 *  `field-provenance.ts` because it is about a care update's two fields, and
 *  that module deliberately knows nothing about care updates. */
export function anyFieldDiscloses(record: {
  clinicalProvenance?: FieldProvenance;
  diagnosticProvenance?: FieldProvenance;
}): boolean {
  return (
    discloses(record.clinicalProvenance ?? "authored") ||
    discloses(record.diagnosticProvenance ?? "authored")
  );
}
