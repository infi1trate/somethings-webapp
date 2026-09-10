// ═══ ABOUT THIS RECORD — CLINICAL AUTHORITY + THE BLANKET AI CAVEAT ═══
//
// Two standing facts about the whole Care tab, in one card beneath the Care
// summary. Neither is about a particular record, review or field — which is why
// they are here and not attached to any of those things.
//
// WHERE THIS CAME FROM. The authority sentence was a bare line at the foot of
// the main column, above a `border-t`, with no label and nothing around it. At
// the bottom of a long clinical page it read as page furniture — the register a
// reader learns to skip.
//
// ═══ THE SECOND DESIGN, AND HOW IT DIFFERS FROM THE FIRST ═══
//
// The first version of this module was deliberately quiet to the point of
// self-effacement: one small label, 12px secondary text throughout, no header
// band, no dividers, no icons, on the reasoning that the rail must read Care
// summary first. The redesign keeps that ordering but stops whispering:
//
//   · a FILLED HEADER BAND (`--surface-s2`) carrying "About this Record", so the
//     card announces itself as a card rather than as a footnote in a box;
//   · TWO LABELLED SECTIONS with a divider between them, each with a leading
//     glyph — "Clinical Advisor" and "AI Usage". The two facts are different in
//     kind, and the first version's undifferentiated pair of sentences left a
//     reader to work that out from the prose;
//   · BODY AT 14/20 PRIMARY INK rather than 12px secondary, because the reader
//     of this card has deliberately looked at it and should not be squinting.
//
// It is still not competing with the Care summary: the summary is a 16/24 bold
// title over a 967px stack, this is a 13px header over ~150px. The squint order
// is unchanged and re-measured.
//
// ═══ WHY THE CAVEAT IS STILL NOT A WARNING ═══
//
// No tint, no alert glyph, no colour. A tinted block would make it the loudest
// thing in the rail and would read as "something is wrong with this record",
// which is not what it says. It is a standing condition of the page, true on
// every record, and a permanent warning is a warning nobody reads.
//
// EMAIL IS A TEXT LINK, NEVER A BUTTON, and it follows the sentence rather than
// leading it — the sentence is the point and the address is an affordance for
// acting on it.

import Link from "next/link";
import { Mail, Sparkles } from "lucide-react";
import { CLINICAL_AUTHORITY } from "@/lib/record/clinical-authority";
import { cn } from "@/lib/utils";

/** Focus ring, matching every other interactive element on the record. */
const RING =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Both links take the same quiet treatment: underlined body text that darkens
 *  on hover. Identical to the treatment the authority name had at the foot of
 *  the column, so nothing about the name's affordance changed when it moved. */
const TEXT_LINK = cn(
  "underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
  RING
);

/** A section's label: glyph + name, muted and small.
 *
 *  THE GLYPH IS DECORATIVE AND SAYS SO. The label text beside it carries the
 *  meaning, so the icon is `aria-hidden` — announcing "envelope Clinical
 *  Advisor" would be reading the decoration aloud. */
function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <p
      className="flex items-center gap-1.5 text-[var(--text-muted)]"
      style={{ font: "var(--type-row-label)" }}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

const BODY = "mt-1 text-[var(--text-primary)]";
const BODY_STYLE = { font: "var(--type-body)" } as const;

export function RecordAuthorityNote({ className }: { className?: string }) {
  const { name, teamHref, email } = CLINICAL_AUTHORITY;

  return (
    <section
      aria-labelledby="record-authority-heading"
      /* A screenshot anchor, like the summary card's — see the note there on why
         a probe naming a class selector evidences the wrong element the first
         time the layout moves. */
      data-record-section="record-authority"
      className={cn(
        /* `overflow-hidden` IS LOAD-BEARING: the header band is a filled child
           at the very top, and without it the fill squares off the container's
           two top corners. */
        "overflow-hidden rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)]",
        className
      )}
    >
      {/* ── THE HEADER BAND ────────────────────────────────────────────────
          A REAL HEADING, at 13px. `<h2>` matches the Care summary's own header
          so the rail reads as two sections to a screen reader rather than a
          section and an unlabelled div — and `aria-labelledby` above points at
          it instead of duplicating the string in an `aria-label`.
          `--surface-s2` IS THE APP GROUND, one step darker than this card's
          white and darker than the `--surface-s1` the rail sits on, which is
          what makes the band read as a band. */}
      {/* ═══ THE FILLED BAND IS GONE (C1) ═══
          It was `--surface-s2` — the app ground — with a bottom border, and it
          worked exactly as intended: the card announced itself. That was the
          problem. This module's own rule is that the rail must read Care summary
          first and the module must be findable without competing, and a filled
          band on the second card in the stack is the loudest element in a column
          whose primary card has none.
          A PLAIN QUIET LABEL, back to the module's original spec: field-label
          scale, muted ink, no fill, no divider under it. It is still a real
          `<h2>` — the semantics were never the problem — so the rail still reads
          as two labelled sections to a screen reader.
          Squint check re-run after the change; result in the report. */}
      <h2
        id="record-authority-heading"
        className="px-4 pt-3 text-[var(--text-muted)]"
        style={{
          font: "var(--type-field-label)",
          letterSpacing: "var(--type-field-label-tracking)",
        }}
      >
        {/* TODO-COPY */}
        About this Record
      </h2>

      {/* ── CLINICAL AUTHORITY ─────────────────────────────────────────────
          VERBATIM COPY. The sentence is preserved exactly as it read at the foot
          of the column; only its container changed. Do not reword it here — it
          is pending clinical sign-off, and this is not the surface that decides
          what it says. */}
      {/* `pt-2` RATHER THAN `py-3`: the label above is no longer a banded row
          with its own padding, so the gap between it and the first section's own
          label was doubling up. */}
      <div className="px-4 pb-3 pt-2">
        {/* TODO-COPY */}
        <SectionLabel icon={Mail}>Clinical Advisor</SectionLabel>
        <p className={BODY} style={BODY_STYLE}>
          {/* ═══ THE NAME STILL POINTS AT TEAM, AND NOW TEAM ANSWERS ═══
              A staff self-profile route does not exist — deferred work, recorded
              as design-system-gaps row 314 — so this goes to the Team directory.
              What changed is that the directory now LISTS this person: the link
              was previously truthful about its destination and useless on
              arrival. See the fixture note in `people-demo.ts`. */}
          <Link href={teamHref} className={TEXT_LINK}>
            {name}
          </Link>
          {
            " is the final decision-maker on all clinical notes and determinations on this page."
          }{" "}
          {/* ═══ THE EMAIL AFFORDANCE ═══
              AFTER the sentence, never before it, and inside the same paragraph
              so it wraps as part of the line rather than sitting on a row of its
              own looking like an action bar.
              A SECOND ENVELOPE, PER THE DESIGN. The section label carries one
              too. Flagged rather than silently deduplicated — the label's glyph
              classifies the section and this one marks the action, and the
              design draws both. */}
          <a
            href={`mailto:${email}`}
            aria-label={`Email ${name}`}
            className={cn(TEXT_LINK, "whitespace-nowrap font-medium")}
          >
            <Mail className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {/* TODO-COPY */}
            Email
          </a>
        </p>
      </div>

      {/* ── THE BLANKET AI CAVEAT ──────────────────────────────────────────
          A DIVIDER NOW SEPARATES THE TWO, where the first design deliberately
          had none. The reasoning then was that a rule would rank one above the
          other; the reasoning now is that they are different KINDS of fact — who
          decides, and how the page was made — and a labelled section each is how
          the design says so. Neither is ranked: same type, same ink, same
          padding.
          THIS IS THE BLANKET CAVEAT, NOT THE PROVENANCE BADGES. The per-field
          disclosures say which specific sentence a model touched; this says the
          page uses AI at all. A reader needs both, and this one must not grow
          into a summary of the other. */}
      <div className="border-t border-[color:var(--border-subtle)] px-4 py-3">
        {/* TODO-COPY */}
        <SectionLabel icon={Sparkles}>AI Usage</SectionLabel>
        <p className={BODY} style={BODY_STYLE}>
          {/* TODO-COPY. THE TERMINAL FULL STOP IS MINE: the design frame ends
              this sentence without one, and a sentence on a clinical record
              should close. Named as a deviation rather than absorbed — it is
              one character and it is veto-able. */}
          AI is used in parts of this page. Always review AI generated content
          for accuracy.
        </p>
      </div>
    </section>
  );
}
