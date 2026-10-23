"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PILL SEGMENTS — the recessed track and the raised thumb (Monitoring v3, §1)
//
// EXTRACTED from Care Reviews' Open/Closed control (`ia/list-toolbar.tsx`),
// so Monitoring's Watch · Events is the SAME control rather than a copy of
// it: a `--surface-s2` track, `h-9` segments raised on `--surface-card` with
// `--shadow-tile`, primary ink on the selected one — two channels, never
// colour alone. Each segment's hit area reaches the track's edge (36 visible,
// 44 pressable, 2.5.8).
//
// TWO ROLES, ONE LOOK. Care Reviews' segments select which set ONE list shows
// — a `radiogroup`, every segment a tab stop, exactly as it was. Monitoring's
// switch panels — a `tablist` with a roving tab stop and the arrow keys, the
// WAI-ARIA tabs pattern.

import { useRef } from "react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export interface PillSegment<T extends string> {
  id: T;
  label: React.ReactNode;
  ariaLabel?: string;
  /** Data attributes for the segment (probes and annotations address them). */
  attrs?: Record<string, string>;
}

export function PillSegments<T extends string>({
  role,
  ariaLabel,
  segments,
  value,
  onChange,
  trackAttrs,
  panelId,
  idPrefix,
}: {
  role: "radiogroup" | "tablist";
  ariaLabel: string;
  segments: PillSegment<T>[];
  value: T;
  onChange: (id: T) => void;
  trackAttrs?: Record<string, string>;
  /** Tabs only: the panel the tabs control. */
  panelId?: string;
  /** Tabs only: segment ids are `${idPrefix}-${id}`, for `aria-labelledby`. */
  idPrefix?: string;
}) {
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const tabs = role === "tablist";
  return (
    <div role={role} aria-label={ariaLabel} {...trackAttrs} className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-[var(--surface-s2)] p-1">
      {segments.map((s, i) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            ref={(el) => {
              refs.current[s.id] = el;
            }}
            type="button"
            role={tabs ? "tab" : "radio"}
            {...(tabs ? { "aria-selected": on, "aria-controls": panelId, id: idPrefix ? `${idPrefix}-${s.id}` : undefined, tabIndex: on ? 0 : -1 } : { "aria-checked": on })}
            aria-label={s.ariaLabel}
            {...s.attrs}
            onClick={() => onChange(s.id)}
            onKeyDown={
              tabs
                ? (e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const next = segments[(i + (e.key === "ArrowRight" ? 1 : segments.length - 1)) % segments.length].id;
                    onChange(next);
                    refs.current[next]?.focus();
                  }
                : undefined
            }
            className={cn(
              "relative inline-flex h-9 min-w-24 items-center justify-center gap-1 rounded-full px-5 text-[14px] leading-[20px] transition-[color,background-color,box-shadow]",
              "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
              on
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-tile)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
