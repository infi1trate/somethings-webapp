"use client";

// THE APP SHELL — one definition of the nav pattern, delegated to by both
// `MentorShell` and `AdminShell`.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS. The two shells were 20 near-identical lines each: same
// `h-dvh` flex, same `SettingsSidebar`, same floating `<main>` panel. The only
// real differences are the item set, the `navLabel`, the badges, and how an item
// id becomes an href. Everything else was duplicated, which is how the nav
// pattern drifts — and RC-1 has to be fixed once, not twice.
//
// THE SHARED-SIDEBAR PRINCIPLE IS PRESERVED, and it is an explicit existing
// decision (`admin-shell.tsx:3–9`): identical styling across roles, only the
// item set and the `navLabel` change. This component is what makes that
// structural rather than a convention two files happen to follow.
//
// ═══ THE NAV TRANSFORM ═══
//
//   below `md` (960px)   bottom tab bar          `bottom-nav.tsx`
//   at and above `md`    the 92px rail           `settings/sidebar.tsx`
//
// `md` is the rail tier and its value is derived from this app's own widest
// table — see the token note in `globals.css`. The two never render together:
// the rail is `hidden md:flex` and the bar is `md:hidden`.
//
// ═══ WHY `hrefFor` REPLACES `onSelect` ═══
//
// RC-1's second half: the rail's items were `<button onClick={router.push}>`
// (`sidebar.tsx:98`), which silently drops middle-click, cmd-click and
// long-press-to-open — three things every user of a list-of-people app does. A
// function from id to href lets both the rail and the bar render real `<Link>`s
// from one mapping, and lets the bar exclude items that have no destination.
//
// Returning `null` means "no destination". The rail still renders those as inert
// buttons, which is the current behaviour and is forgivable; the bar drops them,
// because a tab promises a destination. See the note in `bottom-nav.tsx`.
// ═══════════════════════════════════════════════════════════════════════════

import {
  SettingsSidebar,
  type SidebarItemDef,
} from "@/components/settings/sidebar";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { TopBar } from "@/components/app-shell/top-bar";
import { cn } from "@/lib/utils";

export function AppShell({
  activeId,
  railItems,
  barItems,
  navLabel,
  badges,
  hrefFor,
  onSelect,
  avatarInitial,
  avatarSrc,
  activityHref,
  activityUnread = 0,
  className,
  children,
}: {
  activeId: string;
  /** ═══ TWO ITEM SETS SINCE PHASE 2A ═══
   *
   *  The rail keeps six; the bar carries four with no overflow. They were one
   *  prop when both rendered the same list, and separating them is what lets
   *  Activity move to the top-bar bell and Team fold into People without
   *  touching the desktop rail. Both come from `nav-items.ts`. */
  railItems: SidebarItemDef[];
  barItems: SidebarItemDef[];
  navLabel: string;
  badges?: Record<string, number>;
  /** id → href. NEVER NULL SINCE PHASE 2A: the supervisor console's allowlist is
   *  gone, so every item resolves to a real URL and the unbuilt ones land on the
   *  `/app/[section]` placeholder. An inert icon was survivable in a 92px rail;
   *  it is not survivable as half a four-item tab bar. */
  hrefFor: (id: string) => string;
  /** Handler for items whose `hrefFor` is null. Omit it and those items are
   *  no-ops, which is `AdminShell`'s deliberate behaviour for `home`/`chats` —
   *  it records that sending a supervisor to the unbuilt-section placeholder is
   *  worse than inertness. */
  onSelect?: (id: string) => void;
  avatarInitial?: string;
  avatarSrc?: string | null;
  /** Where the top-bar bell goes, and what it is carrying. Activity is no
   *  longer a tab, so this badge is the only signal it has anything in it. */
  activityHref: string;
  activityUnread?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        // `dvh`, never `vh` — and it subtracts the dev harness's height, which
        // both shells already did before this extraction.
        "flex h-[calc(100dvh-var(--dev-bar-h,0px))] bg-[var(--surface-s2)]",
        className
      )}
    >
      {/* THE RAIL — `md` and up only. Unchanged visually; it now takes `hrefFor`
          so its items are links. */}
      <SettingsSidebar
        activeId={activeId}
        items={railItems}
        navLabel={navLabel}
        avatarInitial={avatarInitial}
        avatarSrc={avatarSrc}
        badges={badges}
        hrefFor={hrefFor}
        onSelect={onSelect}
        className="hidden shrink-0 overflow-y-auto md:flex"
      />

      {/* ═══ THE MOBILE COLUMN: top bar, then the panel ═══
          
          Wrapped so the top bar and the content panel stack, with the panel
          taking the remaining height. Above `md` the wrapper is inert — the top
          bar is `md:hidden` and the wrapper is just the flex child the panel
          always was. */}
      {/* ═══ `min-h-0` IS LOAD-BEARING, NOT TIDINESS (gap row 283) ═══

          A flex item defaults to `min-height: auto`, which refuses to shrink
          below its content height. Without `min-h-0` this column and the
          `<main>` inside it grew to fit their content, overflowed the root's
          `h-[calc(100dvh-…)]`, and made the DOCUMENT the scroll container — so
          the rail scrolled out of the viewport with the page, and the panel's
          own `overflow-y-auto` never engaged because `h-full` measured against
          an already-overgrown parent.

          `min-w-0` was here for the horizontal axis and the vertical twin was
          missing, which is why this survived: routes whose content fits the
          viewport (`/app/team`, `/app/settings`) behaved correctly, and only
          taller ones (`/app/mentees` 1822px, a record 2539px against a 900px
          viewport) exposed it. Reported from a screenshot of the rail scrolled
          half out of view. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopBar
        activityHref={activityHref}
        unread={activityUnread}
        avatarInitial={avatarInitial}
        avatarSrc={avatarSrc}
      />

      {/* THE CONTENT PANEL. Below `md` it loses the rail's left inset and the
          right gutter — a 16px gutter on a 390px viewport is 4% of the width
          spent on nothing — and gains bottom room for the tab bar. */}
      <main className="min-h-0 min-w-0 flex-1 py-0 pr-0 md:py-4 md:pr-4">
        <div
          // ═══ THE FOCUS-OBSTRUCTION GUARD (SC 2.4.11, RC-5) ═══
          //
          // Implemented ONCE, here, on the scroll container — not as padding on
          // every view. `scroll-padding-bottom` tells the browser to keep this
          // much space clear when it scrolls something into view, which is
          // exactly what happens when a keyboard user tabs to a control near the
          // bottom of a long form. Without it the focused element lands under
          // the tab bar and the reader cannot see what they are about to submit.
          //
          // Padding alone would not fix it: padding moves the content, but the
          // browser's own scroll-into-view still targets the element's box and
          // can park it flush against the viewport edge, under fixed chrome.
          //
          // Both values carry the safe-area inset, so a notched device reserves
          // the physical bezel as well as the chrome.
          // ═══ THE RESERVATION IS `--nav-reserve`, DEFINED IN globals.css ═══
          // design-system-gaps row 253.
          //
          // Not set here. Two earlier attempts set it inline — first as two
          // literal values, then as an inline custom property — and both failed
          // the same way: an inline declaration beats the `md:` class meant to
          // cancel it, so above `md` the panel reserved 56px for a bar that is
          // not rendered. Measured at 1280 before the fix. The variable and its
          // media-query reset live in CSS; this only consumes it.
          className={cn(
            // `relative` CONTAINS ABSOLUTE DESCENDANTS (gap row 283). An
            // absolutely-positioned element whose nearest positioned ancestor is
            // missing resolves against the initial containing block, escaping
            // this scroller and extending the DOCUMENT instead. Measured on
            // `/app/activity` at 1440x900 after the `min-h-0` fix: 53px of
            // residual document scroll, traced to a 1x1 `sr-only` paragraph
            // sitting at document y=953 — `documentElement.scrollHeight` was
            // 953 exactly. One invisible screen-reader label was still dragging
            // the rail out of the viewport.
            "relative h-full overflow-y-auto bg-[var(--surface-s1)]",
            "[padding-bottom:var(--nav-reserve)]",
            "[scroll-padding-bottom:calc(var(--nav-reserve)+1rem)]",
            // THE TOP BAR IS FIXED, so the panel reserves its height the same
            // way it reserves the bar's at the bottom. `scroll-padding-top`
            // matters as much as the padding: without it the browser's own
            // scroll-into-view parks a focused control flush against the
            // viewport top, which is underneath the wordmark (SC 2.4.11).
            "[padding-top:var(--topbar-reserve)]",
            "[scroll-padding-top:calc(var(--topbar-reserve)+1rem)]",
            // The floating-panel treatment is a `md`+ affordance. Below it the
            // panel is the screen, so a radius and an inset would just be a
            // frame around everything.
            "md:rounded-[var(--radius-panel)] md:shadow-[var(--shadow-panel)]",
          )}
        >
          {children}
        </div>
      </main>
      </div>

      {/* THE BAR — below `md` only. */}
      <BottomNav
        items={barItems}
        activeId={activeId}
        badges={badges}
        hrefFor={hrefFor}
        navLabel={navLabel}
      />
    </div>
  );
}
