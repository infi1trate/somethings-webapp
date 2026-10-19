"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE SUPPORT LIST — four collapsible sections (SUP-3)
//
// Supervisors, Cohorts, Groups, Other. Supervisors opens by default and the
// rest start closed (`lib/support/disclosure.ts`), and whatever a reader opens
// or closes stays that way for them across routes and sessions.
//
// ═══ A HEADER IS A BUTTON ═══ `<button aria-expanded aria-controls>`, a
// rotating chevron, and the section's unread rolled up onto it while it is
// closed, so closing a section never hides that something is waiting.
//
// ═══ A ROW IS A BUTTON (SUP-4) ═══ It opens its thread in this panel. It was
// content in SUP-3, when there was no thread to open; a control that did
// nothing would have been enabled-but-dead (standing rule 3).
//
// ═══ THE STATES ═══ Loading is skeleton rows, never a spinner. Error says
// what happened and offers a retry. `partial` is one section failing while the
// others render, the case a real feed hits most. Offline is a banner over the
// list. First run (nobody to reach anywhere) says what Support is for. The
// load state is the dev bar's Load axis, as on every surface that has these.

import { useState } from "react";
import { ChevronDown, CloudOff, RotateCw } from "lucide-react";
import { RecordAvatar } from "@/components/record/record-avatar";
import { setSectionOpen, useDisclosure } from "@/lib/support/disclosure";
import { isFirstRun, type SupportRow, type SupportSection } from "@/lib/support/directory";
import { supportStamp, supportStampAbsolute } from "@/lib/support/relative-time";
import type { LoadState } from "@/lib/dev/load-state";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus-ring)]";

/** The section that fails under `partial`: a placeholder section, so the real
 *  one (Supervisors) still demonstrates rendering beside a failure. */
const PARTIAL_FAILS: SupportSection["id"] = "cohorts";

/** The unread pill — the chat list's (`conversation-row.tsx`): text-primary
 *  fill, text-inverse ink, ~15:1 in both themes. aria-hidden; the label says it. */
function Count({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] px-1 text-[10px] leading-none tabular-nums text-[var(--text-inverse)]"
    >
      {n}
    </span>
  );
}

function Row({ row, now, onOpen }: { row: SupportRow; now: number; onOpen: (id: string) => void }) {
  const online = row.presence === "online";
  return (
    <li data-support-row={row.id} className="border-b border-[color:var(--border-subtle)] last:border-b-0">
      <button
        type="button"
        data-support-row-open
        onClick={() => onOpen(row.id)}
        /* ═══ A COMPOSED NAME (SUP-6) ═══ Built from the parts, measured
           wrong: "Brandy Forrestor , online 1d You: …" — a stray space from
           the hidden suffix, and "1d" said as "one d". Now the order a reader
           needs: who, presence, what is waiting, what was said, when.
           TODO-COPY. */
        aria-label={([
          `${row.name}${online ? ", online" : ""}`,
          row.unread > 0 ? `${row.unread} unread` : null,
          row.preview ? `${row.previewFromViewer ? "You: " : ""}${row.preview}` : "No messages yet",
          row.at !== null ? supportStampAbsolute(row.at) : null,
        ].filter(Boolean) as string[])
          /* A part that already ends a sentence ("quickly.") takes a space,
             not a second full stop. */
          .reduce((acc, part) => (acc ? `${acc}${/[.!?]$/.test(acc) ? "" : "."} ${part}` : part), "")}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
      <span className="relative shrink-0">
        <RecordAvatar name={row.name} size={32} />
        {online && (
          /* 9px, `status-online`, a 1px `surface-canvas` ring (the pack's
             anatomy). Decoration: the name says "online" (WCAG 1.4.1). */
          <span
            aria-hidden
            data-presence-dot
            className="absolute -right-px -bottom-px size-[9px] rounded-full bg-[var(--status-online)] shadow-[0_0_0_1px_var(--surface-canvas)]"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[16px] leading-[24px] text-[var(--text-primary)]">
            {row.name}
            {/* TODO-COPY */}
            {online && <span className="sr-only">, online</span>}
          </span>
          {row.at !== null && (
            <time
              dateTime={new Date(row.at).toISOString()}
              title={supportStampAbsolute(row.at)}
              className="shrink-0 text-[12px] leading-[16px] tabular-nums text-[var(--text-tertiary)]"
            >
              {supportStamp(row.at, now)}
            </time>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[12px] leading-[16px] text-[var(--text-tertiary)]">
            {/* TODO-COPY: "You: " and the no-messages line. */}
            {row.preview ? `${row.previewFromViewer ? "You: " : ""}${row.preview}` : "No messages yet"}
          </span>
          {row.unread > 0 && (
            <>
              <Count n={row.unread} />
              <span className="sr-only">, {row.unread} unread</span>
            </>
          )}
        </span>
      </span>
      </button>
    </li>
  );
}

function SkeletonRows({ n = 2 }: { n?: number }) {
  return (
    <ul aria-hidden data-support-skeleton>
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-2 last:border-b-0">
          <span className="size-8 shrink-0 rounded-full bg-[var(--surface-sunken-strong)] motion-safe:animate-pulse" />
          <span className="flex min-w-0 flex-1 flex-col gap-2 py-1">
            <span className="h-3.5 w-2/5 rounded-full bg-[var(--surface-sunken-strong)] motion-safe:animate-pulse" />
            <span className="h-2.5 w-3/4 rounded-full bg-[var(--surface-sunken-strong)] motion-safe:animate-pulse" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ErrorLine({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" data-support-error className="flex flex-col items-start gap-2 px-4 py-3">
      <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        data-support-retry
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-full border border-[color:var(--border-default)] px-4 text-[14px] leading-[16px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
        )}
      >
        <RotateCw aria-hidden className="size-4" strokeWidth={1.75} />
        {/* TODO-COPY */}
        Try again
      </button>
    </div>
  );
}

/** ═══ OFFLINE ═══ A status banner at the top of the panel, in the list and
 *  in a thread alike. */
export function OfflineBanner() {
  return (
    <div
      role="status"
      data-support-offline
      className="mx-4 mt-3 flex shrink-0 items-start gap-2 rounded-[var(--radius-lrg)] bg-[var(--status-attention-bg)] px-3 py-2 text-[var(--status-attention-fg)]"
    >
      <CloudOff aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <p className="text-[14px] leading-[20px]">
        {/* TODO-COPY. Names what still works and what does not. */}
        You&apos;re offline. You can read what&apos;s here, and sending is off until you reconnect.
      </p>
    </div>
  );
}

export function SupportList({
  sections,
  pinned = null,
  persona,
  now,
  load,
  online,
  onOpen,
}: {
  sections: SupportSection[];
  /** A contact pinned from outside the directory (support-beside-hub). */
  pinned?: SupportRow | null;
  persona: string;
  now: number;
  load: LoadState;
  online: boolean;
  onOpen: (id: string) => void;
}) {
  const disclosure = useDisclosure(persona);
  /* ═══ RETRY IS PAGE-LOCAL ═══ It clears the dev axis's failure for THIS
     mount (the axis value it cleared is remembered, so moving the axis again
     fails again), passing through a short loading beat so the retry is seen to
     do something. A timer in a handler, not an effect. */
  const [cleared, setCleared] = useState<LoadState | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    window.setTimeout(() => {
      setCleared(load);
      setRetrying(false);
    }, 500);
  };
  const state: LoadState = retrying ? "loading" : cleared === load ? "ready" : load;

  return (
    <div data-support-list data-state={state} className="flex flex-col">
      {!online && <OfflineBanner />}

      {state === "error" ? (
        <ErrorLine
          /* TODO-COPY. What happened, and what to do. */
          text="Your support conversations didn't load. Check your connection, then try again."
          onRetry={retry}
        />
      ) : state !== "loading" && isFirstRun(sections) && !pinned ? (
        <div data-support-first-run className="flex flex-col gap-2 px-4 pt-4">
          <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
            {/* TODO-COPY */}
            Message your supervisors and the Somethings team here, without leaving what you&apos;re working on.
          </p>
          <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* TODO-COPY */}
            Supervisors, cohorts and groups you belong to will show up here.
          </p>
        </div>
      ) : (
        <>
        {/* ═══ PINNED (support-beside-hub) ═══ The observed mentor, while an
            escalation is open on what a supervisor is watching: above the
            sections, because it is the conversation that cannot wait. */}
        {pinned && state !== "loading" && (
          <section data-support-pinned className="border-b border-[color:var(--border-subtle)] pb-2">
            <h3 className="m-0 px-4 pt-3 pb-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Pinned · escalation open
            </h3>
            <ul>
              <Row row={pinned} now={now} onOpen={onOpen} />
            </ul>
          </section>
        )}
        {sections.map((s) => {
          const open = disclosure[s.id];
          const unread = s.rows.reduce((n, r) => n + r.unread, 0);
          const failed = state === "partial" && s.id === PARTIAL_FAILS;
          const bodyId = `support-section-${s.id}`;
          return (
            <section key={s.id} data-support-section={s.id} className="border-b border-[color:var(--border-subtle)] last:border-b-0">
              <h3 className="m-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  data-support-section-toggle
                  onClick={() => setSectionOpen(persona, s.id, !open)}
                  /* Composed, for the same stray-space reason as a row. */
                  aria-label={!open && unread > 0 && state !== "loading" ? `${s.label}, ${unread} unread` : s.label}
                  className={cn(
                    "flex h-12 w-full items-center gap-2 px-4 text-left transition-colors hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  <ChevronDown
                    aria-hidden
                    strokeWidth={1.75}
                    className={cn(
                      "size-4 shrink-0 text-[var(--icon-secondary)] motion-safe:transition-transform motion-safe:duration-200",
                      !open && "-rotate-90"
                    )}
                  />
                  <span className="min-w-0 flex-1 font-display text-[14px] leading-[16px] font-bold text-[var(--text-primary)]">
                    {s.label}
                  </span>
                  {/* THE ROLL-UP, closed only: open, the rows carry it. */}
                  {!open && unread > 0 && state !== "loading" && (
                    <>
                      <Count n={unread} />
                      {/* TODO-COPY */}
                      <span className="sr-only">, {unread} unread</span>
                    </>
                  )}
                </button>
              </h3>
              <div id={bodyId} hidden={!open} data-support-section-body className="pb-2">
                {state === "loading" ? (
                  <SkeletonRows />
                ) : failed ? (
                  <ErrorLine
                    /* TODO-COPY */
                    text={`${s.label} didn't load. The other sections are up to date.`}
                    onRetry={retry}
                  />
                ) : s.rows.length === 0 ? (
                  <p data-support-empty className="px-4 py-2 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                    {s.empty}
                  </p>
                ) : (
                  <ul>
                    {s.rows.map((r) => (
                      <Row key={r.id} row={r} now={now} onOpen={onOpen} />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
        </>
      )}
    </div>
  );
}
