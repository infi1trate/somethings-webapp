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

/** ═══ 12/16, AND IT WAS 11.5/16 ═══
 *  11.5px is not a step on Bloom's ramp (32/40 · 24/32 · 16/24 · 14/20 ·
 *  12/16) — it is an invented size, the class `view-presets.test.ts` says was
 *  "retired from these rows" and which keeps reappearing wherever no test
 *  looks. 12/16 is the ramp's bottom pair and the size the heading chip this
 *  component now absorbs was already using, so unifying UP to a ramp value
 *  costs nothing and fixes both call sites at once.
 *  MEASURED: `F33.1` goes 32.9px -> 34.4px in the mono stack, +1.5px. */
const LOZENGE =
  "inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[12px] leading-[16px] tabular-nums";

/** ═══ A CHANGE IS THE ONE THAT WANTS A SECOND LOOK ═══
 *  The card's chips carried this as a tint — amber for a change, neutral for a
 *  renewal or a first assignment — and that judgment survives the move to
 *  lozenges: a renewal is a twenty-second confirm and a change needs thought.
 *  ON THE PROPOSED CODE ONLY, so the tint marks the decision rather than the
 *  pair. `--band-amber-*` is an existing token pair (7.24:1 light, 5.73:1
 *  dark) — zero new tokens is the rule. */
/** ═══ THE ONE BILLING-CODE LOZENGE (elevation pack §3 continuity) ═══
 *
 *  "One lozenge component for billing codes across every state and every
 *  surface." IT WAS TWO. This was module-private and rendered only through
 *  `ProposalCodes`, whose single live call site is the Care page — and the
 *  Care Reviews pane showed its code through a SECOND, inline chip in
 *  `review-body.tsx`: `h-[22px] rounded-[4px]` with a `--surface-s1` fill and
 *  a `--border-subtle` hairline at 12px. Two shapes, two type sizes, two fills,
 *  one object, and only one of them carried `data-billing-code` — so a probe
 *  asking "what codes are on screen" could not see the pane's at all.
 *
 *  EXPORTED AND ABSORBING BOTH. The pill wins the shape: it is what the pack
 *  calls a lozenge, it is what carries the state tones §4 will need, and it is
 *  the instance a probe can already find. The heading chip's SIZE wins the type
 *  (12/16, a ramp pair — see `LOZENGE`), and its neutral treatment survives as
 *  the `identity` tone below.
 *
 *  ═══ A CHANGE IS THE ONE THAT WANTS A SECOND LOOK ═══
 *  The card's chips carried this as a tint — amber for a change, neutral for a
 *  renewal or a first assignment — and that judgment survives the move to
 *  lozenges: a renewal is a twenty-second confirm and a change needs thought.
 *  ON THE PROPOSED CODE ONLY, so the tint marks the decision rather than the
 *  pair. `--band-amber-*` is an existing token pair (7.24:1 light, 5.73:1
 *  dark) — zero new tokens is the rule.
 */
export function BillingCodeLozenge({
  code,
  tone,
  className,
}: {
  code: string;
  /** ═══ FOUR TONES, AND `identity` IS THE NEW ONE ═══
   *  · `onRecord` — the code being changed FROM. Outlined, no fill.
   *  · `proposed` — a first assignment or a renewal. Filled, primary ink.
   *  · `changed`  — the code being changed TO. Amber; wants a second look.
   *  · `identity` — THE CODE NAMED IN A HEADING, beside its own statement.
   *
   *  `identity` EXISTS BECAUSE THE HEADING MUST NOT RESTATE THE DECISION. On
   *  the Care page the proposal row above already carries the amber, so an
   *  amber heading chip would state "this is a change" twice, six pixels
   *  apart. And the heading's code is `shown.code` — whatever the supervisor
   *  has currently picked — so a chip that claimed a state there would be
   *  claiming it about a selection in progress.
   *  IT IS THE ABSORBED CHIP'S OWN TREATMENT, unchanged: `--surface-s1` fill,
   *  `--border-subtle` hairline, secondary ink. Not `onRecord`, which is a
   *  different statement (a code being superseded) wearing a similar quiet. */
  tone: "onRecord" | "proposed" | "changed" | "identity";
  className?: string;
}) {
  return (
    <span
      data-billing-code={code}
      data-code-tone={tone}
      className={cn(
        LOZENGE,
        tone === "changed"
          ? /* ═══ THE FIGMA'S "attention" TONE, MAPPED (§3) ═══
               Node 4324:1111 paints the recommended code on a change with
               `surface/s4` #c3b798, a `surface/s7` #82734f hairline and
               `text/onPrimary` white. NEITHER TOKEN EXISTS IN THIS APP — the
               surface scale here is s0/s1/s2 and stops — and MEASURED, white on
               #c3b798 is **1.99:1**, against 4.5 for 12px text. So the literal
               values are both unavailable and a WCAG failure, and mapping them
               by eye would be shipping a measured failure.
               `--band-amber-*` IS THE BLOOM EQUIVALENT AND IT WAS ALREADY HERE:
               7.24:1 light, 5.73:1 dark, and its recorded meaning is the one the
               attention slot wants — "a change is the one that wants a second
               look". Zero new tokens, which is this repo's rule. */
            "bg-[var(--band-amber-bg)] font-semibold text-[var(--band-amber-fg)]"
          : tone === "proposed"
            ? /* THE PROPOSED CODE CARRIES THE INK. It is the thing being
                 decided; the code on record is context for it. */
              "bg-[var(--surface-s2)] font-semibold text-[var(--text-primary)]"
            : /* ═══ ONE NEUTRAL PAINT FOR `identity` AND `onRecord` (§3) ═══
                 The node has exactly TWO code-lozenge treatments — "attention"
                 and "Default" — and its Default (`surface/s1` fill,
                 `border/border-subtle` hairline, `text/secondary` ink) is
                 token-for-token what `identity` already shipped: #f6f4ef,
                 #dfddd8, #58534b against this app's own s1, border-subtle and
                 text-secondary. Exact match, no mapping needed.
                 SO `onRecord` ADOPTS IT rather than keeping its own outline.
                 It used to be border-only on no fill, which read as a THIRD
                 treatment the reference does not have — and beside the amber
                 `changed` lozenge in a from->to pair, an unfilled chip read as
                 absent rather than as superseded.
                 THE TWO NAMES SURVIVE because they are different STATEMENTS at
                 different sites — `onRecord` is a code being superseded,
                 `identity` is a code being named — and the reference painting
                 both the same way is an argument for one paint, not for one
                 name. The day either needs its own, the branch is here. */
              "border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] text-[var(--text-secondary)]",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {code}
    </span>
  );
}

/** ═══ §3 · THE THIRD STATE'S PILL — `New presentation` ═══
 *
 *  Node 4324:1111 carries a HIDDEN `Lozenge` at x=489 on line 1 — 118x24, pill
 *  radius, `sky/100` #b8f1ff ground with `sky/800` #005b76 text, Lausanne 500
 *  at 12/16, reading "New presentation". Hidden in that variant because the
 *  variant is a CHANGE; it is the first-assignment state's mark, and finding it
 *  hidden is what told us the set has three members rather than two.
 *
 *  ═══ THE ONE MAPPING WITH NO BLOOM ANSWER, STATED ═══
 *
 *  `sky` DOES NOT EXIST HERE. The band palette is sand / amber / clay / sage /
 *  rose and there is no blue; `--surface-s*` stops at s2. The Figma pair
 *  measures 6.19:1, so it is not a contrast problem — it is a token problem,
 *  and "zero new tokens" is this repo's rule. A `--band-sky-*` pair would be
 *  two new tokens introduced by a component.
 *
 *  `--band-sage-*` IS THE NEAREST AVAILABLE PAIR: the only cool one, 5.41:1
 *  light and 7.45:1 dark, and the distinct accent §3 asks for — it is used
 *  nowhere else on this surface, so it cannot be confused with a state that
 *  already has a meaning. Sage reads as new rather than as alarming, which is
 *  the right register for a first assignment.
 *  THE COST IS STATED: it is GREEN where the reference is BLUE, and sage is
 *  also the Care page's "on track" hue elsewhere in the system. If the accent
 *  has to be blue, that is a token decision rather than a component one, and
 *  this is the call site to change.
 *
 *  A TEXT PILL, NOT A CODE LOZENGE, so it is deliberately NOT
 *  `BillingCodeLozenge`: it holds a phrase, takes the pill radius the node
 *  gives it, and carries no `data-billing-code` — the guard test's "one
 *  emitter" invariant stays true because this emits nothing.
 */
export function NewPresentationPill() {
  return (
    <span
      data-anno-ref="new-presentation-pill"
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] leading-[16px]"
      style={{
        backgroundColor: "var(--band-sage-bg)",
        color: "var(--band-sage-fg)",
      }}
    >
      {/* NEEDS-COPY-NICOLE. The node's own string. */}
      New presentation
    </span>
  );
}

/** The internal name this file used before the component was exported. Kept as
 *  an alias so the call sites below read as they did rather than churning in a
 *  commit about continuity. */
const Code = BillingCodeLozenge;

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
  codeStatedAbove = false,
  className,
}: {
  currentCode: string | null | undefined;
  recommendedCode: string;
  compact?: boolean;
  /** ═══ THE CALLER SAYS WHETHER THE CODE IS ALREADY ON SCREEN ═══
   *  `false` BY DEFAULT, so no existing caller changes behaviour by being left
   *  alone — and so the suppression is a fact the caller knows rather than an
   *  assumption this component makes. A future host that renders the proposal
   *  WITHOUT a heading above it gets the lozenge back for free.
   *  See the note at the lozenge for what it suppresses and why a change is
   *  exempt. */
  codeStatedAbove?: boolean;
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
      {/* ═══ THE RECOMMENDED LOZENGE IS SUPPRESSED WHEN A HEADING STATES IT ═══
          MEASURED on all four record fixtures: the recommended code rendered
          TWICE on the Care page, every time — the heading's `identity` lozenge
          and this one.
            t19 change   F33.1/identity · F33.0/onRecord · F33.1/changed
            t17 renewal  F33.1/identity · F33.1/proposed
            t12 assign   F43.22/identity · F43.22/proposed
            t9  intake   F43.22/identity · F43.22/proposed
          Unifying the lozenge did not cause this — both renderings pre-date it
          — but it is what made it visible: they used to be two different
          shapes, so the repeat read as two different objects.

          WHY THIS SIDE GIVES. The heading is `Recommended presentation` + code
          + statement; the code there is IDENTITY and cannot be dropped without
          leaving a statement with no code beside it. This row's job is the KIND
          and, for a change, the DELTA. For a renewal or a first assignment
          there is no delta, so its lozenge was saying exactly what the heading
          had already said, six pixels away.

          A CHANGE KEEPS ITS PAIR, AND THAT IS A DELIBERATE EXCEPTION. Dropping
          the target from `F33.0 → F33.1` leaves an arrow pointing at nothing,
          and the pair IS the information — the repeat there carries the delta
          rather than restating identity. So `F33.1` still appears twice on a
          change, and it is the one case where that is load-bearing. The
          remaining-items pack's §3 reworks these three states and the
          directional glyph with them; this is the right shape to hand it,
          rather than a row with a dangling arrow. */}
      {(kind === "change" || !codeStatedAbove) && (
        <Code
          code={recommendedCode}
          tone={kind === "change" ? "changed" : "proposed"}
        />
      )}
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
