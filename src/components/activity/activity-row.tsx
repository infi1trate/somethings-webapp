"use client";

// THE LEDGER ROW. Single density, one line at desktop width, wrapping to two when
// there is not room.
//
// [actor avatar] [type glyph] [event sentence] [timestamp] [hover actions]
//
// IT IS A LEDGER, NOT A TO-DO LIST, and the row is built to make that legible:
//   · Every sentence is past tense and declarative. Nothing here is an
//     instruction, because there is no inline control that could carry one out —
//     see the grammar note in lib/activity/sentences.ts.
//   · The actions are Clear and Open. NOT Resolve, NOT Approve. Working the item
//     happens on the record; this surface records that it happened.
//   · No severity tint on the row and no band. The glyph carries the domain, the
//     sentence carries the fact, and a row about an escalation is the same shape
//     as a row about a survey.
//
// WHOLE ROW IS THE LINK. Implemented as an absolutely-positioned link BEHIND the
// content, with the action buttons above it — the same pattern PastMenteeRow
// already uses, and the only way to get a full-row target without nesting buttons
// inside an anchor (invalid HTML, and a keyboard trap in practice).
//
// HOVER ACTIONS ARE NEVER HOVER-ONLY. Revealed on :hover AND :focus-within, so a
// keyboard reader tabbing into the row sees them appear exactly when a mouse
// reader would. `opacity` rather than `display`, so they keep their place in the
// tab order at all times and the row does not reflow when they appear.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Receipt,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { ActivityDomain } from "@/lib/activity/events";
import type { FeedRow } from "@/lib/activity/query";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** DOMAIN GLYPHS. Icon + tint per workflow domain.
 *
 *  TINTS ARE AN INTERIM — see design-system-gaps.md row 203. There is no Tasks
 *  page and no tier-tint tokens to reuse, and the existing tint families are
 *  severity-shaped while this axis is domain-shaped. Billing and lifecycle
 *  deliberately share `--text-secondary`: both are neutral-operational, and colour
 *  is never the only channel here (the icon shape differs, and the sentence names
 *  the thing in words). */
const DOMAIN_GLYPH: Record<
  ActivityDomain,
  { icon: typeof AlertTriangle; tint: string; label: string }
> = {
  escalation: {
    icon: AlertTriangle,
    tint: "var(--band-clay-fg)",
    label: "Escalation",
  },
  risk: { icon: ShieldAlert, tint: "var(--band-amber-fg)", label: "Risk flag" },
  review: {
    icon: ClipboardCheck,
    tint: "var(--band-sand-fg)",
    label: "Review",
  },
  billing: { icon: Receipt, tint: "var(--text-secondary)", label: "Billing" },
  lifecycle: {
    icon: UserRound,
    tint: "var(--text-secondary)",
    label: "Teen lifecycle",
  },
};

/** The actor's avatar. A SYSTEM EVENT GETS THE SOMETHINGS GLYPH, not a person
 *  (A3 step 7) — an overdue clock is not somebody's action, and giving it a
 *  person-shaped avatar would attribute a cron job to a colleague. */
function ActorAvatar({ row }: { row: FeedRow }) {
  if (row.actorIsSystem) {
    return (
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[var(--text-secondary)]"
      >
        <Sparkles className="size-3" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[11px] font-semibold text-[var(--text-secondary)]"
    >
      {row.actorName.charAt(0).toUpperCase()}
    </span>
  );
}

export function ActivityRow({
  row,
  href,
  onClear,
  onRestore,
  onSeen,
}: {
  row: FeedRow;
  href: string;
  onClear: (row: FeedRow) => void;
  /** Present when the Cleared items filter is on. Its presence is what swaps
   *  Clear for Restore — the row does not need to be told which mode it is in. */
  onRestore?: (row: FeedRow) => void;
  /** Fired once the row has been on screen for the dwell period. */
  onSeen: (row: FeedRow) => void;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const glyph = DOMAIN_GLYPH[row.domain];
  const Icon = glyph.icon;
  const unread = row.state === "unread";
  const cleared = row.state === "cleared";
  const [open, setOpen] = useState(false);
  /** A GROUP OF ONE HAS NO DISCLOSURE, and neither does a DEGRADED group — the
   *  query omits `members` in both cases, so the row does not decide this. */
  const members = row.members;

  /** MARK READ ON VIEW, NOT ON CLICK — with a dwell so that scrolling past at
   *  speed does not silently consume a day of unread rows. ~1s, per A3 step 7.
   *
   *  The timer is cleared when the row leaves the viewport, so a row has to be
   *  continuously visible for the full dwell rather than accumulating credit
   *  across several fast passes. */
  useEffect(() => {
    const el = ref.current;
    if (!el || !unread) return;
    // No IntersectionObserver (older browser, or a test environment): fall back
    // to doing nothing rather than marking everything read on mount.
    if (typeof IntersectionObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => onSeen(row), 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [row, unread, onSeen]);

  return (
    <li ref={ref} className="group relative">
      {/* BEHIND the content, covering the row. */}
      <Link
        href={href}
        // THE ACCESSIBLE NAME IS THE FULL SENTENCE PLUS THE ABSOLUTE TIME —
        // never the truncated visual string, and never the time-of-day alone
        // (the day divider that supplies the date is not in the accessible name).
        aria-label={`${row.sentence} ${row.absolute}${unread ? ". Unread" : ""}`}
        className={cn(
          "absolute inset-0 z-0 rounded-[10px] transition-colors",
          "group-hover:bg-[var(--tint-faint)]",
          "focus-visible:bg-[var(--tint-faint)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[color:var(--focus-ring)]"
        )}
      />

      {/* REDUCED EMPHASIS FOR A CLEARED ROW. Opacity on the content only — never
          on the action, which must stay legible for Restore to be usable. */}
      <div
        className={cn(
          "pointer-events-none relative z-10 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2",
          cleared && "opacity-60"
        )}
      >
        {/* UNREAD IS NEVER COLOUR OR WEIGHT ALONE. An explicit dot with a text
            alternative — the dot is decorative and the <span class="sr-only">
            carries the fact. */}
        <span className="flex w-2 shrink-0 items-center justify-center">
          {unread && (
            <>
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-[var(--brand)]"
              />
              <span className="sr-only">Unread. </span>
            </>
          )}
        </span>

        <ActorAvatar row={row} />

        <span
          aria-hidden
          className="flex size-4 shrink-0 items-center justify-center"
          style={{ color: glyph.tint }}
        >
          <Icon className="size-4" />
        </span>
        {/* The glyph's meaning in words, for anyone who cannot see the tint. */}
        <span className="sr-only">{glyph.label}. </span>

        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[14px] leading-[20px]",
            unread
              ? "font-medium text-[var(--text-primary)]"
              : "text-[var(--text-primary)]"
          )}
        >
          {row.sentence}
        </span>

        {/* DISCLOSURE. Expands IN PLACE; it does not navigate. `pointer-events-auto`
            lifts it above the full-row link layer. */}
        {members && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={
              open
                ? `Hide the ${members.length} events behind this row`
                : `Show the ${members.length} events behind this row`
            }
            className={cn(
              "pointer-events-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full",
              "text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform motion-reduce:transition-none",
                open && "rotate-90"
              )}
              aria-hidden
            />
          </button>
        )}

        <time
          dateTime={row.occurredAt}
          className="shrink-0 tabular-nums text-[12px] leading-[16px] text-[var(--text-muted)]"
        >
          {row.timestamp}
        </time>

        {/* ACTIONS. `pointer-events-auto` re-enables them above the link layer;
            the wrapper is inert so the whole row stays clickable. */}
        <span
          className={cn(
            "pointer-events-auto flex shrink-0 items-center gap-1",
            "opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          <button
            type="button"
            onClick={() => (onRestore ? onRestore(row) : onClear(row))}
            aria-label={
              onRestore
                ? `Restore. ${row.sentence}`
                : `Clear. ${row.sentence}`
            }
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[12px] font-semibold",
              "text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {onRestore ? (
              <RotateCcw className="size-3.5" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
            {/* TODO-COPY */}
            {onRestore ? "Restore" : "Clear"}
          </button>
          <Link
            href={href}
            aria-label={`Open. ${row.sentence}`}
            className={cn(
              "inline-flex min-h-8 items-center rounded-full px-2 text-[12px] font-semibold",
              "text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {/* TODO-COPY */}
            Open
          </Link>
        </span>
      </div>

      {/* CONSTITUENTS, indented beneath. A nested <ol> so the list semantics hold
          all the way down, and each member is a plain row: no disclosure of its
          own, no group treatment. */}
      {members && open && (
        <ol className="relative z-10 mb-1 ml-9 border-l border-[color:var(--border-subtle)] pl-3">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-0.5 py-1"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
                {m.sentence}
              </span>
              <time
                dateTime={m.occurredAt}
                className="shrink-0 tabular-nums text-[11.5px] leading-[16px] text-[var(--text-muted)]"
              >
                {m.timestamp}
              </time>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
