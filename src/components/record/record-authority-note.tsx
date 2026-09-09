// ═══ CLINICAL AUTHORITY + THE BLANKET AI CAVEAT ═══
//
// Two standing facts about the whole Care tab, in one small module beneath the
// Care summary. Neither is about a particular record, a particular review or a
// particular field — which is exactly why they are here and not attached to any
// of those things.
//
// WHERE THIS CAME FROM. The authority sentence was a bare line at the foot of
// the main column, above a `border-t`, with no label and nothing around it. At
// the bottom of a long clinical page it read as page furniture — the register a
// reader learns to skip. Given a container and a label it is findable on
// purpose rather than by scrolling to the end.
//
// THE AI CAVEAT IS THE BLANKET ONE, AND IT IS NOT THE PROVENANCE BADGES. The
// per-field disclosures (`field-provenance-note.tsx`) say which specific
// sentence a model touched; this says the page uses AI at all and asks a reader
// to check what it produces. A reader needs both and they answer different
// questions — so this one must not grow into a summary of the other.
//
// WHY IT IS A FOOTNOTE AND NOT A WARNING. No icon, no tint, no divider between
// the two lines. A tinted block with an alert glyph would make the caveat the
// loudest thing in the rail and would read as "something is wrong with this
// record", which is not what it says. It is a standing condition of the page,
// true on every record, and a permanent warning is a warning nobody reads.
//
// EMAIL IS A TEXT LINK, NEVER A BUTTON. It follows the sentence rather than
// leading it, because the sentence is the point and the address is an
// affordance for acting on it. A filled or outlined control here would compete
// with the Care summary above and with the review actions in the spine — and
// this module has no business being the third thing on the tab that looks
// actionable.

import Link from "next/link";
import { Mail } from "lucide-react";
import { CLINICAL_AUTHORITY } from "@/lib/record/clinical-authority";
import { cn } from "@/lib/utils";

/** Focus ring, matching every other interactive element on the record. */
const RING =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Both links take the same quiet treatment: underlined body text that darkens
 *  on hover. Identical to the treatment the authority name already had at the
 *  foot of the column, so nothing about the name's affordance changed when it
 *  moved — only its surroundings. */
const TEXT_LINK = cn(
  "underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
  RING
);

export function RecordAuthorityNote({ className }: { className?: string }) {
  const { name, teamHref, email } = CLINICAL_AUTHORITY;

  return (
    <section
      /* TODO-COPY */
      aria-label="About this record"
      /* A screenshot anchor, like the summary card's — see the note there on why
         a probe naming a class selector evidences the wrong element the first
         time the layout moves. */
      data-record-section="record-authority"
      className={cn(
        /* SAME SURFACE AND SAME RADIUS AS THE CARE SUMMARY, deliberately: this
           belongs to the rail's stack rather than floating beside it. What makes
           it a step DOWN is type and padding, not a different material —
           `px-4 py-3.5` against the summary header's `px-5 py-4`, and no
           heading-scale type anywhere inside. */
        "rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3.5",
        className
      )}
    >
      {/* THE LABEL IS AT FIELD SCALE, NOT HEADING SCALE. `--type-field-label` is
          the smallest label token in the system and the one the compose form's
          field labels use; a `--type-card-title` here would announce this as a
          second card of equal standing to the Care summary. */}
      <p
        className="text-[var(--text-muted)]"
        style={{
          font: "var(--type-field-label)",
          letterSpacing: "var(--type-field-label-tracking)",
        }}
      >
        {/* TODO-COPY */}
        About this record
      </p>

      {/* ── LINE 1 · CLINICAL AUTHORITY ─────────────────────────────────────
          VERBATIM COPY. The sentence is preserved exactly as it read at the foot
          of the column; only its container changed. Do not reword it here — it
          is pending clinical sign-off, and this is not the surface that decides
          what it says. */}
      <p className="mt-2 text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {/* ═══ THE NAME STILL POINTS AT TEAM, AND NOW TEAM ANSWERS ═══
            A staff self-profile route does not exist — deferred work, recorded
            as design-system-gaps row 314 — so this goes to the Team directory.
            What changed is that the directory now LISTS this person: the link
            was previously truthful about its destination and useless on arrival.
            See the fixture note in `people-demo.ts`. */}
        <Link href={teamHref} className={TEXT_LINK}>
          {name}
        </Link>
        {
          " is the final decision-maker on all clinical notes and determinations on this page."
        }{" "}
        {/* ═══ THE EMAIL AFFORDANCE ═══
            AFTER the sentence, never before it, and inside the same paragraph so
            it wraps as part of the line rather than sitting on a row of its own
            looking like an action bar.
            THE GLYPH IS DECORATIVE. `aria-hidden` on the icon and an explicit
            accessible name on the link, because "Email" alone would announce as
            a link whose target a screen-reader user cannot infer — there are two
            people named on this tab and only one of them is writable to. */}
        <a
          href={`mailto:${email}`}
          aria-label={`Email ${name}`}
          className={cn(TEXT_LINK, "whitespace-nowrap")}
        >
          <Mail className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
          {/* TODO-COPY */}
          Email
        </a>
      </p>

      {/* ── LINE 2 · THE BLANKET AI CAVEAT ──────────────────────────────────
          SAME SCALE AS LINE 1 AND NO DIVIDER. The two lines are separated by the
          module's own rhythm (`mt-2`, the same step as the label-to-line-1 gap),
          because a rule between them would rank one above the other and they are
          two standing facts of equal weight.
          NO ICON AND NO TINT — see the header note. */}
      <p className="mt-2 text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {/* TODO-COPY */}
        AI is used in parts of this page. Always review AI-generated content for
        accuracy.
      </p>
    </section>
  );
}
