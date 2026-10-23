"use client";

// ═══ THE BELL'S ESCALATIONS (pack v5.0, Workstream C) ═══
// The derived notices (`lib/tiering/notifications.ts`), above the bell's
// activity feed for both roles. Each row opens the conversation with Care on
// Overview (`escalationHref`); a mentor's rows also offer "Open Support" —
// the supervisor's thread, in the panel. Rendered only when there is one.

import Link from "next/link";
import { MessageSquare, ShieldAlert, ShieldCheck } from "lucide-react";
import { escalationHref, type EscalationNotice } from "@/lib/tiering/notifications";
import { openInSupport } from "@/lib/support/open";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function EscalationNotices({ notices, seenAt, onNavigate, limit = 5 }: { notices: EscalationNotice[]; seenAt: number; onNavigate: () => void; limit?: number }) {
  if (notices.length === 0) return null;
  return (
    <section data-escalation-notices aria-labelledby="escalation-notices-label" className="mb-3 border-b border-[color:var(--border-subtle)] pb-3">
      <h3 id="escalation-notices-label" className="px-1 pb-1.5 text-[11px] leading-[16px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">
        {/* TODO-COPY */}
        Escalations
      </h3>
      <ul className="space-y-0.5">
        {notices.slice(0, limit).map((n) => {
          const unread = n.at > seenAt;
          const Icon = n.kind === "closed" ? ShieldCheck : n.kind === "support" ? MessageSquare : ShieldAlert;
          return (
            <li key={n.id} data-notice={n.kind} data-notice-unread={unread || undefined} className="group relative flex items-start gap-2.5 rounded-[10px] px-2 py-2 hover:bg-[var(--tint-hover)]">
              <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-s1)] text-[var(--icon-secondary)]">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={escalationHref(n.teenId)}
                  onClick={onNavigate}
                  data-notice-link
                  className={cn("block rounded-sm text-[var(--text-primary)] after:absolute after:inset-0 after:content-['']", RING)}
                  style={{ font: unread ? "var(--type-card-title)" : "var(--type-body)" }}
                >
                  {n.text}
                </Link>
                {n.detail && (
                  <span className="block break-words text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
                    {n.detail}
                  </span>
                )}
                <span className="mt-0.5 flex items-center gap-2 tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
                  {WHEN.format(n.at)}
                  {n.supportId && (
                    /* Above the row's stretched link, so it is its own target. */
                    <button
                      type="button"
                      data-notice-support
                      onClick={() => {
                        openInSupport(n.supportId!);
                        onNavigate();
                      }}
                      className={cn("relative z-[1] inline-flex min-h-6 items-center rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
                    >
                      {/* TODO-COPY */}
                      Open Support
                    </button>
                  )}
                </span>
              </span>
              {unread && <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--text-primary)]" />}
              {unread && <span className="sr-only">, unread</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
