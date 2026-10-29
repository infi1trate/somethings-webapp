"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE START SCREEN — the front door's anatomy, shared (2026-10-29)
//
// Extracted from `app/page.tsx` so the landing and the mentor chooser
// (`/start/mentor`) are ONE screen with different doors, not two that drift.
// Everything below — the ornament rule, the equal doors, the busy state — was
// decided on the landing and is recorded there; this file only moves it.

import { useState } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DoodleScatter } from "@/components/doodles";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export interface StartEntry {
  id: string;
  icon: LucideIcon;
  /** TODO-COPY */
  title: string;
  /** TODO-COPY — what is behind the door, not a description of the role. */
  blurb: string;
  enter: () => void;
}

export function StartScreen({
  title,
  lead,
  notice,
  label,
  entries,
  footnote,
  after,
}: {
  title: string;
  lead: React.ReactNode;
  notice?: React.ReactNode;
  /** The small label above the doors. */
  label: string;
  entries: StartEntry[];
  footnote: React.ReactNode;
  /** Anything under the footnote — the chooser's way back. */
  after?: React.ReactNode;
}) {
  /** Which entry is mid-navigation. The hard navigation takes a moment on a
   *  cold route, and a card that looks inert after a click invites a second. */
  const [entering, setEntering] = useState<string | null>(null);
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-16">
      {/* Ornament only where there is a margin to ornament (measured on the
          landing): hidden below `lg`, never dimmed. */}
      <DoodleScatter className="hidden opacity-70 lg:block" />

      <div className="relative w-full max-w-xl">
        <header className="flex flex-col items-center text-center">
          <Wordmark className="h-6" />
          <h1 className="mt-6 text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[30px]">{title}</h1>
          <p className="mt-3 max-w-md text-[15px] leading-[1.55] text-[var(--text-secondary)]">{lead}</p>
        </header>

        {notice}

        {/* EQUAL DOORS, SO NONE IS FILLED: one filled button per region; a
            filled card per door would be a primary per door. */}
        <h2 className="mt-10 text-center text-[var(--text-muted)] [font:var(--type-field-label)] [letter-spacing:var(--type-field-label-tracking)]">{label}</h2>

        <ul className="mt-3 space-y-2.5">
          {entries.map((entry) => {
            const Icon = entry.icon;
            const busy = entering === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  data-start-entry={entry.id}
                  onClick={() => {
                    setEntering(entry.id);
                    entry.enter();
                  }}
                  disabled={entering !== null}
                  aria-busy={busy || undefined}
                  className={cn(
                    "group flex w-full items-start gap-3.5 rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-4 text-left transition-colors",
                    "hover:bg-[var(--tint-hover)] disabled:cursor-default",
                    /* Only the card being entered stays at full strength. */
                    entering !== null && !busy && "opacity-55",
                    RING
                  )}
                >
                  <Icon className="mt-0.5 size-[18px] shrink-0 text-[var(--text-muted)]" aria-hidden strokeWidth={2} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-[21px] text-[var(--text-primary)]">{entry.title}</span>
                    <span className="mt-1 block text-[13.5px] leading-[19px] text-[var(--text-secondary)]">{entry.blurb}</span>
                  </span>
                  <ArrowRight className={cn("mt-0.5 size-4 shrink-0 text-[var(--text-muted)] transition-transform", "group-hover:translate-x-0.5")} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-7 text-center text-[12.5px] leading-[18px] text-[var(--text-muted)]">{footnote}</p>
        {after}
      </div>
    </main>
  );
}
