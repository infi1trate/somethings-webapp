"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE SUPERVISOR'S RAIL — GROUPED, LABELLED, HORIZONTAL ROWS
//
// ═══ WHY A SECOND RAIL COMPONENT RATHER THAN A PROP ON THE FIRST ═══
//
// `SettingsSidebar` is a 92px ICON rail: a column of 48px tiles with the label
// underneath, badges as dots on the icon, no room for a group heading and no
// room for a nine-item list. Every other persona uses it, and the mentor, lead
// and admin rails are explicitly out of scope this pass.
//
// Making it do both would mean a `variant` prop threading through its tile
// geometry, its badge placement, its label position and its width — four
// branches in one component, three of which no caller may change. Two
// components, one of which nobody touches, is the cheaper honest version. The
// shared pieces that SHOULD be shared already are: `AccountPopover`, the focus
// ring, `nav-items.ts`.
//
// ═══ WHAT `Today` GETS THAT THE DESTINATIONS DO NOT ═══
//
// Its own treatment, above every group label, outside every group. `Today` is
// not a peer of the destinations — it MIRRORS them (the mirror rule), so a
// group label over it would make it a fourth category of work, which is the
// collapse this restructure is undoing. A contour rather than a fill, because a
// fill is the SELECTED treatment and `Today` is a destination like any other
// when you are standing on it.
//
// ═══ THE BADGE'S SHAPE CARRIES ITS MEANING ═══
//
// Colour is never the sole carrier (SC 1.4.1), so `badgeStyleFor` gives each
// destination a SHAPE as well as a tone: a bare count for an escalation or a
// flag queue, a clock-plus-count for Care Reviews — which is the only
// destination with a real published deadline and therefore the only one that
// earns a clock. The full rule and its reasoning are in `nav-items.ts`.
//
// EVERY BADGE IS ALSO A WORD. The visible numeral is `aria-hidden` and the
// accessible name is `{n} {noun}` from `badgeNounFor`, because "20" announced
// alone tells a screen-reader user a number and not what it counts — and the
// noun differs per destination, which is why a shared "unread" was wrong.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, Moon, Sun } from "lucide-react";
import { AccountPopover } from "@/components/settings/account-popover";
import {
  badgeNounFor,
  badgeStyleFor,
  type NavGroup,
  type SidebarItemDef,
} from "@/components/settings/nav-items";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE TONES, AS TOKEN PAIRS ═══
 *
 *  `alarm` IS THE ESCALATION RED THE PRODUCT ALREADY HAS — `--task-respond-*`,
 *  the same pair the escalation band uses, measured at 5.24:1. Not
 *  `--state-error`, which is the inline-validation red: a rail badge and a form
 *  error are different objects and the alarm colour should mean one thing.
 *
 *  `attention` and `neutral` are Bloom's own status pairs — a pale fill under
 *  dark ink, which is this product's badge grammar and passes AA on its own
 *  ground. The target nav shows a saturated orange pill with white text;
 *  the tokens win over the image, which is a structural reference. */
const TONE: Record<string, string> = {
  alarm: "bg-[var(--task-respond-bg)] text-[var(--task-respond-fg)]",
  attention: "bg-[var(--status-attention-bg)] text-[var(--status-attention-fg)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
};

/* ═══ THE RAIL COLLAPSES WHILE SUPPORT IS OPEN BELOW 1280 (support-beside-hub) ═══
   "Below 1280 viewport width, collapse the nav to the rail automatically when
   the support chat opens." 248 → 72, read off the shell root's
   `data-support-open` so no state threads through here. Labels go
   VISUALLY hidden, never removed — every row keeps its accessible name, and
   a `title` gives the sighted reader the word back on hover. A badge becomes
   a dot that keeps its spoken count. Animated 240ms (within the pack's 360),
   instant under reduced motion. */
/* `max-[1280px]`, not 1279: Tailwind v4 reads `max-[X]` as width < X, and
   1279 measured uncollapsed at a 1279px viewport. */
const COLLAPSED_LABEL = "max-[1280px]:in-data-[support-open=true]:sr-only";
const COLLAPSED_ROW = "max-[1280px]:in-data-[support-open=true]:justify-center max-[1280px]:in-data-[support-open=true]:px-0";
const COLLAPSED_BADGE =
  "max-[1280px]:in-data-[support-open=true]:absolute max-[1280px]:in-data-[support-open=true]:top-1.5 max-[1280px]:in-data-[support-open=true]:right-2 max-[1280px]:in-data-[support-open=true]:h-2.5 max-[1280px]:in-data-[support-open=true]:min-w-2.5 max-[1280px]:in-data-[support-open=true]:px-0";
const COLLAPSED_HIDE = "max-[1280px]:in-data-[support-open=true]:hidden";

function Badge({ itemId, count }: { itemId: string; count: number }) {
  const { shape, tone } = badgeStyleFor(itemId);
  return (
    <span
      className={cn(
        "ml-auto inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2",
        "text-[12px] font-semibold leading-[16px] tabular-nums",
        COLLAPSED_BADGE,
        TONE[tone] ?? TONE.neutral
      )}
    >
      {/* THE CLOCK IS THE SHAPE, so it is `aria-hidden` and the noun carries the
          same information in words — "8 due" already says there is a deadline. */}
      {shape === "clockCount" && <Clock className={cn("size-3 shrink-0", COLLAPSED_HIDE)} aria-hidden />}
      <span aria-hidden className={COLLAPSED_HIDE}>{count}</span>
      <span className="sr-only">{`${count} ${badgeNounFor(itemId)}`}</span>
    </span>
  );
}

function Row({
  item,
  active,
  href,
  count,
  /** ═══ `Today`'S OWN TREATMENT, AND IT IS A CONTOUR ═══
   *  `Today` sits above every group label and outside every group, and position
   *  alone is a weak signal on a rail a reader scans vertically. A CONTOUR says
   *  "this is a different kind of thing" without spending the fill, which is
   *  the SELECTED treatment — so when a supervisor is standing on Today the
   *  contour gives way to the pill and there is no doubled emphasis. */
  contoured = false,
}: {
  item: SidebarItemDef;
  active: boolean;
  href: string | null;
  count: number;
  contoured?: boolean;
}) {
  const inner = (
    <>
      <item.icon
        aria-hidden
        className={cn(
          "size-[18px] shrink-0",
          active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        )}
      />
      <span className={cn("min-w-0 truncate", COLLAPSED_LABEL)}>{item.label}</span>
      {count > 0 && <Badge itemId={item.id} count={count} />}
    </>
  );
  const cls = cn(
    /* 44px, and the row is the target — not the label. A rail row that is only
       as tall as its text is the smallest thing on the screen and the one a
       reader aims at most often. */
    "relative flex min-h-11 w-full items-center gap-2.5 rounded-full px-3 text-[14px] leading-[20px]",
    "transition-colors duration-150",
    COLLAPSED_ROW,
    active
      ? /* ═══ THE SELECTED PILL ═══
           A card-coloured fill with the small raised-surface shadow, which is
           the same treatment the icon rail's selected tile has — so a reader
           moving between breakpoints sees one idea of "you are here". Bold
           label: the weight is Lausanne's and inert, so the SHADOW and the FILL
           are what carry it; see the report's measured note. */
        "bg-[var(--surface-card)] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-tile)]"
      : "font-medium text-[var(--text-secondary)] hover:bg-white/50 hover:text-[var(--text-primary)]",
    /* THE CONTOUR ONLY WHILE UNSELECTED — see the prop's note. `border` on both
       branches would shift the row by a pixel on selection. */
    contoured && !active && "border border-[color:var(--border-contour)]",
    contoured && active && "border border-transparent",
    RING
  );
  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} title={item.label} className={cls}>
      {inner}
    </Link>
  ) : (
    /* NO DESTINATION, NO ANCHOR. An `<a>` to nowhere looks like it will work,
       which is worse than an inert row — the same rule the icon rail follows. */
    <span className={cn(cls, "cursor-default")}>{inner}</span>
  );
}

function Group({
  group,
  activeId,
  hrefFor,
  badges,
}: {
  group: NavGroup;
  activeId: string;
  hrefFor?: (id: string) => string | null;
  badges?: Record<string, number>;
}) {
  const [open, setOpen] = useState(true);
  const labelId = group.id ? `rail-group-${group.id}` : undefined;
  const rows = (
    <div role="list" className="flex flex-col gap-0.5">
      {group.items.map((item) => (
        <div role="listitem" key={item.id}>
          <Row
            item={item}
            active={item.id === activeId}
            href={hrefFor?.(item.id) ?? null}
            count={badges?.[item.id] ?? 0}
            /* THE UNGROUPED GROUP IS `Today`'s, and nothing else is in it. */
            contoured={!group.id}
          />
        </div>
      ))}
    </div>
  );

  /* THE UNGROUPED GROUP RENDERS NOTHING OF ITSELF — no label, no chevron, no
     landmark. It is a container in the data, not a thing on screen. */
  if (!group.id || !group.label) return rows;

  return (
    <section aria-labelledby={labelId}>
      {/* ═══ A REAL BUTTON, WITH THE WHOLE ROW AS THE TARGET ═══
          `aria-expanded` and `aria-controls` so the state is announced, and the
          chevron is `aria-hidden` because the button already says it. The
          heading id is on the LABEL rather than the button so the section's
          accessible name is the group's word and not "Monitoring, collapsed". */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${labelId}-items`}
        data-rail-group={group.id}
        className={cn(
          "flex min-h-11 w-full items-center gap-1 rounded-full px-3",
          "text-[12px] font-medium leading-[16px] tracking-[0.3px]",
          /* ═══ `--text-secondary`, NOT `--text-muted` ═══
             The target nav's group labels read LIGHT against the rail fill, and
             muted (#6e6b67) measures 4.06:1 on `--surface-s2` — below AA for
             12px text. Secondary (#58534b) measures 5.99:1 on the same ground.
             A group label is the thing a reader scans to find a destination, so
             it is not decorative and cannot take the decorative token. Measured
             in the phase report. */
          "text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]",
          RING
        )}
      >
        <span id={labelId} className={COLLAPSED_LABEL}>{group.label}</span>
        {/* Collapsed, a group's heading is a short rule: still the button,
            still named, still toggling its rows. */}
        <span aria-hidden className="mx-auto hidden h-px w-6 bg-[var(--border-subtle)] max-[1280px]:in-data-[support-open=true]:block" />
        <ChevronDown
          aria-hidden
          className={cn(
            "ml-auto size-4 shrink-0 transition-transform duration-150",
            COLLAPSED_HIDE,
            "motion-reduce:transition-none",
            open ? "" : "-rotate-90"
          )}
        />
      </button>
      <div id={`${labelId}-items`} hidden={!open} className="mt-0.5">
        {rows}
      </div>
    </section>
  );
}

/** ═══ A FOOTER ROW, WHICH IS A ROW WITH NOWHERE TO GO ═══
 *  Exported so the shell can compose the footer without this file knowing what
 *  belongs in it. It renders the same anatomy as a nav row — 44px, icon, label —
 *  and deliberately no `href`: `Announcements` has no route, and `Row`'s own
 *  rule is that an anchor to nowhere is worse than a row that plainly is not
 *  one. The moment it gets a brief and a route it takes a link and nothing else
 *  about it changes. */
export function RailFooterItem({ item }: { item: SidebarItemDef }) {
  return (
    <div className="px-0">
      <Row item={item} active={false} href={null} count={0} />
    </div>
  );
}

/** ═══ THE THEME TOGGLE — ONE CONTROL, AND IT LIVES HERE ═══
 *
 *  The target nav has `Dark mode off` in the rail's footer, and the addendum
 *  asks for ONE toggle rather than the two the product used to have (a
 *  segmented control in Settings and a quick toggle in the account popover).
 *  Two controls for one preference is two places for it to be found, and the
 *  rail is the one that is on screen on every route.
 *
 *  ═══ A SWITCH, NOT A LINK-SHAPED ROW ═══
 *  It borrows the footer row's anatomy — 44px, icon, label — so the footer
 *  reads as one kind of thing, and takes `role="switch"` with `aria-checked`
 *  because it is a two-state control rather than a navigation. The LABEL states
 *  the current state rather than the action, matching the target nav's wording
 *  and the convention a switch sets: a reader is told what is true, and the
 *  control's own affordance says it can be changed.
 *
 *  THE ICON IS NOT THE ONLY CARRIER: sun/moon plus the words plus
 *  `aria-checked`, so nothing here depends on recognising a glyph. */
export function RailThemeToggle({
  theme,
  onToggle,
  /** ═══ ONE CONTROL, TWO RAIL ANATOMIES ═══
   *  `row` is this rail's 248px labelled row. `tile` is the ICON rail's
   *  utility cluster — a 40px circle beside Settings and Help, which is where
   *  that rail puts its non-destination controls.
   *  NOT TWO CONTROLS: a reader sees exactly one theme toggle, because they
   *  see exactly one rail. The variants exist because the rails do, and §2.3's
   *  "role differences are items, never structure" is about the three staff
   *  roles — all of which are on the labelled rail. */
  variant = "row",
}: {
  theme: "light" | "dark";
  onToggle: () => void;
  variant?: "row" | "tile";
}) {
  const dark = theme === "dark";
  const Icon = dark ? Moon : Sun;
  /* THE ACCESSIBLE NAME IS THE SAME IN BOTH, because a screen-reader user gets
     no benefit from the tile's brevity — and a switch with no words at all is
     the thing `aria-label` exists to prevent. NEEDS-COPY-NICOLE. */
  const label = `Dark mode ${dark ? "on" : "off"}`;
  if (variant === "tile") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label={label}
        data-anno-ref="rail-theme-toggle"
        onClick={onToggle}
        className={cn("flex size-11 items-center justify-center rounded-full", RING)}
      >
        <span className="flex size-[var(--sidebar-utility)] items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-[var(--shadow-tile)] transition-colors hover:text-[var(--text-primary)]">
          <Icon className="size-4" aria-hidden />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      data-anno-ref="rail-theme-toggle"
      onClick={onToggle}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-full px-3 text-[14px] leading-[20px]",
        "font-medium text-[var(--text-secondary)] transition-colors duration-150",
        COLLAPSED_ROW,
        "hover:bg-white/50 hover:text-[var(--text-primary)]",
        RING
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0 text-[var(--text-secondary)]" />
      {/* NEEDS-COPY-NICOLE. The target nav's phrasing, which states the state. */}
      <span className={cn("min-w-0 truncate", COLLAPSED_LABEL)}>{label}</span>
    </button>
  );
}

export function GroupedRail({
  activeId,
  groups,
  badges,
  hrefFor,
  navLabel = "Supervisor navigation",
  avatarInitial = "S",
  avatarSrc = null,
  footer,
  className,
}: {
  activeId: string;
  groups: NavGroup[];
  badges?: Record<string, number>;
  hrefFor?: (id: string) => string | null;
  navLabel?: string;
  avatarInitial?: string;
  avatarSrc?: string | null;
  /** Rendered below the nav, pinned to the bottom: `Announcements`, and the
   *  theme toggle — which is in the target nav as `Dark mode off` and is the
   *  product's ONE theme control (addendum §2.5). */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      data-anno-ref="app-rail"
      /* ═══ THE WIDTH IS DERIVED, NOT SAMPLED ═══
         The longest label is "Mentor Practice" — 15 characters of Lausanne 14px,
         measured at 110px — plus an 18px icon, a 10px gap, a 22px badge with its
         own gap, and `px-3` twice. That is 196px of content, so 248 leaves a
         row breathing without letting the label column drift away from the
         icons. The icon rail's 92px is unrelated and unchanged. */
      className={cn(
        "flex h-full w-[248px] flex-col overflow-hidden bg-[var(--surface-s2)] px-3 py-5",
        "max-[1280px]:in-data-[support-open=true]:w-[72px]",
        "motion-safe:transition-[width] motion-safe:duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
        className
      )}
    >
      <div className="px-1 max-[1280px]:in-data-[support-open=true]:px-0">
        <AccountPopover
          avatarSrc={avatarSrc}
          avatarInitial={avatarInitial}
          triggerClassName="max-[1280px]:in-data-[support-open=true]:size-12"
        />
      </div>

      <nav aria-label={navLabel} className="mt-7 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((g, i) => (
          <Group
            key={g.id ?? `ungrouped-${i}`}
            group={g}
            activeId={activeId}
            hrefFor={hrefFor}
            badges={badges}
          />
        ))}
      </nav>

      {footer && <div className="mt-4 shrink-0">{footer}</div>}
    </aside>
  );
}
