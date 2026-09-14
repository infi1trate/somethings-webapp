"use client";

// ═══ WHY `"use client"` ON A FILE OF DATA AND PURE FUNCTIONS ═══
//
// It holds LUCIDE ICON COMPONENTS, and that puts it on the client side of the
// boundary whether it looks like it or not.
//
// MEASURED FAILURE that produced this line: `/app/[section]` used to read its
// item list from `sidebar.tsx`, which is `"use client"`, so the icons never
// crossed into the server graph. Pointing it here instead — a module with no
// directive — pulled lucide into the RSC graph for that page, and every request
// to `/app/home` returned a 500 with `ReferenceError: require is not defined`
// from inside Next's own `app-page` template. Nothing in the stack named this
// file, and `tsc`, `eslint` and `next build` were all clean.
//
// Next 16 traps of this shape produce no type error and no lint error — see
// AGENTS.md. The directive is the fix and the reason it is needed is not
// self-evident from the file's contents, which is why this note exists.

// ═══════════════════════════════════════════════════════════════════════════
// THE ONE NAV SOURCE — rail items, bottom-bar items, and the id → href map.
//
// ═══ WHY THIS EXISTS ═══
//
// There were THREE definitions of the same navigation:
//   · `sidebar.tsx`      SIDEBAR_ITEMS  — the mentor base
//   · `mentor-shell.tsx` LEAD_ITEMS     — the base, filtered
//   · `admin-shell.tsx`  NAV            — its own literal array
//
// They had already drifted: the mentor base called the messaging destination
// `chat` and the supervisor console called it `chats`, so the same place had two
// ids and only one of them could ever have a route. Phase 2A makes the item set
// diverge further — by persona AND by breakpoint — so three definitions would
// have become six. One source, derived views.
//
// ═══ THE TWO ITEM SETS ARE DIFFERENT SHAPES, DELIBERATELY ═══
//
// The RAIL keeps its full set at every persona (six items, unchanged — Phase 2A
// is a small-screen navigation, not a desktop re-architecture). The BAR is four
// items with no overflow, because HIG and Material 3 both top out near five and
// the previous seven-cell bar produced the cramped labels this phase replaces.
//
// Activity leaves the bar for the top-bar bell; Team folds into People for staff.
// Mentors never see People: a one-option menu is a worse Mentees button, and the
// comment at `mentor-shell.tsx` records why leads have no Mentees destination at
// all — they supervise mentors, not teens.
// ═══════════════════════════════════════════════════════════════════════════

import {
  Bell,
  Home,
  ListChecks,
  MessageCircle,
  Radar,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Persona } from "@/lib/types";

/** A nav destination. THE TYPE LIVES HERE, not in `sidebar.tsx`, so the nav
 *  source does not import from a component that imports it back — a type-only
 *  cycle is erased at runtime but still confuses the module graph and the
 *  linter. `sidebar.tsx` re-exports it for existing consumers. */
export interface SidebarItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** Every nav destination, once. `label` is the on-screen word; Figma frame
 *  2308:19812 uses "Chats" (plural) for the messaging destination, which is also
 *  what the supervisor console already said — so the mentor rail's "Chat" was
 *  the odd one out and moves to match. */
export const NAV = {
  home: { id: "home", label: "Home", icon: Home },
  chat: { id: "chat", label: "Chats", icon: MessageCircle },
  activity: { id: "activity", label: "Activity", icon: Bell },
  tasks: { id: "tasks", label: "Tasks", icon: ListChecks },
  /** ═══ SUPERVISOR ONLY, AND AFTER TASKS (arch-B) ═══
   *
   *  Position follows the shift sequence rather than any ranking of importance:
   *  a supervisor clears the completion surface, then keeps watch. Putting
   *  vigilance before completion would make the first thing they see the one
   *  thing that never finishes.
   *
   *  `Radar` rather than a shield or an eye. A shield is the alarm vocabulary and
   *  this item is permanent chrome — an alarm that is always on is furniture. An
   *  eye reads as surveillance of the teen, which is the one thing this surface
   *  must not look like: it watches the SIGNAL, not the person. */
  monitoring: { id: "monitoring", label: "Monitoring", icon: Radar },
  mentees: { id: "mentees", label: "Mentees", icon: Users },
  team: { id: "team", label: "Team", icon: UsersRound },
  /** BAR-ONLY, STAFF-ONLY. A real route (`/app/people`) carrying a
   *  Team/Mentees segmented control — not a sheet. Decided against the sheet
   *  because a tab-bar item that opens a menu has no URL, no meaningful selected
   *  state and no working Back, and because the Figma frame styles People
   *  identically to the other three cells: no chevron, no disclosure affordance.
   *  The design's own grammar says destination. */
  people: { id: "people", label: "People", icon: Users },
} as const satisfies Record<string, SidebarItemDef>;

/** ═══ WHAT A BADGE COUNTS DEPENDS ON THE DESTINATION (arch-A) ═══
 *
 *  Every badge announced "{n} unread", which is Activity's word: an unread thing
 *  is a message somebody has not opened. Tasks got a badge in arch-A and it is a
 *  count of OPEN BILLING REVIEWS — work waiting, not mail — so "15 unread" told a
 *  screen-reader user the wrong thing about the wrong kind of object, and
 *  "unread" as a substitute for the product's chat vocabulary is prohibited
 *  outright in aria labels.
 *
 *  A NOUN PER ITEM, defaulting to the old word. Activity's label is byte-identical
 *  to what it was; only an item that declares a noun gets a different one. */
const BADGE_NOUN: Record<string, string> = {
  /* TODO-COPY — both placeholders pending Nicole. */
  tasks: "open",
  /* NOT "open" — Monitoring's badge counts what is OWED, not what is open, and
   *  the two differ by two orders of magnitude on this surface. See
   *  `monitoringObligations`. */
  monitoring: "overdue",
};

export function badgeNounFor(itemId: string): string {
  return BADGE_NOUN[itemId] ?? "unread";
}

const isStaff = (p: Persona) =>
  p === "lead-mentor" || p === "supervisor" || p === "admin";

const isMentor = (p: Persona) => p === "mentor" || p === "new-mentor";

/** THE RAIL, at and above the tablet breakpoint. Unchanged from what shipped:
 *  six items, minus Mentees for a lead. */
export function railItems(persona: Persona): SidebarItemDef[] {
  const base = [
    NAV.home,
    NAV.chat,
    NAV.activity,
    NAV.tasks,
    // SUPERVISOR TIER ONLY (arch-B). A lead or a mentor has no Monitoring
    // surface, and an item that routes to the unbuilt-section placeholder is
    // worse than no item — see `hrefFor`'s note on why the allowlist went away.
    ...(isStaff(persona) && persona !== "lead-mentor" ? [NAV.monitoring] : []),
    NAV.mentees,
    NAV.team,
  ];
  // A lead supervises mentors, not teens — see `mentor-shell.tsx`. Supervisors
  // and admins keep Mentees: the roster is theirs.
  return persona === "lead-mentor"
    ? base.filter((i) => i.id !== NAV.mentees.id)
    : base;
}

/** THE BOTTOM BAR, below the tablet breakpoint. FOUR ITEMS, NO OVERFLOW.
 *
 *  ═══ MONITORING IS NOT HERE, AND THAT IS A REAL GAP (arch-B) ═══
 *
 *  Four is a designed cap, not an accident: HIG and Material 3 both top out near
 *  five, and the seven-cell bar this replaced is what produced the cramped labels
 *  Phase 2A was built to fix. Adding a fifth cell for one persona would undo that
 *  phase to serve this one.
 *
 *  THE COST, STATED: below the tablet breakpoint a supervisor cannot reach
 *  Monitoring, and its obligation badge — the only thing surfacing an Imminent
 *  breach outside the surface itself until Phase C ships Home — is not visible to
 *  them at all. design-system-gaps.md row 361. The alternative considered and NOT
 *  taken was swapping People out of the staff bar: that trades a roster a
 *  supervisor uses daily for an obligation that is usually zero, and it changes a
 *  shipped surface for an existing persona on this phase's own authority. */
export function barItems(persona: Persona): SidebarItemDef[] {
  if (isMentor(persona)) {
    return [NAV.home, NAV.chat, NAV.tasks, NAV.mentees];
  }
  return [NAV.home, NAV.chat, NAV.tasks, NAV.people];
}

/** id → href. ONE MAP for both shells, replacing the mentor shell's generic
 *  `/app/${id}` and the supervisor console's allowlist.
 *
 *  THE ALLOWLIST IS GONE, and that is the point of decision 1. It existed
 *  because sending a supervisor to an unbuilt placeholder was judged worse than
 *  an inert icon — survivable in a 92px rail, not survivable when it is half a
 *  four-item tab bar. Every item now resolves to a real URL; the unbuilt ones
 *  land on the `/app/[section]` placeholder, which renders correct chrome and
 *  says plainly that the section is not built yet.
 *
 *  HOME IS THE ONE THAT DIFFERS BY PERSONA. `/app` hardcodes `MentorShell`, so
 *  sending staff there would hand them a mentor's home in a mentor's chrome.
 *  They get `/app/home`, which the section placeholder now serves. */
export function hrefFor(persona: Persona, id: string): string {
  if (id === NAV.home.id) return isStaff(persona) ? "/app/home" : "/app";
  return `/app/${id}`;
}

export { isStaff, isMentor };
