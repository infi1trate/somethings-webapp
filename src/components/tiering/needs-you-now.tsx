"use client";

// ═══════════════════════════════════════════════════════════════════════════
// NEEDS YOU NOW — the bell's Tier 1 rows (Monitoring v4, §4)
//
// Each unconfirmed Tier 1 is one row, above everything else in the tray:
//   28px glyph circle (the t1 ink on the queue container's 40% wash)
//   "Confirm Tier 1 · Riley M."            Avantt 15 — the face is the emphasis
//   "Flagged by Brandon F. · note + C-SSRS" 13 secondary
//   right: the response state ("Overdue 14m" in t1-ink, mono, tabular) and
//          the row's ONE action as a small pill — Join filled, Observe and
//          Resume outlined, following the holder exactly as the queue does.
//
// ONE TARGET PER ROW: the action is the row's button, stretched over it, so
// the whole row is clickable and the tray has one Tab stop per escalation.
// The rows are derived from the record, never from a seen state — marking
// the bell read cannot clear one; it leaves when a supervisor confirms.

import { useRouter } from "next/navigation";
import { ShieldAlert, Volume2, VolumeX } from "lucide-react";
import { monitoringEntryHref } from "@/lib/monitoring/entry-href";
import { markJoined } from "@/lib/monitoring/t1-live";
import { flaggedLine, responseText, type T1Action, type T1Row } from "@/lib/monitoring/t1-queue";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
/* TODO-COPY */
const ACTION_LABEL: Record<T1Action, string> = { join: "Join", observe: "Observe", resume: "Resume" };

export function NeedsYouNow({ rows, onNavigate }: { rows: T1Row[]; onNavigate: () => void }) {
  const router = useRouter();
  if (rows.length === 0) return null;
  return (
    <section data-needs-you-now aria-labelledby="needs-you-now-label" className="mb-3 border-b border-[color:var(--border-subtle)] pb-3">
      <h3 id="needs-you-now-label" className="px-1 pb-1.5 text-[11px] leading-[16px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">
        {/* TODO-COPY */}
        Needs you now
      </h3>
      <ul className="space-y-0.5">
        {rows.map((r) => {
          const t = r.teen;
          const link = monitoringEntryHref(t);
          const overdue = r.response.kind === "overdue";
          const title = `Confirm Tier 1 · ${t.teen}`;
          return (
            <li key={r.id} data-needs-row={r.id} data-needs-action={r.action} className="relative flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-[var(--tint-hover)]">
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--t1-soft)_40%,transparent)] text-[var(--t1-ink)]">
                <ShieldAlert className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span data-needs-title className="block truncate font-display text-[15px] leading-[20px] font-bold text-[var(--text-primary)]">
                  {title}
                </span>
                <span data-needs-flagged className="block truncate text-[13px] leading-[16px] text-[var(--text-secondary)]">
                  {flaggedLine(t.mentor, r.teen.t1!.escalation)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span data-needs-response={r.response.kind} className={cn("font-mono text-[12px] leading-[16px] tabular-nums", overdue ? "text-[var(--t1-text)]" : "text-[var(--text-secondary)]")}>
                  {responseText(r.response)}
                </span>
                {link && (
                  <button
                    type="button"
                    data-needs-go
                    onClick={() => {
                      if (r.action === "join") markJoined(r.id);
                      onNavigate();
                      router.push(link.href);
                    }}
                    /* TODO-COPY */
                    aria-label={`${ACTION_LABEL[r.action]} — ${title}, ${responseText(r.response)}`}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full px-3 text-[13px] leading-none transition after:absolute after:inset-0 after:rounded-[10px] after:content-['']",
                      r.action === "join"
                        ? "bg-[var(--t1)] font-display text-[var(--text-inverse)] hover:brightness-110 dark:bg-[var(--t1-ink)]"
                        : "border border-[color:var(--border-contour)] bg-[var(--surface-raised)] text-[var(--text-primary)]",
                      RING
                    )}
                  >
                    {ACTION_LABEL[r.action]}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** ═══ THE CUE'S MUTE, IN THE TRAY HEADER ═══ A pressed toggle: pressed is
 *  muted. 40px target, the bar's ghost treatment. */
export function T1CueToggle() {
  const persona = useOnboardingStore((s) => s.persona);
  const muted = useOnboardingStore((s) => s.t1CueMuted?.[persona] ?? false);
  const setMuted = useOnboardingStore((s) => s.setT1CueMuted);
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      data-t1-cue-toggle
      aria-pressed={muted}
      /* TODO-COPY. The name is the action pressed means; the state is aria-pressed. */
      aria-label="Mute the Tier 1 sound"
      title={muted ? "Tier 1 sound off" : "Tier 1 sound on"}
      onClick={() => setMuted(persona, !muted)}
      className={cn("ml-auto -mr-2 flex size-10 items-center justify-center rounded-[var(--radius-lrg)] text-[var(--icon-secondary)] hover:bg-[var(--tint-hover)]", RING)}
    >
      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
    </button>
  );
}
