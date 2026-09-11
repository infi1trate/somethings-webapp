"use client";

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

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Mail, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { CLINICAL_AUTHORITY } from "@/lib/record/clinical-authority";
import { useOnboardingStore } from "@/lib/onboarding/store";
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

/** ═══ THUMBS ON THE CAVEAT, AND A NOTE WHEN THE ANSWER IS NO ═══
 *
 *  WHY THE DOWN PATH ASKS AND THE UP PATH DOES NOT. "Yes this was useful" is
 *  complete on its own; "no it wasn't" is the start of a sentence, and the only
 *  version of that signal anyone can act on is the reason. So the input appears
 *  on thumbs-down alone rather than on both — a comment box under a thumbs-up is
 *  a question with no answer.
 *
 *  TWO TOGGLE BUTTONS, NOT A RADIO GROUP. `aria-pressed` on a pair is the
 *  pattern for "one of these is on"; a radiogroup would need arrow-key handling
 *  and a group label read as a form field, which is heavier than two icons
 *  deserve. The choice is still exclusive — picking one replaces the other.
 *
 *  IT IS A CHANGEABLE ANSWER, not a submission. Both buttons stay live after a
 *  choice, so a reader who mis-clicks can just click the other one. Switching
 *  away from down CLEARS the note with it — see the store action.
 *
 *  ═══ THE ACKNOWLEDGEMENT NEVER SAYS "SENT" ═══
 *  There is no pipeline behind this: the rating and the note land in the local
 *  store and stop there. So the copy says "Noted", which is true, rather than
 *  "Thanks, we'll look into it", which would not be. TODO-DATA on the store
 *  field, TODO-COPY on all four strings.
 */
function AiUsageFeedback({ teenId }: { teenId: string }) {
  const feedback = useOnboardingStore((s) => s.aiUsageFeedback[teenId]);
  const setFeedback = useOnboardingStore((s) => s.setAiUsageFeedback);
  const [draft, setDraft] = useState("");
  const noteId = useId();
  const box = useRef<HTMLTextAreaElement | null>(null);

  const rating = feedback?.rating ?? null;
  const submitted = Boolean(feedback?.note);
  /* The form is open on a thumbs-down that has not been written up yet. Derived
     from the store rather than held in its own flag: a second copy of this
     module mounted at another width must not sit open while this one is done. */
  const asking = rating === "down" && !submitted;

  /* FOCUS FOLLOWS THE REVEAL. The input appeared because the reader pressed a
     button, so it is where they are going next — and a keyboard user would
     otherwise have to tab back into a control that materialised below them.
     Only on the transition into `asking`, never on every render. */
  useEffect(() => {
    if (asking) box.current?.focus();
  }, [asking]);

  return (
    <div className="mt-2">
      {/* THE PROMPT IS PART OF THE ROW, at label scale. A bare pair of thumbs
          with nothing to answer is the version of this control a reader has to
          guess at. TODO-COPY. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="text-[var(--text-muted)]"
          style={{ font: "var(--type-row-label)" }}
        >
          Was this helpful?
        </span>
        <div className="flex items-center gap-0.5">
          {(
            [
              ["up", ThumbsUp, "Yes, the AI on this page was helpful"],
              ["down", ThumbsDown, "No, the AI on this page was not helpful"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              /* THE NAME SAYS WHAT IT MEANS, not "thumbs up". A screen-reader
                 user hearing "thumbs up button" has to infer the question.
                 TODO-COPY, both. */
              aria-label={label}
              onClick={() => {
                /* Re-pressing the current answer is a no-op rather than a
                   toggle-off: there is no "no opinion" state to return to that
                   is distinguishable from never having answered. */
                if (rating === value) return;
                setFeedback(teenId, value);
                setDraft("");
              }}
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-[var(--radius-control)] transition-colors",
                rating === value
                  ? "bg-[var(--tint-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              {/* ═══ THE PRESSED ICON IS FILLED, AND THAT IS THE STATE SIGNAL ═══
                  MEASURED: the pressed background is `rgba(0,0,0,0.04)` over
                  white, which composes to #f5f5f5 — 1.09:1 against the card. As
                  a state indicator that is nothing; WCAG 1.4.11 wants 3:1 for
                  the visual information that identifies a control's state, and a
                  tint that faint does not carry it. The glyph's ink also changes
                  (muted 5.30:1 → primary 15.27:1), and muted-vs-primary is only
                  ~2.9:1 against each other at a 14px glyph.
                  So the pressed thumb is FILLED. Mass, not colour and not a
                  wash — the conventional signal for a cast vote, legible in
                  greyscale and in forced-colors, and unmistakable beside its
                  outlined neighbour.
                  A `fill` ATTRIBUTE, not a utility class: Tailwind's arbitrary
                  SVG paint utilities can generate no rule at all, and lucide
                  passes this straight onto the `<svg>`. `getComputedStyle().fill`
                  is the proof, and it is in the report. */}
              <Icon
                className="size-3.5"
                fill={rating === value ? "currentColor" : "none"}
                aria-hidden
              />
            </button>
          ))}
        </div>
        {/* ONE LIVE REGION FOR THE WHOLE MODULE, so the acknowledgement is
            announced without the buttons re-announcing themselves. Empty until
            there is something to say. */}
        <span aria-live="polite" className="text-[var(--text-muted)]" style={{ font: "var(--type-row-label)" }}>
          {submitted ? "Noted" : rating === "up" ? "Thanks" : ""}
        </span>
      </div>

      {asking && (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const note = draft.trim();
            if (!note) return;
            setFeedback(teenId, "down", note);
          }}
        >
          {/* A REAL LABEL, VISUALLY HIDDEN. The placeholder is a prompt and
              disappears on the first keystroke, which is exactly when a reader
              who needs the label most has lost it. TODO-COPY. */}
          <label htmlFor={noteId} className="sr-only">
            What was wrong with the AI on this page?
          </label>
          <textarea
            id={noteId}
            ref={box}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            /* TODO-COPY */
            placeholder="What was wrong?"
            className={cn(
              "w-full resize-none rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-1.5",
              "text-[13px] leading-[18px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              RING
            )}
          />
          <div className="mt-1.5 flex items-center gap-2">
            {/* DISABLED ON AN EMPTY BOX rather than accepting a blank note: a
                stored note of "" is indistinguishable from the thumbs-down
                already recorded, so submitting one would change nothing while
                telling the reader it had. */}
            <button
              type="submit"
              disabled={!draft.trim()}
              className={cn(
                "inline-flex h-7 items-center rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] px-2.5",
                "text-[12px] leading-[16px] text-[var(--text-primary)] transition-colors",
                draft.trim()
                  ? "hover:bg-[var(--tint-hover)]"
                  : "cursor-not-allowed text-[var(--text-muted)]",
                RING
              )}
            >
              {/* TODO-COPY */}
              Submit
            </button>
            {/* NO CANCEL. Leaving the box empty and walking away is the cancel,
                and the thumbs-down it sits under is a complete answer on its
                own — a Cancel here would imply the rating was provisional. */}
          </div>
        </form>
      )}
    </div>
  );
}

export function RecordAuthorityNote({
  /** The record this card sits on — the AI-usage feedback is keyed by it. */
  teenId,
  className,
}: {
  teenId: string;
  className?: string;
}) {
  const { name, teamHref, email } = CLINICAL_AUTHORITY;
  /* ═══ A GENERATED ID, BECAUSE THIS MODULE IS MOUNTED TWICE ═══
     Once in the rail and once `min-[1100px]:hidden` for narrow viewports, and
     both are in the DOM at every width — so the hard-coded
     `id="record-authority-heading"` appeared twice in one document and both
     `aria-labelledby` attributes resolved to whichever came first. Invalid HTML
     that happened to name the right string. `useId` gives each mount its own. */
  const headingId = useId();

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
          ═══ RESTORED (AND WHY IT SHOULD NOT HAVE GONE) ═══
          The band is `--surface-s2` — the app ground, one step darker than this
          card's white — with a bottom border, and it is what makes the card
          read as a card rather than as a footnote in a box.

          A LATER TYPOGRAPHIC SWEEP REMOVED IT, on the argument that a filled
          band on the second card in a column whose primary card has none is the
          loudest element in that column. That argument was about squint order
          and it was not wrong about squint order; it was wrong about whose call
          it was. The band is in the design frame, the frame was drawn after the
          module shipped, and "the design says so" outranks a legibility
          heuristic applied to someone else's decision. Restored to the frame.

          A REAL HEADING, at 13px, matching the Care summary's own header — so
          the rail reads as two labelled sections to a screen reader rather than
          a section and an unlabelled div, and `aria-labelledby` points here
          instead of duplicating the string in an `aria-label`.

          AVANTT BOLD, NOT `font-semibold`. It was `font-semibold` (600) and that
          renders as regular: this app loads Lausanne 400 and Avantt Bold only,
          and Chrome synthesises nothing for this face at any weight — measured
          identical advance widths at 400, 500, 600 and 700. The frame draws this
          bold, so it takes the face that is actually bold. 13px is off Bloom's
          Avantt ramp (16 / 24 / 32) and matches the frame; same trade as the
          Care summary's caption, same flag. */}
      <h2
        id={headingId}
        className="border-b border-[color:var(--border-subtle)] bg-[var(--surface-s2)] px-4 py-2.5 font-display text-[13px] font-bold leading-[18px] text-[var(--text-primary)]"
      >
        {/* TODO-COPY */}
        About this Record
      </h2>

      {/* ── CLINICAL AUTHORITY ─────────────────────────────────────────────
          VERBATIM COPY. The sentence is preserved exactly as it read at the foot
          of the column; only its container changed. Do not reword it here — it
          is pending clinical sign-off, and this is not the surface that decides
          what it says. */}
      {/* `py-3` AGAIN. It was `pb-3 pt-2` while the heading was a bare label
          sharing this section's air; the band has its own padding back, so the
          two no longer double up. */}
      <div className="px-4 py-3">
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
            className={cn(TEXT_LINK, "whitespace-nowrap font-display font-bold")}
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
          {/* TODO-COPY. THE TERMINAL FULL STOP IS GONE. It was mine — the frame
              ended this sentence without one and I added it, on the argument
              that a sentence on a clinical record should close, and flagged it
              as veto-able. A second frame has now drawn it without the period,
              which is the veto. */}
          AI is used in parts of this page. Always review AI generated content
          for accuracy
        </p>
        {/* ═══ THE FEEDBACK MODULE SITS IN THIS QUADRANT, UNDER THE CAVEAT ═══
            Under the sentence it is about, inside the section it belongs to —
            not in the card's footer, where it would read as feedback on the
            whole card, and not beside the "Clinical Advisor" section, where the
            subject would be a person. */}
        <AiUsageFeedback teenId={teenId} />
      </div>
    </section>
  );
}
