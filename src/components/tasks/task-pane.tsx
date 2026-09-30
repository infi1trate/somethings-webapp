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
import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
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
import { elapsedLabel } from "@/components/tasks/strips";
/* `chatThreadHref` AND `MessageSquare` LEFT WITH THE SECOND LINK (§3).
   The conversation link is gone — one way out, not two — and the import
   goes with it rather than sitting unused above a pane that no longer
   offers that destination. `chatThreadHref` is still exported and still
   used by the record header and the Risk Flags pane. */
import type { CompletedEntry } from "@/components/tasks/completed-group";
// Still used by the BILLING pane's Notes link — a different block from the
// risk-flag excerpt. (It read "AI-summary link" until that block's label became
// "Notes"; the link itself is unchanged.)
import {
  buildConversation,
  conversationHref,
  firstNameOf,
} from "@/lib/tasks/conversation";
import { ConversationExcerpt } from "@/components/tasks/conversation-excerpt";
/* §3.2 asks for "the same MENTOR label treatment as Risk Flags", and this is
   that treatment — the component, not a copy of its declarations. Already
   shared with `escalation-region`, so this is its third caller and still one
   implementation. */
import { RolePair } from "@/components/monitoring/event-pane";
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
/** ═══ THE ENGAGEMENT LINE (§3.2) — THREE PAIRS, ONE ROW, NO DISCLOSURE ═══
 *
 *  WHAT IT REPLACES: two of these three figures sat behind a chevron in a
 *  bordered strip, with the third borrowed into the closed state so the
 *  disclosure would say something. §3.1's objection is the right one —
 *  "progressive disclosure earns its place when there is a lot to hide. Two
 *  metrics behind a chevron costs a click and hides the thing that would have
 *  oriented the supervisor before they read anything else."
 *
 *  ═══ SMALL, AND THE RULE SAYS WHY ═══
 *
 *  §3.3: "Large numerals are the page-header treatment; a record header must
 *  not compete with the page it sits inside." So the value is 14px — one ramp
 *  step above the label, the same step the row's figures now use — and the
 *  label is `PANE_LABEL`, which is the token five other files already use for a
 *  field label. NOT `font-semibold` anywhere: only TWKLausanne-400 ships, so a
 *  weight here would be a browser-synthesised faux bold, which is the mistake
 *  `PANE_LABEL`'s own note records.
 *
 *  ═══ TABULAR, AND MONO WITH IT ═══
 *
 *  §3.3 asks for tabular figures. Mono comes with them for the reason the row's
 *  two figure columns share a face: these are three numbers read across, and a
 *  proportional 4 beside a proportional 140 reads as prose.
 *
 *  ═══ THE WINDOW STAYS IN THE LABEL ═══
 *
 *  `30d` rather than "last 30 days", and the abbreviation is a cost worth
 *  stating: the strip's own note said "the window is named, because '62
 *  messages' without 'last 30 days' cannot be sized", and that requirement is
 *  unchanged — a figure over an unstated window is meaningless. What changed is
 *  the budget. MEASURED at 12px in the text face, the three long labels run
 *  "Days in mentorship" 108px + "Messages, last 30 days" 132px + "Video calls,
 *  last 30 days" 139px = 379px of label alone, before figures or gaps, against
 *  a pane that has ~300px to spare beside the identity block. So the window is
 *  abbreviated rather than dropped, because §3.3's fallback — "dropping video
 *  calls is preferable to a two-line header" — drops a FACT, and `30d` drops
 *  only characters. The `<dt>` carries the full phrase for a screen reader.
 */
function EngagementLine({
  stats,
}: {
  stats: { daysInMentorship: number; messagesLast30: number; videoLast30: number };
}) {
  /* NEEDS-COPY-NICOLE on all three visible labels. `full` is what assistive
     tech reads, so the abbreviation above is a VISUAL economy and not a loss of
     the window — a screen-reader user hears the unabbreviated phrase.
     `140d` CARRIES ITS UNIT IN THE VALUE while the other two carry their window
     in the LABEL, and the unevenness is deliberate: "Mentorship 140" states no
     unit at all, and measured, the label that would have stated it ("Days in
     mentorship", 108px) is the single widest string in this block. Putting the
     `d` on the figure costs 9px and buys the fact. */
  const pairs: {
    id: string;
    short: string;
    full: string;
    value: string;
    optional?: boolean;
  }[] = [
    /* `id` IS A PROBE HANDLE AND IT EXISTS BECAUSE TWO OF MY OWN ASSERTIONS
       FAILED TO DISCRIMINATE WITHOUT IT. Mutation-tested, a check for the
       duration (`/\d+d/` over the whole list) passed with the duration DELETED,
       because "Messages 30d" contains "30d" — a regex matching a neighbour's
       label, which is the exact hazard `today-mirror` warns about in its own
       note. A per-pair attribute makes the assertion name the pair it means. */
    { id: "mentorship", short: "Mentorship", full: "Days in mentorship", value: `${stats.daysInMentorship}d` },
    { id: "messages", short: "Messages 30d", full: "Messages, last 30 days", value: `${stats.messagesLast30}` },
    {
      id: "video",
      short: "Video 30d",
      full: "Video calls, last 30 days",
      value: `${stats.videoLast30}`,
      /* ═══ THE ONE PAIR THAT YIELDS — AND §3.3 SAID TO REPORT THIS ═══
         "Everything must fit one band without wrapping at the pane's width. If
         it does not, report before adding a second line — dropping video calls
         is preferable to a two-line header."
         MEASURED, IT DOES NOT FIT AT EVERY WIDTH. Against the widest identity
         block in any fixture (185px — "Theo L." over "Brandy Forrestor"), the
         three pairs need 488px of band; the band has 584 at 1600 and 504 at
         1440, but 467 at 1366 and 424 at 1280. So at the bottom two widths the
         right block wrapped under the left and the band went 93px -> 155px.
         WHICH IS WHY THIS IS A HIDE AND NOT A DELETION. §3.3 offers dropping
         video calls, and the reason to prefer hiding it only where it does not
         fit is Gap 432: `person-row` renders a video-call chip for RECORD teens
         (`t*` ids) and this figure comes from the task fixtures (`tk-*`), which
         share not one id. So "it is one click away on the care journey" — the
         justification the CTA beneath it would otherwise supply — is false for
         these items, and an unconditional drop would remove the only place this
         number is ever shown. Hidden at 1280, present at 1440.
         THE COST IS STATED: a figure that appears on resize is a figure a
         reader can miss. The alternative loses it always. */
      optional: true,
    },
  ];
  return (
    /* A REAL `<dl>`: three label/value pairs ARE a description list, and the
       markup is what lets a screen reader pair them without the labels being
       read as a sentence. `gap-x-3` between pairs against `gap-1` inside one is
       the proximity that says which label owns which figure — a 3x ratio, and
       12px is on the 4px grid that is this product's only real spacing scale.
       IT WAS `gap-x-4`, AND THE 8px IT SAVES IS LOAD-BEARING: it is most of the
       margin the narrow case has left once the video pair is out. */
    <dl data-slot="engagement" className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
      {pairs.map((m) => (
        <div
          key={m.id}
          data-metric={m.id}
          className={cn(
            "items-baseline gap-1 whitespace-nowrap",
            /* ═══ A CONTAINER QUERY, NOT A VIEWPORT BREAKPOINT ═══
               `data-view.tsx` already argues this one: "`@container` +
               `@min-[45rem]` asks the only question that matters: is THIS BOX
               wide enough". The pane's width is a function of the viewport
               today, so a `min-[1420px]:` would work — and would encode that
               relationship in a class, so the day the list/pane split changes
               the header would hide a metric at the wrong width with nothing
               pointing here.
               THE THRESHOLD IS THE MEASURED WORST CASE PLUS MARGIN: 488px is
               what the widest identity block (185px) plus three pairs (287px)
               plus the 16px gap needs, so 500 leaves 12px.
               IT WAS 520 FOR ONE MEASUREMENT AND THAT WAS TOO CAUTIOUS: the
               band is 504px at 1440, so a 520 threshold hid the video pair at a
               width where all three demonstrably fit. 500 shows three at 1440
               and two at 1366 (467px), which is the actual boundary.
               A NAME LONGER THAN THE FIXTURES' WIDEST EATS THAT 12px, and what
               happens then is a shrink rather than a wrap: the identity block is
               `min-w-0` and the metrics are `shrink-0`, so the left yields to
               its min-content first. The band only wraps once even that does
               not fit, which is the behaviour this query exists to keep away
               from the widths anybody uses.
               WRITTEN AS A LITERAL, NEVER INTERPOLATED — `data-view.tsx`'s own
               note records that `@min-[${w}]:hidden` generates no CSS at all,
               because Tailwind reads classes statically. */
            m.optional ? "hidden @min-[500px]:flex" : "flex"
          )}
        >
          {/* ═══ NOT `--text-muted` ON THIS GROUND (elevation amendment §2) ═══
              `LABEL` is `PANE_LABEL`, which pairs the field-label type token
              with `--text-muted`. That pairing was measured against the pane's
              WHITE body; this band is `--surface-s2` now, and this codebase
              already recorded what muted does there — "Muted measures 4.01:1 on
              `--surface-s2` — under the 4.5 floor for 12px text, where
              secondary is 5.78:1", in `ReviewIdentityCell`'s own note.
              SO THE INK MOVES WITH THE GROUND. The type token stays — it is the
              field-label stop and nothing about it changed — and only the colour
              is overridden, which is the same substitution K.5 made system-wide
              on this surface. Applying the tier without this would have put two
              12px labels under the AA floor on the pane a supervisor reads
              every time. */}
          <dt className={cn(LABEL, "text-[var(--text-secondary)]")}>
            <span aria-hidden>{m.short}</span>
            <span className="sr-only">{m.full}</span>
          </dt>
          <dd
            className="text-[14px] leading-[20px] tabular-nums text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
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
  /** ═══ READ-ONLY, BECAUSE THE DECISION IS ALREADY A RECORD (arch-F, F4) ═══
   *  Set when the selection is a row from "Completed today". The review renders
   *  with `canAct={false}` — the module's own tier gate, which already drops the
   *  proposal chip and the picker — and the action bar is replaced by what was
   *  submitted and when. A live Submit over a closed review would offer to commit
   *  it a second time. */
  completed = null,
}: {
  item: TaskItem | null;
  now: number;
  /** Fires with the pane's detail; the page owns resolveWithUndo. */
  onResolve: (item: TaskItem, detail: Record<string, unknown>) => void;
  /** Where the pane publishes its keyboard-reachable actions. See PaneActions. */
  actionsRef?: React.MutableRefObject<PaneActions>;
  excerptState?: ExcerptState;
  completed?: CompletedEntry | null;
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
      confirm:
        payload.kind === "billing"
          ? () => billingHandle.current?.submit()
          : undefined,
    };
  }, [actionsRef, item, payload, confirmCode, onResolve]);

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
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--surface-s2)] px-5 py-4">
        <div
          /* ═══ THE CONTAINER FOR §3.3's QUERY IS THIS ROW ═══
             It is the element that WRAPS when the two blocks do not fit, so its
             width is the quantity the video pair's `@min-[520px]` has to ask
             about. Putting `@container` on the `<dl>` instead would have
             measured the metrics' own width — which is a function of how many
             metrics are shown, so the query would have been asking about its own
             answer. */
          className="@container flex flex-wrap items-start justify-between gap-x-4 gap-y-2"
        >
          <div className="min-w-0">
            {/* ═══ THE EYEBROW IS GONE (addendum §2.9) ═══
                It read "Billing code review" above every record on a
                destination where every record is one — the same string the row
                chip carried, removed for the same reason. The page title three
                inches up says what surface this is; the pane's job is to say
                WHICH one, which is the heading below. */}
            <h2
              /* THE PROBE'S HANDLE ON "WHOSE RECORD IS THIS" — the advance rule
                 is a statement about which record is on screen after a resolve,
                 and reading it off the heading is reading what a supervisor
                 reads. */
              data-pane-teen
              className="mt-0.5 font-display text-[20px] font-bold leading-[28px] text-[var(--text-primary)]"
            >
              {item.teenDisplayName}
            </h2>
            {/* ═══ EVERY ESCALATION BRANCH IS GONE (Phase 6) ═══
                This pane is Care Reviews', and Care Reviews has held billing
                alone since Phase 2 — so `isEscalationTask(item)` was false on
                every item that can reach here and each branch was unreachable
                code. `EscalationMeta`, `EscalationCtas` and `EscalationTaskPane`
                retire with them; the escalation record's own pane on
                `/app/escalations` is the surviving representation, and Phase 6
                moved the facts row and the link-outs onto it rather than letting
                them die with the duplicate. */}
            {/* ═══ §3.2 — THE CONTEXT LINE CARRIES THE MENTOR AGAIN ═══
                "Left — identity. Teen name, then a compact context line
                beneath it: review age, and the mentor with an explicit role
                label."
                THIS REVERSES arch-F's HEADER REMOVAL, and the argument it
                reverses is directly above: "the mentor does not perform a
                billing review, is not accountable for it, and cannot change its
                outcome". THAT IS STILL TRUE AND IS NOT WHAT THIS ANSWERS. The
                mentor is not here as a party to the review; they are here
                because a supervisor reading a teen's record needs to know who
                is working with that teen, which is the question §7 already
                conceded belongs in the pane when it remounted the figures.
                §3 only moves WHERE the pane answers it — out of a bordered
                strip four blocks down and into the identity block, where
                record context belongs.
                THE ROW STILL NEVER NAMES A MENTOR. `e.no-mentor` in
                `row-semantics` asserts it, and nothing here touches that: the
                row's unit is the review, the pane's subject is the teen, and
                only one of those has a mentor as context. */}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
              <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                {/* ═══ THE AGE, BARE (Figma alignment §3) ═══
                    The list's own column is headed "Review age" and its cells
                    read `3d`; the pane header repeating " open" made the same
                    fact wear two shapes two inches apart. */}
                {elapsedLabel(item.openedAt, now)}
              </span>
              {/* ═══ AND SO IS THE DUE FACT (addendum §2.9) ═══
                  The meta line read "2d open · due 6:24 PM", and with
                  `TASK_SLA_MS` null for both billing types the second half
                  became the literal "no review deadline" — a clause announcing
                  the absence of a concept the destination no longer has.
                  THE AGE STAYS, and it is now the whole line: it is what the
                  list is ordered by, so the pane and the row agree on the one
                  figure that explains the queue. */}
              {/* ═══ THE CHIP IS GONE FROM HERE TOO (arch-G, G1) ═══
                  arch-F replaced its misleading label (`Past 3d`, the SLA's
                  LENGTH) with "Overdue" — still a second statement beside
                  "overdue by 9h". The meta line reads `3d open · overdue by 9h`
                  and the due fact carries the breach ink, which is the same rule
                  the rows now follow. */}
              {/* ═══ THE ROLE LABEL IS RISK FLAGS' OWN COMPONENT, NOT ITS CSS ═══
                  §3.2: "Use the same MENTOR label treatment as Risk Flags —
                  without it, two names near each other are ambiguous about who
                  is who, which is the same defect the escalation cards had."
                  SO IT USES `RolePair` ITSELF. The instruction names a
                  treatment, and the two ways to match one are to copy its
                  declarations or to call it — and `RolePair` is already
                  exported and already shared by `escalation-region`, so calling
                  it is the option that cannot drift. Copying `text-[11px]
                  uppercase tracking-wide` into a third file is how one
                  treatment becomes three.
                  `teenName={null}` RENDERS THE MENTOR PAIR ALONE, which the
                  component already supports because Risk Flags has the same
                  case. The teen is the `h2` directly above; labelling it here
                  would put the name on screen twice to disambiguate it from
                  itself. */}
              <RolePair teenName={null} mentorName={item.mentorName} />
            </p>
          </div>

          {/* ═══ THE TWO WAYS OUT, AND WHY THEY ARE HERE AND NOT ON THE ROWS ═══
              At 19–100 rows, two or three controls per row puts 40–300 targets in
              a column whose only job is scanning — Hick's Law, and every one of
              them a chance to leave the queue by accident. Navigation away from
              triage is a deliberate, occasional act; selecting a row fills this
              pane instantly, so the pane header IS the row's control surface.
              TERTIARY, DELIBERATELY: text buttons with icons, no fill, no border.
              They must not compete with the recommendation title below them or
              with the footer's Submit, which is the one primary on the pane. */}
          {/* ═══ §3.2 — ENGAGEMENT, THEN THE CTA UNDER IT ═══
              "Right — engagement, then the CTA. The metrics as small inline
              label/value pairs on one line... `View care journey` sits directly
              beneath them. That adjacency is the point: the metrics are a
              summary of the care journey, so the link to the full journey reads
              as 'see the rest of this' rather than as a floating button."
              WHICH IS ALSO WHAT WAS WRONG WITH THE LINK BEFORE. It sat top-right
              with no semantic neighbour, and the figures it summarises were
              three blocks below it behind a chevron. Neither element was
              explicable from where it stood; together they explain each other.
              `items-end` RIGHT-ALIGNS BOTH so the link's right edge lines up
              with the last metric's, which is what makes the two read as one
              stack rather than as two right-floated things. */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {/* GATED ON THE KIND, because `mentorStats` is the BILLING payload's
                field. This pane has held billing alone since Phase 2, so the
                gate is never false today — it is here because an ungated
                `p.mentorStats` would not compile against the union, and writing
                the narrow is cheaper than asserting the invariant. */}
            {p.kind === "billing" && <EngagementLine stats={p.mentorStats} />}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-1 gap-y-1">
            {/* ═══ ONE SOURCE FOR THE SET, PER TASK KIND (arch-G, G4) ═══
                MEASURED: two "View care profile" links, identical href, side by
                side. `EscalationCtas` carries the escalation set — care profile,
                conversation, escalation record — and this link rendered
                unconditionally alongside it. A duplicated way out is not
                harmless in a cluster whose whole design note above is about not
                competing for the eye: it doubles one destination's weight
                against the two beside it. */}
            {/* ═══ ONE WAY OUT, NOT TWO (Figma alignment §3) ═══
                It was `View care profile` + `View conversation`. The Figma
                collapses them to a single `View care journey`, and that is the
                better shape for the reason the cluster's own note above
                already argues: two tertiary links side by side split the eye,
                and this pane's job is the decision below them rather than the
                navigation beside them.
                IT GOES TO THE CARE TAB, which is where the journey is — the
                conversation link's own note records that `?msg=` anchoring does
                not work and that a billing review has no message to anchor to
                anyway, so the dropped link was the weaker of the two.
                NOT A FORK: these links are this pane's chrome. `ReviewBody` —
                the module frozen against the Care page — renders none of them,
                so the Care page is untouched by this change. */}
            <Link
              href={`/admin/person/${encodeURIComponent(item.teenId)}?tab=care`}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold",
                "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              {/* NEEDS-COPY-NICOLE */}
              View care journey
            </Link>
            {/* AN ESCALATION GETS A THIRD WAY OUT — the durable record. Its own
                component, so the two escalation task types carry the same set. */}
          </div>
          </div>
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
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4",
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
        {p.kind === "billing" && recommended && completed && (
          /* ═══ THE CLOSED REVIEW, AS A RECORD ═══
             The module with `canAct={false}`: no proposal chip, no picker, no
             documentation gate. What a supervisor gets is what they submitted. */
          <ReviewBody
            /* THE CLOSED REVIEW FORKS TOO — a supervisor reading back what they
               submitted should see the pane they submitted it in, not the Care
               page's rendering of it. */
            surface="care-reviews"
            review={billingReviewFor(item, p)}
            currentCode={p.current?.code ?? null}
            currentStatement={p.current?.statement ?? null}
            showCurrentLine
            decision={null}
            canAct={false}
            interactive
          />
        )}
        {p.kind === "billing" && recommended && !completed && (
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
          "sticky bottom-0 -mx-5 -mb-4 mt-4 border-t border-[color:var(--border-subtle)]",
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

        {p.kind === "billing" && completed && (
          /* NEEDS-COPY-NICOLE. WHAT WAS SUBMITTED AND WHEN — the bar's job on a
             closed review is to state the outcome, not to offer one. */
          <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {completed.outcome === "unchanged"
              ? `${completed.code} confirmed`
              : `Changed to ${completed.code}`}
            <span aria-hidden className="px-1.5 opacity-40">·</span>
            <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {new Date(completed.at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </p>
        )}

        {p.kind === "billing" && recommended && !completed && (
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
