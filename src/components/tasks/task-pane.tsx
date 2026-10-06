"use client";

// THE DETAIL PANE (§5). One frame, three bodies, a sticky footer per task type.
//
// SHARED FRAME: header (teen + age, mentor, domain chip, opened time, breach chip)
// → independently scrolling body → sticky footer action bar. The footer is sticky
// because the body can be long and the decision must never be below the fold on a
// surface whose entire job is deciding.
//
// THIS IS WHERE FLAGGED CONTENT LIVES, AND THE ONLY PLACE (locked decision 12).
// The quoted excerpt renders here and nowhere else; the worklist has no code path
// to it.
//
// ESCALATIONS ARE READ-ONLY (§5, locked decision 3). Nothing on the escalation body
// mutates state and its single footer action routes out. `resolveWithUndo` throws
// if handed one, so the rule is enforced twice — once by not offering a control,
// once by the utility refusing.
//
// ONE PRIMARY BUTTON PER REGION. With the Next-up strip gone the page has no
// primary above the list at all, so the footer's confirm — "primary within the
// pane" in §5's words — is the only filled button on the surface. It uses
// PillButton; every other control here is a RecordButton.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { RecordButton } from "@/components/record/record-button";
import { ReviewBody } from "@/components/record/review-body";
import { billingReviewFor } from "@/lib/tasks/billing-presentation";
import type { ReviewDecision } from "@/lib/record/review-draft";
import {
  BillingReview,
  type BillingCommitDetail,
  type BillingSubmitHandle,
} from "@/components/tasks/billing-review";
/* `chatThreadHref` AND `MessageSquare` LEFT WITH THE SECOND LINK (§3).
   The conversation link is gone — one way out, not two — and the import
   goes with it rather than sitting unused above a pane that no longer
   offers that destination. `chatThreadHref` is still exported and still
   used by the record header and the Risk Flags pane. */
import { OUTCOME_VERB, type ClosedCareReview } from "@/lib/tasks/closed-review";
import { BillingCodeLozenge } from "@/components/record/proposal-codes";

import { CareUpdateBodyView, CareUpdateByline } from "@/components/record/care-update-view";
import type { CareUpdateRecord } from "@/lib/record/care-demo";
// Still used by the BILLING pane's Notes link — a different block from the
// risk-flag excerpt. (It read "AI-summary link" until that block's label became
// "Notes"; the link itself is unchanged.)
import {
  buildConversation,
  conversationHref,
  firstNameOf,
} from "@/lib/tasks/conversation";
import { ConversationExcerpt } from "@/components/tasks/conversation-excerpt";
import { OverlayScrollbar } from "@/components/ui/overlay-scrollbar";
import { OverdueChip } from "@/components/tasks/worklist";
import { isOverdue } from "@/lib/tasks/care-overdue";
import {
  type BillingPayload,
  type RiskFlagPayload,
  type TaskItem,
} from "@/lib/tasks/types";
import { dispositionDetail, dispositionFor } from "@/lib/tasks/disposition";
import {
  PANE_LABEL,
  PaneChip,
  SystemBlock,
} from "@/components/ui/evidence-primitives";
import { cn } from "@/lib/utils";

/** The field-label face — the same tokens `review-body.tsx` and
 *  `care-update-view.tsx` use for their own labels. */
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE PANE PRIMITIVES MOVED TO `ui/evidence-primitives.tsx` ═══
 *
 *  `LABEL`, `SystemBlock`, `QuoteBlock` and `Chip` were defined here and are now
 *  imported, unchanged, because the Activity evidence pane needs the same section
 *  rhythm. The alternative was a second `QuoteBlock` that starts identical and
 *  drifts — and a teen's own message rendered two subtly different ways on two
 *  staff surfaces is the drift that matters least to a developer and most to a
 *  reader. The rationale comments travelled with them, including the gap-row
 *  citations (218, 219, 290).
 *
 *  ALIASED SO THE BODIES BELOW ARE UNTOUCHED: this file's call sites still read
 *  `LABEL` and `<Chip>`, so the extraction changed no rendered DOM here. */
const LABEL = PANE_LABEL;
const Chip = PaneChip;


/** ═══ THE EXCERPT FAILS INDEPENDENTLY ═══
 *
 *  Its own state, threaded from the pane rather than derived from the pane's, so
 *  an excerpt that cannot load never blocks the rest of the body or the resolve
 *  actions. That is the whole requirement: a supervisor who cannot see the
 *  transcript can still act on the flag, and one who can see it is not waiting on
 *  anything else. */
export type ExcerptState = "ready" | "loading" | "error";

// ── Bodies ──────────────────────────────────────────────────────────────────

function RiskFlagBody({
  payload,
  teenId,
  item,
  now,
  excerptState,
  onRetryExcerpt,
}: {
  payload: RiskFlagPayload;
  teenId: string;
  item: TaskItem;
  now: number;
  excerptState: ExcerptState;
  onRetryExcerpt: () => void;
}) {
  /** THE FLAGGED LINE IS THE ANCHOR, verbatim — see `buildConversation`. Built
   *  per render rather than memoised: it is a pure function of three values the
   *  pane already holds, and the fixture is ~20 objects. */
  const conversation = buildConversation(item, payload.flaggedExcerpt, now);
  return (
    <div className="space-y-4">
      {/* ═══ THE "TYPE / MESSAGE" ROW IS GONE (Part 5) ═══
          A labelled row whose value is "Message" on every flag in the system is
          not a fact, it is furniture: it costs two lines at the top of the pane —
          the first two lines, above the excerpt — to tell a supervisor something
          that has never once been different. And the excerpt directly below it is
          visibly a conversation, so even the fact it states is already stated.
          It survives as a CHIP, and only when it says something. The day flags
          start arriving from a video note or a journal entry, that chip appears
          beside the categories, where a reader is already looking for what makes
          this flag different from the last one. */}
      <div>
        <p className={LABEL}>{/* TODO-COPY */}Category</p>
        {/* PLAIN-LANGUAGE PLAYBOOK CATEGORIES (§5). Raw enum values never reach
            this surface — the seed carries prose. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {payload.categories.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          {payload.sourceType !== "Message" && <Chip>{payload.sourceType}</Chip>}
        </div>
      </div>

      {/* ═══ THE CONVERSATION, NOT A QUOTE (Part 1) ═══
          The `QuoteBlock` that lived here showed the flagged line alone. It
          answered "what was said"; the question this pane asks — "was this
          flagged correctly?" — is about what surrounds it. "idk it's fine" is
          unremarkable after a joke and worth a second look after a disclosure,
          and one line cannot tell those apart.
          THE STRING IS THE SAME ONE. `flaggedExcerpt` is placed verbatim at the
          anchor, so the rationale below still quotes a sentence the reader can
          see in the transcript. */}
      <div>
        <p className={LABEL}>{/* TODO-COPY */}Conversation</p>
        <div className="mt-2">
          <ConversationExcerpt
            conversation={conversation}
            teenName={firstNameOf(item.teenDisplayName)}
            href={conversationHref(teenId, conversation.anchorId)}
            state={excerptState}
            onRetry={onRetryExcerpt}
          />
        </div>
      </div>

      <div>
        <p className={LABEL}>{/* TODO-COPY */}Why this was flagged</p>
        <div className="mt-2">
          <SystemBlock label="AI rationale">{payload.aiRationale}</SystemBlock>
        </div>
      </div>
    </div>
  );
}

/* ═══ THE PRESENTATION COMPARISON: THREE OWNERS, AND NOW ONE ═══
   `ChangeSide` lived here. It became `record/presentation-diff.tsx` — a shared
   two-column Current → Recommended block with three proposal kinds and a chip —
   on the reasoning that the same clinical comparison was being drawn two ways on
   the two surfaces that commit it.
   THE PRODUCT OWNER SETTLED IT THE OTHER WAY: the Care page is the reference
   standard, so the diff was reverted OFF Care and left as a Tasks-only
   component. That made it a shared component with one consumer, which is a
   single component with extra steps.
   `review-module-02-tasks-host` ends it. This pane renders `ReviewBody` — the
   Care card's own review — so the comparison is drawn once, by the module both
   surfaces use, and `presentation-diff.tsx` is DELETED rather than kept as
   surface with no reader. Its one idea that does not survive is the two-column
   layout; what replaced it is the module's recommendation line plus an "On
   record" row in the host's context strip, which states the same two facts in
   the order a supervisor reads them. */

/** ═══ THE RECORD CONTEXT ACCORDION (arch-F, F2) ═══
 *
 *  The mentorship figures — days, messages, video — were half of a two-cell strip
 *  at the top of the pane, which put them above the recommendation they are
 *  context for. They are a thing a supervisor CONSULTS when the recommendation
 *  looks surprising, not a thing they read every time, so they are collapsed.
 *
 *  BUILT HERE RATHER THAN IN THE MODULE, and minimal by intent: the parity work
 *  specifies a Record context accordion and this pane has none (arch-F's recon
 *  confirmed the only disclosure in the module is the score strip's). This is the
 *  Tasks-only version — one section, the figures it already had — so that when
 *  the real one lands there is one place to replace and nothing of the old header
 *  left behind.
 *
 *  A REAL <button> WITH `aria-expanded`, the whole row as the target, the caret
 *  `aria-hidden` — the same arrangement the score strip settled on. */
/* ═══ REMOUNTED (rework §7), AND THE NOTE BELOW PREDICTED IT ═══
   The Figma alignment pass removed this accordion and said so in the words
   §7 came back for: "this is the one change in the set that removes CLINICAL
   CONTEXT rather than chrome, so it is the one worth a second look before it
   ships". §7 is that second look, and the strangler rule is what made it a
   one-line remount instead of a rebuild — which is the whole argument for the
   rule, so it is worth recording that it paid off once.
   IT NAMES THE MENTOR NOW, which it did not before. The ROW deliberately never
   does — `e.no-mentor` in `row-semantics` asserts that no Tasks row names a
   mentor in text or in its accessible name, because the row's unit is the
   review and the mentor is not its subject. The pane is where the question
   "who is working with this teen" is legitimately asked, and §7 asks it.
   ENGAGED DAYS IS NOT HERE. §7 asked for it and nothing publishes it: there is
   no per-day engagement log in this model, and `care-summary.tsx` says the same
   thing where the Care page would have wanted it. A figure derived from
   `messagesLast30` would look authoritative and be invented, which is the
   failure arch-mon spent a phase removing from the flag tiers. Blocked and
   reported rather than approximated. */
/** ═══ THE MENTOR CHIP — INLINE, LINE-HEIGHT TALL (header pass 3, §2.2) ═══
 *
 *  Last pass this was a block-level pill carrying a `Mentor` label, an initial
 *  and the name at two type steps. §2.2 puts it INSIDE a sentence — "Mentored by
 *  [● Nour Barakat] · 140 days in mentorship · …" — so three things change:
 *
 *  · THE ROLE WORD LEAVES THE CHIP. "Mentored by" carries the role in the
 *    language, so a `Mentor` label inside the pill would say it twice — and it
 *    was the chip's second type style.
 *  · IT IS EXACTLY THE LINE'S HEIGHT. 20px, the body step's line-height, so the
 *    chip sits in the line like a word rather than bumping it taller. MEASURED in
 *    the commit: the sentence's line box is the same height with and without it.
 *  · ONE TYPE STYLE INSIDE IT. The initial and the name are both the body step;
 *    the circle is what distinguishes the initial, not a smaller size.
 *
 *  ═══ STILL NOT INTERACTIVE, FOR THE SAME REASON ═══
 *
 *  There is no mentor record to link to: `/admin/person/{id}` is keyed by teen id
 *  and the mentor exists here as a name on the task with no id. So it must not
 *  look interactive — a `span`, no tab stop, no hover, no pointer cursor. A chip
 *  is a pattern people expect to click, which is why this is asserted rather
 *  than left to styling.
 *
 *  `--surface-s1` ON THE `--surface-s2` BAND — Tier 2 inside Tier 1, the same
 *  ranking the Assessments block uses. No contour: a fill and a contour together
 *  are two treatments, which `flag-task-card` rules out for tonal insets.
 */
function MentorChip({ name }: { name: string }) {
  return (
    <span
      data-anno-ref="mentor-chip"
      /* `align-top`, AND IT WAS `align-[-5px]`. MEASURED: the offset pushed the
         chip 5px below its line box, so a two-line sentence measured 45px instead
         of 40 — the chip WAS bumping the row, which my first check missed because
         it compared the chip's height to the line-height rather than measuring
         the line. A 20px inline box aligned to the TOP of a 20px line cannot
         extend it, and because the name inside is the same 14/20 as the words
         around it, the baselines still meet. */
      className="inline-flex h-5 max-w-full items-center gap-1 rounded-full bg-[var(--surface-s1)] pr-2 align-top"
    >
      {/* THE MARK, at the line's own height. `aria-hidden` — it is the first
          letter of the name beside it. */}
      <span
        aria-hidden
        /* 14/20, NOT 14 with `leading-none` — `leading-none` made the initial a
           14/14 style of its own, measured as a separate entry in the band's
           type count. In a 20px circle a 20px line centres the same glyph. */
        /* `--surface-card`, AND IT WAS `--surface-s2` — WHICH IS THE BAND'S OWN
           FILL. The disc sits flush against the pill's left edge, so in the band's
           colour it vanished into the band and the initial read as a letter on the
           header rather than as the chip's avatar. Card is distinct from both the
           band (s2) and the pill (s1) in both themes. */
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-card)] text-[14px] leading-[20px] text-[var(--text-secondary)]"
      >
        {name.charAt(0)}
      </span>
      <span className="min-w-0 truncate text-[14px] leading-[20px] text-[var(--text-primary)]">
        {name}
      </span>
    </span>
  );
}

/** ═══ THE HEADER SENTENCE (header pass 3, §2.2) ═══
 *
 *  Mentored by [● Nour Barakat] · 140 days in mentorship · 62 messages in the
 *  last 30 days
 *
 *  ═══ WHY A SENTENCE AND NOT THE STAT STRIP ═══
 *
 *  §2.1's diagnosis, accepted in full: four stacked pairs with hairlines are a
 *  dashboard idiom; their column widths came from the LABELS ("Messages, last 30
 *  days" is 142px over a 2-digit value); the row mixed a one-line pill with
 *  two-line pairs; and the band was 175px because four pairs did not fit beside
 *  the chip at any width under 1920 — measured last pass. A sentence wraps where
 *  a column grid breaks, and a supervisor reads one record here, so the header
 *  has to orient rather than be scanned as columns. That last reading was the
 *  pack's and is the reason the trade is worth it.
 *
 *  ═══ ONE TYPE STYLE — AND THE WEIGHT IS NOT WHERE THE PACK ASKED ═══
 *
 *  §2.2: "Numerals carry semibold weight inline; the surrounding words stay
 *  regular. Emphasis by weight, not by size or column."
 *  `font-semibold` ON THE BODY FAMILY RENDERS NOTHING. Only `TWKLausanne-400`
 *  ships, and this repo has measured it identical at 400/500/600/700 in four
 *  places — so semibold numerals in Lausanne would be the instruction declared
 *  and not delivered.
 *  THE NUMERALS TAKE THE DISPLAY FACE INSTEAD. Avantt is the band's title face
 *  already and ships Bold only — a MEASURED +19% ink over Lausanne 400, which is
 *  the weight step the pack wants, delivered by the only bold this product has.
 *  It adds no family to the band (the title is Avantt) and no size (it is the
 *  body step, 14/20). Ink is measured in the commit.
 *  WORDS ARE SECONDARY INK, NUMERALS PRIMARY, so the figures lead on two
 *  channels and the sentence still reads as one quiet line.
 *
 *  ═══ WHAT LEFT ═══
 *
 *  · `Days open`, per §2.4 — a fact about the REVIEW, not the mentorship, and the
 *    list row already shows it. The overdue marker beside the name replaces it,
 *    because urgency is what the header needs to say.
 *  · The engaged-days slot and its em-dash, per §2.4: "No dash, no placeholder,
 *    no reserved slot." It appends here when it can — and note that §2.4 calls
 *    it undefined; it IS defined ("the days a teen sent a message", option a,
 *    implemented in `lib/tasks/engaged-days.ts`). It is unrendered because the
 *    fixture's whole conversation spans 4.5h, so the count would be a constant 1.
 *    Same outcome; different reason.
 */
function HeaderSentence({
  mentorName,
  stats,
  atTimeOfReview = false,
}: {
  mentorName: string;
  /** ═══ §2.3 · A CLOSED RECORD'S FIGURES ARE THE ONES THE SUPERVISOR SAW ═══
   *  On a closed review `stats` come from the snapshot, and the sentence says
   *  so — live figures on a historical record would misrepresent what the
   *  decision was made against. TODO-COPY. */
  atTimeOfReview?: boolean;
  /** The billing payload's figures. `null` on a non-billing item, where the
   *  sentence states the mentorship and nothing about it. */
  stats: { daysInMentorship: number; messagesLast30: number } | null;
}) {
  /* NEEDS-COPY-NICOLE on all three clauses — exact wording is Nicole's. */
  const clauses: { id: string; value: number; tail: string }[] = stats
    ? [
        { id: "mentorship", value: stats.daysInMentorship, tail: "days in mentorship" },
        { id: "messages", value: stats.messagesLast30, tail: "messages in the last 30 days" },
      ]
    : [];
  return (
    /* `.sep-clip` CLIPS AT THE BAND'S TRUE LEFT EDGE so a wrapped line's
       leading dot is hidden — see `.sep-list` in `globals.css`, and the
       measured defect it fixes ("· 140 days in mentorship" at 1280). */
    <div className="sep-clip">
      <p
        data-slot="engagement"
        /* TYPE STEP: BODY, 14/20. Secondary ink for the words; the numerals and
           the chip's name carry primary. `gap-y-0`: each flex line IS a text
           line, 20px, so two lines are 40 with nothing between them. */
        className="sep-list text-[14px] leading-[20px] text-[var(--text-secondary)]"
      >
        {/* ═══ CLAUSES WRAP AS UNITS, NOT WORD BY WORD ═══
            MEASURED at 1600: the line once broke inside the last clause and left
            "days" alone on line two. Each clause is `whitespace-nowrap` and a
            flex item, so a break can only fall BETWEEN clauses — and the
            separator logic above hides the dot that would then lead the line.
            The widest clause is ~210px against a 457px band at 1280. */}
        {/* NEEDS-COPY-NICOLE */}
        <span className="sep-item whitespace-nowrap">
          Mentored by <MentorChip name={mentorName} />
        </span>
        {clauses.map((c) => (
          <span key={c.id} data-metric={c.id} className="sep-item whitespace-nowrap">
            {/* The spoken separator; the visible dot is CSS with empty alt
                text, so it is not announced as "middle dot". */}
            <span className="sr-only">, </span>
            <span
              data-metric-value
              /* THE EMPHASIS: Avantt Bold at the body step — see the note on this
                 component for why not `font-semibold`. `leading-none` stops the
                 second face growing the line box (measured: 41px -> 40 for two
                 lines) while keeping the figure on the words' baseline. */
              className="font-display font-bold leading-none tabular-nums text-[var(--text-primary)]"
            >
              {c.value}
            </span>{" "}
            {c.tail}
          </span>
        ))}
        {atTimeOfReview && stats && (
          <span data-metric="as-of" className="sep-item whitespace-nowrap">
            <span className="sr-only">, </span>
            {/* TODO-COPY */}
            at time of review
          </span>
        )}
      </p>
    </div>
  );
}

/** ═══ RETIRED BY §3 — THE BORDERED STRIP IS DELETED, NOT MOVED ═══
 *
 *  §3.1 names three defects and all three were positional: mentor identity sat
 *  below the Assessments block as though it belonged to it; two metrics hid
 *  behind a chevron; and `View care journey` floated top-right with nothing near
 *  it to explain it. §3.2 puts identity in the header's left and the figures in
 *  its right, so there is nothing left for this container to hold.
 *
 *  UNMOUNTED RATHER THAN DELETED, per the strangler rule — and this component in
 *  particular has already been removed and remounted once: the Figma alignment
 *  pass took it out, §7 put it back, and the note inside it records that the
 *  one-line remount is the argument FOR keeping retired code. Deleting it now
 *  would throw away the thing that made §7 cheap, the second time round.
 *  WHAT IS NOT RETIRED IS THE CONTENT. Every figure it held is on screen now,
 *  and unconditionally — so this is a container retiring, not a fact.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RecordContext({
  payload,
  mentorName,
}: {
  payload: BillingPayload;
  /** The mentor on the record. From the item, not the payload — `TaskItem`
   *  already carries it for every domain, so a second copy inside the billing
   *  payload would be a field that can disagree with the row it came from. */
  mentorName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[var(--radius-inset)] border border-[color:var(--border-contour)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-slot="record-context"
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 px-3.5 text-left",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <span className="min-w-0 text-[13px] leading-[18px] text-[var(--text-primary)]">
          {/* NEEDS-COPY-NICOLE. ═══ THE MENTOR IS THE HEADING NOW (§7) ═══
              "Record context" named the CONTAINER and said nothing, which is
              the disclosure-with-a-silent-closed-state the note below warns
              about — it only escaped that by borrowing the duration on the
              right. The mentor's name is what this block is about, so it is
              what the closed state says; the label follows it, quietly, so the
              phrase still explains what kind of thing the name is. */}
          {/* ═══ `font-display`, AND IT WAS `font-semibold` ═══
              The wrapper carried `font-semibold` when the heading was the words
              "Record context", and MEASURED that does nothing: Lausanne ships
              the 400 face only and renders identically at 400/500/600/700 —
              recorded in four files, and the reason `row-emphasis.ts` exists.
              An inert weight on a label nobody reads is harmless; on the
              block's focal point it is a declaration with no rendering behind
              it. Avantt is one of the two channels that measure (+19% ink), and
              it is the same one the ROW spends on the teen's name — so the
              person a block is about is emphasised the same way wherever this
              product does it. ONE PER ZONE: the label and the duration beside
              it stay quiet. */}
          <span className="block truncate font-display font-bold">{mentorName}</span>
          <span className="block text-[12px] font-normal leading-[16px] text-[var(--text-secondary)]">
            Mentor on record
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          {/* THE HEADLINE FIGURE STAYS VISIBLE COLLAPSED. A disclosure whose
              closed state says nothing is a disclosure nobody opens; the
              mentorship length is the one figure that changes how the rest
              reads. */}
          <span className="tabular-nums">
            {payload.mentorStats.daysInMentorship} days in mentorship
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {open && (
        <dl className="grid gap-3 border-t border-[color:var(--border-subtle)] px-3.5 py-3 sm:grid-cols-2">
          {[
            /* ═══ THE DURATION IS NOT REPEATED (arch-G, G1) ═══
               The collapsed header states "140 days in mentorship" and this list
               stated "In mentorship · 140 days" again six pixels below it. The
               header keeps the duration — it is the figure that changes how the
               other two read — and the body holds only what the header does not
               say. NEEDS-COPY-NICOLE on both labels; the window is named,
               because "62 messages" without "last 30 days" cannot be sized. */
            ["Messages, last 30 days", `${payload.mentorStats.messagesLast30}`],
            ["Video calls, last 30 days", `${payload.mentorStats.videoLast30}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className={LABEL}>{label}</dt>
              <dd className="mt-1 text-[14px] leading-[20px] tabular-nums text-[var(--text-primary)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** ═══ THE BILLING BODY — NOW A WRAPPER AROUND THE REVIEW ═══
 *
 *  What it still owns: the generated rationale block and the two survey /
 *  mentorship facts, because both are statements about THIS pane's payload and
 *  neither is part of the decision form. What it handed over: the diff, the
 *  documentation fields, the validation and the commit, all of which are now
 *  `BillingReview` — see the note on that module for why a code no longer
 *  commits without documentation. */
function BillingBody({
  payload,
  item,
  recommended,
  decision,
  onDecisionChange,
  onCommit,
  handleRef,
  onGapsChange,
  onBlocked,
}: {
  payload: BillingPayload;
  item: TaskItem;
  recommended: { code: string; statement: string };
  decision: ReviewDecision | null;
  onDecisionChange: (next: ReviewDecision | null) => void;
  onCommit: (detail: BillingCommitDetail) => void;
  handleRef: React.MutableRefObject<BillingSubmitHandle | null>;
  onGapsChange: (gaps: number) => void;
  onBlocked: () => void;
}) {
  /** ═══ THE SHARED REVIEW MODULE, FINALLY HOSTED HERE ═══
   *
   *  `review-module-01-extract` pulled `ReviewBody` out of the Care card with
   *  seventeen DOM parity snapshots proving Care did not move. This is the second
   *  half, and it retires the composition that stood in for it: a `Notes` block
   *  where Care says `Rationale`, an `Assigned survey` metadata cell and a
   *  `ScoreLozenge` where Care has a score strip with the answers behind it, a
   *  two-column `PresentationDiff`, and no provenance affordance anywhere.
   *
   *  ONE CLINICAL DECISION, ONE PRESENTATION OF IT. A supervisor who opens a
   *  review from the record and the same review from the queue was reading two
   *  arrangements of one thing with no way to tell which parts were the same.
   *
   *  ═══ WHAT THE HOST STILL OWNS, AND WHY THAT IS THE RIGHT SPLIT ═══
   *
   *  The module is the REVIEW. The host is the CONTEXT. On the Care page the
   *  context is the page itself — the summary document states the mentorship and
   *  the metadata strip states the code in force — so the module never had to
   *  carry either. Tasks has no page around its pane, so the strip below supplies
   *  both. That is what makes a shared module possible rather than a lowest
   *  common denominator.
   *
   *  ═══ THE ON-RECORD LINE IS NOT OPTIONAL HERE ═══
   *
   *  `ReviewBody` reads `currentCode` to decide WHICH KIND of proposal this is
   *  and to mark "On record" in the picker, and it never DISPLAYS it — which is
   *  fine on Care, where the strip above the card states it, and would be a
   *  regression here, where nothing else on the pane does. Recorded as a cost in
   *  `presentation-diff.tsx` during the arch-A recon, and paid here rather than
   *  carried. */
  return (
    <BillingReview
      item={item}
      payload={payload}
      recommended={recommended}
      onCommit={onCommit}
      handleRef={handleRef}
      /* ═══ AND IT IS BACK (rework §7) ═══
         WHAT THE REMOVAL COST WAS STATED HERE AND §7 IS THE SECOND LOOK IT
         ASKED FOR. The Figma alignment pass removed this accordion and the note
         that replaced it said: "this is the one change in the set that removes
         CLINICAL CONTEXT rather than chrome, so it is the one worth a second
         look before it ships." It shipped, §7 asked for the mentor and the
         mentorship length on this pane, and the answer to both is the block
         that was already written for it.
         "It remains on the mentee's record, one click away" was the mitigation,
         and one click away is the thing §7 is declining: a supervisor deciding a
         code should not have to leave the decision to find out how long this
         mentorship has run.
         STILL A DISCLOSURE, not an expanded panel. The two counts stay behind
         the caret; what the closed state carries is the mentor and the
         duration, which are the two facts §7 named. */
      onGapsChange={onGapsChange}
      onBlocked={onBlocked}
    >
      {/* `canAct` AND `interactive` ARE BOTH TRUE, unconditionally. Care passes
          its card's `expanded` for `interactive` because its review lives inside
          a collapsible; this pane IS the review, so there is no collapsed state
          for a pending change to hide in. `canAct` is the tier gate, and only a
          supervisor tier reaches this route at all. */}
      <ReviewBody
        /* ═══ THE FORK, OPTED INTO ON THIS SURFACE (§3) ═══
           `ReviewBody` defaults to `"care"`, so the Care page renders exactly
           what it rendered before this prop existed. `task-pane.tsx` is the
           only file that passes anything. See the prop's own note for the
           exhaustive list of what diverges. */
        surface="care-reviews"
        review={billingReviewFor(item, payload)}
        currentCode={payload.current?.code ?? null}
        currentStatement={payload.current?.statement ?? null}
        /* ═══ THE HOST OPTS IN (arch-F) ═══
           The code on record now renders as a quiet line beneath the
           recommendation title, where the parity spec always wanted it. Care does
           not pass this: its spine states the code above the card, and the
           seventeen parity snapshots forbid changing what that page draws. */
        showCurrentLine
        decision={decision}
        onDecisionChange={onDecisionChange}
        canAct
        interactive
      />
    </BillingReview>
  );
}

/* ═══ `EscalationBody` IS GONE (arch-G, G4) ═══
   It was the read-only pointer: four facts, a context excerpt, and a closing
   sentence whose job was to say that the work happened somewhere else.
   `EscalationTaskPane` replaces all of it — the facts as `Facts`, the mentor and
   conversation as `Record context`, and the excerpt as the timeline's TEEN
   CONVERSATION source, which shows the same messages verbatim and, unlike the
   excerpt, next to the flags and the system events that share their window. The
   link out to the full thread is not lost: `EscalationCtas` carries it.
   THE ONE THING THE SWAP COSTS, stated: the excerpt drew from
   `buildConversation(item, …)`, the surface's own conversation builder, while the
   timeline's teen messages are fixtures (G0: the support thread is not queryable
   by pair or window). Two sources for one set of messages is exactly the fork
   this file's notes warn about, and it is a gap row rather than a fix here. */

// ── The frame ───────────────────────────────────────────────────────────────

/** A closed review in the shape the shared read view takes. The view was written
 *  for the Care page's `CareUpdateRecord`; adapting at the boundary keeps one
 *  read view rather than a second one for the same three fields. */
function closedAsUpdate(r: ClosedCareReview): CareUpdateRecord {
  return {
    id: `closed-${r.id}`,
    teenId: r.snapshot.item.teenId,
    createdAt: r.submittedAt,
    author: r.submittedBy.name,
    authorRole: r.submittedBy.role,
    body: r.body,
    clinicalProvenance: r.provenance.clinical,
    diagnosticProvenance: r.provenance.diagnostic,
  };
}

/** ═══ WHAT THE KEYBOARD CAN PRESS (Part 3) ═══
 *
 *  `y` / `n` / Enter act on the pane's controls, but the LISTENER lives on the
 *  page — one keyboard layer, one "is someone typing" guard, one dialog guard.
 *  So the pane publishes its two decisions into a ref the page holds.
 *
 *  This exists because of `override`: the recommended code is not `item`'s code
 *  once a supervisor has picked a different one from the DSM-5 dialog, and that
 *  choice is pane state. A page-level Enter that read `item.payload.recommended`
 *  would confirm the code the model suggested rather than the one on screen —
 *  silently, on a minor's billing record. Either the state moves up or the action
 *  comes down; the action is smaller. */
export interface PaneActions {
  /** Present only for flag items, at any tier. */
  answer?: (correct: boolean) => void;
  /** Present only for billing items, and it carries the OVERRIDE. */
  confirm?: () => void;
}

export function TaskPane({
  item,
  now,
  onResolve,
  actionsRef,
  /** THE EXCERPT'S OWN STATE, from the page's load-state axis. Separate from the
   *  pane's so the two can disagree — which is the point: the dev harness must be
   *  able to fail the excerpt while the pane succeeds. */
  excerptState = "ready",
  /* ═══ THE `events` PROP IS GONE (Phase 6) ═══
     It existed for one reader: the escalation timeline's flag join, inside
     `EscalationTaskPane`. Its note was about the difference between an empty
     ARRAY ("there are no flags") and an omitted prop ("a wiring mistake"), and
     that distinction still matters — it matters on `event-pane.tsx`, which does
     the join now and takes the prop with the same reasoning. Here there is
     nothing left to join. */
  /** ═══ READ-ONLY, BECAUSE THE DECISION IS ALREADY A RECORD (Closed-tab §2) ═══
   *  Set when the selection is a review on the Closed tab. It replaces the
   *  `completed` prop, which only `Completed today` rows ever set — so a row
   *  picked on the Closed tab rendered the LIVE form (`Save draft`, `Submit`,
   *  `3 fields needed`) over a review already on the record.
   *  The review renders from the SNAPSHOT with `canAct={false}` — the module's
   *  own tier gate, which drops the proposal chip, the picker and `Change
   *  presentation` — the documentation renders as text, and the action bar is
   *  the record's byline. Nothing on the pane can commit it a second time. */
  closed = null,
}: {
  item: TaskItem | null;
  now: number;
  /** Fires with the pane's detail; the page owns resolveWithUndo. */
  onResolve: (item: TaskItem, detail: Record<string, unknown>) => void;
  /** Where the pane publishes its keyboard-reachable actions. See PaneActions. */
  actionsRef?: React.MutableRefObject<PaneActions>;
  excerptState?: ExcerptState;
  closed?: ClosedCareReview | null;
}) {
  /** RETRY IS LOCAL AND REAL. The fixture is synchronous, so "retry" is a
   *  re-render — but a reader cannot tell that, and a Retry that did nothing
   *  would be worse than none. `retryNonce` forces the excerpt to remount, which
   *  re-runs the anchor scroll and clears the error the caller set. */
  const [retryNonce, setRetryNonce] = useState(0);
  /** ═══ THE GATE'S COUNT, FOR THE FOOTER (arch-F, F3) ═══
   *  Published by `BillingReview`, whose gate owns the definition of "empty".
   *  Held here because the footer is the pane's, and stated there because a
   *  supervisor should know the commit is blocked before pressing the button
   *  rather than after. */
  const [gaps, setGaps] = useState(0);
  /** Set by a blocked submit, cleared by the next keystroke that changes the
   *  count. The difference between the two sentences is real: the count is a
   *  standing fact, this is what just happened. */
  const [blocked, setBlocked] = useState(false);
  /** ═══ STABLE, AND THAT WAS A BUG ═══
   *  These were inline arrows. `BillingReview` publishes the count from an effect
   *  keyed on `[gaps.length, onGapsChange]`, so a new function identity every
   *  render re-ran the effect every render — which called `setBlocked(false)`
   *  immediately after a blocked press set it true, and the footer never showed
   *  the blocked sentence. Measured: the status stayed "3 fields needed" through
   *  a refused submit. */
  const onGapsChange = useCallback((n: number) => {
    setGaps(n);
    setBlocked(false);
  }, []);
  const onBlocked = useCallback(() => setBlocked(true), []);
  const effectiveExcerptState: ExcerptState =
    retryNonce > 0 ? "ready" : excerptState;
  /* ═══ THE OVERRIDE BELONGS TO ONE ITEM, AND ONLY ONE ═══
     The pane does not unmount between reviews — resolving auto-advances to the
     next item in the same component — so a code picked for Jordan's intake was
     still sitting in `override` when Riley's arrived, and the footer offered to
     confirm it. On a minor's billing record.
     Fixed by STORING THE ITEM'S ID WITH THE CHOICE and deriving whether it still
     applies, rather than by resetting the state in an effect when `item` changes.
     A reset runs one render LATE: there is a frame in which the new item is on
     screen and the old code is still in state, which is precisely the frame a
     fast keyboard resolve lands in. Derivation has no such frame. */
  const [override, setOverride] = useState<
    { id: string; code: string; statement: string } | null
  >(null);
  const activeOverride =
    override && override.id === item?.id
      ? { code: override.code, statement: override.statement }
      : null;
  /* `pickerOpen` AND `pickerTrigger` WENT WITH THE PICKER. Both existed to open
     a `Dsm5SearchDialog` this pane mounted and to hand focus back to the button
     that opened it; `ReviewBody` owns that dialog and that focus return now. */
  /** ═══ WHERE THE REVIEW PUBLISHES ITS GATE ═══
   *  The footer's Submit and the keyboard's ⌘/Ctrl+Enter both have to run the
   *  SAME three-field validation, and the state it validates lives inside the
   *  review. So the action comes up into this ref rather than the form's state
   *  going down — the same trade the `override` fix made, for the same reason:
   *  the action is the smaller thing to move. Null whenever the mounted body is
   *  not a billing review, which is what the footer checks. */
  const billingHandle = useRef<BillingSubmitHandle | null>(null);
  /* ═══ THE ESCALATION HANDLE AND ITS GATE ARE GONE (Phase 6) ═══
     `escalationHandle`, `escalationBlocked` and `onDispositionChange` existed so
     the footer's `Record response` primary could act on state inside
     `EscalationTaskPane`. Both ends of that arrangement are retired: the pane
     had no route and the primary had no reachable branch. The escalation
     record's pane on `/app/escalations` owns its own footer, so nothing has to
     be lifted across a component boundary there. */

  /* ═══ THE AUTO-ADVANCE CROSSFADE (Part 5) ═══
     Resolving replaces the pane's ENTIRE contents in one frame — new name, new
     excerpt, new rationale — while the reader's eye is still on the button they
     pressed. With no transition it reads as a flicker, and worse, as though
     nothing happened: the pane is the same shape in the same place with different
     words in it, and a supervisor forty flags into a shift genuinely loses track
     of whether their keystroke registered.
     120ms is the whole budget. Long enough to register as a change of subject,
     short enough that it never becomes a wait — this fires fifty times a shift,
     and anything slower would be a tax on the loop the keyboard shortcuts exist
     to speed up. Opacity only: no slide, no scale, nothing that suggests the pane
     moved somewhere.
     `motion-reduce` drops it, and the content swaps instantly. */
  /* ═══ SNAP TO ZERO, THEN FADE IN — TWO PHASES, NOT ONE FLAG ═══
     The first version toggled one boolean with the transition always declared,
     and that does NOT produce a fade in. The layout effect runs AFTER React has
     committed the new content, so the transition's start value is the previously
     painted opacity of 1 — the browser animates 1 → 0, and reversing two frames
     later gives a dip and a recovery. A flicker, which is the thing this was
     meant to remove.
     MEASURED, and it is why the phases exist: the probe sampled opacity on every
     frame across the advance and read exactly 1.00 for all 44 of them, while
     `data-faded` was correctly flipping and the element correctly carried
     `opacity-0`. The class was right and the animation was wrong.
     `snap` sets opacity 0 with NO transition, so it lands there instantly and
     invisibly; the next frame turns the transition on and goes to 1. */
  const [phase, setPhase] = useState<"idle" | "snap" | "in">("idle");
  const lastItemId = useRef<string | null>(item?.id ?? null);
  /* `useLayoutEffect`, NOT `useEffect`, and the difference is the whole effect.
     With a passive effect React paints the new content at full opacity FIRST and
     the fade-out runs after — so a reader sees the next flag flash, disappear,
     and come back. A layout effect flushes the opacity-0 state before that paint,
     so the browser never shows the intermediate frame and the transition is a
     clean fade in. */
  useLayoutEffect(() => {
    const id = item?.id ?? null;
    /* ═══ NULL IS A TRANSIENT, NOT A DESTINATION ═══
       MEASURED: the fade never fired. A resolve does not go A → B, it goes
       A → null → B — the item leaves the open set, the pane has nothing for one
       render, and the auto-advance supplies the next one. The first version
       treated the null as an item change, wrote it to `lastItemId`, and then saw
       B arrive "from nothing" and declined to fade. Opacity sampled 1.00 across
       44 frames, which is how this was found rather than by watching for a
       120ms transition with the naked eye.
       Ignoring the null keeps A on the ref, so B is correctly an advance FROM A.
       It also means leaving to a genuinely empty list does not fade — which is
       right: there is nothing to fade to. */
    if (id === null) return;
    if (lastItemId.current === id) return;
    // ONLY BETWEEN TWO ITEMS. Arriving at the first selection is not an advance —
    // fading in from nothing on open would put a delay on the pane's first paint.
    const advance = lastItemId.current !== null;
    lastItemId.current = id;
    if (!advance) return;
    setPhase("snap");
    /* ONE FRAME AT ZERO, then the fade. rAF rather than a short timer: a timer
       shorter than a frame can coalesce both style changes into a single recalc,
       and a transition with no earlier computed start value does not run at all. */
    const raf = requestAnimationFrame(() => setPhase("in"));
    return () => cancelAnimationFrame(raf);
  }, [item?.id]);

  /* PUBLISH THE KEYBOARD-REACHABLE ACTIONS. Before the early return, because
     hooks cannot live after one — and it has to handle the no-item case itself
     rather than being skipped, or the page would keep pressing the last item's
     buttons after the list emptied. */
  /* The pane body's scroller — the custom thumb reads and drives it. */
  const paneScrollRef = useRef<HTMLDivElement | null>(null);
  const payload = item?.payload;
  const confirmCode =
    payload?.kind === "billing" ? (activeOverride ?? payload.recommended) : null;
  useEffect(() => {
    if (!actionsRef) return;
    if (!item || !payload) {
      actionsRef.current = {};
      return;
    }
    actionsRef.current = {
      // Flags only, at any tier — an escalation has no correctness question,
      // and locked decision 3 says nothing on its pane resolves anything.
      answer:
        payload.kind === "riskFlag"
          ? (correct: boolean) =>
              onResolve(item, dispositionDetail(dispositionFor(correct)))
          : undefined,
      /* ═══ IT RUNS THE GATE NOW, AND IT IS NOT REACHED BY BARE ENTER ═══
         This used to call `onResolve` directly with the code and nothing else —
         the one-click commit, reachable from a list row with a single keypress.
         It now presses the review's published submit, which validates the three
         documentation fields first and refuses with focus and a live-region
         sentence when they are empty.
         Bare Enter no longer routes here: `onEnter` returns false for billing so
         the key moves the keyboard into the pane instead. `⌘/Ctrl+Enter` is what
         reaches this. */
      /* NOTHING TO CONFIRM ON A CLOSED RECORD — `⌘/Ctrl+Enter` must not reach a
         submit that is not on screen (Closed-tab pack §0.2). */
      confirm:
        payload.kind === "billing" && !closed
          ? () => billingHandle.current?.submit()
          : undefined,
    };
  }, [actionsRef, item, payload, confirmCode, onResolve, closed]);

  if (!item) {
    return (
      <div className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5">
        <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          Select a task to review it.
        </p>
      </div>
    );
  }

  const p = item.payload;
  /* `breached` IS GONE WITH THE DUE FACT (addendum §2.9). It coloured the
     deadline clay when the clock had passed; there is no clock. */
  const recommended =
    p.kind === "billing" ? (activeOverride ?? p.recommended) : null;

  return (
    /* ═══ THE PANE IS THE FRAME'S HEIGHT, NOT THE VIEWPORT'S (Part 1.2) ═══
     *
     *  `max-h-[calc(100dvh-8rem)]` was a GUESS at the space available — it
     *  subtracts a constant for chrome the pane cannot see, so it is wrong by
     *  whatever the header, the tab-cards and the shell's own reserves actually
     *  measure, and wrong differently at every viewport. `h-full` takes the
     *  height its grid cell was given, which is the real answer.
     *
     *  `min-h-0` for the same reason as the page root: without it the body
     *  refuses to shrink below its content and the footer is pushed out of the
     *  box rather than the body scrolling. */
    <div
      data-slot="task-pane"
      data-anno-ref="task-pane"
      /* ═══ `max-h-full`, NOT `h-full` (arch-F, F3) ═══
         With `h-full` and the action bar now hugging its content, a short review
         left ~190px of empty card BELOW the bar — the gap moved rather than
         went away, and a card that ends 190px past its own footer reads as
         unfinished. `max-h-full` lets the card end where the bar does and still
         caps it at the cell, so the overflow case is unchanged. */
      className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {/* ── HEADER — pinned inside the pane (arch-F rebuilt it) ─────────── */}
      {/* ═══ WHAT THE OLD HEADER SAID, AND WHY EACH PART MOVED ═══
          It was: the teen's name, an age, a breach chip, and "to {mentor}".
          · THE MENTOR IS GONE. The same leftover the rows dropped in arch-E: the
            mentor does not perform a billing review, is not accountable for it,
            and cannot change its outcome — the code derives from survey data.
            This was its last display on the surface (the transcript still uses
            the field for its sender names).
          · THE TASK TYPE ARRIVED, above the heading, small — the pane's
            equivalent of the Care attention band's identifying chip, and the
            answer to "what am I being asked to do" before "about whom".
          · THE META LINE now carries the age AND the due fact in the same
            expression the row used, so a supervisor who selected a row reading
            "due 6:24 PM" sees the same words in the pane rather than a second
            spelling of the same instant.
          · THE TWO WAYS OUT live here. See the note on the CTAs. */}
      {/* ═══ TIER 1 · THE HEADER BAND'S TONE (elevation amendment §2) ═══
          "Tones do not need to be unique. They need to be RANKED, and the
          header must outrank anything beneath it." Three tiers:
            Tier 1  this band          `--surface-s2`
            Tier 0  the pane body      `--surface-card`
            Tier 2  the nested block   `--surface-s1`  (already, untouched)

          ═══ `--surface-s2` AND NOT `--band-sand-bg`, AND THE NUMBERS DECIDED ═══
          The amendment describes Tier 1 as "deepest, warmest", and the
          reference is a `TaskCard` whose band is `--band-sand-bg`. MEASURED as
          relative luminance x100, sand does not rank:
            light  Tier1 sand 86.40 < Tier2 s1 90.53 < Tier0 card 100.00
                   — but sand:s1 is 1.045:1, which is not a rank, it is a
                     rounding difference
            dark   Tier2 s1 1.80 < Tier0 card 2.89 < Tier1 sand 6.38
                   — THE ORDER INVERTS. The "deepest" tier becomes the
                     brightest thing on the pane.
          `--surface-s2` holds the ranking in BOTH themes:
            light  Tier1 74.62 < Tier2 90.53 < Tier0 100.00
            dark   Tier1  0.41 < Tier2  1.80 < Tier0   2.89
          with separations of 1.319 / 1.200 light and 1.460 / 1.258 dark.
          IT IS ALSO STILL WARM — #e5e0d2 is hue 44deg at chroma 19, the same
          hue family as sand and the same chroma, just deeper. So it satisfies
          "deepest, warmest" better than the warm-triad token does.
          AND IT IS THE EXISTING NEUTRAL VARIANT OF THIS PATTERN, not a new
          choice: `record-authority-note` already uses `--surface-s2` as a flush
          filled header band over a white body, and its note says why — "the app
          ground, one step darker than this card's white". The warm triad is
          SEVERITY-coded (sand/amber/clay via `taskBandFill`), and this band
          carries identity, not severity; importing a severity tone would import
          a semantic this pane does not have.

          THE HAIRLINE STAYS `--border-subtle`. `TaskBand` mixes its hairline
          from the band's own ink at 22% because "a neutral #dfddd8 hairline
          against a warm tint reads as a seam of a different colour" — that rule
          is about the warm `--band-*` tints. `record-authority-note`'s
          `--surface-s2` band keeps the neutral hairline, and this follows it.

          NO `rounded-t-*` AND NO `-mx-*`: the pane container is already
          `overflow-hidden rounded-[var(--radius-elevated)]`, so the fill
          terminates on the radius by clipping. `today-page.tsx` records the
          three-piece `rounded-t` + `border-x border-b` version as the bug.

          PROPORTIONS LEFT ALONE, AND WHY. §3 says to take "the band's
          proportions" from the reference, and those are specified in §6.3 of a
          pack this session was never given — the amendment supersedes §6.2 of
          it and I have only the amendment. `TaskBand`'s own proportions are
          `min-h-14 px-[var(--surface-pad-x)] py-2` against this band's
          `px-5 py-4`; changing them is a spec I cannot check, so the TONE is
          applied and the geometry is not. Reported rather than guessed. */}
      <div /* ═══ §6.4 · PADDING, BECAUSE A TONAL FILL NEEDS ROOM ═══
             "With a tonal fill, padding has to be generous or the band reads as
             a stripe rather than a header."
             py-4 -> py-5, px-5 -> px-6. MEASURED AGAINST THE ONLY SCALE THIS
             PRODUCT HAS: Bloom ships no spacing scale (four component pads and
             nothing else), so Tailwind's 4px step is it — 16px -> 20px vertical
             and 20px -> 24px horizontal are one step each.
             AND BOTH NUMBERS ARE BLOOM PADS. `--surface-pad-y` is 20px and
             `--surface-pad-x` is 24px, which is what the reference band uses
             and what `TaskCard` uses for its own body. So this is not a nudge
             to taste — it is the band adopting the component pads it should
             have had once it became a container. Written as `py-5 px-6` rather
             than the tokens because the tokens are only wired for the record
             card's own padding utilities; the VALUES are theirs. */
            className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--surface-s2)] px-6 py-5">
      <div
          /* ═══ TWO ROWS: THE TEEN, THEN ONE LINE ABOUT THE MENTORSHIP ═══
             Row 1  teen name · View care history  |  overdue marker (when overdue)
             Row 2  Mentored by [chip] · N days in mentorship · N messages …
             SUPERSEDES LAST PASS's "chip | metrics" pairing, whose argument —
             the metrics describe the mentorship and the chip IS the mentorship —
             survives in the sentence itself: they are the same line now, which
             is the strongest adjacency available. What did not survive was the
             stat strip, for the reasons on `HeaderSentence`. */
          className="flex flex-col gap-2"
        >
          {/* ── ROW 1 · the teen and their history | urgency ────────────── */}
          {/* ═══ THE ACTION MOVED NEXT TO THE NAME, THE URGENCY TOOK ITS SLOT ═══
              It read `name · [Overdue]  |  [View care journey]` — a bordered
              button owning the right edge. Product moved it: the history is now
              a quiet text link beside the name it belongs to, and the right
              edge goes to the overdue marker, which is the one fact in the band
              that changes from item to item and so earns the far corner.
              `items-center` on the row: the marker is a box and centres on the
              40px name line; the name and its link share a BASELINE inside the
              left group, because both are text. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2
                /* THE PROBE'S HANDLE ON "WHOSE RECORD IS THIS" — the advance
                   rule is a statement about which record is on screen after a
                   resolve, and reading it off the heading is reading what a
                   supervisor reads. */
                data-pane-teen
                /* ═══ TITLE STEP, ONE UP: 24/32 -> 32/40 (§2.2) ═══
                   "Nothing owns the band." Two passes ago this stopped at 24/32
                   because 32/40 is also the PAGE title's step and a record header
                   "must not compete with the page it sits inside". §2.2 asks for
                   the step anyway, and the band is now one sentence shorter, so
                   the name is the one thing in it at that size — it owns the band
                   rather than competing with it. The page title and this name
                   now share a size; that is the cost, stated. */
                className="min-w-0 truncate font-display text-[32px] font-bold leading-[40px] text-[var(--text-primary)]"
              >
                {item.teenDisplayName}
              </h2>
              <Link
                href={`/admin/person/${encodeURIComponent(item.teenId)}?tab=care`}
                data-care-history-link
                /* ═══ A TEXT LINK, AND ITS HIT AREA IS STILL 24 TALL ═══
                   12/16 underlined in `--text-secondary` — 5.78:1 light on the
                   band (measured last pass for the same token on the same
                   ground). A 16px line is under SC 2.5.8's 24px, so a
                   transparent `::after` extends the target 4px above and below
                   without moving the baseline the name and link share. */
                className={cn(
                  "relative shrink-0 whitespace-nowrap text-[12px] leading-[16px] text-[var(--text-secondary)] underline underline-offset-2",
                  "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
                  "rounded-sm hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                {/* NEEDS-COPY-NICOLE */}
                View care history
              </Link>
            </div>

            {/* ═══ §2.4 · URGENCY, ONLY WHEN THERE IS SOME ═══
                `OverdueChip` is the system breach pattern — the same component
                the list rows use, clay pair plus the triangle icon plus the
                word, so it is never colour alone (SC 1.4.1). Without `onToggle`
                it renders as a plain `span`: it states a fact and filters
                nothing. `isOverdue`, THE SAME PREDICATE THE LIST USES, so the
                pane and the row cannot disagree about the same item. */}
            {!closed && isOverdue(item, now) && <OverdueChip />}
          </div>

          {/* ── ROW 2 · one line about the mentorship ─────────────────────── */}
          {/* §2.5: row 1 and row 2 share a LEFT edge. */}
          <HeaderSentence
            mentorName={item.mentorName}
            /* A CLOSED REVIEW READS ITS SNAPSHOT — `item` IS the snapshot's
               task on the Closed tab, payload included, so these figures are
               the ones on screen when it was submitted. */
            stats={p.kind === "billing" ? p.mentorStats : null}
            atTimeOfReview={!!closed}
          />
        </div>
        {/* ═══ THE TIER LINE IS GONE (Phase 4) ═══
            It rendered `tierLabel(p.tier)` under a flag's header — the per-flag
            severity, stated to a reader as fact. The payload has no tier and
            there is no label table to read one from.
            NOTHING REPLACES IT HERE. A flag's playbook tier is derivable from its
            category (`tierOf`), but this pane is Care Reviews' and flags do not
            reach it; adding a derived line to a surface that renders no flags
            would be inventing a consumer for the derivation. The Risk Flags pane
            is where a category — and, if it earns it, its playbook grouping —
            belongs, and that is Phase 5's. */}
      </div>

      {/* ── BODY, scrolls independently ─────────────────────────────────── */}
      {/* The crossfade wraps the BODY, not the pane: the header carries the teen's
          name and the age, and fading those out would take away the one line that
          tells the reader which record they just moved to. */}
      {/* ── THE BODY IS THE ONLY SCROLLING PART OF THE PANE ──
             `overscroll-contain` so reaching its end does not scroll the page
             behind it — and the excerpt inside contains its own overscroll too,
             so three nested regions each stop at their own edge. */}
      <div
        /* Exposed for the probe — the phases are invisible by design and a
           measurement that has to infer them from a computed opacity mid-
           transition is a measurement that cannot tell "no fade" from "a fade
           that has not started". */
        data-fade-phase={phase}
        /* §2's "appears on scroll" needs a node to write the attribute onto;
           hover and focus-within are CSS and need nothing. */
        ref={paneScrollRef}
        /* FOCUSABLE AND NAMED — same reasoning as the list's. It held form
           fields, so Chrome never made it a tab stop on its own; keyboard
           scrolling ran through a focused field. TODO-COPY on the name. */
        tabIndex={0}
        role="region"
        aria-label="Review details"
        className={cn(
          /* ═══ §1 · SAME CORRECTION HERE — NO RESERVED GUTTER ═══
             This carried `pr-7` (the existing `px-5` plus 8px) to hold the bar
             off the prose. §1: "a reserved gutter defeats the point of an
             overlay scrollbar", and the pane's alley was 8px wider than the
             list's. Back to the symmetric `px-5` the pane had before the
             scrollbar work; the bar overlays transiently and fades at rest. */
          /* `.scroll-overlay`, NOT `.scroll-slim` — the old utility reserved a
             24px gutter here too (measured, `offsetWidth - clientWidth` = 24 with
             real scrollbars). The native bar is hidden and `OverlayScrollbar`
             draws one over the prose. */
          "scroll-overlay min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
          /* ═══ SCROLL PADDING FOR THE STICKY BAR (arch-F, F3) ═══
             The action bar is the last child of this scroller and sticks to its
             bottom edge, so a focus move to a field near the end would land the
             field UNDER it. `scroll-pb-24` reserves the bar's height plus a
             little, so browser-driven scrolling (Tab, the gate's own focus move)
             stops short of it. WCAG 2.4.11. */
          "scroll-pb-24",
          phase === "snap"
            ? "opacity-0 transition-none"
            : "opacity-100 transition-opacity duration-[120ms] ease-out motion-reduce:transition-none"
        )}
      >
        <OverlayScrollbar scrollerRef={paneScrollRef} />
        {p.kind === "riskFlag" && (
          <RiskFlagBody
            payload={p}
            teenId={item.teenId}
            item={item}
            now={now}
            excerptState={effectiveExcerptState}
            onRetryExcerpt={() => setRetryNonce((n) => n + 1)}
          />
        )}
        {p.kind === "billing" && closed && (
          /* ═══ THE CLOSED REVIEW, AS A RECORD (Closed-tab pack §2.2) ═══
             The shared module renders the SNAPSHOT — the review exactly as it
             was rendered when this was submitted — with `canAct={false}`: no
             proposal chip, no picker, no `Change presentation`.
             THE DOCUMENTATION IS TEXT, NOT DISABLED INPUTS. Bloom has no
             disabled state, and a greyed textarea reads as "you cannot do this
             yet" rather than "this is finished". `CareUpdateBodyView` is the
             read view the Care page already renders a committed update with
             (`care-tab.tsx`), so this is the shared read-only state, on both
             hosts, with its per-field AI provenance. */
          <div data-slot="closed-record" className="space-y-4">
            <ReviewBody
              surface="care-reviews"
              review={closed.snapshot.review}
              currentCode={p.current?.code ?? null}
              currentStatement={p.current?.statement ?? null}
              showCurrentLine
              /* THE RECOMMENDATION AS IT WAS RECOMMENDED. The decision is a
                 separate fact and gets its own line below, rather than being
                 folded into the module as a pending change it no longer is. */
              decision={null}
              canAct={false}
              interactive={false}
            />
            {/* ═══ THE DECISION, STATED (§2.1) ═══
                "The presentation decision (recommended code accepted, or changed
                to what)." MEASURED before this line existed: a `Kept` record's
                pane showed the recommendation (F33.1) and the code on record
                (F33.0) and said nothing about which one the supervisor chose —
                only the row did. Same verb and lozenge as the row's outcome. */}
            <div data-slot="closed-decision">
              <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
                {/* TODO-COPY */}
                Decision
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
                {OUTCOME_VERB[closed.decision.outcome]}
                <BillingCodeLozenge code={closed.decision.code} tone="identity" />
                <span className="text-[var(--text-secondary)]">{closed.decision.statement}</span>
              </p>
            </div>
            <p
              data-anno-ref="care-update-heading"
              className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]"
            >
              {/* NEEDS-COPY-NICOLE — the same heading the form carries. */}
              Care Update
            </p>
            <CareUpdateBodyView update={closedAsUpdate(closed)} />
          </div>
        )}
        {p.kind === "billing" && recommended && !closed && (
          <BillingBody
            payload={p}
            item={item}
            recommended={recommended}
            /* ═══ ONE OVERRIDE, TWO VOCABULARIES ═══
               The pane has always held the supervisor's pick as
               `{id, code, statement} | null`, keyed to the item so a code chosen
               for Jordan's intake cannot still be sitting there when Riley's
               arrives. The shared module speaks `ReviewDecision`. The two mean
               the same thing — `pending ?? review.recommended` on one side is
               `activeOverride ?? p.recommended` on the other — so this translates
               at the boundary rather than migrating the pane's state to a shape
               the footer and the commit would then also have to learn. */
            decision={
              activeOverride
                ? {
                    kind: "change",
                    code: activeOverride.code,
                    statement: activeOverride.statement,
                  }
                : null
            }
            onDecisionChange={(next) =>
              setOverride(
                next?.kind === "change"
                  ? { id: item.id, code: next.code, statement: next.statement }
                  : null
              )
            }
            onCommit={(detail) => onResolve(item, detail)}
            handleRef={billingHandle}
            onGapsChange={onGapsChange}
            onBlocked={onBlocked}
          />
        )}
        {/* ═══ THE ESCALATION PANE MOUNT IS GONE (Phase 6) ═══
            `p.kind` is `"billing"` on every item this pane can receive, so this
            branch was unreachable. It hosted the mitigation work arch-G G4 moved
            onto Tasks "now that the OBLIGATIONS are tasks" — and that sentence
            is what Phase 2 reversed: the obligations are the RECORD's again, and
            the record has exactly one pane.
            arch-G's DECISION 3 SURVIVES INTACT, which is worth stating because
            this looks like its undoing: nothing resolved the ESCALATION here
            either. The response task recorded a disposition and the
            documentation task submitted a note, while the escalation's own
            lifecycle belonged to the record. Phase 6 removes the second place
            that work could be done from, not the rule. */}


      {/* ═══ THE ACTION BAR (arch-F, F3) ═══
          IT STAYS BELOW THE DOCUMENTATION, and that is not a compromise: Submit
          attests to the fields above it, and moving it up would make it possible
          to commit a code before writing its justification — and would break the
          frozen-Care behaviour it inherits. Its weakness was a TREATMENT problem.
          WHAT CHANGED: it is now the last child of the SCROLLER, `sticky
          bottom-0`, rather than a `shrink-0` sibling of it. The difference is the
          short-content case, measured before this change: with a pane taller
          than its content the flex body stretched and left a 231px gap between
          the last field and the bar, which read as two buttons floating in
          space. Sticky-inside-the-scroller puts the bar directly under the
          content when there is little, and pins it to the bottom edge when there
          is more — one rule, both cases.
          SOLID FILL, TOP HAIRLINE, SLIGHT ELEVATION. The shadow is what makes it
          read as a bar in front of the content rather than the end of it. */}
      <div
        data-slot="task-pane-footer"
        className={cn(
          /* ═══ `-bottom-4`, NOT `bottom-0` — THE PADDING IS WHY ═══
             A sticky box's inset is measured from the scroller's CONTENT edge,
             inside its `py-4`. So `bottom-0` pinned the bar 16px ABOVE the
             pane's bottom edge, and the fields scrolled through that strip
             underneath it — measured, a 16px gap below the bar on every
             scrolled pane. `-bottom-4` cancels the padding exactly, pinning
             the bar to the edge; `-mb-4` still does the short-content case. */
          "sticky -bottom-4 -mx-5 -mb-4 mt-4 border-t border-[color:var(--border-subtle)]",
          "bg-[var(--surface-card)] px-5 py-3.5",
          /* ═══ AN EXISTING TOKEN, NOT A NEW VALUE ═══
             The first two attempts were arbitrary values — `shadow-[0_-1px_3px_
             rgba(0,0,0,0.04)]` and then the slash form — and BOTH resolved to
             `rgba(0,0,0,0) 0px 0px 0px 0px`: the bar shipped with no elevation
             and the probe read it back as transparent, twice. `--shadow-tile` is
             the design system's own small raised-surface shadow (the sidebar's
             active tile uses it), it is defined for both themes, and it needs no
             new token. It is omnidirectional where a bar wants an upward hint —
             noted in the report as the one place a directional elevation token
             would earn its place. */
          "shadow-[var(--shadow-tile)]"
        )}
      >
        {p.kind === "riskFlag" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Was this flagged correctly?
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {/* EITHER ANSWER RESOLVES THE ITEM (§5). The question is feedback,
                  not a gate — "No" does not mean "leave it open".
                  BOTH ROUTE THROUGH `dispositionFor` RATHER THAN WRITING THE
                  PAYLOAD HERE. Whether a THIRD disposition exists ("seen, not
                  resolved, still watching") is open question 1 in the
                  architecture preamble, blocked on Dr. Nissan and Meg. Routing
                  the two through a named vocabulary means the day it is answered
                  the compiler lists every site that has to change — see
                  `lib/tasks/disposition.ts`, which enumerates them. */}
              <RecordButton
                onClick={() =>
                  onResolve(item, dispositionDetail(dispositionFor(false)))
                }
              >
                {/* TODO-COPY */}
                No
              </RecordButton>
              <PillButton
                onClick={() =>
                  onResolve(item, dispositionDetail(dispositionFor(true)))
                }
                className="h-9 px-5 text-[14px]"
              >
                {/* TODO-COPY */}
                Yes
              </PillButton>
            </div>
          </div>
        )}

        {p.kind === "billing" && closed && (
          /* ═══ THE FOOTER IS THE RECORD'S METADATA (Closed-tab pack §2.2) ═══
             Who submitted it and when — absolute, never relative, because this
             is a record. `CareUpdateByline` is the Care page's own byline for a
             committed update; `withTime` adds the minute, which that page does
             not show and this one must. */
          <div data-slot="closed-byline">
            <CareUpdateByline update={closedAsUpdate(closed)} withTime verb="Submitted by" />
          </div>
        )}

        {p.kind === "billing" && recommended && !closed && (
          /* ═══ TWO BUTTONS, AND NEITHER NAMES THE CODE ANY MORE ═══
             It was `Confirm unchanged` (tonal, re-reviews only) and
             `Confirm {code}` (primary), and the second named its object for a
             good reason: the code on screen is not the model's suggestion once a
             supervisor has picked from the DSM-5 dialog, so a label reading
             `Confirm F41.1` beside a chosen F33.1 catches a mistake nothing
             further up the pane would.

             THE CARE PAGE'S PARADIGM REPLACES BOTH, on the product owner's call
             — `Save draft` and `Submit`. That page dropped its own
             outcome-naming label ("Submit · {code} unchanged") once the region
             above it started moving with the decision, on the grounds that the
             button was then stating the same fact a second time.

             THAT PRECONDITION IS WHY THIS IS SAFE HERE, and it is imported with
             the label rather than assumed: the diff above renders the
             override-aware `recommended`, so picking a different code re-tints
             the changed elements and flips the chip to "Change proposed → F33.1"
             in the same frame. The outcome is stated beside the evidence and it
             moves when the decision moves. A bare `Submit` without that would
             re-open exactly the defect the old label was added to close.

             AND THE TWO OUTCOMES COLLAPSED INTO ONE BUTTON. `unchanged` versus
             `confirmed` was a choice a supervisor made with a button; it is now
             DERIVED from what the diff is showing — a renewal submits as
             `unchanged`, a change as `confirmed`. Two buttons that commit the
             same three documented fields with different outcome strings was an
             invitation to press the wrong one. */
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* ═══ THE GATE'S STATE, OPPOSITE THE BUTTONS (arch-F, F3) ═══
                It used to exist only as an `sr-only` sentence inside the review,
                600px below the button that runs the gate: a sighted supervisor
                pressed Submit and found out then. This states it before.
                A LIVE REGION, and the only one for the gate — `role="status"` so
                the count is announced as fields are filled, and so the blocked
                sentence is announced on a failed press without a second region
                competing to say the same thing.
                CLEARED WHEN VALID: zero gaps renders nothing at all rather than
                "0 fields needed", which is a number nobody needs.
                SUBMIT STAYS ENABLED (no-disabled-buttons): pressing it while
                invalid focuses the first empty field, and this line says why. */}
            <p
              role="status"
              aria-live="polite"
              className="min-w-0 text-[12.5px] leading-[17px] text-[var(--text-secondary)]"
            >
              {gaps === 0
                ? ""
                : blocked
                  ? /* NEEDS-COPY-NICOLE */ `${gaps} field${gaps === 1 ? "" : "s"} still needed. Focus moved to the first.`
                  : /* NEEDS-COPY-NICOLE */ `${gaps} field${gaps === 1 ? "" : "s"} needed`}
            </p>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <RecordButton
              onClick={() => {
                billingHandle.current?.saveAndClose();
                /* ═══ IT HANDS THE KEYBOARD BACK, which is this pane's version
                   of the Care card closing ═══
                   On the Care page `Save draft` closes the card, and the draft is
                   already on disk by then — so the button's real effect is
                   "leave this review". This pane never closes: selecting another
                   item is how you leave it, and a `Save draft` that only
                   re-saved an already-saved draft would be a control that does
                   nothing. The codebase has removed one of those before (the
                   care summary's Refresh, whose honest label was "this does
                   almost nothing").
                   THE SELECTED ROW IS THE TARGET, found by its own semantics
                   rather than through a new prop: the worklist is a `role="tree"`
                   and exactly one `treeitem` carries `aria-selected="true"`.
                   That is the same element `onFocusPane` moves focus AWAY from,
                   so this is its inverse and needs nothing wired through the
                   page. */
                document
                  .querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]')
                  ?.focus();
              }}
            >
              {/* TODO-COPY. IT PERSISTS NOTHING EXTRA — the draft is written on
                  every keystroke — so the name says what it does: leave this
                  review without committing, and hand the keyboard back. */}
              Save draft
            </RecordButton>
            <PillButton
              onClick={() => billingHandle.current?.submit()}
              className="h-9 px-5 text-[14px]"
            >
              {/* TODO-COPY */}
              Submit
            </PillButton>
            </div>
          </div>
        )}

        {(p.kind === "escalation" || p.kind === "documentation") && (
          /* ═══ THE ACTION BAR IS THE TASK'S, NOT A LINK OUT ═══
             It held one button that routed to the record. The task is completed
             HERE now: a response records its disposition, and a documentation
             task's bar is where the note module portals its own action row —
             which is why this branch renders only the response primary and
             leaves the slot empty otherwise. */
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p
              role="status"
              aria-live="polite"
              className="min-w-0 text-[12.5px] leading-[17px] text-[var(--text-secondary)]"
            >
              {/* THE RESPONSE GATE'S SENTENCE WENT WITH ITS BUTTON (Phase 6).
                  It read "Record what you did first." beside a `Record response`
                  primary that only an escalation task could reach. */}
              {""}
            </p>
            {/* ═══ AND `Record response` IS GONE, WHICH CLOSES A KNOWN DEFECT ═══
                The Phase 0 audit measured it at 144×36 — below the 44px minimum
                — and it was still on the fix list. It is resolved by DELETION
                rather than by resizing, because the control had no route: only
                `p.kind === "escalation"` reached it and Care Reviews holds
                billing alone. Resizing an unreachable button would have closed
                the audit item without changing anything a reader can touch.
                The escalation record's own pane carries the disposition footer,
                and its controls were measured at 44px in Phase 4. */}
            {/* ═══ AND THE PORTAL SLOT WITH IT ═══
                The escalation NOTE module portalled its action row into this
                span. The module is alive and well — `event-pane.tsx` renders it
                on the record — but it renders its row inline there, so nothing
                needs a slot lifted across a component boundary any more. */}
          </div>
        )}
      </div>
      {/* ── end of the scroller, which now contains the action bar ───────── */}
      </div>

      {/* ═══ THE CODE PICKER LIVES IN THE SHARED MODULE NOW ═══
          It was a `Dsm5SearchDialog` mounted here, opened by a `Change…` button
          the pane passed down. `ReviewBody` carries its own `Change code` control
          and its own picker — including the focus-return this app's dialogs need
          by hand, and the rule that picking the code ON RECORD resolves to
          unchanged rather than producing a change from a code to itself. Two
          pickers would have been two places for that rule to live. */}
    </div>
  );
}

/** Exported for the completion state's copy. */
export { AlertTriangle as PaneAlertIcon };
