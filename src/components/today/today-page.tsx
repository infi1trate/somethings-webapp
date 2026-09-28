"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TODAY — the supervisor's orientation route. Supervisor tier only.
//
// ═══ §4: TODAY MIRRORS. IT NEVER CONTAINS. ═══
//
// The rule, stated as the acceptance test it is: **it must be impossible to
// change the state of any record from this route, except by navigating away from
// it.** Not "we avoided putting a resolve button here" — impossible, and checked.
//
// FOUR THINGS MAKE IT TRUE, and they are listed because the next person adding a
// section here needs to know which invariant they are inside:
//
//  1 · EVERY AFFORDANCE THAT TOUCHES A RECORD IS A `<Link>`. Not a button that
//      navigates — an anchor, so it is a navigation to the browser, to a screen
//      reader, to middle-click, and to the probe that enumerates this page.
//  2 · THE THREE NON-LINK CONTROLS ARE PAGE CHROME and are named here:
//      the digest's dismiss, and two per-region retries. None of them reads or
//      writes a record; all three are `useState` on this component and die with
//      the mount.
//  3 · THIS FILE IMPORTS NO MUTATOR. No `useResolveUndo`, no `TaskPane`, no
//      `EventPane`, no store setter except `setShiftSeenAt` — see 4.
//  4 · THE ONE STORE WRITE IS A VISIT STAMP. `shiftLastSeenAt`, which is what
//      makes the shift digest appear once per shift rather than on every visit.
//      It is UI memory about this reader, not state on any record, and the
//      distinction is the one the acceptance test encodes: the probe diffs the
//      whole persisted store across a Today mount and requires the diff to be
//      exactly that key.
//
// ═══ WHY A MIRROR IS WORTH A ROUTE AT ALL ═══
//
// Because the console has five destinations now, and the question a supervisor
// arrives with — "what is worst right now" — is the one question no single
// destination can answer. Every figure on this page is computed by the
// destination that owns it (`lib/home/today.ts` has the reasoning); this page
// chooses nothing, counts nothing, and phrases nothing that a destination has
// not already phrased.
//
// ═══ WHAT IS DELIBERATELY ABSENT ═══
//
// No trend, no streak, no coverage-over-time, nothing comparative across
// supervisors, no platform-health aggregate. A chart of whether somebody kept
// pace is a performance surface, and the punitive dimension of this role is a
// known sensitivity. Today's position and recency only.
//
// SUCCEEDS `home/home-page.tsx`, which is left in place under the strangler rule
// for the same reason `DomainTabs` was: it is the four-stage LADDER surface, its
// sequence was a priority claim built on the tier model Phase 4 removes, and
// deleting it in the same commit that replaces it would put the diff and the
// judgement in one place.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Phone, RotateCcw, X } from "lucide-react";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { tasksScenario } from "@/lib/tasks/seed";
import {
  compareEscalations,
  isActive,
  type EscalationRecord,
} from "@/lib/monitoring/escalation";
import { monitoringData } from "@/lib/monitoring/scenarios";
import { NowBand } from "@/components/monitoring/now-band";
import { PageHeader } from "@/components/ia/page-header";
import {
  startHerePreview,
  type StartHerePreview,
} from "@/lib/home/start-here";
import { PinnedMentees } from "@/components/today/pinned-mentees";
import { SuggestedSchedule } from "@/components/today/suggested-schedule";
import { bandStateFor } from "@/lib/monitoring/live";
import { LIVE_LAYER_ENABLED } from "@/lib/monitoring/constants";
import {
  ACTIVITY_DOMAIN_OF,
  DOMAIN_LABEL,
  type TaskDomain,
} from "@/lib/tasks/types";
import { HOME_LOAD_STAGES, homeLoadPlanFor } from "@/lib/tasks/load-plan";
import { isNewShift, shiftFactsFor } from "@/lib/tasks/shift";
import {
  directiveCardId,
  todayRationale,
  todayCards,
  /* `todayDigestLine` IS NO LONGER IMPORTED HERE (Phase C.2). It is still
     exported and still tested — it is the shift-start DIGEST, which names
     destinations — but the banner's body is the rationale now, and C.2 rules
     out the digest's sentence there for being a restatement of the rows. The
     function keeps its tests so the day something else wants a digest, the
     sentence is still proven; no current caller means no current render. */
  type CardTone,
  type TodayCard,
} from "@/lib/home/today";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import { devClockAt } from "@/lib/home/dev-clock";
import {
  ReviewAgeCell,
  ReviewDisc,
  ReviewIdentityCell,
  ReviewPresentationCell,
  ReviewRowHeader,
} from "@/components/tasks/review-row";
import { NAV } from "@/components/settings/nav-items";
import type { DestinationId } from "@/lib/ia/destinations";
import type { LucideIcon } from "lucide-react";

/** ═══ ONE SECTION-LABEL TREATMENT (K.7.1) ═══
 *  "Pinned mentees" and "Closed today — not counted above" floated as small
 *  grey text between containers with no shared treatment — different inks,
 *  different gaps, no relationship to each other or to the modules they label.
 *  ONE STYLE, ONE GAP ABOVE, ONE GAP BELOW, declared once. `--text-secondary`
 *  rather than `--text-muted`: muted is 4.82:1 on the page ground and secondary
 *  is 6.94:1, and K.5 makes the same substitution wherever a de-emphasised ink
 *  carries text. The gap below is the label's own `mb`, so a section cannot
 *  set its own and drift. */
export const SECTION_LABEL =
  "mb-1.5 text-[12px] leading-[16px] font-semibold text-[var(--text-secondary)]";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ TONE IS NEVER THE ONLY CARRIER (SC 1.4.1) ═══
 *
 *  Every tone here also changes the WORDS — "2 notes overdue" against "21 open ·
 *  oldest 4d ago" against "Nothing open" — so a reader who cannot separate the
 *  two inks gets the same sentence. Breach additionally carries an icon. That is
 *  the reason this returns classes rather than a colour: if a tone ever needs to
 *  be readable on its own, the words are wrong. */
const TONE_TEXT: Record<CardTone, string> = {
  breach: "text-[var(--band-clay-fg)]",
  attention: "text-[var(--text-primary)]",
  clear: "text-[var(--text-secondary)]",
  unavailable: "text-[var(--text-muted)]",
};

/** ═══ THE LIVE ESCALATION STRIP — THE INTERRUPT LAYER ═══
 *
 *  §3 keeps the STRIP global while the REGION moved to its destination: the
 *  region is a worklist of records and belongs on one route, and the strip is an
 *  interrupt and belongs wherever a supervisor is standing.
 *
 *  Nothing here changes escalation state: one link out, to the record that owns
 *  it. A resolve control on this strip would be the §4 violation in its worst
 *  possible location — a supervisor closing a crisis from a summary.
 *
 *  THE ONLY SATURATED FILLED TREATMENT ON TODAY. `--task-respond-*` is defined in
 *  `:root` only and deliberately does not theme, because an alarm should be the
 *  same object in both modes (gap row 214). If a second filled-red thing appears
 *  on this page, the strip stops meaning anything.
 *
 *  ═══ IT READS THE RECORDS, AND IT USED TO READ TASK ITEMS ═══
 *
 *  Measured on mobile under the `classifier-degraded` fixture: this strip
 *  announced two live escalations in `aria-live="assertive"` red, and the
 *  Escalations CARD forty pixels below it read "Nothing open". The strip counted
 *  `activeEscalation` TASK ITEMS; the card counts the destination's RECORDS.
 *
 *  The card was right — it mirrors `/app/escalations`, whose region renders those
 *  same records — so the strip moved to the same source rather than the card
 *  moving to the strip's. One source for escalations on this route, which is the
 *  mirror rule applied to the loudest element on it.
 *
 *  THE FIXTURE DISAGREEMENT IS REAL AND IS NOT THIS FILE'S: the
 *  `classifier-degraded` builder produces its own (empty) escalation set while
 *  the task scenario underneath it still holds escalation tasks. Phase 10 owns
 *  the scenarios; gap row 409 records it. What this change fixes is Today
 *  contradicting itself on screen, which no fixture repair would have. */
function EscalationStrip({
  records,
  now,
}: {
  records: EscalationRecord[];
  now: number;
}) {
  if (records.length === 0) return null;
  return (
    <section
      /* TODO-COPY */
      aria-label="Open escalations"
      /** ANNOUNCED ON ARRIVAL. A supervisor landing on Today with an escalation
       *  running must not have to read for it — `assertive`, which is reserved on
       *  this surface for exactly this and nothing else. */
      aria-live="assertive"
      data-anno-ref="today-escalation-strip"
      className="shrink-0 overflow-hidden rounded-[var(--radius-elevated)]"
      style={{ backgroundColor: "var(--task-respond-bg)" }}
    >
      <ul className="divide-y divide-[color-mix(in_oklab,var(--task-respond-fg)_20%,transparent)]">
        {records.map((rec) => {
          return (
            <li
              key={rec.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-[var(--task-respond-fg)]"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold leading-[20px]">
                  {rec.teenName}
                </span>
                <span className="block truncate text-[12px] leading-[16px]">
                  {/* TODO-COPY */}
                  to {rec.mentorName}
                </span>
              </span>
              {/* ICON PLUS TEXT, NO GROUND. A tinted pill on this ground measures
                  3.84:1 and fails — the same defect arch-B found and removed in
                  the escalation region. */}
              <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold leading-[16px]">
                <Phone className="size-3 shrink-0" aria-hidden />
                {/* TODO-COPY */}
                {rec.is911 ? "911 dispatched" : "No 911"}
              </span>
              <span
                className="shrink-0 text-[13px] font-semibold tabular-nums"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {/* TODO-COPY */}
                {/* FROM `triggeredAt`, which is the record's own clock and the
                    one the acknowledgement SLA is measured against. */}
                {elapsedLabel(rec.triggeredAt, now)} elapsed
              </span>
              <Link
                href={escalationHref(rec.id)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold",
                  "bg-[var(--task-respond-fg)] text-[var(--task-respond-bg)] transition-opacity hover:opacity-90",
                  RING
                )}
              >
                {/* TODO-COPY */}
                Open escalation
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** ═══ ONE DESTINATION — THE WHOLE CARD IS THE LINK ═══
 *
 *  Not a chevron at the end: a card is one destination, so a reader aiming
 *  anywhere on it should arrive. That also makes the accessible name the whole
 *  sentence — "Care Reviews, 16 open · 2 overdue" — rather than a label whose
 *  state sits in a sibling a screen reader meets separately.
 *
 *  ═══ AN ANCHOR, NOT A BUTTON WITH A ROUTER PUSH ═══
 *  §4's test is that leaving is the only way to change anything, so leaving has
 *  to be a real navigation: middle-clickable, copyable, announced as a link, and
 *  visible to a probe that enumerates this page's affordances. A `<button
 *  onClick={router.push}>` would look identical and satisfy none of that.
 *
 *  ═══ THE DIRECTIVE IS THE ONLY EMPHASIS, AND IT IS NOT A COLOUR ═══
 *  One card carries the ladder's answer, marked by a filled dot and the display
 *  face. Tone already varies for a different reason (breach against clear) and
 *  two colour languages in one row teach neither. Weight is not available —
 *  Lausanne ships one face — so the channels are the FACE and the MARKER, which
 *  is the rule `row-emphasis` records. */
/** ═══ THE DESTINATION ICONS (K.4.1) ═══
 *  THE SAME GLYPH THE NAV USES, read from the nav's own table rather than
 *  restated — shield for Escalations, flag for Risk Flags, document for Care
 *  Reviews. A second copy here would be two answers to "what does this
 *  destination look like", and the rail is the one a reader has already
 *  learned. A destination added to `NAV` without an icon fails to compile. */
const CARD_ICON: Record<DestinationId, LucideIcon> = {
  escalations: NAV.escalations.icon,
  "risk-flags": NAV.riskFlags.icon,
  "care-reviews": NAV.careReviews.icon,
};

function DestinationCard({
  card,
  directive,
  count,
}: {
  card: TodayCard;
  directive: boolean;
  /** The rail badge's number for this destination, or null. Passed in rather
   *  than recomputed: the card and the rail disagreeing about one destination is
   *  the mirror failure this whole surface is built to avoid. */
  count: number | null;
}) {
  const Icon = CARD_ICON[card.id];
  return (
    <li>
      <Link
        href={card.href}
        data-anno-ref={`today-card:${card.id}`}
        data-tone={card.tone}
        data-directive={directive ? "true" : undefined}
        className={cn(
          /* ═══ 80 TALL, AND THE WHOLE CARD IS THE TARGET (H.2.2, H.2.3) ═══
             Well clear of 2.5.8's 24px floor and of the 44px practical bar.
             ELEVATION IS `--shadow-card`, AND THAT NAME IS A FINDING. H.2.4
             says "`Elevation/2` is a Bloom token" — it is not, in this
             codebase: Bloom ships `--shadow-card`, `--shadow-card-hover`,
             `--shadow-panel`, `--shadow-tile`, `--shadow-alert` and
             `--shadow-elevation-4`, and there is no `-2`. `--shadow-card` is
             the existing card elevation, so nothing new is authored here,
             which is the instruction that actually matters. Reported under
             H.6 rather than resolved silently. */
          "flex min-h-[80px] w-full flex-col justify-center gap-1 rounded-[var(--radius-elevated)]",
          "border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-3",
          "shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {/* ═══ THE DOT IS GONE, THE ICON HAS ITS SLOT (K.4.2) ═══
              The dot was a filled-or-hollow indicator carrying no stated
              meaning, occupying the slot the icon belongs in, and
              distinguishing its two states BY FILL ALONE. K.4.2 resolves
              Phase B.5 in favour of removal.
              WHAT IT WAS DOING IS NOT LOST: the directive is carried in words
              by the `sr-only` sentence ("Start here.") and, since K.4.5, by a
              visible text signal on the card — see `directive` below. */}
          <Icon
            aria-hidden
            className="size-4 shrink-0 text-[var(--text-secondary)]"
          />
          {/* ═══ THE COUNT LEADS THE HEADLINE (H.2.3) ═══
              "count + destination name as the headline". It was a figure
              right-aligned at the far end of a 794px row, which at 275 has
              nowhere to be — and on a card the count is the thing being
              counted's own headline rather than a trailing annotation.
              TABULAR AND MONO so a column of three cards does not jitter as
              the figures change, and `aria-hidden` for the reason the trailing
              figure was: the state sentence below already says the number, and
              the `sr-only` line speaks it once in order. */}
          <span
            className={cn(
              "min-w-0 truncate text-[14px] leading-[20px] text-[var(--text-primary)]",
              /* `font-display` IS the emphasis here and `font-bold` is not:
                 Avantt ships Bold only, so the weight declaration has no
                 rendering behind it — the FACE is the channel. */
              directive && "font-display"
            )}
          >
            {card.label}
          </span>
          {/* ═══ THE COUNT FOLLOWS THE NAME (K.4.3) ═══
              H.2.3 put it first. MEASURED, that broke the thing K.4.3 asks
              for: two cards led with a large numeral and the zero-state card
              led with nothing, so the destination NAME sat at a different x on
              each and the three did not share a structure.
              Trailing, every card is `[icon] [name]` and the figure appends —
              identical whether the count is 16 or absent, which is K.4.3's own
              test. The figure keeps its prominence; it just stops displacing
              the name.
              `aria-hidden` for the reason it always was: the state line below
              says the number in words and the `sr-only` sentence speaks it
              once in order. */}
          {count != null && count > 0 && (
            <span
              aria-hidden
              className="shrink-0 text-[20px] leading-[28px] tabular-nums text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {count}
            </span>
          )}
          {/* ═══ THE VISIBLE DIRECTIVE SIGNAL (K.4.2, K.4.5) ═══
              REMOVING THE DOT REMOVED THE ONLY VISIBLE ONE. The dot said
              "start here" by fill; "Start here." lived in the `sr-only`
              sentence, and the label's `font-bold` is inert on a Bold-only
              face — so a sighted reader had nothing left.
              SO IT IS WORDS NOW, which is what K.4.5 asks for on the
              Escalations card and what the standing constraint asks for
              everywhere: a state distinguished by colour must also be
              distinguished by text. This is text ALONE — no fill, no tone —
              so it carries on its own.
              AND IT IS REMOVED FROM THE `sr-only` SENTENCE BELOW, because a
              visible string is already in the accessible name and saying it
              twice is the defect the trailing figure had. */}
          {directive && (
            <span
              data-anno-ref="today-card-directive"
              className="shrink-0 whitespace-nowrap rounded-full border border-[color:var(--border-contour)] px-1.5 py-0.5 text-[11px] leading-[14px] text-[var(--text-secondary)]"
            >
              {/* NEEDS-COPY-NICOLE */}
              Start here
            </span>
          )}
        </span>
        {/* ═══ THE SECOND LINE AND THE CHEVRON SHARE A ROW ═══
            H.2.3 puts the decision-relevant fact second and the chevron last.
            On a 275px card the chevron goes at the end of that line rather
            than in a third row: it is an affordance for the card, not a fact
            about it, and giving it its own row would spend a third of an 80px
            card on decoration.
            THE TRAILING FIGURE IS GONE — it moved into the headline above,
            where H.2.3 puts it. Rendering it in both places would be the row
            saying one fact twice, which is what its old note was guarding. */}
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[12px] leading-[16px]",
              TONE_TEXT[card.tone]
            )}
          >
            {card.tone === "breach" && (
              <AlertTriangle className="mr-1 inline size-3 shrink-0 align-[-2px]" aria-hidden />
            )}
            {card.state}
          </span>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-[var(--text-muted)]"
          />
        </span>
        {/* THE WHOLE SENTENCE, ONCE, IN ORDER. "Start here" is NOT repeated
            here — it is a visible string above and therefore already in this
            link's accessible name. */}
        <span className="sr-only">{`${card.label}. ${card.state}.`}</span>
      </Link>
    </li>
  );
}

/** ═══ THE BOUNDED PREVIEW (Phase I) ═══
 *
 *  ORIENTATION WITH A SHORTCUT, NOT A WORK SURFACE. Every row is a `Link` and
 *  nothing else: no checkbox, no hover action, no swipe, no drawer, no
 *  disposition. The only interactive elements in this whole subtree are the
 *  rows and the one `See all`.
 *
 *  THE PARTIAL-LIST DISCLOSURE IS THE SAFETY PART (I.3). A supervisor who
 *  clears four items and sees an empty preview must not be able to conclude the
 *  queue is empty — the same hazard as a filtered-empty safety queue. So the
 *  count of shown-against-total renders whenever anything is open, and it reads
 *  off `preview.total`, which is the destination card's own figure.
 */
/** ═══ THE PREVIEW'S DISC SIZE ═══
 *  36px, matching `ROW_GEOMETRY.comfortable.disc` on the destination. Stated
 *  here rather than imported, because importing the worklist's preset table
 *  would tie Today's row height to a view control Today does not have. */
const PREVIEW_DISC = 36;



function StartHere({
  preview,
  now,
}: {
  preview: StartHerePreview;
  now: number;
}) {
  const more = preview.total > preview.items.length;
  return (
    <div data-anno-ref="today-start-here" className="mt-3">
      {/* ═══ THE COLUMN HEADER (K.1.3) ═══
          Parity was the explicit instruction, so it is built. THE JUDGMENT
          K.1.3 ASKS FOR, stated: over four rows the header is heavier than it
          is over sixteen — it adds a 33px band and three labels to name columns
          a reader can already read off four rows. It earns its place on the
          destination and it is chrome here. Reported rather than dropped,
          because the instruction was explicit.
          NOT STICKY, unlike the destination's: there is nothing to scroll past
          in a four-row list, and a sticky header over a static list is a
          promise about scrolling that the list does not keep. */}
      <ReviewRowHeader disc={PREVIEW_DISC} className="rounded-t-[var(--radius-inset)]" />
      <ul
        data-anno-ref="start-here-items"
        className="overflow-hidden rounded-b-[var(--radius-inset)] border-x border-b border-[color:var(--border-subtle)]"
      >
        {preview.items.map((it, i) => (
          <li key={it.id}>
            <Link
              href={it.href}
              data-anno-ref="start-here-item"
              className={cn(
                /* ═══ THE SAME ANATOMY, THE SHELL THAT SUITS THIS SURFACE ═══
                   K.1.5: the shared row navigates on both surfaces, and
                   selection belongs to Care Reviews where it drives a pane. So
                   this is a `Link`, not a treeitem — and every FIELD inside it
                   comes from `review-row.tsx`, which is what K.1 is for.
                   80px, MATCHING THE DESTINATION — K.1.4 allows the cap as the
                   only difference and names "no density variant" among the
                   things not to build. It was 54 here, which is a density
                   variant however it is described. Well clear of the 44px floor
                   (I.5.1) as a consequence rather than as the target. */
                "flex min-h-[80px] w-full items-center gap-3 px-6 py-2 transition-colors",
                "hover:bg-[var(--tint-hover)]",
                i > 0 && "border-t border-[color:var(--border-subtle)]",
                RING
              )}
            >
              <ReviewDisc teenId={it.teenId} name={it.name} size={PREVIEW_DISC} />
              <ReviewIdentityCell
                name={it.name}
                /* NEEDS-COPY-NICOLE where the destination has no status word —
                   Risk Flags, whose status-shaped field is its CATEGORY and so
                   is clinical content rather than a workflow state. */
                caption={it.status ?? ""}
              />
              {/* CODES, REQUIRED SINCE K.1 — and rendered through the same cell
                  the destination uses, so the pair arrow and the mono face
                  cannot differ between the two. */}
              {it.codes && (
                <ReviewPresentationCell
                  currentCode={it.codes.current}
                  recommendedCode={it.codes.recommended}
                />
              )}
              <ReviewAgeCell at={it.at} now={now} />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {/* ═══ SHOWN OF TOTAL (I.3.1) ═══
            NEEDS-COPY-NICOLE: Showing {n} of {total}
            It renders even when the preview holds everything, because "4 of 4"
            and a silent list of four are different claims and only one of them
            is checkable by the reader. */}
        <p
          data-anno-ref="start-here-count"
          className="text-[12px] leading-[16px] text-[var(--text-secondary)]"
        >
          Showing {preview.items.length} of {preview.total}
        </p>
        {/* ═══ THE MODULE'S ONE CTA (I.3.2, I.0) ═══
            Required whenever anything is open beyond the shown set, and it is
            the ONLY affordance pointing at the recommended destination — the
            banner's own button was removed rather than kept beside it. */}
        {more && (
          <Link
            href={preview.href}
            data-anno-ref="start-here-see-all"
            className={cn(
              "inline-flex min-h-11 items-center rounded-full bg-[var(--text-primary)] px-4 text-[13px] font-semibold text-[var(--text-inverse)]",
              "transition-opacity hover:opacity-90",
              RING
            )}
          >
            {/* NEEDS-COPY-NICOLE: See all {n} */}
            See all {preview.total}
          </Link>
        )}
      </div>
    </div>
  );
}

function RegionSkeleton({ h }: { h: number }) {
  return (
    <div
      aria-hidden
      className="shrink-0 animate-pulse rounded-[var(--radius-elevated)] bg-[var(--surface-s1)]"
      style={{ height: h }}
    />
  );
}

/** A region that could not load says so and offers the way back. The retry is
 *  PAGE-LOCAL — it flips this component's own `retried` flag and touches no
 *  record — which is why §4 allows it and why it is named in the module note. */
function RegionError({ line, onRetry }: { line: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="shrink-0 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4"
    >
      <p className="text-[13.5px] leading-[19px] text-[var(--text-primary)]">
        {line}
      </p>
      <button
        type="button"
        onClick={onRetry}
        data-today-local="retry"
        className={cn(
          "mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3",
          "text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <RotateCcw className="size-3.5" aria-hidden />
        {/* TODO-COPY */}
        Try again
      </button>
    </div>
  );
}

export function TodayPage() {
  const mounted = useMounted();
  const devClockKey = useOnboardingStore((st) => st.devClockKey);
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const monitoringScenarioId = useOnboardingStore((s) => s.monitoringScenarioId);
  const shiftLastSeenAt = useOnboardingStore((s) => s.shiftLastSeenAt);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const setShiftSeenAt = useOnboardingStore((s) => s.setShiftSeenAt);

  /** FIXED AT MOUNT, matching every other surface. `Date.now()` in render scope
   *  is impure and the React Compiler's purity rule rejects it. */
  const [mountedAt] = useState(() => Date.now());

  /** ═══ READ BEFORE IT IS WRITTEN ═══
   *  The gate is "has it been a shift since you were last here", and opening
   *  Today is what makes it no longer true — so the answer is captured at mount,
   *  before the effect below stamps the new visit. Read the other way round, the
   *  digest would disqualify itself every time. */
  const [wasNewShift] = useState(() => shiftLastSeenAt);
  const shiftDigestDismissedAt = useOnboardingStore(
    (st) => st.shiftDigestDismissedAt
  );
  const dismissShiftDigest = useOnboardingStore((st) => st.dismissShiftDigest);

  /** ═══ THE ONLY STORE WRITE ON THIS ROUTE (§4) ═══
   *  A visit stamp about this reader, not state on any record. The acceptance
   *  probe diffs the whole persisted store across a mount and requires the diff
   *  to be exactly this key — so adding a second write here fails that check by
   *  construction rather than by review. */
  useEffect(() => {
    if (!mounted) return;
    setShiftSeenAt(Date.now());
  }, [mounted, setShiftSeenAt]);

  const items = useMemo(
    () => (mounted ? tasksScenario(tasksScenarioId, mountedAt) : []),
    [mounted, tasksScenarioId, mountedAt]
  );

  /** ═══ THE DESTINATIONS' OWN DATA, READ THE DESTINATIONS' OWN WAY ═══
   *  Same call, same arguments, same clock override as `MonitoringPage` — which
   *  is what makes the flag, practice and coverage cards a mirror rather than a
   *  second opinion. A fixture may pin the hour, and Today has to honour that or
   *  its ages disagree with the queue's. */
  const data = useMemo(
    () =>
      mounted
        ? monitoringData(monitoringScenarioId, tasksScenarioId, mountedAt)
        : null,
    [mounted, monitoringScenarioId, tasksScenarioId, mountedAt]
  );
  /** ═══ THE PINNED CLOCK OUTRANKS BOTH (Phase J.1) ═══
   *  Precedence, widest to narrowest: the dev bar's pinned position, then the
   *  scenario's own `clockOverride`, then the mount instant.
   *  THE PIN WINS OVER THE SCENARIO DELIBERATELY. A scenario override moves the
   *  HOUR and keeps today's date, so it cannot reach the Friday variant or the
   *  Monday obligation overlap; the pin carries a weekday. When a reader has
   *  pinned a moment, honouring the scenario's hour instead would silently
   *  discard the thing they just asked for. */
  const pinnedClock = devClockAt(devClockKey);
  const now = pinnedClock ?? data?.clockOverride ?? mountedAt;

  const devLoadState = useOnboardingStore((st) => st.devLoadState);
  /** Per-region retries, which WIN over the plan once a reader has used one —
   *  the same arrangement every other surface has, and the reason the plan is a
   *  default rather than the value. */
  const [retried, setRetried] = useState<Record<string, boolean>>({});

  /** THE STAGE STAMP CARRIES THE STATE IT BELONGS TO, and the cleanup clears it
   *  — without that a finished run leaves the stamp matching and "Loading"
   *  replays exactly once, which is the defect arch-A found on Tasks. */
  const [progress, setProgress] = useState<{ forState: string | null; stage: number }>(
    { forState: devLoadState, stage: HOME_LOAD_STAGES }
  );
  const loadStage =
    progress.forState === devLoadState
      ? progress.stage
      : devLoadState === "loading"
        ? 0
        : HOME_LOAD_STAGES;

  useEffect(() => {
    if (!mounted || devLoadState !== "loading") return;
    const timers = Array.from({ length: HOME_LOAD_STAGES }, (_, i) =>
      setTimeout(() => setProgress({ forState: devLoadState, stage: i + 1 }), (i + 1) * 240)
    );
    return () => {
      timers.forEach(clearTimeout);
      setProgress({ forState: null, stage: HOME_LOAD_STAGES });
    };
  }, [mounted, devLoadState]);

  const plan = useMemo(
    () => homeLoadPlanFor(devLoadState, loadStage),
    [devLoadState, loadStage]
  );
  const stateOf = (region: keyof typeof plan) =>
    retried[region] ? "ready" : plan[region];

  const facts = useMemo(() => shiftFactsFor(items, now), [items, now]);

  /* ═══ DISMISSAL IS PERSISTED, PER SHIFT (Phase C.6) ═══
     It was `useState(false)`, which survived nothing — navigating to a
     destination and coming back brought the banner straight back, which is the
     one thing a supervisor does immediately after reading it. The store holds
     the INSTANT; `isNewShift` decides whether that instant is in this shift, so
     the dismissal expires on its own at the same eight-hour boundary the banner
     already uses to decide a shift is new. */
  const dismissed = !isNewShift(shiftDigestDismissedAt, now);

  /** THE FIVE CARDS. Every figure inside is the owning destination's — see
   *  `lib/home/today.ts`. */
  /** ═══ ONE INPUT OBJECT, TWO READERS (Phase C) ═══
   *  `todayCards` and `todayRationale` both need it, and the rationale's whole
   *  job is to explain a card — so building it twice is two chances for the
   *  banner to reason about a slightly different set than the rows show. */
  const todayInput = useMemo(
    () => ({
      items,
      facts,
      events: data?.events ?? [],
      /* THE RECORDS, which is what the Escalations destination counts. `raised`
         has no analogue here: an escalation opened from a flag's disposition is
         page-local to the queue that opened it, and Today can only see what
         survives a navigation — the same honest limit coverage credit has. */
      escalations: data?.escalations ?? [],
      conversations: data?.conversations ?? [],
      classifierDegraded: data?.classifier === "degraded",
      now,
    }),
    [items, facts, data, now]
  );

  const cards = useMemo(() => todayCards(todayInput), [todayInput]);

  /** AT MOST ONE CARD CARRIES IT, and it is read off the cards rather than from
   *  the ladder — which consulted `ShiftFacts` and put "start here" on a card
   *  reading "Nothing open". `directiveCardId` has the measurement. NULL is a
   *  real answer: with nothing owed, no card is marked. */
  const directiveCard = useMemo(() => directiveCardId(cards), [cards]);

  /** ═══ THE SAME RECORDS, IN THE SAME ORDER, AS THE DESTINATION ═══
   *  `compareEscalations` is the region's comparator — so the escalation at the
   *  top of the strip is the one at the top of `/app/escalations`, and a reader
   *  following the strip does not arrive to a differently-ordered list. */
  const liveEscalations = useMemo(
    () =>
      (data?.escalations ?? [])
        .filter(isActive)
        .sort((a, b) => compareEscalations(a, b, now)),
    [data, now]
  );

  /** ═══ THE DIGEST IS A SENTENCE AND A BUTTON NOW ═══
   *  Its eight chips restated the cards below it, in different words, from a
   *  second source that disagreed — and two of them asserted flag deadlines this
   *  system invented. `todayDigestLine` has the whole finding. */
  /** ═══ THE LIVE LAYER, ON TODAY, GATED OFF (Phase 9) ═══
   *
   *  `LIVE_LAYER_ENABLED` is `false` and blocked on Dr. Nissan and Meg: a live
   *  view of mentor–teen exchanges changes what it feels like to be supervised
   *  and creates a plausible performance effect on mentors. `bandStateFor`
   *  returns `"off"` while it is false and `NowBand` renders nothing at all — so
   *  what ships here is the WIRING, and the band is one constant away.
   *
   *  ═══ WHY TODAY IS WHERE IT BELONGS ═══
   *
   *  The band's entire justification is perishability — "a response-time breach
   *  seen at minute four is a save, and the same breach seen at 10pm is a
   *  coaching note" — and Today is the orientation route a supervisor lands on.
   *  A perishable layer on the page nobody keeps open is a layer nobody sees.
   *
   *  ═══ AND IT DOES NOT VIOLATE THE MIRROR RULE ═══
   *
   *  The band carries STATE CHANGES, never message content, and no item on it
   *  resolves anything: reading a conversation requires opening it, which is a
   *  navigation. Its two controls — pause and "N new" — are page chrome of the
   *  same kind the digest's dismiss already is, and both are declared in the §4
   *  probe's allowlist rather than assumed. The band is `aria-live="off"` by its
   *  own design, so it does not compete with the escalation strip's
   *  `assertive` — which stays the one interrupt on this route.
   *
   *  PAUSE IS PAGE-LOCAL AND REQUIRED (WCAG 2.2.2): content that auto-updates
   *  needs a way to stop it, and storing that preference would be a second
   *  store write on a route allowed exactly one. */
  const [livePaused, setLivePaused] = useState(false);
  const bandState = useMemo(
    () =>
      bandStateFor({
        enabled: LIVE_LAYER_ENABLED,
        transport: data?.transport === "lost" ? "lost" : "connected",
        paused: livePaused || !!data?.paused,
        now,
        items: data?.live ?? [],
      }),
    [data, livePaused, now]
  );

  /* ═══ THE BANNER'S BODY IS THE RATIONALE NOW (Phase C.2) ═══
     `todayDigestLine` is still exported and still tested — it is the
     shift-start DIGEST, a different sentence with a different job — but it is
     no longer what this banner says. C.2: the banner's only job is why THIS
     destination, "not a restatement of the list below it", which is exactly
     what naming all three destinations was. */
  const rationale = useMemo(
    () => todayRationale(cards, todayInput),
    [cards, todayInput]
  );
  /* ═══ THE PREVIEW IS KEYED TO THE RATIONALE (FORK I-1 = KEYED) ═══
     `rationale.id` and nothing else, so I.2.3 holds by construction: the
     module previews the destination the sentence above it names.
     `ctaCard` IS RETIRED, NOT DELETED. It resolved the rationale's destination
     to its card so the banner's own button could link there; I.0's merged form
     removes that button, and `See all` carries the link from `preview.href`.
     Kept because FORK I-2 flipping to `separate` restores the banner's CTA,
     and this is the one line that fork needs back. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ctaCard = rationale
    ? (cards.find((c) => c.id === rationale.id) ?? null)
    : null;
  const preview = useMemo(
    () => startHerePreview(rationale?.id, todayInput),
    [rationale, todayInput]
  );
  const showDigest =
    /* RATIONALE-OR-NOTHING (C.3). The last clause was `digestLine != null`,
       which is true whenever anything at all needs attention — so the banner
       rendered generic copy in every non-empty state. It now requires a derived
       rationale, and `todayRationale` returns null rather than inventing one. */
    mounted && !dismissed && isNewShift(wasNewShift, now) && rationale != null;

  return (
    <div
      data-anno-ref="today-page"
      /* ═══ THE GRADIENT — ATMOSPHERE, GROUPING NOTHING (Phase G.2) ═══
         REGION SEMANTICS: OPTION (a). It is anchored at the top of the content
         area and fades to zero alpha, so it has no edge — and a wash with no
         edge cannot bound an arbitrary subset or imply a relationship that
         does not exist (Law of Common Region). G.2.1 says "header region
         only"; that is where it is READ, and it dissipates rather than
         stopping, which is how both instructions hold at once.
         `background-repeat: no-repeat` and a fixed height so it washes the
         header and nothing below it, rather than tiling down a scrolling page.
         THE TOKEN CARRIES THE COLOUR AND THIS FILE CARRIES NONE. Raw values
         belong in the token file; `--gradient-header` is a documented design
         system extension, minted because Bloom has no gradient token.
         IT DEPENDS ON NO PROPS. Nothing about it varies with data, state,
         priority, recency or urgency. */
      style={{
        backgroundImage: "var(--gradient-header)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 220px",
      }}
      /* ═══ THE COLUMN PAIR'S WIDTH (Phase H.1) ═══
         857 + 16 + 285 = 1158 of content, plus `lg:px-8`'s 64 = 1222. The
         857 is `275 × 3 + 16 × 2` — a 3-up card grid at a 16px gutter — and
         H.1.1 forbids rounding it, approximating it or expressing it as a
         percentage, so it is written once, here and in the column itself.
         BELOW THE BREAKPOINT the old single-column width is kept exactly, so
         the narrow rendering is unchanged by this phase.
         ONE ARBITRARY VARIANT, NOT A NAMED ONE. Tailwind orders `lg:` and
         `min-[…]:` by where they fall in its own emitted sheet, not by
         specificity, and a named variant landing after an arbitrary one has
         silently won an argument on this codebase before. Both widths here are
         arbitrary so the cascade order is the source order. */
      className="mx-auto flex h-full min-h-0 w-full max-w-[860px] flex-col gap-5 overflow-y-auto px-6 py-6 min-[1470px]:max-w-[1222px] lg:px-8"
    >
      {/* ═══ THE SHARED HEADER, AND TODAY TAKES NO METRICS (addendum §2.10) ═══
          Deliberate, and the mirror rule is why: every figure on this page
          belongs to the destination it links to, so a metric pair up here
          would be a sixth copy of a number already on a card — and the first
          one a reader would meet, which would make Today the place the
          counting happens rather than the place it is reflected. */}
      {/* ═══ THE GREETING, AND THE ONE DECORATIVE MOMENT (Phase G.1) ═══
          OPTION (b) — TIME-NEUTRAL, NO TIME WORD. The pack allows (a),
          computing the word from the clock, and defaults to (b) if that word
          could ever be wrong during a shift. It could, for a reason the pack's
          own open items name: SUPERVISOR TIMEZONE LOCALISATION IS UNRESOLVED
          (Meg). So there are only two places to compute from and both can lie:
           · the SCHEDULE's zone (`America/New_York`, what Phase D reads) would
             tell a supervisor in California "Good evening" at 2pm their time;
           · the DEVICE's zone contradicts this pack's own timezone discipline
             and would render "Good morning" mid-shift for a western reader —
             the exact failure G.1.2 names.
          A greeting is a claim about the READER's time of day, and this product
          cannot currently make one. So it makes none. The wave survives, which
          is the part G.1 requires.
          NO DATE LINE. G.1.5 permits one only if computed from real time; it is
          not required, and one less element asserting something is the right
          trade on a surface whose whole job is orientation. */}
      <p
        data-anno-ref="today-greeting"
        className="shrink-0 font-display text-[20px] leading-[28px] font-bold text-[var(--text-primary)]"
      >
        {/* ═══ aria-hidden, AND THE TEXT CARRIES EVERYTHING (G.1.3) ═══
            Emoji rendering varies across platforms and fonts, so the glyph can
            never be the sole carrier of anything. It is sized to the type scale
            by INHERITING it — no arbitrary dimension (G.1.4). */}
        <span aria-hidden className="mr-2">
          👋
        </span>
        {/* NEEDS-COPY-NICOLE: Hi, {firstName} / Hi there */}
        {mounted && firstName?.trim() ? `Hi, ${firstName.trim()}` : "Hi there"}
      </p>

      <PageHeader
        className="shrink-0"
        // TODO-COPY. The route's name and the rail's label, one string.
        title="Today"
        purpose={
          /* ═══ TODO-COPY. IT SAYS WHERE TO GO, NOT HOW ANYBODY IS DOING ═══
             Says what is true and does not celebrate: an empty board is the
             resting state of this work rather than an achievement, and
             "Nothing needs attention right now" must not read as broken. */
          mounted && liveEscalations.length === 0 && cards.every((c) => c.tone === "clear")
            ? "Nothing needs attention right now"
            : "Every count below belongs to the destination it links to"
        }
      />

      {stateOf("escalations") === "loading" ? (
        <RegionSkeleton h={72} />
      ) : stateOf("escalations") === "error" ? (
        <RegionError
          /* TODO-COPY */
          line="Escalations couldn’t be loaded, so this page can’t say whether any are open."
          onRetry={() => setRetried((r) => ({ ...r, escalations: true }))}
        />
      ) : (
        <EscalationStrip records={liveEscalations} now={now} />
      )}

      {/* ═══ THE PERISHABLE LAYER SITS BELOW THE INTERRUPT AND ABOVE THE MAP ═══
          Order is the reader's priority: the strip is what cannot wait, the band
          is what will stop being actionable, and the cards are where the work
          is. Below the strip because an escalation outranks everything the band
          can carry — including, deliberately, the band's own
          `escalationTriggered` item: `interrupts()` reserves the assertive
          announcement for the region that owns the record, and the strip is that
          region's mirror here.
          IT RENDERS NOTHING WHILE THE GATE IS OFF. `bandStateFor` returns
          `"off"`, which `NowBand` treats as "do not render" rather than as an
          empty band — a band saying nothing is indistinguishable from a broken
          one, which is the same reasoning behind its three named silences. */}
      {mounted && (
        <NowBand
          state={bandState}
          items={data?.live ?? []}
          now={now}
          paused={livePaused || !!data?.paused}
          onTogglePause={() => setLivePaused((p) => !p)}
        />
      )}

      {/* ═══ THE COLUMN PAIR (Phase H.1) ═══
          THE INTERRUPT AND THE BAND STAY ABOVE IT, full width. Both are
          perishable layers addressed to the whole page, and narrowing them to
          857 to sit beside a reference rail would rank a schedule alongside an
          escalation.
          `items-start` SO THE RAIL DOES NOT STRETCH. A schedule is as tall as
          its blocks; a stretched aside would put its dividers against a column
          of empty surface.
          STACKED IS THE DEFAULT AND THE ROW IS THE OVERRIDE (H.1.4). Below the
          breakpoint the rail moves under the main column at full width, which
          is what a mobile-first default gives for free — and it means the
          320px case is the base rendering rather than a special one. */}
      <div className="flex shrink-0 flex-col gap-5 min-[1470px]:flex-row min-[1470px]:items-start min-[1470px]:gap-4">
        <div
          data-anno-ref="today-main"
          className="flex min-w-0 flex-col gap-5 min-[1470px]:w-[857px] min-[1470px]:shrink-0"
        >
      {/* ═══ THE CARDS COME FIRST (K.6) ═══
          The page opened with a tall module containing a list, and the three
          cards followed as a weaker afterthought. The Figma opens with a
          composed row of three, and this also restores what H.2 and F.6 already
          require: destinations are the primary orientation layer and the
          RECOMMENDATION sits beneath them. A recommendation above the thing it
          recommends is a page that argues before it reports. */}
      {stateOf("sequence") === "loading" ? (
        <RegionSkeleton h={308} />
      ) : stateOf("sequence") === "error" ? (
        <RegionError
          /* TODO-COPY */
          line="The destinations couldn’t be summarised, so this page can’t say what each one holds."
          onRetry={() => setRetried((r) => ({ ...r, sequence: true }))}
        />
      ) : (
        <section
          /* TODO-COPY */
          aria-label="Destinations"
          data-anno-ref="today-destinations"
          className="shrink-0"
        >
          {/* ═══ THREE ACROSS THE 857 COLUMN (Phase H.2) ═══
              `grid-cols-3` with `gap-4` on a container that is exactly 857
              yields exactly 275 per card — the grid computes H.1.1's own
              arithmetic rather than restating it, so the two cannot drift.
              THE SECTION LOST ITS SHARED SHELL. The rows were one bordered
              surface divided by hairlines; three cards each carry their own
              border, surface and elevation, so the wrapper is now layout only.
              STACKED BELOW THE BREAKPOINT, one card per row at full width.
              H.2.5's warning is live: a FOURTH destination breaks this grid,
              and the instruction is to revert to full-width stacked rows
              rather than invent a 4-up. `cards.length` is the thing to check
              the day Chat/Coverage resolves in. */}
          <ul className="grid grid-cols-1 gap-4 min-[1470px]:grid-cols-3">
            {cards.map((card) => (
              <DestinationCard
                key={card.id}
                card={card}
                directive={card.id === directiveCard}
                count={card.count}
              />
            ))}
          </ul>
        </section>
      )}

      {showDigest && (
        <section
          /* TODO-COPY */
          aria-label="Since your last shift"
          data-anno-ref="today-digest"
          className="shrink-0 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
              {/* TODO-COPY */}
              Since your last shift
            </p>
            <button
              type="button"
              onClick={() => dismissShiftDigest(now)}
              data-today-local="dismiss"
              /* TODO-COPY */
              aria-label="Dismiss the shift summary"
              className={cn(
                "-m-1 flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)]",
                "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {/* ═══ THE REASON, NOT THE LIST (Phase C.2) ═══
              One sentence saying why the CTA below points where it does. It
              cites a clock or a verified "oldest" — see `todayRationale`, which
              returns null rather than asserting a comparison it has not
              checked, and the banner then does not render at all.
              NO SECOND SET OF LINKS, which was already true and stays true: the
              destinations are three rows below with their own figures and their
              own hrefs. */}
          <p
            data-anno-ref="today-rationale"
            data-rationale-basis={rationale?.basis}
            className="mt-1 text-[13px] leading-[19px] text-[var(--text-secondary)]"
          >
            {rationale?.reason}
          </p>
          {/* ═══ THE PREVIEW, MERGED INTO THE BANNER (FORK I-2 = MERGED) ═══
              One module, one container, one CTA: heading, rationale, items,
              See all. The banner's own `Start with {label}` button is REMOVED
              as redundant — it and `See all` pointed at the same destination,
              which I.0 names as the thing not to build.
              WHAT THE REMOVED BUTTON ARGUED IS PRESERVED: it deliberately named
              no teen, because naming one meant a third count of the same work
              off a different source. The preview names teens, but it does so
              from the destination's OWN open set (`start-here.ts` reads the
              sets `open-counts.ts` exports), so there is still no third
              source — which is exactly the condition that objection set. */}
          {preview && (
            <StartHere preview={preview} now={now} />
          )}
        </section>
      )}

      {/* ═══ PINNED MENTEES — BELOW THE DESTINATIONS, ABOVE "Closed today" ═══
          F.6 asks for one and says which: it must not sit above the
          destination rows, because destinations remain the primary
          orientation. Above "Closed today" rather than below, because
          "Closed today" is a footnote about work that is FINISHED and the
          pinned set is about people who may still need something — putting a
          live section under a settled one buries it. */}
      {mounted && <PinnedMentees input={todayInput} />}

      {stateOf("closed") === "ready" && <ClosedToday facts={facts} />}
        </div>

        {/* ═══ THE SCHEDULE MOVES TO THE RAIL (Phase H.1, H.4) ═══
            PHASE D LEFT THIS BELOW THE WORK and said why: "the reference mock
            has it in a right rail; Today is a single column and introducing a
            second one is a layout change this phase did not ask for." H.1 asks
            for it, so the reasoning is now satisfied rather than overruled —
            the rail holds the schedule AND NOTHING ELSE (H.1.2), which is what
            keeps it a reference rather than a second place work appears.
            AND IT ANSWERS H.1.5. Below a long column a glance-all-shift
            reference is not glanceable; in the rail it is on screen at the
            default viewport, which the phase requires and the report measures.
            IT IS AN `aside`, not a `section`: complementary to the page's
            content rather than part of its sequence, which is exactly the
            relationship "reference, not work" describes. */}
        <aside
          data-anno-ref="today-rail"
          className="w-full min-[1470px]:w-[285px] min-[1470px]:shrink-0"
        >
          {mounted && <SuggestedSchedule now={now} />}
        </aside>
      </div>
    </div>
  );
}

/** ═══ THE RESIDUE OF COMPLETED EFFORT — QUIET, AND NOT A SCORE ═══
 *
 *  Today's closures per domain, each linking to the ledger that holds them. It
 *  is deliberately the last thing on the page and deliberately not emphasised:
 *  the moment a count of what somebody got through is given weight, this route
 *  starts measuring output, which is the surface it is specifically not.
 *
 *  THE ROUTINE TIER IS ABSENT, and that is `closedToday`'s own decision rather
 *  than an omission here — "closing a routine review is not an achievement worth
 *  a counter". */
function ClosedToday({ facts }: { facts: ReturnType<typeof shiftFactsFor> }) {
  const entries = Object.entries(facts.closedToday).filter(
    ([, n]) => (n ?? 0) > 0
  ) as Array<[TaskDomain, number]>;
  if (entries.length === 0) return null;

  return (
    <section
      /* ═══ THE LABEL NOW STATES THE SEMANTIC (Phase A.5) ═══
         "Closed today" sat directly under three open counts and said nothing
         about being a different quantity, so the page read as four rows of one
         measure. A.5: the values stay and the label carries the distinction.
         IN THE ACCESSIBLE NAME AS WELL AS ON SCREEN, because the visible line
         is a `<p>` rather than a heading — a screen-reader user reaching this
         region by landmark gets the qualification from the region's own name or
         not at all. */
      /* NEEDS-COPY-NICOLE: Closed today — not counted above */
      aria-label="Closed today — not counted above"
      data-anno-ref="today-closed-today"
      className="shrink-0"
    >
      <p className={SECTION_LABEL}>
        {/* NEEDS-COPY-NICOLE: Closed today — not counted above */}
        Closed today — not counted above
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([domain, n]) => (
          <li key={domain}>
            <Link
              /* THE LEDGER'S OWN VOCABULARY, mapped. Activity's domains are not
                 Tasks' — passing a Tasks domain string would silently match
                 nothing (gap row 208). `scope=mine` because this is the
                 supervisor's own closures.
                 NO DATE PARAM: the ledger has scope and domain axes and no
                 "today", so the link lands on the domain's full history rather
                 than on today's slice. Gap row 371. */
              href={`/app/activity?scope=mine&domain=${ACTIVITY_DOMAIN_OF[domain]}`}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-1 text-[13px] leading-[18px] text-[var(--text-secondary)]",
                "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <span aria-hidden className="tabular-nums">
                {n}
              </span>
              {DOMAIN_LABEL[domain].toLowerCase()}
              <span className="sr-only">{` closed today`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
