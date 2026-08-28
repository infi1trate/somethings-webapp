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

import { useImperativeHandle, useMemo, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  CARE_FILTERS,
  TYPE_LABEL,
  TYPE_TONE,
  matchesFilter,
  type CareEvent,
  type CareFilterId,
} from "@/lib/record/care-demo";
import { AssessmentChip } from "@/components/record/care-update-view";
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
/** Just the name, for a sentence that already has its own framing. `Provenance`
 *  renders the same union as a labelled line; this is for inline prose. A care
 *  update is always person-authored, so the fallback is defensive only. */
function personName(author: CareEvent["author"]): string {
  return author.kind === "person" ? author.name : "a supervisor"; // TODO-COPY
}

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

/** ═══ THE RELATIONAL LINE (Phase 2) ═══
 *
 *  What turns a flat log into a chain a supervisor can walk. One muted line under
 *  an entry saying where this one sits in its own sequence, and a link back to the
 *  one before it.
 *
 *  `previous` is ABSENT on a first occurrence, and the copy changes with it —
 *  "First flag", no link. A "previous: none" link would be a dead affordance, and
 *  the first flag in a record is a fact worth stating plainly rather than an
 *  absence to paper over. */
export interface RelationalLine {
  /** TODO-COPY. "3rd flag" / "First flag" / "Changed from F41.1". */
  lead: string;
  /** The entry this one follows, when there is one. */
  previous?: { id: string; at: number };
}

/** TODO-COPY. "2nd", "3rd", "11th" — the ordinal a flag's place in the sequence
 *  reads as. Handles the teens, which is where a naive suffix table breaks. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function Row({
  event,
  amendedBy,
  amends,
  relational,
  documents,
  documentedBy,
  onJump,
}: {
  event: CareEvent;
  /** The entry that supersedes this one, when there is one. */
  amendedBy?: CareEvent;
  /** The entry this one corrects, when it corrects one. */
  amends?: CareEvent;
  /** Flag, escalation and presentation-change entries only. */
  relational?: RelationalLine;
  /** ═══ THE TWO HALVES OF ONE DOCUMENTED EVENT ═══
   *
   *  `documents` — set on a care_update row: the presentation event it documents.
   *  `documentedBy` — set on a presentation_* row: the care update documenting it.
   *
   *  TWO ENTRIES, CROSS-REFERENCED, NEVER MERGED. A merged row would claim one
   *  thing happened where two did, and an append-only record cannot later take
   *  that apart. Each row reads on its own and points at its counterpart.
   *
   *  A standalone care update has neither, which is how it stays visibly
   *  standalone rather than looking like a link that failed to resolve. */
  documents?: CareEvent;
  documentedBy?: CareEvent;
  onJump: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const superseded = !!amendedBy;
  // A presentation row is expandable when it has an update to show, even though
  // it no longer carries a note of its own.
  const expandable =
    !!event.items?.length || !!event.providerNote || !!documentedBy;

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

          {/* ── THE RELATIONAL LINE. Muted, one line, beneath the existing
              content — no new rows and no new sections. It sits ABOVE the
              amendment chain because the chain is about this entry's own
              correction, which is a closer relationship than its place in a
              sequence. */}
          {relational && (
            <p
              className="mt-1.5 text-[var(--text-muted)]"
              style={{ font: "var(--type-row-label)" }}
            >
              {relational.lead}
              {relational.previous && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => onJump(relational.previous!.id)}
                    className={cn(
                      "rounded-sm underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
                      RING
                    )}
                  >
                    {/* TODO-COPY */}
                    {`previous ${dateOf(relational.previous.at)}`}
                    <span aria-hidden> →</span>
                  </button>
                </>
              )}
            </p>
          )}

          {/* WHAT THIS UPDATE DOCUMENTS, and whether an AI draft was revised.
              Both are secondary lines rather than disclosure content: a reader
              scanning History needs to know an entry is tied to a presentation
              change, and whether a diagnostic justification was actually read,
              WITHOUT opening anything. */}
          {documents && (
            <p
              className="mt-1.5 text-[var(--text-muted)]"
              style={{ font: "var(--type-row-label)" }}
            >
              {/* TODO-COPY */}
              {"Documents the "}
              <button
                type="button"
                onClick={() => onJump(documents.id)}
                className={cn(
                  "rounded-sm underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                {`${dateOf(documents.occurredAt)} ${documents.type === "presentation_changed" ? "presentation change" : "presentation review"}`}
                <span aria-hidden> →</span>
              </button>
            </p>
          )}

          {event.diagnosticPrefill && (
            <p
              className="mt-1.5 text-[var(--text-muted)]"
              style={{ font: "var(--type-row-label)" }}
            >
              {/* TODO-COPY — the fact, not a judgement of it. "Reviewed as
                  drafted" is not a criticism: a draft that was already right
                  should not have to be edited to look diligent. What matters is
                  that the reader can tell which happened. */}
              {event.diagnosticPrefill.edited
                ? `Diagnostic statement edited by ${personName(event.author)}`
                : "Diagnostic statement reviewed as drafted"}
            </p>
          )}

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
              ) : documentedBy ? (
                /* THE PRESENTATION ENTRY CARRIES ITS CARE UPDATE. It no longer
                   has a note of its own — the update IS the documentation — so
                   opening a presentation change shows the reasoning that was
                   committed with it, in the same words, rather than a second
                   copy of the prose or a bare link. */
                <div className="space-y-2">
                  <p
                    className="whitespace-pre-line text-[var(--text-secondary)]"
                    style={{ font: "var(--type-row-label)" }}
                  >
                    {documentedBy.providerNote}
                  </p>
                  {documentedBy.assessment && (
                    <AssessmentChip value={documentedBy.assessment} />
                  )}
                  <button
                    type="button"
                    onClick={() => onJump(documentedBy.id)}
                    className={cn(
                      "rounded-sm py-1 text-left underline underline-offset-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]",
                      RING
                    )}
                    style={{ font: "var(--type-row-label)" }}
                  >
                    {/* TODO-COPY */}
                    {`Open the ${dateOf(documentedBy.occurredAt)} care update`}
                    <span aria-hidden> →</span>
                  </button>
                </div>
              ) : (
                <p
                  className="whitespace-pre-line text-[var(--text-secondary)]"
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

/** WHAT THE PATTERN BLOCK CAN ASK OF HISTORY. One method, and it is a READ —
 *  filter and scroll, never a write.
 *
 *  EXPOSED AS A HANDLE RATHER THAN A PROP because `jump` already exists and
 *  already handles the part that is easy to get wrong: a target row can be
 *  filtered out of the DOM, so the filter is cleared BEFORE the scroll and the
 *  scroll waits a frame for the full list to paint. Re-implementing that at the
 *  call site is how the pattern block would end up with a dead link. */
export interface CareTimelineHandle {
  jump: (eventId: string) => void;
}

export function CareTimeline({
  events,
  ref,
}: {
  events: CareEvent[];
  /** React 19 — `ref` is a normal prop; no forwardRef needed. */
  ref?: React.Ref<CareTimelineHandle>;
}) {
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

  /** ═══ THE RELATIONAL INDEX (Phase 2) ═══
   *
   *  Built once over the WHOLE event set, oldest-first, so an entry's ordinal is
   *  its place in the record rather than its place in whatever the current filter
   *  is showing. A "3rd flag" that became the "2nd flag" when the reader clicked a
   *  chip would be worse than no line at all.
   *
   *  FLAGS AND ESCALATIONS SHARE ONE SEQUENCE. They are one clinical series — the
   *  playbook routes between the tiers as a concern develops — so an escalation
   *  that followed two risk flags is the third thing in that series, not the
   *  first of a separate one. */
  const relational = useMemo(() => {
    const out = new Map<string, RelationalLine>();
    const oldestFirst = [...events].sort((a, b) => a.occurredAt - b.occurredAt);

    // ── Flags and escalations, one shared ordinal sequence.
    let prevFlag: CareEvent | null = null;
    let flagN = 0;
    for (const e of oldestFirst) {
      if (e.type !== "risk_flag" && e.type !== "escalation") continue;
      flagN += 1;
      out.set(e.id, {
        /* TODO-COPY */
        lead: flagN === 1 ? "First flag" : `${ordinal(flagN)} flag`,
        ...(prevFlag ? { previous: { id: prevFlag.id, at: prevFlag.occurredAt } } : {}),
      });
      prevFlag = e;
    }

    // ── Presentation changes name the code they REPLACED and when it was
    //    assigned. `code` is the machine-readable field — the one that exists so
    //    nobody parses it back out of `result` prose.
    let prevPres: CareEvent | null = null;
    for (const e of oldestFirst) {
      if (
        e.type !== "presentation_assigned" &&
        e.type !== "presentation_changed"
      )
        continue;
      if (e.type === "presentation_changed" && prevPres?.code) {
        out.set(e.id, {
          /* TODO-COPY */
          lead: `Changed from ${prevPres.code}`,
          previous: { id: prevPres.id, at: prevPres.occurredAt },
        });
      }
      prevPres = e;
    }
    return out;
  }, [events]);

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

  // THE ONLY THING ANOTHER SURFACE MAY DO TO HISTORY.
  useImperativeHandle(ref, () => ({ jump }));

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
                relational={relational.get(e.id)}
                amends={e.amends ? byId.get(e.amends) : undefined}
                documents={e.documents ? byId.get(e.documents) : undefined}
                documentedBy={
                  e.documentedBy ? byId.get(e.documentedBy) : undefined
                }
                onJump={jump}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
