"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ONE HEADER, EVERY DESTINATION (addendum §2.10)
//
// ═══ WHAT IT REPLACES ═══
//
// Four headers written four times: Monitoring's h1-plus-subtitle, Tasks' own,
// the record surfaces', and whatever each placeholder did. They agreed on
// nothing — not the title's size, not whether a subtitle existed, not where a
// count went. A reader moving between destinations re-learned the top of the
// page each time.
//
// ═══ THE THREE PARTS, AND WHY THE THIRD IS A PAIR ═══
//
//  · TITLE. Larger than it was, with more room under it.
//  · PURPOSE. One line, on EVERY page, in one voice. A destination that cannot
//    say what it is for in a sentence is a destination that needs a brief, not
//    a header that hides the question.
//  · METRICS. Two at most, as a PAIR — not chips and not badges. Value
//    prominent, label quiet, figures tabular so the column does not jitter as
//    numbers change.
//
// A PAIR RATHER THAN CHIPS IS THE LOAD-BEARING PART. Chips are filters
// everywhere else in this product; a chip-shaped thing that cannot be pressed
// teaches a reader that chips sometimes do nothing. A badge implies an inbox.
// Two figures with quiet labels under them are a reading, which is what these
// are.
//
// ═══ NO METRIC MAY FRAME WORK AS AN INBOX TO EMPTY ═══
//
// §2.10's standing rule, and the reason `Today` and `Chat` take none at all:
// Today MIRRORS its destinations and a figure here would be a sixth copy of a
// number that already appears on a card, and a conversation count is not work.
//
// EVERY METRIC STRING IS NEEDS-COPY-NICOLE.

import { cn } from "@/lib/utils";

export interface PageMetric {
  /** The figure. A string, not a number: "oldest 20h" is a metric and "20" is
   *  not, and forcing a number here would push formatting into every caller. */
  value: string;
  /** NEEDS-COPY-NICOLE. What the figure counts, quietly. */
  label: string;
}

export function PageHeader({
  title,
  purpose,
  metrics = [],
  progress,
  children,
  className,
  toolbar,
  rule = true,
}: {
  title: string;
  /** The hairline closing the band. On by default (every destination's band
   *  closes); Monitoring and Care Reviews turn it off (Monitoring v4, §3) —
   *  their toolbar's 40px is the separator. */
  rule?: boolean;
  /** NEEDS-COPY-NICOLE. One line, present on every destination. */
  purpose: string;
  /** At most two. A third is a dashboard, which this is not. */
  metrics?: PageMetric[];
  /** §2.11's track, when the destination has one. Sits in the header region,
   *  never as a modal and never as an interrupt. */
  progress?: React.ReactNode;
  /** Anything the destination pins beside its metrics — the live band's pause
   *  control is the only caller today. */
  children?: React.ReactNode;
  className?: string;
  /** ═══ THE TOOLBAR SLOT (Monitoring v3, §1) ═══ One 44px row, 40px below
   *  the band's rule — exactly where Care Reviews' search + Open/Closed row
   *  sits (measured: y=213 under a 32/40 title at y=88), so a destination
   *  that puts its toolbar here gets the same proportions by construction.
   *  Care Reviews places its own row in its list column at the same offset;
   *  `monitoring-v3.mjs` measures the two against each other. */
  toolbar?: React.ReactNode;
}) {
  return (
    <>
    <div
      data-anno-ref="page-header"
      /* ═══ A BAND, NOT TWO CORNERS (Figma alignment §5.1, §5.2) ═══
         MEASURED before: the title sat left and a small dense metric panel sat
         right with nothing spanning between them. The eye landed on the title,
         crossed empty space and arrived at the panel — which is why it read as
         disappearing. The panel was not too small; it was unaccompanied.
         SO THE BAND SPANS THE CONTENT WIDTH and the two sides are bound by a
         shared bottom rule rather than by proximity. */
      className={cn(
        "flex shrink-0 flex-col",
        /* ═══ THE RULE IS A HAIRLINE NOW, NOT THE TRACK (§5.3) ═══
           §5.2 made the progress fill the band's bottom rule. Judged in situ
           at 1440 with 8 of 19 done, that rule READ AS A BROWSER LOADING BAR —
           see the note on the progress slot below. The rule still has to exist,
           because §5.1's fix for the disappearing metric panel was binding the
           two sides with something that SPANS rather than with proximity. So
           the span survives and the fill does not: one hairline, which is the
           "no added chrome" §5.2 was protecting, to within a pixel.

           ═══ UNGATED (Care Reviews rework §5.4) ═══
           It was `progress && …`, which reproduced exactly the set of surfaces
           that had a rule when the TRACK drew one — so Today, Mentees, Roster
           and the team directory were left untouched by a component edit that
           was not a decision about them.
           §5.4 REMOVED THE TRACK FROM BOTH LIST SURFACES, and the gate then did
           something nobody chose: it took the rule away with it, leaving the
           two headers with nothing terminating the band. That was a side
           effect of the gate rather than a decision, and Brandon's answer was
           to ungate.
           SO EVERY DESTINATION'S BAND CLOSES NOW, which is what §2.10 claims
           the shared header is for — one header, one treatment. The
           propagation is real and is the point rather than a cost: Mentees,
           Roster and the team directory gain a hairline they did not have, and
           they gain it because they are the same component. Measured and
           reported. */
        rule && "border-b border-[var(--border-subtle)] pb-4",
        className
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[32px] font-bold leading-[40px] text-[var(--text-primary)]">
            {title}
          </h1>
          {/* ═══ THE SECOND LINE IS THE DESTINATION'S CONTEXT ═══
              On the two list surfaces this is the date (§4.1); elsewhere it is
              still the purpose sentence. The component does not know which —
              it renders the string it is given, which is why the prop is named
              for its position rather than for one of its two uses. */}
          <p
            data-anno-ref="page-purpose"
            className="mt-1 max-w-prose text-[16px] leading-[24px] text-[var(--text-secondary)]"
          >
            {purpose}
          </p>
          {/* ═══ QUEUE STATE BELONGS WITH THE PAGE'S NAME (§5.2) ═══
              `16 open · 2d oldest` are facts about the QUEUE; the progress on
              the right is a fact about this supervisor's SESSION. They were
              stacked in one box as though they were one kind of thing, which
              is the third of §5.1's three problems. Split by what they
              describe: the queue's state sits under the queue's name.
              ONE TYPE SCALE, not three. Numerals at 24/32 in the display face,
              labels at 13/18 quiet, separated by a middot — a phrase, not a
              grid. §5.1's second problem was three scales and two alignment
              logics inside 95px; this is one scale and one baseline. */}
          {metrics.length > 0 && (
            <p
              data-anno-ref="page-metrics"
              className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1"
            >
              {metrics.map((m, i) => (
                <span key={m.label} className="flex items-baseline gap-1.5">
                  {i > 0 && (
                    <span aria-hidden className="mr-0.5 text-[var(--text-muted)]">
                      ·
                    </span>
                  )}
                  <span
                    data-metric-value={m.label}
                    className="font-display text-[24px] font-bold leading-[32px] tabular-nums text-[var(--text-primary)]"
                  >
                    {m.value}
                  </span>
                  <span className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
                    {m.label}
                  </span>
                </span>
              ))}
            </p>
          )}
        </div>
        {(children || progress) && (
          <div className="flex shrink-0 items-end gap-4">
            {children}
            {/* ═══ THE TRACK IS A WIDGET IN THE CORNER AGAIN, DELIBERATELY ═══
                §5.2 moved it out of the corner because a contained track "reads
                as a widget" — and that was the right complaint about a track
                sitting alone in dead space. It does not sit alone now: §4.2
                took the `View` control out of this slot, so the track occupies
                the cluster the band already had, bottom-aligned with the
                metrics and bound to them by the hairline above. A widget
                beside two figures is a reading; a widget in empty space was
                the thing §5.1 called disappearing. */}
            {progress && <div className="w-64">{progress}</div>}
          </div>
        )}
      </div>

      {/* ═══ WHAT WAS HERE: THE FULL-WIDTH RULE (§5.2), AND WHY IT WENT ═══
          `{progress && <div className="mt-4">{progress}</div>}` — the track
          rendered BELOW the band at the full content width, as the band's
          bottom rule.

          §5.2's argument was good and one clause of it turned out to be the
          defect: "it reads as THE PAGE FILLING UP". That is the loading-bar
          read, described approvingly, and §5.3 required a judgement on exactly
          it. MEASURED at 1440 with the fill at 8 of 19: a 1224×8 bar — a 153:1
          aspect ratio — carrying a solid `--text-primary` fill, sitting as a
          horizontal rule directly beneath a header. That is the canonical
          page-load form, and all five of §5.3's mitigations were present and
          working while it still read that way. The shape is the signature;
          thickness and a visible remainder do not overcome it.

          THE REMAINDER WAS ALSO THE WEAKEST MITIGATION ON ITS OWN TERMS.
          `ShiftTrack` calls a visible unfilled remainder "the strongest single
          cue that this is a measure rather than a wait". Measured, that
          remainder is `--surface-s2` on `--surface-s1` = 1.2:1 light, 1.26:1
          dark. Bloom has no stronger neutral to move to — `--border-subtle` is
          LIGHTER than `--surface-s2` — and the fill's colour is settled and
          not reopenable ("NEVER GREEN"). So the cue could not be strengthened
          where it stood.

          IT RENDERS NOTHING WHEN THE SHIFT HAS NO WORK — still true, and now
          it is the hairline rather than the track that guarantees the band
          terminates. `ShiftTrack` returns null at `total === 0`, so an empty
          queue gets no track; a supervisor who was given no work has not
          failed to do it. */}
    </div>
    {toolbar && (
      <div data-page-toolbar className="mt-10 flex min-h-11 shrink-0 flex-wrap items-center gap-2">
        {toolbar}
      </div>
    )}
    </>
  );
}
