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
  todayCards,
  todayDigestLine,
  type CardTone,
  type TodayCard,
} from "@/lib/home/today";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

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
  return (
    <li>
      <Link
        href={card.href}
        data-anno-ref={`today-card:${card.id}`}
        data-tone={card.tone}
        data-directive={directive ? "true" : undefined}
        className={cn(
          /* 44px minimum via the padding, and the whole row is the target. */
          "flex min-h-[60px] w-full items-center gap-3 px-4 py-3 transition-colors",
          "hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* THE DIRECTIVE MARKER. `aria-hidden` because the accessible name below
            carries the same fact in words — a screen-reader user hears "start
            here" rather than being told about a dot. */}
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            directive
              ? "bg-[var(--text-primary)]"
              : "border border-[color:var(--border-contour)]"
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[14px] leading-[20px] text-[var(--text-primary)]",
              directive && "font-display font-bold"
            )}
          >
            {card.label}
          </span>
          <span
            className={cn(
              "block truncate text-[12px] leading-[16px]",
              TONE_TEXT[card.tone]
            )}
          >
            {card.tone === "breach" && (
              <AlertTriangle className="mr-1 inline size-3 shrink-0 align-[-2px]" aria-hidden />
            )}
            {card.state}
          </span>
        </span>
        {/* THE FIGURE, WHERE THERE IS ONE. `aria-hidden`: the state sentence
            above already contains the number, and announcing "16" a second time
            after "16 open · 2 overdue" is the row saying one fact twice. */}
        {count != null && count > 0 && (
          <span
            aria-hidden
            className="shrink-0 text-[14px] tabular-nums text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {count}
          </span>
        )}
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-[var(--text-muted)]"
        />
        {/* THE WHOLE SENTENCE, ONCE, IN ORDER. TODO-COPY on "Start here". */}
        <span className="sr-only">
          {`${card.label}. ${card.state}.${directive ? " Start here." : ""}`}
        </span>
      </Link>
    </li>
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
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const monitoringScenarioId = useOnboardingStore((s) => s.monitoringScenarioId);
  const shiftLastSeenAt = useOnboardingStore((s) => s.shiftLastSeenAt);
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
  const [dismissed, setDismissed] = useState(false);

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
  const now = data?.clockOverride ?? mountedAt;

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

  /** THE FIVE CARDS. Every figure inside is the owning destination's — see
   *  `lib/home/today.ts`. */
  const cards = useMemo(
    () =>
      todayCards({
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

  const digestLine = useMemo(() => todayDigestLine(cards), [cards]);
  const ctaCard = cards.find((c) => c.id === directiveCard) ?? null;
  const showDigest =
    mounted && !dismissed && isNewShift(wasNewShift, now) && digestLine != null;

  return (
    <div
      data-anno-ref="today-page"
      className="mx-auto flex h-full min-h-0 w-full max-w-[860px] flex-col gap-5 overflow-y-auto px-6 py-6 lg:px-8"
    >
      <div data-anno-ref="today-header" className="shrink-0">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          {/* TODO-COPY. The route's name and the rail's label, one string. */}
          Today
        </h1>
        <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {/* ═══ TODO-COPY. IT SAYS WHERE TO GO, NOT HOW ANYBODY IS DOING ═══
              Says what is true and does not celebrate: an empty board is the
              resting state of this work rather than an achievement, and
              "Nothing needs attention right now" must not read as broken. */}
          {mounted && liveEscalations.length === 0 && cards.every((c) => c.tone === "clear")
            ? "Nothing needs attention right now"
            : "Every count below belongs to the destination it links to"}
        </p>
      </div>

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
              onClick={() => setDismissed(true)}
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
          {/* ═══ NAMES, NOT COUNTS, AND NOT A SECOND SET OF LINKS ═══
              The destinations it names are five rows below with their own
              figures and their own links. A chip row here would be the cards
              again — and the counts it used to carry came from a source that
              disagreed with them. Breach-first survives: the sentence names
              breaching destinations first. */}
          <p
            data-anno-ref="today-digest-line"
            className="mt-1 text-[13px] leading-[19px] text-[var(--text-secondary)]"
          >
            {digestLine}
          </p>
          {ctaCard && (
            /* ONE PRIMARY CTA, TARGETING THE LADDER'S HEAD. The item it names is
               the comparator's answer — see `ladderTargetFor` — so the digest
               cannot point somewhere the destination's own list would not have
               put first. */
            <Link
              href={ctaCard.href}
              className={cn(
                "mt-3 inline-flex min-h-11 items-center rounded-full bg-[var(--text-primary)] px-4 text-[13px] font-semibold text-[var(--text-inverse)]",
                "transition-opacity hover:opacity-90",
                RING
              )}
            >
              {/* TODO-COPY. The CTA names where it GOES, not what it does —
                  "Resolve" would be a promise this route cannot keep. */}
              {/* ═══ NO NAMED TEEN, AND THAT IS A SOURCE REMOVED ═══
                  It read "Start with escalations — Simone first", from
                  `ladderTargetFor(items)` — a THIRD count of the same work, off
                  task items, which named a teen the destination did not have
                  under the degraded fixture. The destination's own comparator
                  already puts the right item first, so the name here was a
                  promise this route had to duplicate data to keep. */}
              Start with {ctaCard.label}
            </Link>
          )}
        </section>
      )}

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
          className="shrink-0 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
        >
          <ul className="divide-y divide-[color:var(--border-subtle)]">
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

      {stateOf("closed") === "ready" && <ClosedToday facts={facts} />}
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
      /* TODO-COPY */
      aria-label="Closed today"
      data-anno-ref="today-closed-today"
      className="shrink-0"
    >
      <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
        {/* TODO-COPY */}
        Closed today
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
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
