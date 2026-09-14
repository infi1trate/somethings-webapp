"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE BOTTOM BAR — four items, no overflow. Below the rail tier only.
//
// Built from Figma frame 2308:19812. Values from the file:
//
//   container    py-16, gap-8, justify-center
//   pill         396 × 72, rounded-360, bg #fff, border button/border/disabled
//   elevation    Elevation/1
//   item         h-68, gap-4, glyph 24
//   label        Label/Medium/Mobile — TWK Lausanne 700, 14/16, tracking 0,
//                warmGrey/700
//
// ═══ WHAT THIS REPLACES ═══
//
// A full-bleed 56px bar carrying SEVEN cells — Home · Chats · Activity · Tasks ·
// Mentees · Team · More — which is where the cramped labels came from. Activity
// moves to the top-bar bell; Team folds into People for staff; More is gone
// entirely because the avatar sheet now holds Settings and Help.
//
// ═══ THREE DELIBERATE EXTENSIONS, BECAUSE THE FILE HAS NO ANSWER ═══
//
// 1. THE PILL IS FLUID, NOT 396px. The artboard is 500px wide and the frame's
//    bottom row is 396 + 8 + 64 (search) = 468px. At 320px that overflows by
//    ~148px, and 320 is a hard floor (SC 1.4.10). With search out of scope the
//    row is just the pill, so it takes the available width up to the frame's
//    396px and never exceeds it. Height, radius, border and elevation are the
//    file's.
//
// 2. THERE IS NO ACTIVE STATE IN THE FRAME — all four labels are
//    `warmGrey/700`, nothing distinguishes the current item. Since every label
//    is already weight 700, weight cannot be the differentiator. The active cell
//    gets a FILLED PILL behind it plus the primary ink; inactive stays
//    transparent with secondary ink. SHAPE is the non-colour channel the brief
//    requires, `aria-current="page"` is the programmatic one, and colour is the
//    third and redundant.
//
// 3. THE FRAME'S PER-ITEM PADDING IS HAND-TUNED AND ASYMMETRIC — Home 27/20,
//    Chats 32/32, Tasks 32/32, People 20/24 — which content-sizes a 396px pill
//    for four specific words. That cannot survive a fluid pill or a different
//    item set (mentors get "Mentees", not "People"). Equal `flex-1` cells
//    instead, which is also what keeps every target the same size.
// ═══════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import {
  badgeNounFor,
  type SidebarItemDef,
} from "@/components/settings/nav-items";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The pill's height, from the frame. Exported so the shell reserves exactly
 *  this and the two cannot drift. */
export const BAR_PILL_H = 72;
/** The frame's `py-16` around the pill — it floats, so this is real reserved
 *  space above and below it, not a margin that collapses. */
export const BAR_PAD_Y = 16;
/** What the content panel must keep clear. */
export const BAR_RESERVE = BAR_PILL_H + BAR_PAD_Y * 2;

function Badge({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--state-error)] px-1 text-[10px] font-semibold leading-none text-[var(--text-inverse)]"
    >
      {count}
    </span>
  );
}

function Cell({
  item,
  href,
  active,
  badge,
}: {
  item: SidebarItemDef;
  href: string;
  active: boolean;
  badge: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={
        badge > 0 ? `${item.label}, ${badge} ${badgeNounFor(item.id)}` : undefined
      }
      className={cn(
        // `h-[68px]` is the frame's item height inside its 72px pill. Equal
        // `flex-1` cells rather than the frame's asymmetric padding — see the
        // module note.
        "flex h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full transition-colors",
        active
          ? "bg-[var(--tint-press)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)]",
        RING
      )}
    >
      <span className="relative flex size-6 items-center justify-center">
        <Icon className="size-6" aria-hidden />
        {badge > 0 && <Badge count={badge} />}
      </span>
      {/* Label/Medium/Mobile — 14/16, weight 700, tracking 0. Truncates rather
          than wrapping: a two-line label changes the pill's height. */}
      <span className="max-w-full truncate text-[14px] font-bold leading-[16px]">
        {item.label}
      </span>
    </Link>
  );
}

export function BottomNav({
  items,
  activeId,
  badges,
  hrefFor,
  navLabel,
}: {
  items: SidebarItemDef[];
  activeId?: string;
  badges?: Record<string, number>;
  hrefFor: (id: string) => string;
  navLabel: string;
}) {
  return (
    <nav
      aria-label={navLabel}
      // Same `aria-label` as the rail's nav, deliberately: they are one nav in
      // two forms and exactly one is in the accessibility tree at a time (the
      // other's ancestor is `display:none`, which removes it). `data-slot` is how
      // tests tell them apart, since the label cannot.
      data-slot="bottom-nav"
      data-anno-ref="app-bottom-nav"
      style={{
        // ABOVE THE DEV BAR and clear of the physical bezel. The frame's 16px
        // becomes the floating gap; the safe-area inset is added to it rather
        // than replacing it.
        bottom: "calc(var(--dev-bar-h, 0px) + env(safe-area-inset-bottom, 0px))",
        paddingTop: BAR_PAD_Y,
        paddingBottom: BAR_PAD_Y,
      }}
      className="fixed inset-x-0 z-40 flex justify-center px-4 md:hidden"
    >
      <div
        style={{ height: BAR_PILL_H }}
        className={cn(
          // The pill: fluid up to the frame's 396px.
          "flex w-full max-w-[396px] items-center gap-1 rounded-full px-1.5",
          "border border-[color:var(--border-subtle)] bg-[var(--surface-card)]",
          // Elevation/1 — the file's bound style (blur 6, #00000021). The
          // generated code said `0 3px 3px rgba(0,0,0,.13)`; the two disagree
          // and the STYLE is the source of truth.
          "shadow-[0_3px_6px_rgba(0,0,0,0.13)]"
        )}
      >
        {items.map((item) => (
          <Cell
            key={item.id}
            item={item}
            href={hrefFor(item.id)}
            active={item.id === activeId}
            badge={badges?.[item.id] ?? 0}
          />
        ))}
      </div>
    </nav>
  );
}
