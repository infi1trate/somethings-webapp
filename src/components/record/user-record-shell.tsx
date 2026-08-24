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
import { ROLE_BADGE_TONE, ROLE_LABEL } from "@/components/record/role-label";
import type { PersonRole } from "@/lib/record/people-demo";
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

export type StatusDot = "positive" | "warning" | "critical" | "none";

// "none" = role-only pill (no dot). The record header stopped carrying
// lifecycle state — it lives on Organization, and echoing it here made the
// header a second status surface that could read stale.
/** The role badge — a ROLE label and nothing else. It used to carry a state dot
 *  too, which put two different facts in one pill: the dot meant LIFECYCLE
 *  STANDING (active / paused / deactivated) while the pill named the role. The
 *  standing signal was also duplicated, since any non-default state already
 *  renders as its own word-chip beside this one. Presence now lives on the
 *  avatar, where the eye goes first and where it can't be mistaken for
 *  standing. */
function RoleBadge({
  role,
  ariaLabel,
}: {
  role: PersonRole;
  ariaLabel: string;
}) {
  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-3 py-1",
        ROLE_BADGE_TONE[role]
      )}
      style={{ font: "var(--type-label-sm)" }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

export function UserRecordShell({
  avatar,
  name,
  role,
  online = false,
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
  /** Drives the role TINT (badge-role-* taxonomy). The label comes from the
   *  shared ROLE_LABEL map, so wording and colour can't disagree. */
  role: PersonRole;
  /** ONLINE PRESENCE — the dot at the avatar's bottom-right. This is NOT
   *  lifecycle standing: a paused teen can be online, and an active one can be
   *  offline. Standing is the word-chip beside the role badge. Omit or pass
   *  false for offline, which renders nothing — presence is an exception worth
   *  noticing, not a label on everyone. */
  online?: boolean;
  /** EXCEPTION WORD, rendered as a SECOND chip beside the role badge — never
   *  colour alone (WCAG 1.4.1), and never folded into the role pill, because a
   *  role and a state are two different facts. Omit for the default state: the
   *  dot inside the role badge carries it, and defaults whisper. */
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
        {/* PRESENCE LIVES HERE, bottom-right of the avatar — the one place it
            appears. The ring is the card surface, so the dot reads as sitting
            ON the avatar rather than floating beside it, and it survives the
            avatar's own colour. Colour is never the only carrier: its label
            is announced to a screen reader and the role badge is untouched. */}
        <span className="relative shrink-0">
          {avatar.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar.src}
              alt=""
              className="size-16 rounded-2xl object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 items-center justify-center rounded-2xl font-display text-2xl font-bold"
              style={{
                backgroundColor: "color-mix(in oklab, var(--brand) 12%, white)",
                color: "color-mix(in oklab, var(--brand) 60%, black)",
              }}
            >
              {avatar.initial}
            </span>
          )}
          {online && (
            <span
              role="img"
              aria-label="Online now"
              className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full ring-2 ring-[color:var(--surface-card)]"
              style={{ backgroundColor: "var(--dot-positive)" }}
            />
          )}
        </span>

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
            {/* The role, and only the role. Standing is the word-chip beside
                it; presence is the dot on the avatar. */}
            <RoleBadge role={role} ariaLabel={statusAriaLabel} />
            {/* Exceptions get a WORD. */}
            {statusText && (
              <span
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--status-attention-bg)] px-2.5 py-1 text-[var(--status-attention-fg)]"
                style={{ font: "var(--type-label-sm)" }}
              >
                {statusText}
              </span>
            )}
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
                : "font-normal text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]"
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
