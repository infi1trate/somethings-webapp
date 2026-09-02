// CHAT — who may message whom, and where that lands.
//
// The seam exists so chat can scale WITHOUT touching call sites. Chat used to be
// one item inside a "Contact" dropdown that also held phone and email; that
// bundling meant chat couldn't grow without dragging PII exposure along with it.
// Chat is now its own action (components/admin/chat-action.tsx) and contact
// details are stored data on the record (components/record/contact-actions.tsx).
//
// ANYONE MAY CHAT ANYONE — deliberately, not by omission. Product intent is that
// every pair can eventually talk: mentors with their teens, staff with mentors,
// staff with each other. Today's narrower reality (mentor↔staff, staff↔teen) is
// not encoded here on purpose — hard-coding a rule we plan to delete would mean
// rows showing an affordance that disappears later for no visible reason.
//
// When a real rule is needed, narrow it HERE and every table, record and future
// surface follows. ChatAction already renders nothing when this returns false,
// so tightening the rule needs no component edits.

import type { PersonRole } from "@/lib/record/people-demo";

/** May `viewer` open a chat with `subject`? Both roles are accepted so a future
 *  rule can read either side without changing any caller's signature. */
export function canChatWith(
  viewer: PersonRole | undefined,
  subject: PersonRole | undefined
): boolean {
  // Both roles are deliberately unread today. They stay in the signature because
  // the rule that replaces this WILL read them, and adding params later would
  // mean touching every call site. `void` marks the non-use as intentional
  // rather than leaving a lint warning that looks like an oversight.
  void viewer;
  void subject;
  return true;
}

/** ═══ THE ONE PLACE THAT KNOWS THE CHAT URL SHAPE ═══
 *
 *  It used to return `/app/chat?with=<id>`, from the days when the thread was a
 *  query param on a single route. The thread is a route segment now, so the
 *  shape moved — and because every caller has always gone through this function
 *  (six of them: the person record, the task pane, the record task regions, the
 *  relationship table and the flag card), moving it cost no call-site edits.
 *
 *  `?with=` IS NOT BROKEN, it is redirected. Links already sitting in someone's
 *  history, a bookmark or an Activity row still resolve — `/app/chat` reads the
 *  param and redirects to the segment. See that route's own note. */
export function chatThreadHref(personId: string): string {
  return `/app/chat/${encodeURIComponent(personId)}`;
}

/** The name the record surfaces have always called this by. Kept as an alias so
 *  the six call sites read unchanged; `chatThreadHref` is the canonical name. */
export const chatHrefFor = chatThreadHref;
