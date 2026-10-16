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
import { CalendarClock } from "lucide-react";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function Block({
  block,
  position,
  showCta,
  divided,
}: {
  block: ScheduleBlock;
  position: "past" | "now" | "later";
  showCta: boolean;
  /** Every row but the first carries the rule above it — see the stack note. */
  divided: boolean;
}) {
  const past = position === "past";
  const now = position === "now";
  return (
    <li
      data-anno-ref={`schedule-block:${block.start}`}
      data-position={position}
      /* ═══ THE ROW IS A COLUMN WITH A 4px GAP (M.1, read from 4055:22115) ═══
         IT WAS A TWO-COLUMN FLEX — a 2px positional rule in a gutter, then the
         text — and D.2 put the rule there as a non-colour carrier for the
         current block. M.1 measures the reference row as `flex flex-col
         gap-[4px]` with no gutter, so the rule goes and the carrier it
         provided has to come from somewhere that still exists. See the fill
         note below: it does.
         THE CURRENT ROW KEEPS ITS SURFACE FILL, AND THAT IS DELIBERATE. M.1
         removes the "Now" and "Earlier" WORDS and says current is "already
         distinguished by weight (Bold vs Regular) — that satisfies 1.4.1".
         MEASURED, IT DOES NOT IN THIS BUILD: TWK Lausanne ships the 400 face
         only and renders identically at 400/500/600/700, so a Lausanne bold is
         no carrier at all. Two things follow, and both are reported rather
         than absorbed:
           · the current LABEL takes `font-display` — Avantt, Bold-only, a
             real +19% ink step — so M.1's weight carrier actually renders;
           · the `--surface-s2` fill STAYS, because "colour is never the sole
             carrier" is a standing constraint rather than a phase decision,
             and M.1 neither removes the fill nor lists it under its removals.
         So the current row is carried by weight AND fill, with hue third. */
      /* ═══ THE RULE SPACING AND THE FILL ARE ON DIFFERENT BOXES ═══
         MEASURED when they shared one: the current row's `py-1` won the
         cascade over the rule's `pt-5`, so the divider above the CURRENT block
         sat 4px from its content while every other sat at 20 — the one row a
         reader is looking for was the one row off the pitch.
         So the `li` owns the rule and the gap above it, and an inner box owns
         the fill and its own padding. Two boxes, one each, and neither can
         overwrite the other's spacing. */
      className={cn(
        divided && "mt-5 border-t border-[color:var(--border-contour)] pt-5"
      )}
    >
      <span
        className={cn(
          "flex flex-col gap-1",
          now && "-mx-2 block rounded-[var(--radius-inset)] bg-[var(--surface-s2)] px-2 py-1"
        )}
      >
      {/* ═══ THE TIME (M.1) ═══
          MONO SEMIBOLD, AND GEIST MONO IS ABSENT — K.3 reported that as a
          blocker and it is unchanged: `--font-mono` is a system stack here, so
          this is the stack at 600 rather than Geist Mono SemiBold.
          12px, AND THE REFERENCE IS 11. M.1 calls 11px "off Bloom's type
          scale" and asks for each off-token value to be mapped with the
          mapping reported. 12 is the scale's smallest step and the nearest, so
          it maps to 12 rather than minting an 11px step that would exist
          nowhere else in the product.
          THE CURRENT TIME KEEPS THE ORANGE HUE AND LOSES THE FAILING TONE.
          The reference is `text/warning` #e18002, which M.1 measures at 2.46:1
          and rejects. `--band-sand-fg` #5e4a21 is an EXISTING warm token in the
          same hue family — so M.1's "registered as a Bloom extension token,
          not a one-off hex" turns out not to be needed: the tone exists.
          Measured on the rail ground in the report. */}
      <span
        className={cn(
          "text-[12px] leading-[16px] font-semibold tabular-nums",
          past
            ? "text-[var(--text-muted)]"
            : now
              ? "text-[var(--band-sand-fg)]"
              : "text-[var(--text-secondary)]"
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {clockLabel(block.start)} – {clockLabel(block.end)}
      </span>

      {/* ═══ WHAT WAS HERE: "Now" AND "Earlier" (D.2, D.4, H.4.1 → M.1) ═══
          Two text labels, and they were the non-colour carriers those phases
          required. M.1 removes them and logs the consequence itself: "Past vs
          future is distinguished by colour alone in the reference; the mapped
          tokens keep that legible, but it remains a 1.4.1 gap and is logged in
          Open items for a decision."
          SO THE GAP IS REAL, NAMED, AND NOT MINE TO CLOSE. Past reads lighter
          than future and nothing else separates them. It is in the report. */}

      {block.labels.map((l) => (
        <span
          key={l}
          className={cn(
            "block text-[16px] leading-[20px]",
            past
              ? "text-[var(--text-muted)]"
              : now
                ? "font-display text-[var(--text-primary)]"
                : "text-[var(--text-secondary)]"
          )}
        >
          {/* NEEDS-COPY-NICOLE — every label is transcribed from the mock.
              16/20, AND IT WAS 14/20. M.1 measures the reference label as TWK
              Lausanne 16/20. */}
          {l}
        </span>
      ))}

      {/* ═══ ONE CTA, ON THE CURRENT BLOCK, WHERE THE MAPPING IS CLEAN (D.7) ═══
          Six of the seven blocks have no clean destination and get nothing —
          see `BLOCK_DESTINATIONS` for the reasoning on each, including the one
          that reads like Escalations and is not. */}
      {showCta && block.destination && (
        <Link
          href={`/app/${block.destination}`}
          className={cn(
            "mt-1 inline-flex min-h-11 items-center rounded-full border border-[color:var(--border-contour)] px-3",
            "text-[13px] leading-[18px] font-semibold text-[var(--text-primary)]",
            "transition-colors hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          {/* NEEDS-COPY-NICOLE. Names where it GOES — this module navigates and
              does nothing else, per the mirror rule. */}
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
      /* ═══ THE RAIL'S OWN PADDING (Phase H.1.2) ═══
         H.1.2 specifies a 285px rail with 33px padding each side, giving 219
         of content. 33 IS OFF BLOOM'S ONLY REAL SPACING SCALE — Bloom carries
         no spacing tokens beyond four component pads, so Tailwind's 4px step
         is the scale, and the nearest step is 32 (`p-8`) for 221 of content.
         Two pixels from the Figma, and on the grid rather than beside it.
         IT IS SCOPED TO THE TWO-COLUMN LAYOUT, because 33px is a fact about a
         285px RAIL. Below `min-[1470px]` the rail stacks to full width and this
         card is an ordinary module beside the digest and the destination
         cards — 32px of padding on a 327px phone card would be the one
         module out of register, which is the defect H.5 had just fixed one
         component along. So `p-4` there, matching every other module, and the
         rail's own padding only where the rail exists. */
      /* ═══ A TALL FIXED CONTAINER (Phase L.7) ═══
         L.7 measures the rail at 285 × 784. It was an auto-height card, which
         L.7 calls "a small auto-height card" against "a tall fixed container"
         — and the difference is what made the rail read as an afterthought
         beside an 857 column of content.
         `min-h` RATHER THAN `h`, and only in the two-column layout: a fixed
         height would clip on a variant whose block list is longer than the
         reference's, and below the breakpoint the rail is a full-width module
         where 784 of empty surface would be absurd. */
      /* ═══ THE CONTAINER, READ FROM 4055:22115 (M.1) ═══
         MEASURED: radius 32, 1px border `button/border/subtle` #cbc6be, ground
         `stateLayers/onSecondary/Opacity-08` rgba(160,153,141,0.08), padding
         32 horizontal / 24 vertical, column with a 24px gap between header and
         timeline.
         IT WAS a `--surface-card` panel at `--radius-elevated` with `p-8`.
         TWO OF THE THREE MAP AND ONE IS AN EXTENSION, all reported:
           · radius 32 → `--radius-rail`, a registered extension (Bloom here has
             no 32 step; see the token's own note)
           · ground rgba(160,153,141,0.08) → `--surface-rail`, a registered
             extension (this build's tints are neutral, so a warm 8% state
             layer did not exist)
           · border #cbc6be → `--border-contour`. #cbc6be has NO counterpart
             here — `--border-subtle` is #dfddd8, lighter — and it resolves to
             one of the four non-Bloom libraries the reference file binds.
             `--border-contour` is this build's contour hairline and is what
             ships, rather than a raw hex or a fourth border value.
         THE 784 FLOOR IS GONE. L.7 measured the rail at 285×784 and this
         carried a `min-h`; the node now measures 1197 tall with its timeline
         ending at 707, i.e. the height is the CONTAINER's and not the
         content's. A floor that tracks neither is furniture, so the rail is
         content-sized with the padding the node specifies. Reported. */
      className={cn(
        "shrink-0 rounded-[var(--radius-rail)] border border-[color:var(--border-contour)]",
        "bg-[var(--surface-rail)] px-4 py-4 min-[1470px]:@min-[1190px]/canvas:px-8 min-[1470px]:@min-[1190px]/canvas:py-6"
      )}
    >
      {/* ═══ THE HEADER ICON IS REQUIRED (L.7, reversed Superseded #5) ═══
          Superseded #5 banned it as decoration and L reverses that: it is a
          SECTION IDENTIFIER. The page's one DECORATIVE glyph is still the
          hero's wave; this is functional, which is the distinction the
          reversal draws. */}
      {/* HEADER ROW — gap 8, height 32, icon 24, per the node. */}
      <div className="flex min-h-8 items-center gap-2">
        <CalendarClock
          aria-hidden
          className="size-6 shrink-0 text-[var(--text-primary)]"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {/* ═══ Avantt Bold 20/24 (L.7) ═══ It was 13px semibold, which is a
            caption rather than a section title. */}
        <p className="font-display text-[20px] font-bold leading-[24px] text-[var(--text-primary)]">
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
          {/* ═══ ROWS STACK — THE PITCH IS 20 / RULE / 20 (M.1) ═══
              The node's stack is `flex flex-col gap-[20px]` with a full-width
              divider instance between each pair, so the rule sits CENTRED
              between two rows: row → 20 → rule → 20 → row.
              `divide-y` WAS THE FIRST TRY AND IS WRONG HERE: it puts the border
              on the child's top edge, so with a gap above it the rule lands
              flush against the next row rather than midway. Each row carries
              its own `mt-5 border-t pt-5` instead — 20 above the rule, 20
              below — which is the measured pitch stated as the two numbers it
              actually is.
              24 ABOVE THE STACK, the node's header→timeline gap. */}
          <ol className="mt-6">
            {state.variant.blocks.map((b, i) => (
              <Block
                key={b.start}
                divided={i > 0}
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
