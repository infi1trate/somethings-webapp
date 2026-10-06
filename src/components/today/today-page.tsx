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
/* ═══ `X` AND `PageHeader` ARE RETIRED BY L.2 AND L.3, NOT DELETED ═══
   `X` was the withdrawn module's dismiss control; `PageHeader` was this
   route's title block before the greeting became the page title. Both stay
   imported and unmounted so the diff shows what left and why — the same
   convention `ctaCard` and `RecordContext` follow elsewhere. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AlertTriangle, ChevronDown, ChevronRight, ListChecks, Phone, RotateCcw, X } from "lucide-react";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { tasksScenario } from "@/lib/tasks/seed";
import { withClosures } from "@/lib/tasks/closed-review";
import {
  compareEscalations,
  isActive,
  type EscalationRecord,
} from "@/lib/monitoring/escalation";
import { monitoringData } from "@/lib/monitoring/scenarios";
import { NowBand } from "@/components/monitoring/now-band";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  COL_EQUAL,
  ReviewAgeCell,
  ReviewDisc,
  ReviewIdentityCell,
  ReviewCycleCell,
  ReviewRowHeader,
} from "@/components/tasks/review-row";
import { NAV } from "@/components/settings/nav-items";
import type { DestinationId } from "@/lib/ia/destinations";
import type { LucideIcon } from "lucide-react";
import { greetingFor } from "@/lib/home/greeting";

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
/* RETIRED BY L.6, unmounted rather than deleted — see the note at its old call
   site for why the standing constraint on the global interrupt layer does not
   cover it. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          "border bg-[var(--surface-card)] px-4 py-3",
          card.tone !== "breach" && "border-[color:var(--border-contour)]",
          /* ═══ THE ESCALATION STATE LIVES HERE NOW (L.6) ═══
             An outline plus a red-retinted elevation, replacing the full-width
             bars this page used to open with.
             THE TWO TOKENS L.6 NAMES DO NOT EXIST UNDER THOSE NAMES. There is
             no `border/border-error` and no `stateLayers/error/Opacity-10` in
             this build. What DOES exist is `--state-error` (#cc3300, 4.73:1)
             and `--shadow-alert`, which is already Bloom's card elevation
             retinted red — `0 1px 2px rgb(201 53 29 / 0.05), 0 12px 32px -14px
             rgb(201 53 29 / 0.22)`. That is exactly what L.6 describes, so
             nothing is authored and nothing is approximated. Reported.
             COLOUR IS NOT THE SOLE CARRIER: the card's count and its second
             line state the condition in words — "2 active · 3 close-out items
             overdue" — which is what closes the item open since H.3.5. */
          /* ═══ M.7 IS UNBLOCKED, AND THE TOP EDGE IS THE PART THAT WAS
                 MISSING ═══
             M.7 reported this blocked because the frame it linked was in the
             all-clear state, so the red treatment could not be read and L.6's
             two tokens were inferred from a token search. THE TWO-ESCALATION
             STATE IS IN `4081:26107` — node `4081:23462` — and it reads:

               border-t-3, border-b/l/r 1px, colour `button/error` #f93b51
               drop-shadow 0px 9px 9.45px rgba(249,59,81,0.1)
               radius 16

             THE HEAVIER TOP EDGE IS BUILT EXACTLY. `border-t-[3px]` against
             the 1px the other three sides inherit — which is the one thing
             M.7 named that could not be guessed, and it is now measured
             rather than described.
             THE COLOUR AND THE SHADOW STAY IN-SYSTEM, AND THAT IS REPORTED
             RATHER THAN QUIETLY DECIDED. `button/error` #f93b51 has no
             counterpart in this build: Bloom here ships `--state-error`
             #cc3300 (4.73:1), and #f93b51 resolves to one of the four
             non-Bloom libraries the reference file binds. Taking it would mean
             a raw hex in a component and a SECOND red in the system, both of
             which the standing constraints forbid — so the outline is
             `--state-error`.
             THE SHADOW GEOMETRY ALSO DIVERGES, measured: the node's escalation
             shadow is offset 9 / radius 9.45 while its ordinary card is offset
             6 / radius 4.7 — so it is NOT "Elevation/2 retinted with offset and
             radius unchanged" as L.6 and M.7 both describe; it is a larger
             shadow as well as a red one. `--shadow-alert` is this build's
             red-tinted card elevation and is what ships. Both divergences are
             in the report. */
          card.tone === "breach"
            ? "border-t-[3px] border-[color:var(--state-error)] shadow-[var(--shadow-alert)]"
            : "shadow-[var(--shadow-card)]",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* ═══ ONE ROW, VERTICALLY CENTRED (M.4.1, read from 4081:26107) ═══
            IT WAS TWO ROWS — icon + count + label, then state line + chevron —
            which is why M.4.1 reports the caret "sits low": it was pinned to
            the bottom row rather than centred in the 80px card.
            THE NODE'S ANATOMY IS ONE ROW: `items-center` over [icon 24, a
            column of headline + second line, chevron 24]. That centres the
            caret by construction rather than by a nudge, and it is also what
            L.5.1 describes — count and label on one line, the fact beneath.
            So M.4.1 and L.5 are the same structure, and the build had drifted
            from both. */}
        {/* ═══ ONE ROW, VERTICALLY CENTRED (M.4.1, read from 4081:26107) ═══
            IT WAS TWO ROWS — icon + count + label, then state line + chevron —
            which is why M.4.1 reports the caret "sits low": it was pinned to
            the bottom row rather than centred in the 80px card.
            THE NODE'S ANATOMY IS ONE ROW: `items-center` over [icon 24, a
            column of headline + second line, chevron 24], with the node's own
            `gap/m` of 16 between them. That centres the caret by construction
            rather than by a nudge, and it is also what L.5.1 describes — count
            and label on one line, the fact beneath — so M.4.1 and L.5 want the
            same structure and the build had drifted from both. */}
        <span className="flex min-w-0 flex-1 items-center gap-4">
          {/* ═══ THE ICON IS 24px AND PRIMARY INK (L.5.2) ═══
              It was `size-4` at `--text-secondary` — L.5 measures 24×24 and
              calls the build's "undersized and too light", which the
              measurement bears out. The nav's own glyph, read from `NAV`.
              CONFIRMED AT 24 in the node (M.4.2), which is why it is unchanged
              here while the trailing chevron moved. */}
          <Icon aria-hidden className="size-6 shrink-0 text-[var(--text-primary)]" />

          {/* THE TEXT COLUMN — headline, then the decision-relevant fact. */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              {/* ═══ THE COUNT PRECEDES THE LABEL (L.5.1) ═══
                  K.4.3 PUT IT AFTER, to make the three cards share a structure
                  when one of them had no numeral. L.5.1 measures the reference
                  as "2 Escalations" and reverses that.
                  THE STRUCTURAL PROBLEM K.4.3 WAS SOLVING IS REAL AND IS SOLVED
                  DIFFERENTLY: L.5.5 requires the label in the SAME POSITION in
                  both states, so the numeral slot is reserved at a fixed width
                  and renders empty on a zero card rather than collapsing and
                  shifting the label left.
                  `aria-hidden`: the state line says the number in words and the
                  `sr-only` sentence speaks it once, in order. */}
              <span
                aria-hidden
                className="flex shrink-0 justify-end text-[20px] leading-[28px] tabular-nums text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-mono)", width: 22 }}
              >
                {count != null && count > 0 ? count : ""}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-[14px] leading-[20px] text-[var(--text-primary)]",
                  /* ═══ THE TITLE IS BOLD (L.5.3), AND THE NODE SAYS REGULAR ═══
                     MEASURED, `4081:26107` renders this headline in the text
                     family at 400 — `Body/Large-Regular/Web`, 16/24. M.4.3
                     restates L.5.3's "bold title" and the pack wins over the
                     reference by its own rule, so bold it is; reported as a
                     divergence rather than silently taking either side.
                     `font-display` IS THE CHANNEL THAT CAN CARRY IT. Avantt
                     ships Bold only, so this is a real weight step; a
                     `font-bold` on Lausanne would be a declaration with nothing
                     behind it, which is the same measured fact the sub-header
                     note records. */
                  "font-display"
                )}
              >
                {card.label}
              </span>
            </span>
            <span
              className={cn(
                "min-w-0 truncate text-[12px] leading-[16px]",
                TONE_TEXT[card.tone]
              )}
            >
              {card.tone === "breach" && (
                <AlertTriangle className="mr-1 inline size-3 shrink-0 align-[-2px]" aria-hidden />
              )}
              {card.state}
            </span>
          </span>

          {/* ═══ 24px, AND IT WAS 16 (M.4.2, read from the node) ═══
              `4081:26107` renders the trailing chevron at 24×24, the same size
              as the leading glyph. It was `size-4`. */}
          <ChevronRight
            aria-hidden
            className="size-6 shrink-0 text-[var(--text-muted)]"
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

/** The table's disc size, matching `ROW_GEOMETRY.comfortable.disc` on the
 *  destination. Stated here rather than imported, because importing the
 *  worklist's preset table would tie Today's rows to a view control Today does
 *  not have. */
const PREVIEW_DISC = 36;

/** ═══ THE TASKS SECTION (Phase L.3, L.4) ═══
 *
 *  ═══ WHAT IT REPLACED ═══
 *
 *  A "Since your last shift" card holding a generated rationale sentence, a
 *  bounded preview and a "Showing 4 of 16" footer, all dismissable. Phase C is
 *  withdrawn, FORK I-2 resolved to "no module", and the container went with
 *  them. The PREVIEW survives — it was always the useful half — and it is now
 *  a labelled section rather than a recommendation.
 *
 *  ═══ THE LINE IT STILL WALKS (the mirror rule) ═══
 *
 *  Today may show a supervisor what is waiting; it may not let them act on it.
 *  Every row is a `Link` and nothing else, the only other controls are `See
 *  all` and the collapse chevron, and neither touches a record.
 *
 *  ═══ I.3's SAFETY CLAIM, RELOCATED NOT DROPPED ═══
 *
 *  A supervisor who clears four items and sees an empty table must not be able
 *  to conclude the queue is empty. L.3 removes the "Showing 4 of 16" FOOTER and
 *  puts the count in the sub-header as a badge — so the total is still on
 *  screen, beside the thing it counts, and `See all` still renders whenever
 *  anything is open beyond the shown set. The disclosure moved; it did not go.
 */
function TasksSection({
  preview,
  now,
}: {
  preview: StartHerePreview;
  now: number;
}) {
  /* ═══ COLLAPSE IS LOCAL AND UNPERSISTED ═══
     L.3 measures a chevron and does not say it persists. A dismissal that
     outlived the visit was the withdrawn module's behaviour, and this is a
     disclosure control rather than a dismissal — so it resets on navigation,
     and no store write happens on this route beyond the visit stamp. */
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = "today-tasks-body";
  const more = preview.total > preview.items.length;

  return (
    <section data-anno-ref="today-tasks" aria-label="Tasks" className="shrink-0">
      {/* ═══ THE SECTION HEADER — 24px ICON, REQUIRED (L.5, reversed #5) ═══
          Superseded #5 banned decorative glyphs on section headers and L
          reverses it: these are SECTION IDENTIFIERS, not decoration, and the
          one-glyph-per-page rule was this pack's own invention. The emoji tile
          in the hero remains the page's single DECORATIVE glyph; this is a
          functional icon, which is the distinction the reversal draws. */}
      <div className="flex items-start gap-2">
        <ListChecks
          aria-hidden
          className="mt-1 size-6 shrink-0 text-[var(--text-primary)]"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
            {/* NEEDS-COPY-NICOLE */}
            Tasks
          </h2>
          <p className="text-[16px] leading-[20px] text-[var(--text-secondary)]">
            {/* NEEDS-COPY-NICOLE */}
            Reviews waiting on your decision
          </p>
        </div>
      </div>

      {/* ═══ THE SUB-HEADER CARRIES THE COUNT, THE CTA AND THE CHEVRON (L.3) ═══
          All three top-right of the sub-header rather than bottom-right of the
          table, which is where the withdrawn footer put them. */}
      <div className="mt-4 flex items-center gap-2">
        {/* ═══ 16/20, AND IT WAS AVANTT BOLD 20/24 (M.3.1) ═══
            The reference has this at 20 against "Tasks" at 24 — a 1.2 ratio,
            below the 1.25–1.5 range where two levels read as distinct. 24 → 16
            is 1.5. A DELIBERATE DEVIATION FROM THE REFERENCE, on instruction.
            `Label/Large-Bold/Web` NAMES A WEIGHT THAT CANNOT RENDER, and that
            is fine here for a reason worth stating rather than working around:
            TWK Lausanne ships the 400 face only in this build and measures
            identically at 400/500/600/700, so `font-bold` on it would be a
            declaration with nothing behind it. M.3.1's own justification is the
            SIZE RATIO, not the weight — so the level reads as distinct on the
            channel the instruction actually argues from, and the inert one is
            left off instead of being faked with Avantt at 16. Reported.
            `font-sans` IS NOT REDUNDANT: `globals.css` applies `font-display`
            to every `h3`, so dropping the utility left this at Avantt 16 —
            measured. The override is what puts it in the text family M.3.1
            actually names. */}
        <h3 className="font-sans text-[16px] leading-[20px] text-[var(--text-primary)]">
          {/* NEEDS-COPY-NICOLE */}
          Care reviews
        </h3>
        {/* ═══ THE COUNT AS A BADGE (L.3.1) ═══
            THE TOTAL, NOT THE SHOWN COUNT — it is the destination card's own
            figure, which keeps I.3.4 true: the table is never the only place a
            total appears, and the two cannot disagree because both read
            `openCounts`. `aria-hidden` because the `See all` label states it in
            words for a screen reader. */}
        <span
          aria-hidden
          data-anno-ref="today-tasks-count"
          className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[10px] leading-none tabular-nums text-[var(--text-primary)]"
        >
          {preview.total}
        </span>
        <span className="flex-1" />
        {/* ═══ `See all` IS REQUIRED WHENEVER ANYTHING IS BEYOND THE SHOWN SET
            (I.3.2) — and it states the total in words, which is what carries
            the disclosure to a screen reader now the footer is gone. */}
        {more && (
          <Link
            href={preview.href}
            data-anno-ref="start-here-see-all"
            className={cn(
              "inline-flex h-8 w-[120px] shrink-0 items-center justify-center rounded-full",
              "bg-[var(--text-primary)] text-[13px] font-semibold text-[var(--text-inverse)]",
              "transition-opacity hover:opacity-90",
              RING
            )}
          >
            {/* NEEDS-COPY-NICOLE: See all {n} */}
            See all {preview.total}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          /* ═══ DECLARED AS PAGE CHROME (today-mirror's gate) ═══
             The mirror rule allows Today its own local chrome and forbids any
             control that could act on WORK. A disclosure toggle acts on this
             page's own presentation and touches no record — the same class as
             the dismissal it replaces. Undeclared, `controls.all-named` fails
             with UNDECLARED, which is the gate working. */
          data-today-local="collapse-care-reviews"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          /* NEEDS-COPY-NICOLE, both. The name states the ACTION and names what
             it acts on, so it is unambiguous read out of context. */
          aria-label={collapsed ? "Expand care reviews" : "Collapse care reviews"}
          className={cn(
            /* 24px glyph in a 44px target — L.3 measures the icon and 2.5.8
               governs the hit area, so the box is larger than the mark. */
            "flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)]",
            "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn("size-6 transition-transform", collapsed && "-rotate-90")}
          />
        </button>
      </div>

      {/* ═══ THE TABLE (L.4) ═══
          Header 40 tall, body rows 64, three equal 285px columns. The FIELDS
          are the destination's own — same components from `review-row.tsx`,
          same order, same treatment — and only the column widths differ, by
          L.4's instruction. That divergence is reported rather than absorbed;
          see `COL_EQUAL`. */}
      <div id={bodyId} hidden={collapsed} className="mt-2">
        {/* ═══ THREE EQUAL 285s FILLING THE 857 COLUMN (L.4) ═══
            NO ROW PADDING, deliberately: 285 × 3 = 855 and the main column is
            857, so a `px-6` on the row put the cells 48px over their container
            and the last column ran past the edge — measured at 879 against an
            809 content box. L.4's own numbers only close with the inset INSIDE
            each cell, which is also what its "chip at x=16 within its cell"
            measurement describes.
            THE MENTEE COLUMN IS 285 INCLUDING ITS AVATAR — disc 36 + gap 12 +
            237 of text — so the three columns are equal as measured from their
            own left edges. */}
        {/* ═══ ONE BORDERED CONTAINER, RADIUS 16, CLIPPING (M.5) ═══
            IT WAS THREE PIECES: the header carried `rounded-t` and its own
            bottom hairline, the list carried `border-x border-b` and
            `rounded-b`, and nothing carried a top or side border ACROSS the
            header — so the table read as square and open at the top.
            READ FROM THE NODE, not inferred: `4345:6175` is a single
            `border border-[button/border/subtle #cbc6be] rounded-[16px]
            overflow-clip` container holding the header and the rows flush, and
            the metadata's 1px inset on every child is that border rather than
            padding. `--radius-inset` is this build's 16 and
            `--border-subtle` is its #dfddd8 hairline — the existing tokens,
            so nothing is authored.
            THE CLIP IS WHAT MAKES THE RADIUS VISIBLE: without `overflow-hidden`
            the header's own fill squares off the top two corners from inside,
            which is what it was doing. */}
        <div className="overflow-hidden rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)]">
        <ReviewRowHeader
          disc={PREVIEW_DISC}
          equalWidth={COL_EQUAL}
          presentationWidth={COL_EQUAL}
          ageWidth={COL_EQUAL}
          className="h-10 px-0 py-0"
        />
        <ul
          data-anno-ref="start-here-items"
        >
          {preview.items.map((it, i) => (
            <li key={it.id}>
              <Link
                href={it.href}
                data-anno-ref="start-here-item"
                className={cn(
                  /* 64px per L.4, comfortably over 2.5.8's floor. */
                  /* NO INTER-COLUMN GAP — each column owns its inset, so the
                     three 285s fill the 857 exactly. See `ReviewRowHeader`. */
                  "flex h-16 w-full items-center transition-colors",
                  "hover:bg-[var(--tint-hover)]",
                  i > 0 && "border-t border-[color:var(--border-subtle)]",
                  RING
                )}
              >
                {/* THE MENTEE COLUMN IS 285 INCLUDING ITS AVATAR, so the three
                    columns measure equal from their own left edges. */}
                <span
                  className="flex shrink-0 items-center gap-3"
                  style={{ width: COL_EQUAL }}
                >
                  <ReviewDisc teenId={it.teenId} name={it.name} size={PREVIEW_DISC} />
                  {/* §5's renew glyph, from the flag `start-here.ts` derives
                      with the same expression the caption came from. */}
                  <ReviewIdentityCell
                    name={it.name}
                    caption={it.status ?? ""}
                    captionIcon={it.captionIcon}
                  />
                </span>
                {/* ═══ THE CYCLE, NOT THE CODES (rework §6.1, §6.3) ═══
                    K.1 put codes here and the Care Reviews rework takes them
                    off BOTH lists — they live only in the detail pane now.
                    THIS FOLLOWS FROM K.1 RATHER THAN OVERRIDING IT: the two
                    surfaces share this cell precisely so the same object
                    cannot be identified two ways, so a Today preview showing
                    codes its own destination no longer shows would be that
                    defect. The column stays; its content changed. */}
                <ReviewCycleCell taskType={it.taskType} width={COL_EQUAL} />
                <ReviewAgeCell at={it.at} now={now} width={COL_EQUAL} />
              </Link>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </section>
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
  /* RETIRED WITH PHASE C (L.3). The store field and its migration stay — a
     dismissal stamp already written to a supervisor's store is not worth a
     migration to remove — and nothing reads or writes it on this route now. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  /* CLOSED REVIEWS ARE NOT OPEN — the same rule the rail badge and Care
     Reviews run, so Today's card cannot say 16 beside a list of 9 (§0.3). */
  const closedCare = useOnboardingStore((s) => s.closedCareReviews);
  const items = useMemo(
    () => (mounted ? withClosures(tasksScenario(tasksScenarioId, mountedAt), closedCare) : []),
    [mounted, tasksScenarioId, mountedAt, closedCare]
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
  /* ═══ ALWAYS CARE REVIEWS — FORK I-1 RESOLVED (L.3) ═══
     It read `rationale?.id`, so the section's TYPE followed whichever
     destination the rationale named. L.3 resolves the fork to Care Reviews
     only, and that is what removes the defect it names: escalation rows
     rendered inside the care-review table with an empty Presentation column,
     because escalations have no codes.
     `rationale` IS RETIRED, NOT DELETED — Phase C is withdrawn, so nothing
     reads it, and it stays because `todayRationale` is still the expression
     that would answer "where should I start" if that question returns. */
  const tasksPreview = useMemo(
    () => startHerePreview("care-reviews", todayInput),
    [todayInput]
  );
  /* RETIRED WITH PHASE C (L.3): the gate for a container that no longer
     exists. Kept because it is the one expression that encodes "is this a new
     shift for this reader", which the Tasks section may yet want. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const showDigest =
    /* RATIONALE-OR-NOTHING (C.3). The last clause was `digestLine != null`,
       which is true whenever anything at all needs attention — so the banner
       rendered generic copy in every non-empty state. It now requires a derived
       rationale, and `todayRationale` returns null rather than inventing one. */
    mounted && !dismissed && isNewShift(wasNewShift, now) && rationale != null;

  return (
    /* ═══ THE GRADIENT IS FULL-BLEED NOW (Phase L.1.1) ═══
       IT WAS ON THE `max-w-[1222px] mx-auto` COLUMN, so it stopped where the
       column stopped — 239px short of the content area's edge at 1900, which
       L.1.1 calls "a misaligned panel rather than atmosphere". Measured, and
       it is right.
       SO THE SCROLLER IS FULL WIDTH and carries the wash, and the max-width
       moves to an inner column. That is G.4/G.2's option (a) — atmosphere
       spanning the content area, grouping nothing — which L.1.1 notes was
       specified and not built.
       IT STILL DEPENDS ON NO PROPS. Nothing about it varies with data, state,
       priority, recency or urgency. */
    <div
      data-anno-ref="today-page"
      style={{
        backgroundImage: "var(--gradient-header)",
        backgroundRepeat: "no-repeat",
        /* ═══ 420px, AND IT WAS 220 (M.6) ═══
           "Extend the falloff further down the page so it reads as atmosphere
           rather than a band with an edge." The height is the half of M.6 that
           does the work: the stop softened by one step in the token file, and
           nearly doubling the painted height is what removes the horizon. Set
           here rather than in the token because it is a property of THIS
           surface's composition, not of the gradient. */
        backgroundSize: "100% 420px",
      }}
      className="h-full min-h-0 w-full overflow-y-auto"
    >
      <div
        data-anno-ref="today-column"
        className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-6 py-6 min-[1470px]:max-w-[1222px] lg:px-8"
      >
      {/* ═══ ONE HERO, NOT THREE TIERS (Phase L.2) ═══
          IT WAS a small "Hi there", a large "Today", and a subtitle. L.2's
          reading is that this is one tier too many and creates competing
          regions — and it is right: "Today" repeated the route name and the
          rail label, and the greeting above it was too small to be the thing
          the eye landed on.
          SO THE GREETING IS THE PAGE TITLE. The separate heading is gone and
          `PageHeader` is no longer mounted here, which means this route stops
          sharing §2.10's header component — stated plainly because that is a
          real IA divergence, not a detail. L.2 overrides §2.10 for this
          surface: every other destination still renders the shared header.
          MEASURED TO THE REFERENCE: 51×51 tile at x=0, 10px gap so the text
          starts at x=61, greeting at Avantt Bold 32/40 with −1 tracking,
          subtitle directly beneath at 16/20. */}
      <header data-anno-ref="today-hero" className="flex shrink-0 items-start gap-[10px]">
        {/* ═══ THE EMOJI IS A TILE, NOT AN INLINE GLYPH (L.2.1) ═══
            "The tile is most of what makes the hero read as designed." It was
            an inline glyph at body size, inheriting the type scale — which G.1.4
            asked for and L.2 overrides with a measured dimension.
            `aria-hidden` STILL, and that is unchanged and load-bearing: emoji
            rendering varies across platforms and fonts, so the glyph can never
            be the sole carrier of anything. The greeting text carries all of
            it, and the heading's accessible name below contains no glyph. */}
        <span
          aria-hidden
          data-anno-ref="today-hero-tile"
          className="flex size-[51px] shrink-0 items-center justify-center rounded-[var(--radius-inset)] bg-[var(--surface-s1)]"
        >
          <span className="text-[32px] leading-[40px]">👋</span>
        </span>
        <span className="min-w-0 flex-1">
          <h1
            data-anno-ref="today-greeting"
            className="font-display text-[32px] font-bold leading-[40px] tracking-[-1px] text-[var(--text-primary)]"
          >
            {/* NEEDS-COPY-NICOLE: {Good morning|Good afternoon|Good evening|Working late}, {firstName}
                COMPUTED FROM REAL TIME (G.1 option a, made binding by L.2).
                `mounted` gates it because the greeting reads a clock and the
                store's first name, and both are client-only — rendering a
                server guess and correcting it is a visible flash on the
                largest element on the page. */}
            {mounted ? greetingFor(now, firstName) : ""}
          </h1>
          {/* NO DATE LINE (L.2.4, G.1.5). */}
          <p
            data-anno-ref="page-purpose"
            /* 16/20 text in a 24 block — L.2 measures the subtitle's block at
               24 and the hero total at 64 (greeting 40 + subtitle 24). */
            className="flex h-6 items-center text-[16px] leading-[20px] text-[var(--text-secondary)]"
          >
            {/* ═══ TODO-COPY. IT SAYS WHERE TO GO, NOT HOW ANYBODY IS DOING ═══
                Says what is true and does not celebrate: an empty board is the
                resting state of this work rather than an achievement, and
                "Nothing needs attention right now" must not read as broken. */}
            {mounted && liveEscalations.length === 0 && cards.every((c) => c.tone === "clear")
              ? "Nothing needs attention right now"
              : "Every count below belongs to the destination it links to"}
          </p>
        </span>
      </header>

      {/* ═══ THE FULL-WIDTH RED BARS ARE GONE (Phase L.6) ═══
          WHAT WAS HERE: `EscalationStrip`, one saturated red bar per live
          escalation, each naming a teen and carrying an "Open escalation"
          link, with a loading and an error state around it.
          L.6 REMOVES THEM: they are inverted sections, which this pack's own
          standing constraints already prohibited, and they are not the
          escalation treatment. The state is expressed on the Escalations
          summary card instead — see `DestinationCard`.
          ═══ THE STANDING CONSTRAINT THIS DOES NOT BREACH ═══
          "Global escalation interrupt layer persists on this route as on every
          supervisor route. Do not modify it." CHECKED BEFORE REMOVING:
          `EscalationStrip` is declared in this file and mounted in this file
          only — one consumer, page-local, no shell-level counterpart on any
          other route. It is Today's MIRROR of the escalations region, which is
          what its own module note calls it. The global layer is not this.
          ═══ WHAT IS LOST, STATED ═══
          A supervisor on Today no longer sees WHICH teens have live
          escalations, or reaches one in a click from here. That is a real
          reduction and L.6 accepts it — the card states the condition in text
          and the destination holds the records. Flagged rather than absorbed.
          THE COMPONENT STAYS, unmounted, for the same reason every other
          retired piece does. */}

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

      {/* ═══ THE TASKS SECTION REPLACES THE START-HERE MODULE (Phase L.3) ═══
          PHASE C IS WITHDRAWN AND SO IS THE CONTAINER IT LIVED IN. Gone: the
          "Since your last shift" card, the generated rationale sentence, the
          dismiss control, and the "Showing 4 of 16" footer. L.3's reading is
          that they read as filler in the build, and the reference has a
          labelled Tasks section with none of them.
          WHAT THE RATIONALE WAS FOR IS NOT REPLACED, and that is the point: it
          told a supervisor WHERE TO START, which the destination cards above
          now do by position. A sentence asserting which queue holds the oldest
          work was this pack's invention.
          FORK I-1 IS RESOLVED TO `always Care Reviews`. The section never
          switches type — which is what removes the defect L.3 names: the
          previous build rendered escalation rows inside the care-review table
          with an empty Presentation column, because the type followed a
          rationale that could name any destination. */}
      {/* ═══ 40px ABOVE THIS SECTION, NOT THE COLUMN'S 20 (M.3.2) ═══
          MEASURED from the reference: the cards occupy y=24–104 and the Tasks
          frame begins at y=144, so the gap is exactly 40. The column's
          `gap-5` is 20, and M.3.2 reports the build at "roughly half" — which
          it was, to the pixel.
          `mt-5` ON TOP OF THE COLUMN GAP rather than a per-child gap override:
          20 + 20 = 40, and it leaves every other gap in the column alone. A
          `gap-10` on the column would have moved all four. */}
      {mounted && tasksPreview && (
        <div className="mt-5 shrink-0">
          <TasksSection preview={tasksPreview} now={now} />
        </div>
      )}

      {/* ═══ PINNED MENTEES — BELOW THE DESTINATIONS, ABOVE "Closed today" ═══
          F.6 asks for one and says which: it must not sit above the
          destination rows, because destinations remain the primary
          orientation. Above "Closed today" rather than below, because
          "Closed today" is a footnote about work that is FINISHED and the
          pinned set is about people who may still need something — putting a
          live section under a settled one buries it. */}
      {mounted && <PinnedMentees input={todayInput} />}

      {/* ═══ "Closed today" IS GONE (M.2.2) ═══
          A.5 kept the values and made the label carry the semantic — "not
          counted above" — because three open counts with a fourth quantity
          under them read as four rows of one measure. M.2.2 removes the
          section instead, and the removal is the stronger answer to the same
          problem: closed items belong to the destinations that own them, and a
          count of what a supervisor got through is the one thing this route is
          specifically not for. Its own note said so ("the moment a count of
          what somebody got through is given weight, this route starts
          measuring output").
          THE COMPONENT STAYS, unmounted — the strangler rule — because the
          `ACTIVITY_DOMAIN_OF` mapping and the no-date-param gap (row 371) are
          recorded in it and are the only place they are. */}
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
/* ═══ UNMOUNTED BY M.2.2 (strangler rule) ═══
   Not deleted: it holds the Tasks-domain → Activity-domain mapping and the
   record of gap row 371 (the ledger has no "today" axis, so its links land on
   a domain's full history). Both are findings, and a finding with no code
   attached to it is one the next reader re-derives. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
