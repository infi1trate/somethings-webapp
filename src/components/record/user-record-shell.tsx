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

import { useEffect, useRef } from "react";
import { EdgeFades, useEdgeOverflow } from "@/components/ui/scroll-affordance";
import Link from "next/link";
import { ROLE_BADGE_TONE, ROLE_LABEL } from "@/components/record/role-label";
import type { PersonRole } from "@/lib/record/people-demo";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// THE TAB STRIP'S OVERFLOW AFFORDANCE now lives in
// `components/ui/scroll-affordance.tsx` — Phase 5 needed the identical thing for
// tables, and a second copy is how two affordances that mean the same thing end
// up looking different. The reasoning that produced it (why a fade and not a
// scrollbar; why no ARIA) is recorded there in full, including the measured
// 15px-scrollbar bug the nav's own comment below describes.
//
// design-system-gaps rows 257, 266.

export interface Viewer {
  role: "mentor" | "lead_mentor" | "supervisor" | "admin";
  isSelf: boolean;
}

/** THE TAB BADGE — a small numeric indicator, never a bare dot.
 *
 *  NEVER COLOUR ALONE (WCAG 1.4.1). The number carries the count, the accessible
 *  label carries the meaning in words, and the tone is the third, redundant
 *  channel. A monochrome print and a screen reader get the same information.
 *
 *  TONE COMES FROM THE WORST OPEN ITEM, not from the count: two routine reviews
 *  stay muted, one open escalation goes critical. A count is not a severity.
 *
 *  It sits INSIDE the tab button, so a click anywhere on it activates the tab —
 *  a badge you can miss by two pixels is a badge that eats clicks. */
function TabBadge({ tab }: { tab: UserRecordTab }) {
  const tone = tab.badgeTone ?? "routine";
  const fill =
    tone === "critical"
      ? "var(--band-clay-bg)"
      : tone === "warning"
        ? "var(--band-amber-bg)"
        : "var(--surface-s2)";
  const ink =
    tone === "critical"
      ? "var(--band-clay-fg)"
      : tone === "warning"
        ? "var(--band-amber-fg)"
        : "var(--text-secondary)";
  return (
    <span
      role="img"
      /* TODO-COPY. Names the tab AND the count, because a screen reader reaching
         this has already passed the label and should not have to go back. */
      aria-label={`${tab.label}, ${tab.badge} ${
        tab.badge === 1 ? "item needs" : "items need"
      } attention`}
      className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11.5px] font-semibold leading-[16px] tabular-nums"
      style={{ backgroundColor: fill, color: ink }}
    >
      {tab.badge}
    </span>
  );
}

export interface UserRecordTab {
  id: string;
  label: string;
  /** OPEN ACTION ITEMS on this tab. Omit or 0 to render nothing — a zero badge
   *  is chrome that says "nothing here", which is what the absent badge already
   *  says more quietly.
   *
   *  ADDITIVE AND OPTIONAL. Every existing consumer (/app/profile, /admin/mentor)
   *  passes tabs with no badge and renders exactly as before. */
  badge?: number;
  /** The badge's family. "routine" is muted — the default, because a review due
   *  next week is not an exception. "warning"/"critical" only when an escalation
   *  or risk flag is open. Defaults whisper; exceptions speak. */
  badgeTone?: "routine" | "warning" | "critical";
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
        ROLE_BADGE_TONE[role],
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
  tabRowAction,
  children,
}: {
  avatar: { src: string | null; initial: string };
  name: string;
  /** Drives the role TINT (badge-role-* taxonomy). The label comes from the
   *  shared ROLE_LABEL map, so wording and colour can't disagree. */
  role: PersonRole;
  // PRESENCE IS GONE FROM RECORD HEADERS (user decision, reversing the run that
  // added it). The dot lived at the avatar's bottom-right, driven by an `online`
  // prop; it is REMOVED rather than defaulted off, so it cannot return by a
  // caller passing true. Header status is now the role badge plus a word-bearing
  // chip for exceptional platform states only — Paused, Deactivated — and the
  // avatar is identity alone, which is why RecordAvatar has no dot variant.
  //
  // `isOnlineNow()` is deleted with it: leaving a presence fixture behind is how
  // a dot comes back.
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
  /** PAGE-LEVEL CHROME, right-aligned on the tab row.
   *
   *  It sits OUTSIDE the nav, not inside it: the nav is `overflow-x-auto`, so
   *  anything right-aligned within it scrolls away with the tabs at narrow
   *  widths. The wrapper row below owns the alignment and the nav keeps its own
   *  scrolling, which is why this is a sibling of the nav rather than a child.
   *
   *  Additive and optional — the mentor self-view and /admin/mentor pass
   *  nothing and render exactly as before. */
  tabRowAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const edges = useEdgeOverflow(navRef);

  // ═══ THE ACTIVE TAB IS ALWAYS BROUGHT INTO VIEW ═══
  //
  // Without this, the strip scrolling is worse than the strip clipping. A record
  // is deep-linked by tab (`?tab=account`), and at 390px roughly two of six tabs
  // fit — so arriving on Account showed Overview and Mentorship, with the tab
  // the reader is actually ON scrolled out of sight and no indication of where
  // they were. That is the same defect as hiding the current page behind a
  // "More" menu.
  //
  // `scrollLeft` IS SET DIRECTLY RATHER THAN VIA scrollIntoView, deliberately:
  // scrollIntoView walks up every scrollable ancestor, so on mount it also
  // scrolls the record panel — the reader lands mid-page with the identity
  // header pushed off the top. Writing scrollLeft moves this element only, and
  // the browser clamps it, so no bounds arithmetic is needed.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const current = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) return;
    el.scrollLeft =
      current.offsetLeft - (el.clientWidth - current.offsetWidth) / 2;
  }, [activeTab, tabs]);

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

      {/* Tabbed workspace — refined active bar on a hairline track.
          NO SCROLLBAR, EVER. `overflow-x-auto` alone rendered a 15px VERTICAL
          scrollbar inside the strip, for two compounding reasons:
            1. Per the CSS overflow spec, when one axis is `visible` and the
               other is not, the `visible` one computes to `auto`. Authoring
               only overflow-x silently made the y-axis scrollable too.
            2. The active indicator sat at `-bottom-px` — 1px OUTSIDE the
               content box — so the newly scrollable y-axis had 1px to report.
               Measured: clientHeight 44, scrollHeight 45, and the scrollbar
               was eating 15px of the strip's width.
          Fixed at both ends: overflow-y is pinned hidden, and the indicator
          moved inside the box so pinning it cannot clip the bar. The
          horizontal scrollbar is hidden too — the strip still scrolls by
          wheel, drag and keyboard, it just doesn't draw chrome over a
          40px-tall nav. */}
      {/* THE TAB ROW. A flex row holding the scrolling nav and, optionally,
          page-level chrome pinned right on the same baseline. The bottom rule
          moved from the nav to this wrapper so it spans the full width rather
          than stopping where the tabs stop. */}
      <div className="mt-6 flex items-end gap-3 border-b border-[color:var(--border-contour)]">
        {/* THE SCROLL PORT. The fades are siblings of the nav inside this
            wrapper, never children of it — a child of an `overflow-x-auto`
            element scrolls with the content and adds to its scrollWidth, so a
            fade placed inside would drift away from the edge it marks and make
            the strip wider at the same time. */}
        <div className="relative min-w-0 flex-1">
          <nav
            ref={navRef}
            aria-label={sectionsLabel}
            className="flex w-full gap-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    : "font-normal text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                )}
              >
                {t.label}
                {!!t.badge && t.badge > 0 && <TabBadge tab={t} />}
                {activeTab === t.id && (
                  <span
                    aria-hidden
                    // bottom-0, not -bottom-px: see the nav's note. The 2px bar
                    // still reads as sitting on the hairline because the nav's
                    // border-b renders directly beneath it.
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--text-primary)]"
                  />
                )}
              </button>
            ))}
          </nav>
          {/* THE EDGE FADES — see `ui/scroll-affordance.tsx`.

              `bottom-0.5` STOPS THEM SHORT OF THE HAIRLINE: the tab row's
              `border-b` and the active tab's 2px indicator both live in the
              bottom 2px, and fading them out mid-line looked like a rendering
              fault rather than an affordance. */}
          <EdgeFades
            edges={edges}
            surface="var(--surface-s1)"
            className="bottom-0.5"
          />
        </div>
        {tabRowAction && (
          // Separated from the tabs by the gap and by shape — it is a pill, not
          // a tab, and it must not read as one. `shrink-0` so a long tab set
          // scrolls underneath it rather than squeezing it.
          <div className="shrink-0 pb-1.5">{tabRowAction}</div>
        )}
      </div>

      <div
        className={cn(
          "mt-6 grid items-start gap-8",
          rail && "lg:grid-cols-[minmax(0,900px)_300px]",
        )}
      >
        <div className="min-w-0">{children}</div>
        {rail && <aside className="min-w-0 lg:sticky lg:top-6">{rail}</aside>}
      </div>
    </div>
  );
}
