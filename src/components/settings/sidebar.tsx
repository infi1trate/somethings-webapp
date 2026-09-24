"use client";

// The nav icons moved to `nav-items.ts` with the item literals; what remains
// here is the rail's own bottom utility cluster.
import { HelpCircle, Settings } from "lucide-react";
import Link from "next/link";
import { AccountPopover } from "@/components/settings/account-popover";
import {
  badgeNounFor,
  railItems,
  type SidebarItemDef,
} from "@/components/settings/nav-items";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// THE TYPE AND THE ITEM SETS MOVED to `nav-items.ts` (Phase 2A) — there were
// three definitions of this navigation and the item set now varies by persona AND
// by breakpoint, so it needed one home. Re-exported here because several modules
// already import it from this path.
export type { SidebarItemDef };

// Bottom utility cluster (settings-04): Settings gear (all personas →
// /app/settings) + Help + the theme toggle. The old announcements icon is gone.
//
// ═══ THE THEME TOGGLE IS BACK HERE, AS A TILE (addendum §2.5) ═══
// It used to live in the avatar's account popover, and the restructure removed
// it along with the theme. §2.5 asks for ONE toggle "in the rail", and the
// labelled rail puts it in its footer — so this rail puts it in the cluster
// where it keeps its non-destination controls. One control per rail, and a
// reader sees one rail.

interface SettingsSidebarProps {
  activeId: string;
  onSelect?: (id: string) => void;
  items?: SidebarItemDef[];
  /** Initial-letter fallback when the persona has no photo yet. */
  avatarInitial?: string;
  /** The CURRENT persona's own photo (§5 Phase 10) — approved chat avatar for
   *  mentor personas, the Photo-row asset for lead/supervisor. Feeds the
   *  account popover the avatar opens (settings-04). */
  avatarSrc?: string | null;
  /** The theme toggle, composed by the shell so this file does not have to
   *  know what a theme is. Rendered in the utility cluster below. */
  themeToggle?: React.ReactNode;
  /** Counts by item id (e.g. { activity: 2, tasks: 15 }) — dot badge on the
   *  icon tile, mirroring the Supervisor console's treatment. WHAT IS COUNTED
   *  DIFFERS BY DESTINATION: Activity counts unread notifications, Tasks counts
   *  open reviews. `badgeNounFor` supplies the right noun for the aria label;
   *  the number itself is the same treatment either way. */
  badges?: Record<string, number>;
  /** Accessible name for the nav landmark — the styling is identical across
   *  roles; only the item set and this label change (e.g. supervisor passes
   *  "Supervisor sections"). */
  navLabel?: string;
  /** id → href, or null when the item has nowhere to go. When it returns an
   *  href the item renders as a `<Link>`; otherwise it falls back to `onSelect`.
   *  See the note at the render site. */
  hrefFor?: (id: string) => string | null;
  className?: string;
}

// App-shell sidebar on surface/s2 — build-spec §5. Active item = 48px white
// tile with tile shadow + bold black label; inactive = bare icon + medium
// #58534b label (Lausanne 500 renders synthetic — gaps.md #12). Labels are
// Title-case per Figma (gaps.md #17). Hover tint is an interim (gaps.md #5).
export function SettingsSidebar({
  activeId,
  onSelect,
  items = railItems("mentor"),
  avatarInitial = "S",
  avatarSrc = null,
  themeToggle,
  badges,
  navLabel = "Mentor navigation",
  hrefFor,
  className,
}: SettingsSidebarProps) {
  return (
    <aside
      data-anno-ref="app-rail"
      className={cn(
        "flex h-full w-[92px] flex-col items-center bg-[var(--surface-s2)] px-3 py-5",
        className
      )}
    >
      {/* The avatar opens the account popover (settings-04) — click/keyboard
          only; hover shows a plain "Account" tooltip. */}
      <AccountPopover avatarSrc={avatarSrc} avatarInitial={avatarInitial} />

      <nav
        aria-label={navLabel}
        className="mt-8 flex flex-1 flex-col items-center gap-5"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          const badge = badges?.[item.id] ?? 0;
          // ═══ RC-1, SECOND HALF: A LINK WHERE THERE IS A DESTINATION ═══
          //
          // These were `<button onClick={router.push}>`, which silently drops
          // middle-click, cmd-click and long-press-to-open — three things every
          // user of a list-of-people app does. `hrefFor` returns the destination
          // and this renders a real anchor.
          //
          // THE BUTTON PATH SURVIVES for two cases: an item with no destination
          // (AdminShell's `home` and `chats` have no HREFS entry), and any caller
          // still passing `onSelect` instead. Neither should be a link — an
          // anchor to nowhere is worse than an inert button, because it looks
          // like it will work.
          //
          // The className is IDENTICAL on both branches. The visual treatment
          // does not change; only the element does.
          const cls = cn(
            "group flex flex-col items-center gap-1.5 rounded-2xl",
            RING
          );
          const href = hrefFor?.(item.id) ?? null;
          const inner = (
            <>
              <span
                className={cn(
                  "relative flex size-[var(--sidebar-tile)] items-center justify-center rounded-2xl transition-colors",
                  active
                    ? "bg-[var(--surface-card)] shadow-[var(--shadow-tile)]"
                    : "group-hover:bg-white/60"
                )}
              >
                <item.icon
                  aria-hidden
                  className={cn(
                    "size-5",
                    active
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]"
                  )}
                />
                {badge > 0 && (
                  <span
                    aria-label={`${badge} ${badgeNounFor(item.id)}`}
                    className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--state-error)] px-1 text-[10px] font-semibold leading-none text-[var(--text-inverse)]"
                  >
                    {badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[12px] leading-[16px] tracking-[0.3px]",
                  active
                    ? "font-bold text-[var(--text-primary)]"
                    : "font-medium text-[var(--text-secondary)]"
                )}
              >
                {item.label}
              </span>
            </>
          );
          return href ? (
            <Link
              key={item.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cls}
            >
              {inner}
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item.id)}
              aria-current={active ? "page" : undefined}
              className={cls}
            >
              {inner}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 flex flex-col items-center gap-1">
        {/* Settings — every persona (settings-04). 44px hit area wrapping the
            specced 40px visual circle (Phase 8); lit when the settings surface
            is active. */}
        <Link
          href="/app/settings"
          aria-label="Settings"
          aria-current={activeId === "settings" ? "page" : undefined}
          className={cn("flex size-11 items-center justify-center rounded-full", RING)}
        >
          <span
            className={cn(
              "flex size-[var(--sidebar-utility)] items-center justify-center rounded-full bg-[var(--surface-card)] shadow-[var(--shadow-tile)] transition-colors",
              activeId === "settings"
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <Settings className="size-4" aria-hidden />
          </span>
        </Link>
        {themeToggle}
        {/* Help — placeholder destination (no content yet). */}
        <button
          type="button"
          aria-label="Help"
          className={cn("flex size-11 items-center justify-center rounded-full", RING)}
        >
          <span className="flex size-[var(--sidebar-utility)] items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-[var(--shadow-tile)] transition-colors hover:text-[var(--text-primary)]">
            <HelpCircle className="size-4" aria-hidden />
          </span>
        </button>
      </div>
    </aside>
  );
}
