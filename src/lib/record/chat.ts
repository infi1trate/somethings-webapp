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

/** The one place that knows the chat URL shape. `?with=` carries the person so
 *  the eventual thread view inherits a correct deep link. */
export function chatHrefFor(personId: string): string {
  return `/app/chat?with=${encodeURIComponent(personId)}`;
}
