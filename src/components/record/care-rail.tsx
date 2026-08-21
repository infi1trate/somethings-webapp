"use client";

// CARE RAIL (MO-9.1 Prompt C, Phases 1–3).
//
// THE RAIL HOLDS THE INTERPRETIVE LAYER; THE MAIN COLUMN HOLDS THE EVIDENTIARY
// LAYER. Nothing from the timeline is duplicated here — the Figma exploration's
// filtered History rail is deliberately NOT built, because the timeline in the
// main column IS the record and a second, filtered copy of it beside the first
// invites a reader to trust whichever one is shorter.
//
// Two segments: Summary (the AI read) · Notes (what supervisors wrote).
//
// The AI summary is DECISION SUPPORT, NOT RECORD, and its typography says so:
// smaller than care-update body copy, secondary ink, never bold. Mentors read
// this page, and an AI paragraph set like an authored clinical account would be
// read as one. It carries an explicit label, an AI-marked icon, a limitation
// line, an "Updated" date and a manual refresh.
//
// EVENTS, NOT MESSAGE CONTENT — in both segments. "View conversation" leaves for
// the conversation surface rather than excerpting anything here.

import { useState } from "react";
import Link from "next/link";
import { MessagesSquare, RefreshCw, Sparkles } from "lucide-react";
import { SegmentedControl } from "@/components/record/segmented-control";
import { clinicalDate } from "@/components/record/care-presentation";
import { chatHrefFor } from "@/lib/record/chat";
import {
  AI_SUMMARY_LIMITATION,
  CARE_UPDATE_SECTIONS,
  type CareAiSummary,
  type CareUpdateRecord,
} from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-4";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;
const TEXT_LINK =
  "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70";

export type CareRailSegment = "summary" | "notes";

// ── Summary ─────────────────────────────────────────────────────────────────

function AiSummary({
  summary,
  refreshedAt,
  onRefresh,
  conversationHref,
}: {
  summary: CareAiSummary | null;
  /** A supervisor's manual refresh, if one has happened. */
  refreshedAt: number | null;
  /** Supervisor tier only — absent below it, never a disabled refresh. */
  onRefresh?: () => void;
  conversationHref: string;
}) {
  const updatedAt = refreshedAt ?? summary?.generatedAt ?? null;

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <p
          className="flex items-center gap-1.5 text-[var(--text-muted)]"
          style={LABEL_STYLE}
        >
          <Sparkles className="size-3.5" aria-hidden />
          {/* TODO-COPY */}
          AI summary
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            /* TODO-COPY */
            aria-label="Refresh the AI summary"
            className={cn(
              "-m-1.5 shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <RefreshCw className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {summary ? (
        // SUBORDINATE TYPOGRAPHY, on purpose: 13px against the care update's
        // 14px, secondary ink, regular weight. This must not read as an
        // authoritative account of a teen.
        <p className="mt-2.5 text-[13px] leading-[19px] font-normal text-[var(--text-secondary)]">
          {summary.text}
        </p>
      ) : (
        <p className="mt-2.5 text-[13px] leading-[19px] text-[var(--text-muted)]">
          {/* TODO-COPY — before a trend exists to describe. */}
          Not enough data yet.
        </p>
      )}

      {/* The limitation line renders whether or not there is a summary: what
          this thing IS matters as much when it has nothing to say. */}
      <p className="mt-3 border-t border-[var(--border-subtle)] pt-2.5 text-[12px] leading-[17px] text-[var(--text-muted)]">
        {AI_SUMMARY_LIMITATION}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {updatedAt && (
          <p className="text-[12px] leading-[17px] text-[var(--text-muted)]">
            {/* Clinical-adjacent date: explicit, not elapsed — same reason as
                the presentation provenance line. */}
            {`Updated ${clinicalDate(updatedAt)}`}
          </p>
        )}
        {/* Events, not content: this LEAVES for the conversation rather than
            excerpting a message here. */}
        <Link
          href={conversationHref}
          className={cn(TEXT_LINK, "inline-flex items-center gap-1.5")}
        >
          <MessagesSquare className="size-3.5" aria-hidden />
          {/* TODO-COPY */}
          View conversation
        </Link>
      </div>
    </div>
  );
}

// ── Notes ───────────────────────────────────────────────────────────────────

/** One care update, read view. The Figma's three prompts are the READ structure
 *  too, not just the compose template — it keeps an update skimmable. */
export function CareUpdateBodyView({
  update,
  compact = false,
}: {
  update: CareUpdateRecord;
  compact?: boolean;
}) {
  const filled = CARE_UPDATE_SECTIONS.filter((s) => update.body[s.id].trim());
  return (
    <div className={compact ? "space-y-2.5" : "space-y-4"}>
      {filled.map((s) => (
        <div key={s.id}>
          <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
            {s.label}
          </p>
          {/* 14px — one step ABOVE the AI summary, deliberately. Human clinical
              writing outranks decision support on this page. */}
          <p className="mt-1 whitespace-pre-line text-[14px] leading-[20px] text-[var(--text-primary)]">
            {update.body[s.id].trim()}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Author + date. Amendments say what they amend, so a reader never has to work
 *  out which of two updates is current. */
export function CareUpdateByline({
  update,
  amendsDate,
}: {
  update: CareUpdateRecord;
  amendsDate?: number;
}) {
  return (
    <p className="text-[12px] leading-[17px] text-[var(--text-muted)]">
      {`${update.author} · ${update.authorRole} · ${clinicalDate(update.createdAt)}`}
      {amendsDate !== undefined && (
        <>
          {" · "}
          {/* TODO-COPY */}
          {`amends the ${clinicalDate(amendsDate)} update`}
        </>
      )}
    </p>
  );
}

function Notes({
  updates,
  onCompose,
  onAmend,
}: {
  updates: CareUpdateRecord[];
  /** Supervisor tier only. Absent below it — no disabled compose button. */
  onCompose?: () => void;
  onAmend?: (update: CareUpdateRecord) => void;
}) {
  const byId = new Map(updates.map((u) => [u.id, u]));
  const superseded = new Set(updates.map((u) => u.amends).filter(Boolean));

  return (
    <div className="space-y-3">
      {onCompose && (
        <button type="button" onClick={onCompose} className={cn(CARD, "w-full text-left", RING)}>
          <span className={cn(TEXT_LINK, "no-underline")}>
            {/* TODO-COPY */}
            Write a care update
          </span>
          <span className="mt-1 block text-[12px] leading-[17px] text-[var(--text-muted)]">
            {/* TODO-COPY — names the scaffolding so the shape is known before
                the compose surface opens. */}
            Where things stand, direction of care, what you are watching.
          </span>
        </button>
      )}

      {updates.length === 0 ? (
        <div className={CARD}>
          <p className="text-[13px] leading-[19px] text-[var(--text-muted)]">
            {/* TODO-COPY */}
            No care updates yet.
          </p>
        </div>
      ) : (
        updates.map((u) => (
          <div
            key={u.id}
            className={cn(
              CARD,
              // Superseded updates are RECESSED, not dimmed — same reasoning as
              // the timeline: the update a correction points at is the one a
              // reader must still be able to read.
              superseded.has(u.id) && "bg-[var(--surface-s1)]"
            )}
          >
            <CareUpdateBodyView update={u} compact />
            <div className="mt-3 border-t border-[var(--border-subtle)] pt-2.5">
              <CareUpdateByline
                update={u}
                amendsDate={u.amends ? byId.get(u.amends)?.createdAt : undefined}
              />
              {superseded.has(u.id) && (
                <p className="mt-1 text-[12px] leading-[17px] text-[var(--alert-warm-fg)]">
                  {/* TODO-COPY */}
                  A later update amends this one.
                </p>
              )}
              {onAmend && !superseded.has(u.id) && (
                <button
                  type="button"
                  onClick={() => onAmend(u)}
                  className={cn(TEXT_LINK, "mt-2")}
                >
                  {/* TODO-COPY — never "Edit": nothing is edited, an amendment
                      is appended and both keep rendering. */}
                  Amend
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── The rail ────────────────────────────────────────────────────────────────

export function CareRail({
  summary,
  summaryRefreshedAt,
  onRefreshSummary,
  personId,
  updates,
  onCompose,
  onAmend,
}: {
  summary: CareAiSummary | null;
  summaryRefreshedAt: number | null;
  onRefreshSummary?: () => void;
  personId: string;
  updates: CareUpdateRecord[];
  onCompose?: () => void;
  onAmend?: (update: CareUpdateRecord) => void;
}) {
  const [segment, setSegment] = useState<CareRailSegment>("summary");

  return (
    <div className="min-w-0">
      <SegmentedControl
        size="md"
        fullWidth
        semantics="tabs"
        ariaLabel="Care rail"
        options={[
          { value: "summary" as const, label: "Summary", controls: "care-rail-summary" },
          { value: "notes" as const, label: "Notes", controls: "care-rail-notes" },
        ]}
        value={segment}
        onChange={setSegment}
      />
      <div className="mt-3">
        {segment === "summary" ? (
          <div id="care-rail-summary" role="tabpanel">
            <AiSummary
              summary={summary}
              refreshedAt={summaryRefreshedAt}
              onRefresh={onRefreshSummary}
              conversationHref={chatHrefFor(personId)}
            />
          </div>
        ) : (
          <div id="care-rail-notes" role="tabpanel">
            <Notes updates={updates} onCompose={onCompose} onAmend={onAmend} />
          </div>
        )}
      </div>
    </div>
  );
}
