// ═══ THE ASSEMBLED TIMELINE — FACTS, NOT NARRATIVE (arch-G, G5) ═══
//
// Every entry is a SYSTEM EVENT or a VERBATIM MESSAGE, and every entry names
// where it came from. There is no summarisation anywhere in this module and no
// generated prose: a timeline that paraphrases is a timeline that can be wrong
// about a crisis, and the one thing this surface must never be is confidently
// wrong about what happened.
//
// AI ANNOTATION IS DEFERRED (§G8) and the gate is with Meg. This module is the
// shape that would host it, and it holds assembled facts only.
//
// ═══ WHY A MANUAL LOG IS MANDATORY HERE ═══
//
// Phone calls and out-of-band actions are invisible to every system source, and
// they happen at the highest-stakes moments of an escalation. A timeline that
// LOOKS complete while omitting a phone call invites exactly the misplaced trust
// a clinical audit surface cannot afford. So the affordance is not optional, and
// manual entries are marked as manually entered — an assembled fact and a
// remembered one are different kinds of evidence.

import type { ConversationMessage, MessageSender } from "@/lib/tasks/conversation";
import type { EscalationRecord } from "@/lib/monitoring/escalation";

export type TimelineSource =
  | "escalation"
  | "supportThread"
  | "teenConversation"
  | "riskFlag"
  | "dispatch"
  | "emergencyContact"
  | "note"
  | "manual";

/** NEEDS-COPY-NICOLE, all eight. Every entry states its source in these words —
 *  that is the attribution requirement, and it is why no entry can exist without
 *  one: the type has no "unknown" member. */
export const SOURCE_LABEL: Record<TimelineSource, string> = {
  escalation: "Escalation record",
  supportThread: "Support thread",
  teenConversation: "Teen conversation",
  riskFlag: "Risk flag",
  dispatch: "911 status",
  emergencyContact: "Emergency contact",
  note: "Escalation note",
  manual: "Logged by hand",
};

export interface TimelineEntry {
  id: string;
  at: number;
  source: TimelineSource;
  /** What happened, in the system's own words or the author's. Never a summary
   *  of something longer. */
  text: string;
  /** Who, when a person is attributable. Null for a system event. */
  author: string | null;
  /** ═══ THIS ENTRY IS A MESSAGE, NOT A RECORD EVENT (addendum §2.4) ═══
   *  Message content is preserved VERBATIM — the standing rule — and the flag
   *  is what tells the renderer it is looking at a TRANSCRIPT rather than at
   *  the escalation's ledger. The two are different kinds of thing and the
   *  renderer draws them differently: messages as bubbles, identical to Risk
   *  Flags; record events as timestamped rows. */
  verbatim?: boolean;
  /** Who said it, as a ROLE — set only on verbatim entries. `author` is the
   *  name and cannot carry this: a transcript sides and tints by role, and
   *  inferring the role from a name would be a string comparison standing in
   *  for a field the source already has. */
  sender?: MessageSender;
  /** Manually logged entries carry the action type the author picked. */
  actionType?: string;
  /** ═══ LOGGED AFTER THE ESCALATION CLOSED (arch-G, G7) ═══
   *  Set by the assembler, not by the author. A hand-logged action is stamped
   *  with the LOGGING time, so anything written up after the escalation ended
   *  falls outside its window — which is most of them. The entry is kept and
   *  marked rather than filtered, and the renderer says so: an entry at 9am
   *  today on an escalation that closed yesterday would otherwise imply the
   *  action itself happened this morning. */
  afterWindow?: boolean;
}

/** NEEDS-COPY-NICOLE, all five. What a supervisor can log by hand. Named rather
 *  than free-text-only because the TYPE is what makes a manual entry scannable
 *  beside system events; the detail is free text underneath it. */
export const MANUAL_ACTION_TYPES = [
  { id: "phoneCall", label: "Phone call" },
  { id: "contactAttempt", label: "Contact attempt" },
  { id: "handover", label: "Handover" },
  { id: "externalService", label: "Contacted an external service" },
  { id: "other", label: "Other action" },
] as const;
export type ManualActionType = (typeof MANUAL_ACTION_TYPES)[number]["id"];

export function manualActionLabel(id: string): string {
  return MANUAL_ACTION_TYPES.find((a) => a.id === id)?.label ?? id;
}

/** ═══ THE ESCALATION WINDOW ═══
 *  Opens at the trigger; closes at resolution, or stays open. Everything the
 *  timeline assembles is filtered to it, so a message from last week cannot
 *  appear as part of a crisis. A live escalation's window has no end, which is
 *  expressed as `null` rather than `now` — `now` would silently exclude anything
 *  that arrives while a reader is looking at it. */
export function escalationWindow(rec: EscalationRecord): { from: number; to: number | null } {
  return { from: rec.triggeredAt, to: rec.resolvedAt };
}

export function withinWindow(at: number, w: { from: number; to: number | null }): boolean {
  if (at < w.from) return false;
  return w.to == null || at <= w.to;
}

/** What the assembler is given. Every field is a deterministic source — there is
 *  no slot here for a model's output. */
export interface TimelineSources {
  record: EscalationRecord;
  /** Mentor ↔ supervisor messages. Fixture-supplied per escalation: the chat
   *  app's support threads are the live mentor's own two and are not queryable
   *  by (mentor, supervisor) pair — reported as a blocker in G0. */
  support: ConversationMessage[];
  /** Mentor ↔ teen messages in the window. */
  teen: ConversationMessage[];
  /** Risk flags raised on the same teen inside the window: `{at, category}`. */
  flags: { at: number; category: string }[];
  /** Close-out completions, as `{at, label}`. */
  noteEvents: { at: number; label: string }[];
  /** Entries a supervisor logged by hand. */
  manual: TimelineEntry[];
}

/** ═══ THE ASSEMBLY ═══
 *
 *  Chronological, oldest first — a record is read forwards. Message content is
 *  copied verbatim and marked; nothing is condensed, and the two conversation
 *  sources are assembled SEPARATELY so the reader's source toggle switches
 *  between them rather than interleaving two voices into one thread.
 *
 *  `conversation` is the toggle's position, and it is a parameter rather than a
 *  filter applied afterwards because the two sources are different lengths: a
 *  timeline that assembled both and hid one would scroll to a height the visible
 *  half does not have. */
export function assembleTimeline(
  s: TimelineSources,
  conversation: "supportThread" | "teenConversation"
): TimelineEntry[] {
  const w = escalationWindow(s.record);
  const out: TimelineEntry[] = [];

  /* NEEDS-COPY-NICOLE on every system sentence below. Each states a fact and
     names nothing it cannot see. */
  out.push({
    id: `${s.record.id}-opened`,
    at: s.record.triggeredAt,
    source: "escalation",
    text: "Escalation opened",
    author: s.record.mentorName,
  });

  if (s.record.acknowledgedAt != null) {
    out.push({
      id: `${s.record.id}-acked`,
      at: s.record.acknowledgedAt,
      source: "escalation",
      text: "Acknowledged by the supervisor",
      author: null,
    });
  }

  if (s.record.is911) {
    /* THE DISPATCH HAS NO TIMESTAMP OF ITS OWN — `is911` is a boolean on the
       payload with no status history (G0's blocker). So it is attributed to the
       trigger instant, which is the only instant the data supports, and the
       entry says "at open" rather than implying a moment nobody recorded. */
    out.push({
      id: `${s.record.id}-911`,
      at: s.record.triggeredAt,
      source: "dispatch",
      text: "911 dispatched — recorded at open; no status history exists",
      author: null,
    });
  }

  if (s.record.resolvedAt != null) {
    out.push({
      id: `${s.record.id}-resolved`,
      at: s.record.resolvedAt,
      source: "escalation",
      text: "Escalation closed",
      author: null,
    });
  }

  for (const f of s.flags) {
    if (!withinWindow(f.at, w)) continue;
    out.push({
      id: `flag-${f.at}`,
      at: f.at,
      source: "riskFlag",
      text: `Flag raised — ${f.category}`,
      author: null,
    });
  }

  for (const n of s.noteEvents) {
    if (!withinWindow(n.at, w)) continue;
    out.push({ id: `note-${n.at}`, at: n.at, source: "note", text: n.label, author: null });
  }

  const messages = conversation === "supportThread" ? s.support : s.teen;
  for (const m of messages) {
    if (!withinWindow(m.at, w)) continue;
    out.push({
      id: `msg-${m.id}`,
      at: m.at,
      source: conversation,
      /* VERBATIM. Not trimmed, not summarised — the standing rule, and the one
         place on this surface where a paraphrase would be a clinical error. */
      text: m.text,
      author: m.senderName,
      verbatim: true,
      sender: m.sender,
    });
  }

  /* ═══ MANUAL ENTRIES ARE NOT WINDOW-FILTERED, AND THAT IS THE FIX ═══
     MEASURED: logging an action on a documentation task produced nothing. The
     entry is stamped `Date.now()` and the escalation closed 20 hours ago, so
     the window filter dropped it — on the one entry type whose whole purpose is
     recording something afterwards, on the surface whose standing caveat says
     out-of-band actions appear only when logged BY HAND.
     Every other source is filtered because its membership is a question of
     fact: a message either was or was not sent during the escalation. A manual
     entry's membership is the AUTHOR'S assertion — they attached it to this
     record — so the window cannot overrule it. What the window still decides is
     whether the entry says it came later. */
  for (const e of s.manual) {
    out.push(withinWindow(e.at, w) ? e : { ...e, afterWindow: true });
  }

  return out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
