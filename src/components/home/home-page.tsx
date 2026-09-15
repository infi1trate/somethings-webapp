"use client";

// ═══════════════════════════════════════════════════════════════════════════
// HOME — the supervisor's shift. Supervisor tier only.
//
// ═══ THE PRD'S PRIMARY GOAL, WHICH HAS NEVER BEEN BUILT ═══
//
// "Restructure the home screens for supervisors… so they're personal and
// task-oriented, rather than centered on general platform health." Until this,
// a supervisor's Home was the shared unbuilt-section placeholder — "Nothing here
// yet" — inside a nav landmark labelled "Mentor navigation". There were no
// platform-health aggregates to move away from because there was nothing at all.
//
// ═══ HOME NEVER HOSTS WORK, AND THAT IS A HARD BOUNDARY ═══
//
// No item lists, no detail panes, no resolve actions, no queues. Every count is
// a LINK to the surface that owns it. If a supervisor can complete a task
// without leaving Home, the boundary has been violated and the surfaces have
// started to duplicate.
//
// The test is simple and worth applying to anything added here: could this
// element change the state of a task? If yes, it belongs on Tasks or Monitoring.
//
// ═══ WHAT IS DELIBERATELY ABSENT ═══
//
// No trend, no streak, no coverage-over-time, nothing comparative across
// supervisors, no platform-health aggregate. A chart of whether somebody kept
// pace is a performance surface, and the punitive dimension of this role is a
// known sensitivity. Today's position and recency only.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Phone, RotateCcw, X } from "lucide-react";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { isEscalationTask, lifecycleOf } from "@/lib/tasks/escalation-state";
import { sortedOpen } from "@/lib/tasks/sort";
import { tasksScenario } from "@/lib/tasks/seed";
import { ACTIVITY_DOMAIN_OF, DOMAIN_LABEL, type TaskDomain } from "@/lib/tasks/types";
import { HOME_LOAD_STAGES, homeLoadPlanFor } from "@/lib/tasks/load-plan";
import {
  digestLinesFor,
  isNewShift,
  ladderStageFor,
  ladderTargetFor,
  shiftFactsFor,
  shiftStagesFor,
  type ShiftStage,
  type StageTone,
} from "@/lib/tasks/shift";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ TONE IS NEVER THE ONLY CARRIER (SC 1.4.1) ═══
 *
 *  Every tone here also changes the WORDS — "2 past 24h" against "8 open, all
 *  within SLA" against "All clear" — so a reader who cannot separate the two
 *  inks gets the same sentence. The breach tone additionally carries an icon.
 *  That is the whole reason this returns classes rather than a colour: if a tone
 *  ever needs to be readable on its own, the words are wrong. */
const TONE_TEXT: Record<StageTone, string> = {
  breach: "text-[var(--band-clay-fg)]",
  attention: "text-[var(--text-primary)]",
  stale: "text-[var(--text-secondary)]",
  clear: "text-[var(--text-secondary)]",
  unavailable: "text-[var(--text-muted)]",
};

/** ═══ THE LIVE ESCALATION STRIP — A MIRROR, NOT A SECOND HOME ═══
 *
 *  Present only when an escalation is open. Nothing here changes escalation
 *  state: one link out, to the region on Monitoring that owns it. A resolve
 *  control on this strip would be the boundary violation the module note warns
 *  about, and it would be the worst possible place to put one — a supervisor
 *  would be closing a crisis from a summary.
 *
 *  THE ONLY SATURATED FILLED TREATMENT ON HOME. `--task-respond-*` is defined in
 *  `:root` only and deliberately does not theme, because an alarm should be the
 *  same object in both modes (gap row 214). If a second filled-red thing appears
 *  on this page, the strip stops meaning anything. */
function EscalationStrip({
  items,
  now,
}: {
  items: ReturnType<typeof sortedOpen>;
  now: number;
}) {
  if (items.length === 0) return null;
  return (
    <section
      /* TODO-COPY */
      aria-label="Open escalations"
      /** ANNOUNCED ON ARRIVAL. A supervisor landing on Home with an escalation
       *  running must not have to read for it — `assertive`, which is reserved on
       *  this surface for exactly this and nothing else. */
      aria-live="assertive"
      data-anno-ref="home-escalation-strip"
      className="overflow-hidden rounded-[var(--radius-elevated)]"
      style={{ backgroundColor: "var(--task-respond-bg)" }}
    >
      <ul className="divide-y divide-[color-mix(in_oklab,var(--task-respond-fg)_20%,transparent)]">
        {items.map((item) => {
          const p = item.payload;
          const is911 = p.kind === "escalation" ? p.is911 : false;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-[var(--task-respond-fg)]"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold leading-[20px]">
                  {item.teenDisplayName}
                </span>
                <span className="block truncate text-[12px] leading-[16px]">
                  {/* TODO-COPY */}
                  to {item.mentorName}
                </span>
              </span>
              {/* ICON PLUS TEXT, NO GROUND. A tinted pill on this ground measures
                  3.84:1 and fails — the same defect arch-B found and removed in
                  the escalation region. */}
              <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold leading-[16px]">
                <Phone className="size-3 shrink-0" aria-hidden />
                {/* TODO-COPY */}
                {is911 ? "911 dispatched" : "No 911"}
              </span>
              <span
                className="shrink-0 text-[13px] font-semibold tabular-nums"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {/* TODO-COPY */}
                {elapsedLabel(item.openedAt, now)} elapsed
              </span>
              <Link
                href={escalationHref(
                  p.kind === "escalation" ? p.escalationId : item.objectId
                )}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold",
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

/** ═══ ONE STAGE — A SINGLE LINK, WITH ITS STATE IN THE NAME ═══
 *
 *  The whole row is the link, not a chevron at the end: a stage is one
 *  destination, so a reader aiming anywhere on it should arrive. That also makes
 *  the accessible name the whole sentence — "Risk flags, 2 imminent past 24h" —
 *  rather than a label whose state sits in a sibling a screen reader meets
 *  separately.
 *
 *  THE DIRECTIVE STAGE IS THE ONLY EMPHASIS ON THE PAGE. One primary treatment,
 *  nothing else competing, and it is carried by a filled marker and a heavier
 *  face rather than by colour — the tone already varies for a different reason
 *  (breach vs clear) and two colour languages in one row teach neither. */
function StageRow({
  stage,
  directive,
}: {
  stage: ShiftStage;
  directive: boolean;
}) {
  const body = (
    <>
      {/* THE DIRECTIVE MARKER. A filled dot against a hairline ring — shape, not
          hue, so it survives both themes and a reader who cannot tell the two
          apart by colour. */}
      <span
        aria-hidden
        className={cn(
          "mt-[3px] size-2.5 shrink-0 rounded-full",
          directive
            ? "bg-[var(--text-primary)]"
            : "border border-[color:var(--border-contour)]"
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[14px] leading-[20px] text-[var(--text-primary)]",
            directive && "font-display"
          )}
        >
          {stage.label}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-[13px] leading-[18px]",
            TONE_TEXT[stage.tone]
          )}
        >
          {stage.tone === "breach" && (
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          )}
          {stage.state}
        </span>
      </span>
      {stage.href && (
        <ChevronRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]"
        />
      )}
    </>
  );

  /* TODO-COPY. THE STATE IS IN THE NAME, because a sighted reader gets it from
     the line beneath the label and a screen-reader user would otherwise hear
     only "Risk flags, link". `Next` marks the directive stage in words — the
     dot is `aria-hidden` and shape cannot be announced. */
  const label = `${stage.label}, ${stage.state}${directive ? ", next" : ""}`;

  /* NO DESTINATION, NO LINK. Chat review has no surface to go to — see the note
     at its stage — and a link to nowhere reads as broken rather than unbuilt. */
  if (!stage.href) {
    return (
      <li
        aria-label={label}
        className="flex items-start gap-3 px-4 py-3"
        data-stage={stage.id}
        data-directive={directive ? "true" : undefined}
      >
        {body}
      </li>
    );
  }
  return (
    <li data-stage={stage.id} data-directive={directive ? "true" : undefined}>
      <Link
        href={stage.href}
        aria-label={label}
        className={cn(
          "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {body}
      </Link>
    </li>
  );
}

/** A region that has not arrived. Sized to the real thing so nothing below it
 *  moves when it does. */
function RegionSkeleton({ h }: { h: number }) {
  return (
    <div
      aria-hidden
      style={{ height: h }}
      className="shrink-0 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] motion-safe:animate-pulse"
    />
  );
}

/** ═══ A FAILED REGION SAYS SO, AND THE OTHERS CARRY ON ═══
 *
 *  Each error is scoped to its own region with its own retry, so one failed read
 *  never blanks the page. The escalation wording is the load-bearing one: an
 *  ABSENT strip means "nobody is in danger", which is the good news a supervisor
 *  most wants to be able to trust — so a failure there states what is unknown
 *  rather than what failed. "Couldn't load escalations" invites the reading "so
 *  there are none". */
function RegionError({
  line,
  onRetry,
}: {
  line: string;
  onRetry: () => void;
}) {
  return (
    <section
      role="alert"
      className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-3"
    >
      <p className="text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
        {line}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] font-semibold text-[var(--text-primary)]",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <RotateCcw className="size-3.5 shrink-0" aria-hidden />
        {/* TODO-COPY */}
        Retry
      </button>
    </section>
  );
}

export function HomePage() {
  const mounted = useMounted();
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const shiftLastSeenAt = useOnboardingStore((s) => s.shiftLastSeenAt);
  const setShiftSeenAt = useOnboardingStore((s) => s.setShiftSeenAt);

  /** FIXED AT MOUNT, matching every other surface. `Date.now()` in render scope
   *  is impure and the React Compiler's purity rule rejects it. */
  const [now] = useState(() => Date.now());

  /** ═══ READ BEFORE IT IS WRITTEN ═══
   *  The gate is "has it been a shift since you were last here", and opening
   *  Home is what makes it no longer true — so the answer is captured at mount,
   *  before the effect below stamps the new visit. Read the other way round, the
   *  digest would disqualify itself every time. */
  const [wasNewShift] = useState(() => shiftLastSeenAt);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    setShiftSeenAt(Date.now());
  }, [mounted, setShiftSeenAt]);

  const items = useMemo(
    () => (mounted ? tasksScenario(tasksScenarioId, now) : []),
    [mounted, tasksScenarioId, now]
  );

  const devLoadState = useOnboardingStore((st) => st.devLoadState);
  /** Per-region retries, which WIN over the plan once a reader has used one —
   *  the same arrangement Tasks and Monitoring have, and the reason the plan is a
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
  const stages = useMemo(
    /* NULL RECENCY — no last-reviewed data exists. See the stage's own note. */
    () => shiftStagesFor(facts, null),
    [facts]
  );
  const directive = useMemo(() => ladderStageFor(facts), [facts]);
  const target = useMemo(() => ladderTargetFor(items, now), [items, now]);

  const liveEscalations = useMemo(
    () =>
      sortedOpen(items, now).filter(
        (i) => isEscalationTask(i) && lifecycleOf(i, now) === "active"
      ),
    [items, now]
  );

  const digest = useMemo(() => digestLinesFor(facts), [facts]);
  const showDigest =
    mounted && !dismissed && isNewShift(wasNewShift, now) && digest.length > 0;

  /** ═══ RETIREMENT — AND WHY IT IS THE VISIT, NOT THE FIRST RESOLVE ═══
   *
   *  The brief asks the digest to auto-retire "when the first item is resolved
   *  anywhere". MEASURED: it cannot, and not for a reason worth working around.
   *  RESOLUTIONS ARE PAGE-LOCAL STATE — `resolvedIds` is a `useState` on Tasks
   *  and another on Monitoring, and nothing persists them. Home cannot observe a
   *  resolve because no surface writes one anywhere Home can read.
   *
   *  So the retirement that ships is the one the model can support honestly, and
   *  it is the stronger of the two: the stamp is written on the first Home mount
   *  of a shift, so `isNewShift` is false on every later visit that shift and the
   *  digest does not come back — whether or not anything was resolved in between.
   *  A supervisor meets it once per shift, which is what a shift-start digest is.
   *
   *  A first draft of this compared an open count "at arrival" against the
   *  current one. It could never fire: Home hosts no work, so within one mount
   *  nothing changes, and across mounts the stamp has already suppressed it.
   *  Removed rather than left as a condition that reads as live and is not.
   *  Gap row 372 records what a resolve-triggered retirement would need. */

  /** TODO-COPY. The CTA names where it goes, not what it does — "Start with the
   *  imminent flags" is a destination; "Resolve" would be a promise Home cannot
   *  keep, because Home hosts no work. */
  const ctaStage = stages.find((s) => s.id === directive);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[860px] flex-col gap-5 overflow-y-auto px-6 py-6 lg:px-8">
      <div data-anno-ref="home-header" className="shrink-0">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          {/* TODO-COPY */}
          Your shift
        </h1>
        <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {/* TODO-COPY. SAYS WHAT IS TRUE, and does not celebrate: an empty board
              is the resting state of this work rather than an achievement, and
              "Nothing needs action right now" must not read as broken. */}
          {directive === "chatReview" && liveEscalations.length === 0
            ? "Nothing needs action right now"
            : "Work through the sequence in order"}
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
        <EscalationStrip items={liveEscalations} now={now} />
      )}

      {showDigest && (
        <section
          /* TODO-COPY */
          aria-label="Since your last shift"
          data-anno-ref="home-digest"
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
              /* TODO-COPY */
              aria-label="Dismiss the shift summary"
              className={cn(
                "-m-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)]",
                "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {/* BREACH LINES FIRST, in breach styling, before any neutral count —
              see `digestLinesFor`. */}
          <ul className="mt-2 flex flex-wrap gap-2">
            {digest.map((line) => (
              <li key={line.id}>
                <Link
                  href={line.href}
                  data-tone={line.tone}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] leading-[17px]",
                    line.tone === "breach"
                      ? "bg-[var(--band-clay-bg)] text-[var(--band-clay-fg)]"
                      : "bg-[var(--surface-s1)] text-[var(--text-secondary)]",
                    RING
                  )}
                >
                  {line.tone === "breach" && (
                    <AlertTriangle className="size-3 shrink-0" aria-hidden />
                  )}
                  {line.text}
                </Link>
              </li>
            ))}
          </ul>
          {ctaStage?.href && (
            /* ONE PRIMARY CTA, TARGETING THE LADDER'S HEAD. The item it lands on
               is the comparator's answer — see `ladderTargetFor` — so the digest
               cannot point somewhere the list would not have put first. */
            <Link
              href={ctaStage.href}
              className={cn(
                "mt-3 inline-flex min-h-9 items-center rounded-full bg-[var(--text-primary)] px-4 text-[13px] font-semibold text-[var(--text-inverse)]",
                "transition-opacity hover:opacity-90",
                RING
              )}
            >
              {/* TODO-COPY */}
              Start with {ctaStage.label.toLowerCase()}
              {target ? ` — ${target.teenDisplayName.split(" ")[0]} first` : ""}
            </Link>
          )}
        </section>
      )}

      {stateOf("sequence") === "loading" ? (
        <RegionSkeleton h={228} />
      ) : stateOf("sequence") === "error" ? (
        <RegionError
          /* TODO-COPY */
          line="The shift sequence couldn’t be loaded."
          onRetry={() => setRetried((r) => ({ ...r, sequence: true }))}
        />
      ) : (
      <section
        /* TODO-COPY */
        aria-label="Shift sequence"
        data-anno-ref="home-sequence"
        className="shrink-0 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
      >
        <ul className="divide-y divide-[color:var(--border-subtle)]">
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              /* EXACTLY ONE. The ladder is total, so this is never empty and
                 never two. */
              directive={stage.id === directive}
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
 *  the moment a count of what somebody got through is given weight, Home starts
 *  measuring output, which is the surface this phase is specifically not
 *  building.
 *
 *  THE ROUTINE TIER IS ABSENT, and that is `closedToday`'s own decision rather
 *  than an omission here — "closing a routine review is not an achievement worth
 *  a counter". */
function ClosedToday({
  facts,
}: {
  facts: ReturnType<typeof shiftFactsFor>;
}) {
  const entries = Object.entries(facts.closedToday).filter(
    ([, n]) => (n ?? 0) > 0
  ) as Array<[TaskDomain, number]>;
  if (entries.length === 0) return null;

  return (
    <section
      /* TODO-COPY */
      aria-label="Closed today"
      data-anno-ref="home-closed-today"
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
                "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-1 py-0.5 text-[13px] leading-[18px] text-[var(--text-secondary)]",
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
