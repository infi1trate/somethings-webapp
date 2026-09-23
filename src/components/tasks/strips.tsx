"use client";

// THE PINNED STRIP — Respond (§3.2). Next-up (§3.1) was removed; see the note
// where it stood.
//
// ═══ THE ALARM BUDGET LIVES AND DIES HERE ═══
// The Respond strip is THE ONLY SURFACE IN THE TASKS PAGE using the filled
// saturated red/rose treatment (§3.2 + §3.3). Not the cards, not the rows, not the
// pane, not the breach chip. If a second filled-red thing appears anywhere on this
// page, the strip stops meaning anything — that is the entire reason the budget is
// written as a rule rather than a preference.
//
// ═══ THE PAGE NOW HAS NO PRIMARY BUTTON ABOVE THE LIST ═══
// The Next-up CTA used to be it, and its removal is not a gap to fill. The
// question it answered — "what should I do now" — is answered by the surface
// itself: the list is sorted by the priority comparator and the pane opens on its
// head. A button restating that was a second answer to a question already
// answered, and the one place two answers can disagree.
//
// Everything on this page stays tonal secondary. If a filled primary reappears
// above the list, it needs a reason that is not "there used to be one."

import Link from "next/link";
import { AlertTriangle, Phone } from "lucide-react";
import { RecordButton } from "@/components/record/record-button";
import { type TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. Elapsed since open, in the house format — mono figures so a live
 *  counter does not jitter as digits change width. */
export function elapsedLabel(openedAt: number, now: number): string {
  const ms = Math.max(0, now - openedAt);
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** THE ESCALATION'S OWN PATH — and it resolves now (arch-G, G6).
 *
 *  IT WAS A STUB. The note here said "no escalation surface exists in this repo
 *  — audited", and that was true through arch-A: the Care tab's flag REVIEW
 *  modal closes a flag rather than running an escalation, so every link-out
 *  landed on a placeholder sentence (gap row 213).
 *
 *  It is a HOP now. The route redirects to the record on Monitoring, which
 *  arch-mon built and G6 gave a timeline, the note module and a terminal state.
 *  The LINK SHAPE is unchanged, which is why every caller was left alone — see
 *  `escalationRecordHref` for why the hop is kept rather than inlined.
 *
 *  WHAT IS STILL OPEN: the escalation FLOW — running one, live — has no surface
 *  here. Reading the record is not the same as conducting the escalation, so row
 *  213 narrows rather than closes. */
export function escalationHref(escalationId: string): string {
  return `/app/escalation/${encodeURIComponent(escalationId)}`;
}

/** ═══ WHERE THE RECORD ACTUALLY OPENS (arch-G, G6) ═══
 *  `/app/escalation/[id]` is a HOP: it redirects here. This is the destination,
 *  and it is exported so the hop and anything that wants to skip it build one
 *  URL rather than two spellings of it.
 *  THE LINKS KEEP USING THE HOP, deliberately. Every "Open the escalation
 *  record" on every surface points at the escalation's own path, which is the
 *  URL a reader would expect to see and the one that stays right if the record
 *  ever gets a page of its own. Rewriting forty call sites to Monitoring's
 *  query string would bake this phase's hosting decision into every caller. */
export function escalationRecordHref(escalationId: string): string {
  /* ═══ IT POINTED AT A RETIRED ROUTE, AND THAT WAS AN INFINITE LOOP ═══
     Phase 1 turned `/app/monitoring` into a hop whose `?escalation=` branch
     maps to `/app/escalation/{id}` — which is the hop that calls THIS function.
     So a reader opening any escalation record bounced
     `/app/escalation/X` → `/app/monitoring?escalation=X` → `/app/escalation/X`
     forever, both legs a `router.replace`, so Back could not escape it either.
     Phase 1's probe opened the retired routes and asserted the FIRST hop's URL,
     which is exactly the assertion a two-hop cycle passes.
     The record's destination is `/app/escalations` now. */
  return `/app/escalations?escalation=${encodeURIComponent(escalationId)}`;
}

// ── Respond strip (§3.2) ────────────────────────────────────────────────────

export function RespondStrip({
  escalations,
  now,
}: {
  escalations: TaskItem[];
  now: number;
}) {
  // ESCALATIONS ARE NEVER ONLY INSIDE A TAB (locked decision 10). This renders
  // above the tabs and is identical from every one of them, because it is fed the
  // whole item set rather than the active domain.
  if (escalations.length === 0) return null;

  return (
    <section
      /* TODO-COPY */
      aria-label="Open escalations"
      className="overflow-hidden rounded-[var(--radius-elevated)]"
      style={{
        // THE ONE FILLED SATURATED TREATMENT ON THIS PAGE. Nothing else here may
        // use it.
        //
        // `--task-respond-bg`, not `--alert-critical-accent`: the alert token
        // INVERTS in dark mode to a bright tangelo, where white text on it
        // measures 2.78:1 and fails AA. The respond token is defined in `:root`
        // only and does not theme — an alarm should be the same object in both
        // modes. Row 214.
        backgroundColor: "var(--task-respond-bg)",
      }}
    >
      <ul className="divide-y divide-[color-mix(in_oklab,var(--task-respond-fg)_20%,transparent)]">
        {escalations.map((item) => {
          const p = item.payload;
          const is911 = p.kind === "escalation" ? p.is911 : false;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <AlertTriangle
                className="size-4 shrink-0 text-[var(--task-respond-fg)]"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-[20px] text-[var(--task-respond-fg)]">
                  {item.teenDisplayName}
                </span>
                <span className="block text-[12px] leading-[16px] text-[color-mix(in_oklab,var(--task-respond-fg)_75%,transparent)]">
                  {/* TODO-COPY */}
                  to {item.mentorName}
                </span>
              </span>

              {/* 911 / NON-911. Icon plus text — never colour alone, and on a
                  saturated ground colour could not carry it anyway. */}
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--task-respond-fg)_20%,transparent)] px-2 py-0.5 text-[11.5px] font-semibold leading-[16px] text-[var(--task-respond-fg)]">
                <Phone className="size-3 shrink-0" aria-hidden />
                {/* TODO-COPY */}
                {is911 ? "911 dispatched" : "No 911"}
              </span>

              {/* LIVE ELAPSED COUNTER, mono. */}
              <span
                className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--task-respond-fg)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {elapsedLabel(item.openedAt, now)}
              </span>

              <Link
                href={escalationHref(
                  p.kind === "escalation" ? p.escalationId : item.objectId
                )}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full bg-[var(--task-respond-fg)] px-3.5 text-[13px] font-semibold",
                  "text-[var(--task-respond-bg)] transition-opacity hover:opacity-90",
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

// THE NEXT-UP STRIP LIVED HERE. Removed with its two helpers
// (`nextUpSentence`, `BreachedInline`) — see the note at its old mount in
// `tasks-page.tsx` for why. `nextUp` in `lib/tasks/sort.ts` is untouched and
// still orders the list, pre-selects the pane and drives auto-advance. (The
// shift digest it also fed was removed in full — see the note in
// `tasks-page.tsx`.)

/** A tonal secondary button for the tasks surface. Re-exported from the record's
 *  own secondary so the two cannot drift — every button on this page except the
 *  pane's own confirm is one of these. */
export { RecordButton as TaskSecondaryButton };
