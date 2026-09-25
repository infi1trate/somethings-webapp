"use client";

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTED SCHEDULE — A REFERENCE, NOT A TRACKER (Today Phase D)
//
// ═══ TWO PARTS, RENDERED APART ═══
//
// The block sequence dims and carries the now-marker. The standing obligation
// does neither — it overlaps four blocks and runs past several of them, so a
// now-marker on it would put two things "now" at once and dimming it would grey
// out something still running. `lib/home/schedule.ts` makes that structural:
// the obligation is not in `blocks[]` and there is nowhere to put one.
//
// ═══ WHAT IT REFUSES TO BE (D.8) ═══
//
// No checkboxes, no completion state, no percentage, no "you are behind". This
// is a suggestion a supervisor glances at, and every one of those turns it into
// a thing they can fail. The past-state marker says the TIME has passed —
// "Earlier" — and deliberately not that the work is done: a check glyph would
// be an adherence claim this module is forbidden from making, and it would be
// making it about work it cannot observe.
//
// ═══ COLOUR CARRIES NOTHING (D.2, standing constraint) ═══
//
//  · NOW    — the word "Now", a filled rule in the gutter, and the display face.
//  · PAST   — the word "Earlier", and reduced ink.
//  · LATER  — no marker; its position below the current block is the signal.
//
// Remove every colour and the three states are still distinguishable by word
// and by position, which is the test.
//
// ═══ THE DIM IS `--text-muted`, AND THE SURFACE IS WHY ═══
//
// D.3 sets a 4.5:1 floor on dimmed text. MEASURED: `--text-muted` (#6e6b67) is
// 5.30:1 on `--surface-card` and 4.02:1 on `--surface-s2` — so the module must
// sit on the card, and it does. `--text-tertiary` is 2.82:1 and the token file
// already flags it "⚠ FAILS AA. Decorative"; it is not an option here and the
// test pins that it is not used.

import Link from "next/link";
import {
  clockLabel,
  obligationActive,
  positionOf,
  scheduleNowFor,
  scheduleStateFor,
  type ScheduleBlock,
  type ScheduleVariant,
} from "@/lib/home/schedule";
import { LABEL } from "@/lib/home/today";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function Block({
  block,
  position,
  showCta,
}: {
  block: ScheduleBlock;
  position: "past" | "now" | "later";
  showCta: boolean;
}) {
  const past = position === "past";
  const now = position === "now";
  return (
    <li
      data-anno-ref={`schedule-block:${block.start}`}
      data-position={position}
      className="relative flex gap-3 py-2"
    >
      {/* ═══ THE POSITIONAL INDICATOR (D.2) ═══
          A filled rule in the gutter on the current block, a hairline on every
          other. Shape and position, not hue — at 2px wide it reads as a mark
          rather than as a colour. */}
      <span
        aria-hidden
        className={cn(
          "mt-1 w-0.5 shrink-0 self-stretch rounded-full",
          now ? "bg-[var(--text-primary)]" : "bg-[var(--border-subtle)]"
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn(
              "shrink-0 text-[12px] leading-[16px] tabular-nums",
              past ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
            )}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {clockLabel(block.start)} – {clockLabel(block.end)}
          </span>
          {/* ═══ THE WORD IS THE MARKER (D.2, D.4) ═══
              "Now" and "Earlier" are the non-colour carriers. A future block
              gets no word: three states, two labelled, and position carries the
              third — a word on every row would be noise on the majority. */}
          {now && (
            <span
              data-anno-ref="schedule-now"
              className="shrink-0 font-display text-[12px] leading-[16px] font-bold text-[var(--text-primary)]"
            >
              {/* NEEDS-COPY-NICOLE */}
              Now
            </span>
          )}
          {past && (
            <span className="shrink-0 text-[12px] leading-[16px] text-[var(--text-muted)]">
              {/* NEEDS-COPY-NICOLE. THE TIME HAS PASSED — not the work is done.
                  A check glyph here would be an adherence claim, which D.8
                  forbids and which this module cannot observe anyway. */}
              Earlier
            </span>
          )}
        </span>
        {block.labels.map((l) => (
          <span
            key={l}
            className={cn(
              "mt-0.5 block text-[14px] leading-[20px]",
              past
                ? "text-[var(--text-muted)]"
                : now
                  ? "font-display text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]"
            )}
          >
            {/* NEEDS-COPY-NICOLE — every label is transcribed from the mock. */}
            {l}
          </span>
        ))}
        {/* ═══ ONE CTA, ON THE CURRENT BLOCK, WHERE THE MAPPING IS CLEAN (D.7) ═══
            Six of the seven blocks have no clean destination and get nothing —
            see `BLOCK_DESTINATIONS` for the reasoning on each, including the
            one that reads like Escalations and is not. */}
        {showCta && block.destination && (
          <Link
            href={`/app/${block.destination}`}
            className={cn(
              "mt-1.5 inline-flex min-h-11 items-center rounded-full border border-[color:var(--border-contour)] px-3",
              "text-[13px] leading-[18px] font-semibold text-[var(--text-primary)]",
              "transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {/* NEEDS-COPY-NICOLE. Names where it GOES — this module navigates
                and does nothing else, per the mirror rule. */}
            Open {LABEL[block.destination]}
          </Link>
        )}
      </span>
    </li>
  );
}

function Obligation({
  variant,
  active,
}: {
  variant: ScheduleVariant;
  active: boolean;
}) {
  return (
    <div
      data-anno-ref="schedule-obligation"
      data-active={active ? "true" : "false"}
      /* ═══ IT NEVER DIMS AND NEVER CARRIES A NOW-MARKER (D, "do not build") ═══
         Its ink does not vary with the clock, because it is not a block whose
         moment passes — it is the thing running underneath them. `data-active`
         is for the probe and for nothing visual. */
      className="mt-3 rounded-[var(--radius-inset)] bg-[var(--band-sand-bg)] px-3 py-2.5"
    >
      {/* ═══ THE CLOCK GLYPH IS GONE (Phase G's budget) ═══
          It sat beside the time range and conveyed nothing the range did not.
          G allows ONE decorative moment on this page and spends it on the
          greeting's wave; Superseded #5 removed exactly this kind of glyph
          from two other section headers for the same reason. The chevrons
          elsewhere stay — those are navigation affordances, not decoration. */}
      <p className="text-[12px] leading-[16px] text-[var(--band-sand-fg)]">
        <span
          className="shrink-0 tabular-nums"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {clockLabel(variant.obligation.start)} – {clockLabel(variant.obligation.end)}
        </span>
      </p>
      <p className="mt-1 text-[14px] leading-[20px] font-display text-[var(--band-sand-fg)]">
        {variant.obligation.label}
      </p>
      <p className="mt-0.5 text-[12px] leading-[16px] text-[var(--band-sand-fg)]">
        {variant.obligation.note}
      </p>
    </div>
  );
}

export function SuggestedSchedule({ now }: { now: number }) {
  const at = scheduleNowFor(now);
  const state = scheduleStateFor(at);
  const variant = state.kind === "out-of-shift" ? state.variant : state.variant;

  return (
    <section
      data-anno-ref="today-schedule"
      aria-label="Suggested schedule"
      className="shrink-0 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
          {/* NEEDS-COPY-NICOLE */}
          Suggested schedule
        </p>
        {/* ═══ THE TIMEZONE, VISIBLY (D.6) ═══
            Computed from `SCHEDULE_TZ`, so it reads EDT or EST correctly on
            either side of the change rather than asserting one of them all
            year. It is NOT the device's zone — a reader elsewhere sees the
            zone the table is written in, which is the point of showing it. */}
        <p
          data-anno-ref="schedule-tz"
          className="text-[12px] leading-[16px] text-[var(--text-secondary)]"
        >
          {variant ? `${variant.label} · ${at.zoneAbbrev}` : at.zoneAbbrev}
        </p>
      </div>

      {state.kind === "out-of-shift" ? (
        <p
          data-anno-ref="schedule-out-of-shift"
          className="mt-2 text-[13px] leading-[19px] text-[var(--text-secondary)]"
        >
          {/* NEEDS-COPY-NICOLE. States the next window and nothing else — no
              now-marker, and no encouragement. */}
          {`No shift scheduled right now. Next: ${state.next.label}, ${clockLabel(
            state.next.shift.start
          )} – ${clockLabel(state.next.shift.end)}.`}
        </p>
      ) : (
        <>
          <ol className="mt-1">
            {state.variant.blocks.map((b) => (
              <Block
                key={b.start}
                block={b}
                position={positionOf(b, at.minutes)}
                showCta={state.kind === "in-block" && state.block.start === b.start}
              />
            ))}
          </ol>

          {state.kind === "obligation-only" && (
            <p
              data-anno-ref="schedule-obligation-only"
              className="text-[13px] leading-[19px] text-[var(--text-secondary)]"
            >
              {/* NEEDS-COPY-NICOLE. The four-hour stretch between 5:30 and 9:30
                  is not a hole in the table — the standing obligation below IS
                  the schedule for it, and saying so is cheaper than letting a
                  reader wonder. */}
              Nothing sequential is scheduled right now — the standing
              obligation below is what is running.
            </p>
          )}

          {state.kind === "unspecified" && (
            <p
              data-anno-ref="schedule-unspecified"
              className="text-[13px] leading-[19px] text-[var(--text-secondary)]"
            >
              {/* NEEDS-COPY-NICOLE. THE SOURCE TABLE STOPS HERE. Friday runs to
                  7 PM and the authored table is cut off after 4 — so this says
                  the schedule does not cover the moment, rather than inventing
                  a block or showing nothing. */}
              The schedule doesn&rsquo;t cover this part of the Friday shift yet.
            </p>
          )}

          <Obligation
            variant={state.variant}
            active={obligationActive(state.variant, at.minutes)}
          />
        </>
      )}
    </section>
  );
}
