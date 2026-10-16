"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE MOBILE TOP BAR — wordmark, Activity bell, avatar. Below the rail tier only.
//
// Built from Figma frame 2308:19812 (MO 4.1 User Profile / User Settings). Values
// taken from the file, not the brief:
//
//   container    px-24 py-16, justify-between, full width
//   wordmark     184 × 23.968
//   right gap    16
//   bell         64 × 64 circle, border button/border/disabled, glyph 24
//   avatar       64 × 64 circle
//
// FIGMA COLOURS MAPPED TO EXISTING PROJECT TOKENS rather than pasted as hexes:
// `button/border/disabled #dfddd8` is already `--border-subtle`, and
// `warmGrey/700 #58534b` is already `--text-secondary`. Two names for one value
// is how a palette forks.
//
// ═══ THREE PLACES THE FILE HAD NO ANSWER ═══
//
// 1. THE BELL HAS NO BADGE IN THE FRAME. The brief makes it load-bearing — the
//    bell is now the ONLY signal Activity has anything in it, because Activity
//    left the tab bar. So the badge is an extension, and rather than invent one
//    it is the rail's badge verbatim (`sidebar.tsx`): same `--state-error` fill,
//    same 18px pill, same 10px semibold. A count the reader already learned in
//    one place must not change shape in another.
// 2. THE ACCESSIBLE NAME COMPOSES THE COUNT — "Activity, 4 unread" — so the
//    badge is not carried by colour or position alone (SC 1.4.1). The bare word
//    when there is nothing waiting; no "0 unread", which reads as a fault.
// 3. THE WORDMARK IS THE PROJECT'S OWN `<Wordmark>`, not the frame's exported
//    SVG: Figma asset URLs expire in ~7 days, and the committed component uses
//    `currentColor` so it themes. Its viewBox is 148×21 against the frame's
//    184×23.968 — the same glyph in a tighter box, so at the frame's 24px height
//    it renders ~169px wide rather than 184px. Flagged rather than stretched.
// ═══════════════════════════════════════════════════════════════════════════

import { MessagesSquare } from "lucide-react";
import { ActivityBellMobile } from "@/components/app-shell/activity-bell";
import { toggleSupport, useSupportOpen } from "@/lib/support/panel";
import { Wordmark } from "@/components/brand";
import { AccountPopover } from "@/components/settings/account-popover";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The circular 64px chrome button the frame uses for both the bell and (as a
 *  plain image) the avatar. */
/* ═══ 44, NOT THE FRAME'S 64 (answered 2026-10-16) ═══
   The support CTA joined this bar (SUP-1), and four items at 64px need 409px
   on a 390px phone with 342 to spend. At 44 — the touch-target floor this
   codebase holds (`--target-min`) — wordmark + three buttons + two 12px gaps
   is 169 + 132 + 24 = 325. */
const CIRCLE =
  "flex size-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-card)]/94";

export function TopBar({
  unread,
  avatarInitial,
  avatarSrc,
  support,
}: {
  /** The support CTA (SUP-1), for the personas that have the panel; absent
   *  for everyone else. Same store as the desktop bar's, so the two agree. */
  support?: { unread: number };
  unread: number;
  avatarInitial?: string;
  avatarSrc?: string | null;
}) {
  return (
    <header
      // ═══ FIXED, NOT A FLEX SIBLING (product-owner decision) ═══
      //
      // It was a flex child above the scrolling panel, which kept it visually in
      // place but tied it to the shell's layout. Fixed is unambiguous: the
      // wordmark, the Activity bell and the avatar stay reachable at any scroll
      // position, which is the point of promoting Activity out of the tab bar in
      // the first place — a badge you have to scroll to find is not a signal.
      //
      // TWO CONSEQUENCES, BOTH HANDLED:
      //   · IT NEEDS ITS OWN OPAQUE SURFACE. A fixed bar over a scrolling panel
      //     shows content through unless it paints. `--surface-s1` is the panel's
      //     own colour (#f6f4ef), which also settles the mismatch flagged at
      //     GATE 2A: the bar was inheriting the shell ground `--surface-s2`
      //     (#e5e0d2) and reading as a darker strip, where Figma frame
      //     2308:19812 is one flat #faf6ef across the whole screen.
      //   · THE PANEL MUST RESERVE ITS HEIGHT. `--topbar-reserve` in globals.css,
      //     the mirror of `--nav-reserve` at the bottom, so content starts below
      //     it and `scroll-padding-top` keeps a focused control from being
      //     scrolled underneath it (SC 2.4.11).
      //
      // SAFE AREA ON THE TOP EDGE (RC-5), added to the frame's 16px rather than
      // replacing it — a notched device needs the inset AND the designed padding.
      // `change-requests-dock.tsx:63` is the reference for this in the codebase.
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      data-anno-ref="app-topbar"
      className="fixed inset-x-0 top-0 z-40 flex w-full items-center justify-between bg-[var(--surface-s1)] px-6 pb-4 md:hidden"
    >
      <Wordmark className="h-6" />

      <div className="flex items-center gap-3">
        {/* ACTIVITY — the bell opens it in a bottom sheet now (2026-10-16); it
            was a link to `/app/activity`, which is gone. */}
        <ActivityBellMobile unread={unread} circleClass={CIRCLE} ringClass={RING} />

        {support && <MobileSupportButton unread={support.unread} />}

        {/* THE AVATAR OPENS A SHEET, NOT A ROUTE — and it is the SAME component
            the rail uses, in its `sheet` presentation. See the note on
            `AccountPopover`'s `presentation` prop for why a second menu was the
            wrong answer. */}
        <AccountPopover
          presentation="sheet"
          avatarSrc={avatarSrc ?? null}
          avatarInitial={avatarInitial ?? "S"}
          triggerClassName="size-11"
        />
      </div>
    </header>
  );
}

/** ═══ THE SUPPORT CTA, MOBILE TIER (SUP-1) ═══
 *  The same toggle as the desktop bar's (`console-top-bar.tsx`), on the same
 *  store, so opening it on one tier and resizing to the other agrees. Open is
 *  the raised fill here too. The panel is SUP-2 (a full-screen sheet below
 *  768). */
function MobileSupportButton({ unread }: { unread: number }) {
  const open = useSupportOpen();
  return (
    <button
      type="button"
      data-support-cta
      aria-expanded={open}
      /* TODO-COPY */
      aria-label={unread > 0 ? `Support, ${unread} unread` : "Support"}
      onClick={toggleSupport}
      className={cn(CIRCLE, open && "bg-[var(--surface-raised)]", RING)}
    >
      <MessagesSquare className="size-6 text-[var(--text-primary)]" aria-hidden />
    </button>
  );
}
