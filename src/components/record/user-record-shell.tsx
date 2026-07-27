"use client";

// UserRecordShell — the ONE record skeleton both the mentor self-view and (in a
// follow-up) the staff record render through: a persistent identity header +
// a tabbed workspace + a contextual right rail. Tone is gated by `viewer`
// ({ role, isSelf }) — a mentor viewing their own record ({role:'mentor',
// isSelf:true}) gets a warm identity + a Preview-only rail; staff get the
// supervisory affordances. Person attributes are TYPOGRAPHY, not containers
// (established record rule). Reuses the elevated header-card / tab / token
// language from the staff record. This pass wires only the self case; the
// staff page still renders its own (elevated) chrome until the migration
// follow-up, so this shell is built to match it as a drop-in.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Viewer {
  role: "mentor" | "lead_mentor" | "supervisor" | "admin";
  isSelf: boolean;
}

export interface UserRecordTab {
  id: string;
  label: string;
}

export type StatusDot = "positive" | "warning" | "critical";

const DOT_VAR: Record<StatusDot, string> = {
  positive: "var(--dot-positive)",
  warning: "var(--dot-warning)",
  critical: "var(--dot-critical)",
};

export function UserRecordShell({
  avatar,
  name,
  roleLabel,
  statusDot = "positive",
  statusText,
  statusAriaLabel,
  meta,
  primaryAction,
  overflow,
  backLink,
  tabs,
  activeTab,
  onTabChange,
  sectionsLabel = "Sections",
  rail,
  children,
}: {
  avatar: { src: string | null; initial: string };
  name: string;
  roleLabel: string;
  statusDot?: StatusDot;
  /** Word shown in the pill after the role when a state is exceptional (e.g.
   *  "· Unpublished"); omit for the default (active) state — a dot alone. */
  statusText?: string;
  statusAriaLabel: string;
  /** pronouns · location · [context] — a single middot-joined string. */
  meta: string;
  primaryAction?: React.ReactNode;
  overflow?: React.ReactNode;
  backLink?: { href: string; label: string };
  tabs: UserRecordTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  sectionsLabel?: string;
  /** Contextual rail content. When omitted the workspace is full-width. */
  rail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-6 lg:px-10">
      {backLink && (
        <Link
          href={backLink.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLink.label}
        </Link>
      )}

      {/* Identity header CARD (elevated) — avatar + name + role pill + meta,
          actions top-right on wide, wrapping below on narrow. */}
      <header className="mt-3 flex flex-col gap-5 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-5 py-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:px-7 sm:py-6">
        {avatar.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar.src}
            alt=""
            className="size-16 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-bold"
            style={{
              backgroundColor: "color-mix(in oklab, var(--brand) 12%, white)",
              color: "color-mix(in oklab, var(--brand) 60%, black)",
            }}
          >
            {avatar.initial}
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1
              className="text-[var(--text-primary)]"
              style={{
                font: "var(--type-record-name)",
                letterSpacing: "var(--type-record-name-tracking)",
              }}
            >
              {name}
            </h1>
            <span
              aria-label={statusAriaLabel}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-s1)] px-3 py-1 text-[13px] font-medium text-[var(--text-primary)] ring-1 ring-[color:var(--border-contour)]"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: DOT_VAR[statusDot] }}
              />
              {roleLabel}
              {statusText ? ` · ${statusText}` : ""}
            </span>
          </div>
          <p
            className="text-[var(--text-secondary)]"
            style={{
              font: "var(--type-meta)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {meta}
          </p>
        </div>

        {(primaryAction || overflow) && (
          <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
            {primaryAction}
            {overflow}
          </div>
        )}
      </header>

      {/* Tabbed workspace — refined active bar on a hairline track. */}
      <nav
        aria-label={sectionsLabel}
        className="mt-6 flex gap-1 overflow-x-auto border-b border-[color:var(--border-contour)]"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            aria-current={activeTab === t.id ? "page" : undefined}
            className={cn(
              "relative min-h-11 shrink-0 rounded-md px-3 py-2 text-[14px] leading-[20px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
              activeTab === t.id
                ? "font-semibold text-[var(--text-primary)]"
                : "font-normal text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]"
            )}
          >
            {t.label}
            {activeTab === t.id && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--text-primary)]"
              />
            )}
          </button>
        ))}
      </nav>

      <div
        className={cn(
          "mt-6 grid items-start gap-8",
          rail && "lg:grid-cols-[minmax(0,900px)_300px]"
        )}
      >
        <div className="min-w-0">{children}</div>
        {rail && (
          <aside className="min-w-0 lg:sticky lg:top-6">{rail}</aside>
        )}
      </div>
    </div>
  );
}
