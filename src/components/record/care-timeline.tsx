"use client";

// CARE TIMELINE — the teen record's append-only history (MO-9.1).
//
// READ-ONLY FOR EVERYONE, every tier. Nothing here mutates, so there is no
// permission branch in this component at all: the action affordances that
// supervisors get live outside it. That is the "read-wide, act-narrow" rule
// expressed structurally rather than as a disabled state.
//
// ROWS ARE NOT PRESSABLE. There is nothing to drill into in v1, so no row-level
// navigation and no trailing chevron implying it. The chevron on the left of the
// row is a DISCLOSURE control — it rotates, carries aria-expanded, and sits with
// the content it opens rather than in the trailing position a navigation chevron
// occupies everywhere else in this product.
//
// AMENDMENT CHAINS ARE VISIBLE, not merely stored. A superseded entry keeps
// rendering, muted, labelled "Amended on [date]" with a jump to the correction;
// the correction says "Amends [date] entry". Nothing is hidden or overwritten.
//
// Provenance renders on EVERY row — person, system, or AI. A reader must never
// have to infer who wrote a rationale.

import { useMemo, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  CARE_FILTERS,
  TYPE_LABEL,
  TYPE_TONE,
  matchesFilter,
  type CareEvent,
  type CareFilterId,
} from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const CHIP =
  "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF =
  "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

/** Pill tone → the semantic families. No raw values, and deliberately not the
 *  PRD's purple: the token system already separates these four weights. */
const TONE_STYLE: Record<string, string> = {
  neutral:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  warm: "bg-[var(--alert-warm-bg)] text-[var(--alert-warm-fg)]",
  warning: "bg-[var(--alert-warning-bg)] text-[var(--alert-warning-fg)]",
  critical:
    "bg-[var(--alert-critical-bg)] text-[var(--alert-critical-fg)]",
};

const dateOf = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Provenance line. Always rendered — the whole point is that a reader never has
 *  to guess. AI carries an icon so it reads differently at a glance. */
function Provenance({ author }: { author: CareEvent["author"] }) {
  if (author.kind === "ai") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
        <Sparkles className="size-3" aria-hidden />
        {/* TODO-COPY */}
        AI generated{author.model ? ` · ${author.model}` : ""}
      </span>
    );
  }
  if (author.kind === "system") {
    // TODO-COPY
    return <span className="text-[var(--text-muted)]">Recorded automatically</span>;
  }
  return (
    <span className="text-[var(--text-muted)]">
      {author.name} · {author.role}
    </span>
  );
}

function Row({
  event,
  amendedBy,
  amends,
  onJump,
}: {
  event: CareEvent;
  /** The entry that supersedes this one, when there is one. */
  amendedBy?: CareEvent;
  /** The entry this one corrects, when it corrects one. */
  amends?: CareEvent;
  onJump: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const superseded = !!amendedBy;
  const expandable = !!event.items?.length || !!event.providerNote;

  return (
    <li
      id={`care-${event.id}`}
      // A superseded entry is RECESSED, not DIMMED. A blanket opacity-60 here
      // measured 4.41:1 on its description — below AA — and the entry a
      // correction points at is precisely the one a reader must still be able to
      // read. Tone does the same job at full contrast: the row sits back on the
      // s1 surface and its description drops one ink step, which is how the rest
      // of this product says "set aside".
      className={cn(
        "px-[var(--surface-pad-x)] py-3",
        superseded && "bg-[var(--surface-s1)]"
      )}
    >
      <div className="flex items-start gap-3">
        {expandable ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} details for ${TYPE_LABEL[event.type]} on ${dateOf(event.occurredAt)}`}
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)]",
              "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <ChevronRight
              className={cn("size-4 transition-transform", open && "rotate-90")}
              aria-hidden
            />
          </button>
        ) : (
          // Keeps the columns aligned without implying a control.
          <span aria-hidden className="mt-0.5 size-6 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="shrink-0 text-[var(--text-secondary)] tabular-nums"
              style={{ font: "var(--type-row-label)" }}
            >
              {dateOf(event.occurredAt)}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium",
                TONE_STYLE[TYPE_TONE[event.type]]
              )}
            >
              {TYPE_LABEL[event.type]}
            </span>
          </div>

          <p
            className={cn(
              "mt-1",
              superseded
                ? "text-[var(--text-secondary)]"
                : "text-[var(--text-primary)]"
            )}
            style={{ font: "var(--type-row-value)" }}
          >
            {event.description}
          </p>

          <p
            className="mt-0.5 flex flex-wrap items-center gap-x-2"
            style={{ font: "var(--type-row-label)" }}
          >
            <span className="text-[var(--text-secondary)]">{event.result}</span>
            <span aria-hidden className="text-[var(--text-muted)]">·</span>
            <Provenance author={event.author} />
          </p>

          {/* Amendment chain, both directions. */}
          {superseded && (
            <p className="mt-1.5" style={{ font: "var(--type-row-label)" }}>
              <button
                type="button"
                onClick={() => onJump(amendedBy!.id)}
                className={cn(
                  "rounded-sm text-[var(--alert-warm-fg)] underline underline-offset-2",
                  RING
                )}
              >
                {/* TODO-COPY */}
                Amended on {dateOf(amendedBy!.occurredAt)}
              </button>
            </p>
          )}
          {amends && (
            <p className="mt-1.5" style={{ font: "var(--type-row-label)" }}>
              <button
                type="button"
                onClick={() => onJump(amends.id)}
                className={cn(
                  "rounded-sm text-[var(--text-secondary)] underline underline-offset-2",
                  RING
                )}
              >
                {/* TODO-COPY — names the date so the pair is findable when the
                    filter or scroll position hides its partner. */}
                {`Amends the ${dateOf(amends.occurredAt)} entry`}
              </button>
            </p>
          )}

          {open && (
            <div className="mt-3 rounded-[var(--radius-surface)] bg-[var(--surface-s1)] p-3">
              {event.items?.length ? (
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th
                        className="pb-1 pr-3 font-medium text-[var(--text-muted)]"
                        style={{ font: "var(--type-field-label)" }}
                      >
                        {/* TODO-COPY */}
                        Question
                      </th>
                      <th
                        className="pb-1 pr-3 font-medium text-[var(--text-muted)]"
                        style={{ font: "var(--type-field-label)" }}
                      >
                        Answer
                      </th>
                      <th
                        className="pb-1 text-right font-medium text-[var(--text-muted)]"
                        style={{ font: "var(--type-field-label)" }}
                      >
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.items.map((it) => (
                      <tr key={it.question} className="align-top">
                        <td
                          className="py-1 pr-3 text-[var(--text-primary)]"
                          style={{ font: "var(--type-row-label)" }}
                        >
                          {it.question}
                        </td>
                        <td
                          className="py-1 pr-3 text-[var(--text-secondary)]"
                          style={{ font: "var(--type-row-label)" }}
                        >
                          {it.answer}
                        </td>
                        <td
                          className="py-1 text-right text-[var(--text-primary)] tabular-nums"
                          style={{ font: "var(--type-row-label)" }}
                        >
                          {it.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p
                  className="text-[var(--text-secondary)]"
                  style={{ font: "var(--type-row-label)" }}
                >
                  {event.providerNote}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function CareTimeline({ events }: { events: CareEvent[] }) {
  const [filter, setFilter] = useState<CareFilterId>("all");

  // Newest first, and an index of what supersedes what.
  const ordered = useMemo(
    () => [...events].sort((a, b) => b.occurredAt - a.occurredAt),
    [events]
  );
  const amendedBy = useMemo(() => {
    const m = new Map<string, CareEvent>();
    for (const e of events) if (e.amends) m.set(e.amends, e);
    return m;
  }, [events]);
  const byId = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events]
  );

  const rows = ordered.filter((e) => matchesFilter(e.type, filter));

  // Jumping between the two halves of an amendment chain has to survive a
  // filter: "Flags" can show a superseded entry whose correction is a
  // presentation event, so the target isn't in the DOM. Clear the filter first,
  // then scroll once the full list has painted — a dead link on a chain the
  // reader is trying to follow is worse than losing their chip selection.
  const jump = (id: string) => {
    setFilter("all");
    requestAnimationFrame(() => {
      document
        .getElementById(`care-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <section aria-label="Care timeline" data-record-section="care-timeline">
      <div className="flex flex-wrap items-center gap-2">
        {CARE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(CHIP, filter === f.id ? CHIP_ON : CHIP_OFF, RING)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
        {rows.length === 0 ? (
          <p
            className="px-[var(--surface-pad-x)] py-6 text-[var(--text-secondary)]"
            style={{ font: "var(--type-row-label)" }}
          >
            {/* TODO-COPY */}
            {events.length === 0
              ? "Nothing recorded yet. Entries appear here once the first survey is assigned."
              : "No entries of this kind yet."}
          </p>
        ) : (
          <ul className="[&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]">
            {rows.map((e) => (
              <Row
                key={e.id}
                event={e}
                amendedBy={amendedBy.get(e.id)}
                amends={e.amends ? byId.get(e.amends) : undefined}
                onJump={jump}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
