"use client";

// ═══ TODAY'S ESCALATION ITEMS (pack v5.0, Workstream C) ═══
// The supervisor's agenda from the tiering store — awaiting confirmation
// (urgent), follow-ups due, follow-ups scheduled — through `supervisorAgenda`,
// the SAME function the bell's notices are derived beside, so Today mirrors
// rather than computes (§4). Read-only links into the conversation with Care
// on Overview.
//
// ═══ NOT THE RETIRED STRIP (Phase L.6) ═══ No inverted bar and no alert
// fill: a quiet list on the page's own surface. "Urgent" is said in words and
// with the shield, never by colour alone; red stays the Tier 1–2 lozenge's.

import Link from "next/link";
import { CalendarClock, ChevronRight, ShieldAlert } from "lucide-react";
import { escalationHref, type EscalationNotice } from "@/lib/tiering/notifications";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function TodayEscalations({ items }: { items: EscalationNotice[] }) {
  if (items.length === 0) return null;
  return (
    <section data-today-escalations aria-labelledby="today-escalations-label" className="shrink-0 rounded-[var(--radius-elevated)] bg-[var(--surface-raised)] p-2 shadow-[var(--el-soft)]">
      <h2 id="today-escalations-label" className="px-3 pt-2 pb-1 text-[11px] leading-[16px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">
        {/* TODO-COPY */}
        Escalations
      </h2>
      <ul>
        {items.map((n) => {
          const Icon = n.urgent ? ShieldAlert : CalendarClock;
          return (
            <li key={n.id} data-today-escalation={n.kind} data-urgent={n.urgent || undefined}>
              <Link
                href={escalationHref(n.teenId)}
                className={cn("flex min-h-12 items-center gap-3 rounded-[12px] px-3 py-2 hover:bg-[var(--tint-hover)]", RING)}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-[var(--icon-secondary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[var(--text-primary)]" style={{ font: n.urgent ? "var(--type-card-title)" : "var(--type-body)" }}>
                    {n.text}
                  </span>
                  {n.detail && (
                    <span className="block text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
                      {n.detail}
                    </span>
                  )}
                </span>
                {n.urgent && (
                  <span data-today-urgent className="shrink-0 text-[var(--text-primary)]" style={{ font: "var(--type-field-label)" }}>
                    {/* TODO-COPY */}
                    Needs you now
                  </span>
                )}
                <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--icon-secondary)]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
