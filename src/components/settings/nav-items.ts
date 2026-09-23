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
  CalendarDays,
  FileText,
  Flag,
  Home,
  ListChecks,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Radar,
  ShieldAlert,
  UserCog,
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

  // ═══════════════════════════════════════════════════════════════════════
  // THE SUPERVISOR'S DESTINATIONS (supervisor IA restructure, Phase 1)
  //
  // Home absorbed Monitoring and Tasks and became the place work LIVES rather
  // than the place work is oriented. These are where the work goes, and `Today`
  // is what is left when you take the work out of it.
  //
  // `Tasks` AND `Monitoring` ARE NOT HERE. Work is owned by three destinations;
  // "task" survives as an object noun only, and Monitoring is a GROUP LABEL — a
  // category of destinations, not a destination. Both entries above are kept
  // for the other personas, who still have a Tasks item pointing where it
  // always pointed.
  // ═══════════════════════════════════════════════════════════════════════

  /** ORIENTATION ONLY. It mirrors; it never contains — see the mirror rule. */
  today: { id: "today", label: "Today", icon: CalendarDays },
  escalations: { id: "escalations", label: "Escalations", icon: ShieldAlert },
  /** ONE destination, no tiers. The three-way split was a severity taxonomy
   *  this system stamped onto individual flags without computing it. */
  riskFlags: { id: "risk-flags", label: "Risk Flags", icon: Flag },
  /** THE MENTOR'S PRACTICE, not the teen's safety. Same event primitive, a
   *  different review subject and a different disposition meaning — which is
   *  why it is a destination rather than a second tab inside Risk Flags. */
  mentorPractice: {
    id: "mentor-practice",
    label: "Mentor Practice",
    icon: UserCog,
  },
  /** ═══ THE NAME IS BLOCKED ON NICOLE, AND THE ROUTE IS NOT ═══
   *  `chat`, `messages` and every messaging synonym are prohibited site-wide —
   *  visible copy, aria labels, alt text, component names. The Figma mockup
   *  nests `Chat` under Monitoring, where it is the COVERAGE surface, and
   *  `Conversations` is arguably the same violation: the surface is named for
   *  the medium when its object is the supervised mentor-mentee relationship.
   *  Candidates with Nicole, in order of preference: Mentorships (names the
   *  object) · Coverage (names the work) · Pairs (names the unit).
   *  The ROUTE is `/app/coverage` and does not wait for her. */
  coverage: {
    id: "coverage",
    // NEEDS-COPY-NICOLE — see above. Placeholder names the work.
    label: "Coverage",
    icon: MessagesSquare,
  },
  /** `Care review`, not `Billing code review`. The work is clinical
   *  presentation review that produces a billing artifact, not code entry — and
   *  it moves billing off the safety surface, which was the naming pass's own
   *  resolution. */
  careReviews: { id: "care-reviews", label: "Care Reviews", icon: FileText },
  /** ═══ IN THE TARGET NAV, AND WITH NO BRIEF ═══
   *  The rail's footer shows `Announcements` below every group. It appears in no
   *  distribution row, no destination brief and no blocked-copy list, so there
   *  is nothing to say about what it holds — and `/app/announcements` does not
   *  exist. It renders as an INERT row rather than an anchor, on the rail's own
   *  rule that a link to nowhere looks like it will work and is therefore worse
   *  than a row that plainly does not. Reported as needing a brief. */
  announcements: {
    id: "announcements",
    label: "Announcements",
    icon: Megaphone,
  },
} as const satisfies Record<string, SidebarItemDef>;

/** ═══ THE BADGE TAXONOMY — SHAPE CARRIES THE OBLIGATION TYPE ═══
 *
 *  The mockup got this accidentally right and it is worth writing down as a
 *  rule rather than leaving as a coincidence: colour is never the sole carrier
 *  (SC 1.4.1), so the badge's SHAPE says what kind of obligation it is.
 *
 *   · `count`      red      — an escalation. An unacknowledged obligation
 *                             against a five-minute clock.
 *   · `count`      amber    — risk flags. Volume, and no deadline exists.
 *   · `clockCount` neutral  — Care Reviews. The ONLY destination with a real
 *                             published deadline, so the only one that earns a
 *                             clock.
 *
 *  AND `Today` HAS NO VARIANT HERE, deliberately. The mockup shows 30, which is
 *  2 + 20 + 8: it double-counts every child badge, sums incommensurate units,
 *  and renders coverage work as a thirty-item inbox — the exact framing this
 *  restructure exists to escape. Today's badge counts the TIME-CRITICAL set
 *  only and renders nothing when that set is empty; see `homeObligations`. */
export type BadgeShape = "count" | "clockCount";

export interface BadgeStyle {
  shape: BadgeShape;
  tone: "alarm" | "attention" | "neutral";
}

export const BADGE_STYLE: Record<string, BadgeStyle> = {
  escalations: { shape: "count", tone: "alarm" },
  "risk-flags": { shape: "count", tone: "attention" },
  "care-reviews": { shape: "clockCount", tone: "neutral" },
  /* Today's is the time-critical count. Alarm tone because every member of that
     set is either an unacknowledged escalation or something already breached —
     there is no non-urgent way for this badge to be non-zero. */
  today: { shape: "count", tone: "alarm" },
};

export function badgeStyleFor(itemId: string): BadgeStyle {
  return BADGE_STYLE[itemId] ?? { shape: "count", tone: "neutral" };
}

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
  /* NEEDS-COPY-NICOLE, all four. Each noun names what the number COUNTS, which
     is a different thing per destination and the reason a shared "unread" was
     wrong: an escalation badge counts obligations against a clock, a risk-flag
     badge counts volume with no deadline, and Today counts only what is
     already late or already unacknowledged. */
  escalations: "needing a response",
  "risk-flags": "open",
  "mentor-practice": "open",
  "care-reviews": "due",
  today: "needing attention now",
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

/** ═══ THE GROUPED RAIL (supervisor IA restructure, Phase 1) ═══
 *
 *  The supervisor's rail gains GROUP LABELS, because it gained destinations: one
 *  flat list of nine items is a list a reader scans linearly every time, and the
 *  three groups answer three different questions —
 *
 *    MONITORING  what is happening now, that I judge
 *    CASEWORK    what I owe, that has a deadline
 *    DIRECTORY   who the people are
 *
 *  `Today` IS OUTSIDE EVERY GROUP AND FIRST. It is not a peer of the
 *  destinations: it mirrors them. A group label over it would make it a fourth
 *  category of work, which is the collapse this restructure is undoing.
 *
 *  ═══ ACTIVITY IS UNDER MONITORING, ON INSTRUCTION, AND THE OBJECTION IS KEPT ═══
 *
 *  Activity is a retrospective LEDGER — a self-audit of what was closed.
 *  Monitoring is present-tense vigilance. Grouping them teaches the reader that
 *  the label means "things about events" rather than "things I watch now", which
 *  is the distinction that makes a group label earn its place at all. The
 *  product owner took the Figma mockup as the target and this is a one-line
 *  change to revisit, so it is built where the mockup puts it and the reasoning
 *  is recorded rather than discarded.
 *
 *  ═══ EVERY OTHER PERSONA GETS ONE UNGROUPED GROUP ═══
 *
 *  Mentor, lead-mentor and admin rails are OUT OF SCOPE this pass, so they
 *  resolve to a single group with no label holding exactly `railItems(persona)`.
 *  Byte-identical rendering, one code path. */
export interface NavGroup {
  /** Null for the ungrouped leading group — `Today`, and every other persona's
   *  whole rail. A null id is not collapsible and renders no label. */
  id: string | null;
  label: string | null;
  items: SidebarItemDef[];
}

export function railGroups(persona: Persona): NavGroup[] {
  const supervisorTier = isStaff(persona) && persona !== "lead-mentor";
  /* ADMIN KEEPS THE FLAT RAIL TOO. `isStaff` is true for admin, and §11 puts
     the admin rail out of scope — so the grouped rail is gated on the
     supervisor persona alone rather than on the tier. */
  if (persona !== "supervisor") {
    void supervisorTier;
    return [{ id: null, label: null, items: railItems(persona) }];
  }
  return [
    { id: null, label: null, items: [NAV.today] },
    {
      id: "monitoring",
      // NEEDS-COPY-NICOLE. A category of destinations, never a destination.
      label: "Monitoring",
      items: [
        NAV.escalations,
        NAV.riskFlags,
        /* BELOW RISK FLAGS, per the target nav. The three judgment destinations
           sit together and the two reading surfaces follow them. */
        NAV.mentorPractice,
        NAV.coverage,
        NAV.activity,
      ],
    },
    {
      id: "casework",
      /* ═══ NEEDS-COPY-NICOLE, AND THE NAME IS A KNOWN PROBLEM ═══
         `caseload` is on the prohibited list and `casework` reads as the same
         family. The group ships anyway, on instruction, with one child — a
         label over a single item is chrome, and the argument for keeping it is
         that the second child is coming rather than that one child needs a
         heading. */
      label: "Casework",
      items: [NAV.careReviews],
    },
    {
      id: "directory",
      // NEEDS-COPY-NICOLE
      label: "Directory",
      items: [NAV.mentees, NAV.team],
    },
  ];
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
  /** ═══ A SUPERVISOR'S BAR NAMES THE ROUTES IT GOES TO (Phase 3) ═══
   *
   *  It was `[home, chat, tasks, people]`, and two of those cells lied by
   *  Phase 2. `home` already resolved to `/app/today` through `hrefFor` while
   *  the cell still read "Home" — the header-disagreement defect, in the one
   *  place a supervisor on a phone has to navigate from. And `tasks` pointed at
   *  a RETIRED HOP, labelled with a retired name, carrying a live badge of 16:
   *  tapping it bounced through `/app/tasks` to Care Reviews.
   *
   *  ═══ AND ROW 361'S COST IS NOW MITIGATED, WHICH IS WHY FOUR IS STILL FOUR ═══
   *
   *  That row records the real gap: four cells is a designed cap (HIG and
   *  Material 3 both top out near five, and the seven-cell bar this replaced is
   *  what produced the cramped labels) so a supervisor below the tablet
   *  breakpoint could not reach Monitoring at all.
   *
   *  Today is a MIRROR now — five destination cards, each a link, each carrying
   *  that destination's own state — so the first cell reaches all five in two
   *  taps and surfaces their obligations in one. That does not close row 361
   *  (Escalations is still not one tap away on a phone) but it does mean the
   *  answer is no longer "add a fifth cell", and a fifth cell would undo the
   *  phase that fixed the labels. Stated so the trade is visible rather than
   *  inherited. */
  return [NAV.today, NAV.chat, NAV.careReviews, NAV.people];
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
  /** ═══ A SUPERVISOR'S `home` IS `Today` NOW (supervisor IA restructure) ═══
   *
   *  `/app/home` still resolves — it redirects — so this is not about
   *  correctness, it is about not spending a navigation on a hop. The
   *  supervisor's RAIL has no `home` item at all; what still asks for one is
   *  the mobile BAR, whose four cells are out of scope this pass.
   *
   *  ADMIN AND LEAD KEEP `/app/home`, and take the hop. Their rails are
   *  explicitly unchanged here, so their items are left pointing exactly where
   *  they pointed and the redirect does the work — see the phase report for the
   *  stale-label cost that leaves on the admin rail. */
  if (id === NAV.home.id) {
    if (persona === "supervisor") return "/app/today";
    return isStaff(persona) ? "/app/home" : "/app";
  }
  return `/app/${id}`;
}

export { isStaff, isMentor };
