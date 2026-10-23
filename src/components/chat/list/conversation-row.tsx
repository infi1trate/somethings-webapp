"use client";

// ONE ROW. Teen or support, no branch — see `ConversationList`'s note on why the
// sameness is load-bearing.
//
// ═══ ANATOMY, AND WHAT EACH PART IS FOR ═══
//
//   avatar · name + preview · time + unread
//
// The preview is the only line here that is not a fact about the relationship, so
// it gets the muted ink and the truncation. The name gets primary ink and never
// truncates before the preview does — a row where the name is clipped and the
// message is complete has its priorities backwards.
//
// ═══ "YOU:" IS A PREFIX, NOT A SEPARATE ELEMENT ═══
//
// One string, so it truncates as one string. Two spans meant the prefix survived
// at full opacity while the message it belonged to disappeared, which reads as a
// row about nothing.
//
// ═══ THE CHECK-IN CHIP NAMES THE GAP, NEVER THE TEEN ═══
//
// It says "Check in" — an action available to the mentor. It does not say at-risk,
// lapsed, cold or churning, because those are claims about a fifteen-year-old
// made by a query, and because a mentor who reads a label like that about someone
// they know stops trusting the rest of the screen. Its condition is
// `mentees-demo.ts`'s own `teen-quiet` state at its own threshold.
//
// It is a CHIP AND NOT A DOT: colour alone cannot carry it (SC 1.4.1), and this
// is a case where the difference matters — a mentor scanning fifteen rows for the
// one that needs them is exactly the reader a colour-only signal fails.

import { Shield } from "lucide-react";
import { RecordAvatar } from "@/components/record/record-avatar";
import type { ChatThread } from "@/lib/chat/types";
import type { RaiseTarget, Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ RELATIVE TIME, COARSE ON PURPOSE ═══
 *
 *  "3d", not "3 days ago", and never "17:42". A list of fifteen rows is scanned,
 *  and a scan wants a magnitude — the exact minute is in the thread, where it
 *  belongs. Coarsening also keeps the column narrow enough that the preview gets
 *  the width instead.
 *
 *  TODO-COPY. Under a minute reads "now" rather than "0m", which is a number that
 *  looks like an error. */
function shortAgo(at: number, now: number): string {
  const mins = Math.max(0, Math.floor((now - at) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

/** ═══ AN OPEN ESCALATION ON THIS CONVERSATION (pack v5.0, C1) ═══ */
export interface RowEscalation {
  /** The confirmed tier, else what was requested. */
  tier: Tier | Exclude<RaiseTarget, Tier>;
  /** Opened after the page's clock — the shield arrives with one pulse. */
  fresh: boolean;
}

/* The tier lozenge's ink: alert family for Tiers 1–2 ONLY (blocked
   constant), neutral for Tier 3 and a platform concern. */
const SHIELD_INK: Record<string, string> = { 1: "text-[var(--t1-ink)]", 2: "text-[var(--t2-ink)]" };

export function ConversationRow({
  thread,
  selected,
  now,
  onSelect,
  escalation,
}: {
  thread: ChatThread;
  selected: boolean;
  /** REQUIRED, and passed from the page's mount-fixed clock. Not defaulted to
   *  `Date.now()`: reading the clock in render scope is impure —
   *  `react-hooks/purity` rejects it — and it would also let fifteen rows in one
   *  render disagree about what "3d" means. */
  now: number;
  onSelect: () => void;
  escalation?: RowEscalation;
}) {
  const clock = now;
  const unread = thread.unreadCount > 0;

  /** TODO-COPY. The whole row, spoken, in the order a reader would want it:
   *  who, then whether anything is waiting, then what was last said. */
  const label = [
    thread.displayName,
    /* TODO-COPY. Said in words, so the shield is never colour alone. */
    escalation ? (escalation.tier === "platform" ? "platform concern open" : `escalation open, Tier ${escalation.tier}`) : null,
    unread ? `${thread.unreadCount} unread` : null,
    thread.needsCheckIn ? "worth a check-in" : null,
    thread.preview
      ? `${thread.previewFromMentor ? "you said" : "they said"} ${thread.preview}`
      : null,
    shortAgo(thread.lastActivityAt, clock),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      // Per-thread, not per-type — see the note in `worklist.tsx`.
      data-anno-ref={`conversation-row:${thread.id}`}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      aria-label={label}
      className={cn(
        "flex w-full items-center gap-3 border-b border-[color:var(--border-subtle)] px-3 py-3 text-left transition-colors",
        // SELECTED IS A FILL, focus is the ring. A reader arrowing a list sees
        // the ring move while the fill stays put — the same separation the Tasks
        // worklist makes.
        selected
          ? "bg-[var(--surface-s2)]"
          : "hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      {/* 30 is the largest size `RecordAvatar` defines, and the set is closed on
          purpose — the tints and the initial's size are tuned per step. A 38px
          avatar here would have meant adding a step to a shared primitive to suit
          one row. */}
      <RecordAvatar name={thread.displayName} size={30} />

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[var(--text-primary)]",
              // The one place a weight change is available: Avantt Bold IS
              // shipped, and `--type-card-title` is the Avantt stop at this size.
              // Unread gets it; read rows get the regular body face. No
              // `font-semibold` on Lausanne anywhere — that weight is not shipped
              // and the browser would synthesise it (gap row 330).
              unread && "font-display"
            )}
            style={{ font: unread ? "var(--type-card-title)" : "var(--type-body)" }}
          >
            {thread.displayName}
          </span>
          {/* ═══ THE SELECTED ROW'S INK STEPS UP, AND THIS IS GAP ROW 294 AGAIN ═══
              MEASURED BY AXE: `--text-muted` (#6e6b67) on `--surface-s2` (#e5e0d2)
              is 4.01:1 — under the 4.5 floor for 12px text. It passes on the card
              and fails on the selected fill, so it fails only on the row a reader
              is looking at.
              The Tasks worklist hit this exact pairing and took the same fix:
              `--text-secondary` (#58534b) is 5.78:1 on s2 and is the design
              system's own next step, so nothing is invented. Conditional here
              rather than unconditional because these rows DO sit on the card most
              of the time, where muted is correct and quieter. */}
          {/* ═══ THE SHIELD, AT THE LEADING META POSITION (C1) ═══ Before the
              time, beside (never instead of) the unread disc. It arrives with
              one soft pulse when the escalation is new (make it magical 2),
              then holds still. Resolved escalations show nothing. */}
          {escalation && (
            <span
              aria-hidden
              data-row-escalation={String(escalation.tier)}
              className={cn("inline-flex shrink-0 self-center", SHIELD_INK[String(escalation.tier)] ?? "text-[var(--text-secondary)]", escalation.fresh && "shield-arrive")}
            >
              <Shield className="size-3.5" strokeWidth={2.25} />
            </span>
          )}
          <span
            className={cn(
              "shrink-0 tabular-nums",
              selected ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
            )}
            style={{ font: "var(--type-field-label)" }}
          >
            {shortAgo(thread.lastActivityAt, clock)}
          </span>
        </span>

        <span className="mt-0.5 flex min-w-0 items-center gap-2">
          {/* ONE STRING, so it truncates as one — see the module note. */}
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              // Same reason as the timestamp above — see its note.
              unread || selected
                ? "text-[var(--text-secondary)]"
                : "text-[var(--text-muted)]"
            )}
            style={{ font: "var(--type-body)" }}
          >
            {thread.preview
              ? `${thread.previewFromMentor ? "You: " : ""}${thread.preview}`
              : /* TODO-COPY. A matched pair with nothing sent yet — a fact, not a
                   nudge. The nudge belongs to the Assist panel. */
                "No messages yet"}
          </span>

          {thread.needsCheckIn && (
            <span
              className="shrink-0 rounded-full bg-[var(--band-sand-bg)] px-2 py-0.5 text-[var(--band-sand-fg)]"
              style={{ font: "var(--type-field-label)" }}
            >
              {/* TODO-COPY */}
              Check in
            </span>
          )}
          {unread && (
            /* ═══ NEUTRAL, NOT RED ═══
               The shell's nav badge is `--state-error`, and that is right for it:
               one global signal, seen from anywhere, that something arrived. A
               list of fifteen conversations is not that — fifteen red discs spend
               the whole alarm budget on "you have messages", and this surface
               needs that budget for escalations.
               `--text-primary` fill with `--text-inverse` ink is the pairing the
               token file itself prescribes, and both halves flip together, so the
               disc is dark-on-light and light-on-dark without a second rule.
               MEASURED: ~15:1 in both modes.
               The count is aria-hidden because the row's own label already says
               "N unread" — announcing it twice is worse than not at all. */
            <span
              aria-hidden
              className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] px-1 tabular-nums text-[10px] leading-none text-[var(--text-inverse)]"
            >
              {thread.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
