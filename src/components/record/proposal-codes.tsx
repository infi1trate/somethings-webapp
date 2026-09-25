"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE BILLING CODES, AS LOZENGES (addendum §2.9)
//
// ═══ WHAT THIS REPLACES ═══
//
// `proposalPreview` returns a sentence — "Change proposed → F41.1" — and the
// row rendered it as one run of secondary text. A code is not prose: it is an
// identifier a supervisor matches against a record, and three of them in a
// paragraph read as a sentence with an arrow in it.
//
// ═══ THE TREATMENT, AND WHY IT IS ONE LOZENGE PER CODE ═══
//
// A CHANGE shows both: the code on record, outlined, then the arrow, then the
// proposed code, filled. Two lozenges with a transition between them is the
// only form that says WHAT IT IS CHANGING FROM — which is the fact a reviewer
// needs and the string form buries at the end.
//
// A RENEWAL shows ONE lozenge, because both codes are the same value. An arrow
// from F33.1 to F33.1 is a diagram of nothing, which is the defect
// `proposalKindFor` was extracted to prevent — a first-ever review once wore
// "Change proposed → F43.22" beside a header already reading F43.22.
//
// A FIRST ASSIGNMENT shows ONE lozenge, filled, with nothing on the left: there
// is no code on record to point away from.
//
// ═══ THE KIND LABEL IS DEMOTED, NOT DELETED ═══
//
// A renewal and a first assignment both render one filled lozenge, so the
// lozenges alone cannot tell them apart — and they are different decisions
// (confirm what is there, versus put something there for the first time). The
// word carries that, quietly, beside the codes rather than in front of them.
//
// ═══ MONO AND TABULAR ═══
//
// These are identifiers. `F33.1` and `F41.1` differ in one glyph, and in a
// proportional face that glyph sits in a different place on every row.

import {
  PROPOSAL_LABEL,
  proposalKindFor,
} from "@/lib/record/proposal-kind";
import { cn } from "@/lib/utils";

const LOZENGE =
  "inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[11.5px] leading-[16px] tabular-nums";

/** ═══ A CHANGE IS THE ONE THAT WANTS A SECOND LOOK ═══
 *  The card's chips carried this as a tint — amber for a change, neutral for a
 *  renewal or a first assignment — and that judgment survives the move to
 *  lozenges: a renewal is a twenty-second confirm and a change needs thought.
 *  ON THE PROPOSED CODE ONLY, so the tint marks the decision rather than the
 *  pair. `--band-amber-*` is an existing token pair (7.24:1 light, 5.73:1
 *  dark) — zero new tokens is the rule. */
function Code({
  code,
  tone,
}: {
  code: string;
  tone: "onRecord" | "proposed" | "changed";
}) {
  return (
    <span
      data-billing-code={code}
      data-code-tone={tone}
      className={cn(
        LOZENGE,
        tone === "changed"
          ? "bg-[var(--band-amber-bg)] font-semibold text-[var(--band-amber-fg)]"
          : tone === "proposed"
            ? /* THE PROPOSED CODE CARRIES THE INK. It is the thing being
                 decided; the code on record is context for it. */
              "bg-[var(--surface-s2)] font-semibold text-[var(--text-primary)]"
            : "border border-[color:var(--border-contour)] text-[var(--text-secondary)]"
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {code}
    </span>
  );
}

export function ProposalCodes({
  currentCode,
  recommendedCode,
  /** ═══ A ROW HAS 280px AND THE CARD HAS THE WIDTH (addendum §2.9) ═══
   *  MEASURED at 1280: the worklist row rendered "F33.0 → F33.1 Change propc"
   *  — the kind label truncated mid-word, which reads as broken rather than as
   *  abbreviated.
   *  THE WORD ONLY EARNS ITS PLACE WHERE THE LOZENGES CANNOT SAY IT. Two
   *  lozenges with an arrow between them ARE a change. One lozenge is either a
   *  renewal or a first assignment, which are different decisions — confirm
   *  what is on record, versus put something there for the first time — and
   *  nothing but the word distinguishes them.
   *  ═══ `compact` NOW DROPS IT ALWAYS (Refinement §1.4) ═══
   *
   *  It dropped the word only for a change, on the reasoning above: two
   *  lozenges with an arrow ARE a change, while one lozenge is either a renewal
   *  or a first assignment and nothing but the word tells those apart.
   *
   *  §1.4 overrides that for the ROW, and states the principle it is applying:
   *  the list showed two treatments for one idea — a lozenge pair for a change,
   *  a lozenge plus a text label for everything else — and "the shape already
   *  says it". MEASURED across ten rows: 5 pairs, 4 "Presentation proposed",
   *  1 "Renewal proposed".
   *
   *  WHAT IS LOST, STATED PLAINLY: on a row, a renewal and a first assignment
   *  now draw the same single filled lozenge. That was reported before this was
   *  built and accepted.
   *
   *  WHAT CARRIES IT INSTEAD is `proposalSpoken`, which states the kind for
   *  every case and is already in every row's accessible name. That is not a
   *  consolation prize — it is the same mitigation §2.9 chose when it removed
   *  the `Billing code review` chip from these rows: "IT SURVIVES IN THE
   *  ACCESSIBLE NAME for exactly one reason: a screen-reader user arriving
   *  mid-list has no page title above them."
   *
   *  The card keeps all three, where "proposed" is doing work beside a Submit
   *  button. */
  compact = false,
  className,
}: {
  currentCode: string | null | undefined;
  recommendedCode: string;
  compact?: boolean;
  className?: string;
}) {
  const kind = proposalKindFor(currentCode, recommendedCode);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {kind === "change" && currentCode && (
        <>
          <Code code={currentCode} tone="onRecord" />
          {/* ARIA: the arrow is decorative and the accessible name below says
              "changing from X to Y" in words. A bare "→" announced between two
              codes is a reader guessing at direction. */}
          <span aria-hidden className="shrink-0 text-[11px] text-[var(--text-muted)]">
            →
          </span>
        </>
      )}
      <Code
        code={recommendedCode}
        tone={kind === "change" ? "changed" : "proposed"}
      />
      {!compact && (
        <span className="min-w-0 truncate text-[12px] leading-[16px] text-[var(--text-secondary)]">
          {PROPOSAL_LABEL[kind]}
        </span>
      )}
    </span>
  );
}

/** The same fact in words, for an accessible name. The lozenges are visual; a
 *  screen-reader user needs the direction stated rather than inferred from an
 *  arrow glyph that is `aria-hidden`. NEEDS-COPY-NICOLE. */
export function proposalSpoken(
  currentCode: string | null | undefined,
  recommendedCode: string
): string {
  const kind = proposalKindFor(currentCode, recommendedCode);
  if (kind === "change") {
    return `${PROPOSAL_LABEL.change}, from ${currentCode} to ${recommendedCode}`;
  }
  return `${PROPOSAL_LABEL[kind]}, ${recommendedCode}`;
}
