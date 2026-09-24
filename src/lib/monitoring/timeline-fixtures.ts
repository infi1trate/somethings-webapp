// ═══ THE TIMELINE'S CONVERSATION SOURCES, AS FIXTURES (arch-G, G5) ═══
//
// ═══ WHY FIXTURES AND NOT A QUERY ═══
//
// G5 asks for "support-thread messages between the mentor and supervisor within
// the escalation window". The recon found no such source: `lib/chat` holds
// exactly two support threads — the ONE live mentor's lead and supervisor — keyed
// by the other party's id from that mentor's perspective, with no (mentor,
// supervisor) index, no time-range API, and no path from the supervisor console
// into the mentor app's data at all.
//
// So the messages are generated here, deterministically, per escalation — which
// is the same arrangement `lib/tasks/conversation.ts` uses for the flag excerpt
// and for the same reason: a fixture that is honest about being a fixture beats
// reaching across an app boundary that does not exist. The alternative — build a
// queryable support-thread store — is logged rather than smuggled into this
// phase.
//
// NOTHING HERE IS CLINICAL. The support messages are coordination ("I've got
// her on the phone"), not assessment: inventing clinical judgment for a
// fictional supervisor would put words in a clinician's mouth that no fixture
// should.

import type { ConversationMessage } from "@/lib/tasks/conversation";
import type { EscalationRecord } from "@/lib/monitoring/escalation";
import { CLOSE_OUT_LABEL, closeOutOf } from "@/lib/monitoring/escalation";
import type { TimelineSources } from "@/lib/monitoring/timeline";
import type { MonitoringEvent } from "@/lib/monitoring/event";

const MINUTE = 60_000;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** NEEDS-COPY-NICOLE on every line. Coordination between a mentor and their
 *  supervisor during an incident — what each of them is doing, and when. */
const SUPPORT_LINES: { from: "mentor" | "them"; text: string; after: number }[] = [
  { from: "mentor", after: 0, text: "Raised an escalation — she said she has the pills with her." },
  { from: "them", after: 2, text: "Seen. I'm on it. Stay in the conversation and keep her talking." },
  { from: "mentor", after: 3, text: "Still replying. She says her mum is downstairs." },
  { from: "them", after: 4, text: "Good. I'm calling the emergency contact now." },
  { from: "mentor", after: 9, text: "She's agreed to go and find her mum." },
  { from: "them", after: 6, text: "Mother has her and the pills are out of the room. Standing down." },
];

/** ═══ INSIDE THE WINDOW, BY CONSTRUCTION ═══
 *  Offsets accumulate from the trigger, and anything that would fall past a
 *  resolved escalation's close is dropped — so the assembler's window filter is
 *  a second line of defence rather than the only one. */
export function supportMessagesFor(rec: EscalationRecord): ConversationMessage[] {
  const seed = hash(rec.id);
  const out: ConversationMessage[] = [];
  let at = rec.triggeredAt + MINUTE;
  SUPPORT_LINES.forEach((line, i) => {
    at += line.after * MINUTE;
    if (rec.resolvedAt != null && at > rec.resolvedAt) return;
    out.push({
      id: `sup-${rec.id}-${i}`,
      sender: line.from === "mentor" ? "mentor" : "teen",
      /* THE SENDER NAMES ARE THE RECORD'S OWN — the mentor who raised it and the
         supervisor who answered. `ConversationMessage.sender` has two values
         ("teen" | "mentor") because it was built for a teen conversation; the
         support thread's other party is a colleague, so the NAME carries the
         role and the enum is just an alignment. Logged as a modelling
         limitation rather than widened here. */
      senderName: line.from === "mentor" ? rec.mentorName : "Your supervisor",
      at,
      text: line.text,
    });
  });
  /* A DETERMINISTIC SLICE so two escalations do not read identically — the same
     trick the flag excerpt uses. */
  return out.slice(0, 3 + (seed % 3) + 1);
}

/** NEEDS-COPY-NICOLE. Ordinary teen-side messages around the trigger. Mundane
 *  on purpose: the escalation's weight is carried by the escalation, and
 *  inventing crisis language for a fictional teen is the thing
 *  `lib/tasks/conversation.ts` already refuses to do. */
const TEEN_LINES: { from: "teen" | "mentor"; text: string; after: number }[] = [
  { from: "mentor", after: 0, text: "are you somewhere safe right now?" },
  { from: "teen", after: 2, text: "in my room" },
  { from: "mentor", after: 1, text: "is anyone else home?" },
  { from: "teen", after: 4, text: "my mum is downstairs" },
  { from: "mentor", after: 2, text: "can you go and sit with her for me?" },
  { from: "teen", after: 7, text: "ok" },
];

export function teenMessagesFor(rec: EscalationRecord): ConversationMessage[] {
  const out: ConversationMessage[] = [];
  let at = rec.triggeredAt + 2 * MINUTE;
  TEEN_LINES.forEach((line, i) => {
    at += line.after * MINUTE;
    if (rec.resolvedAt != null && at > rec.resolvedAt) return;
    out.push({
      id: `teen-${rec.id}-${i}`,
      sender: line.from,
      senderName: line.from === "teen" ? rec.teenName.split(" ")[0] : rec.mentorName.split(" ")[0],
      at,
      text: line.text,
    });
  });
  return out;
}

/** Flags on the same teen inside the window, from the surface's own event set —
 *  a real join rather than a fixture, because those events exist. */
export function flagsInWindowFor(
  rec: EscalationRecord,
  events: MonitoringEvent[]
): { at: number; category: string }[] {
  return events
    .filter((e) => e.teenId === rec.teenId)
    .map((e) => ({ at: e.at, category: e.category ?? "Flag" }));
}

/** Close-out completions. Derived from `closeOutDone`, which has no timestamps —
 *  so each is attributed to the resolution instant, and the entry says the
 *  completion was recorded rather than claiming a moment nobody stored. */
export function noteEventsFor(rec: EscalationRecord, now: number): { at: number; label: string }[] {
  const at = rec.resolvedAt ?? rec.triggeredAt;
  return closeOutOf(rec, now)
    .filter((i) => i.done)
    /* NEEDS-COPY-NICOLE */
    .map((i) => ({ at, label: `${CLOSE_OUT_LABEL[i.id]} recorded complete` }));
}

/** ═══ ONE HAND-LOGGED ACTION, SEEDED (arch-G, G7) ═══
 *
 *  The seeds ask for at least one manual entry, and until this existed there was
 *  none: a hand-logged action was only ever created by a reader using the form,
 *  so the treatment that distinguishes remembered evidence from assembled
 *  evidence was invisible on arrival — on the surface whose whole claim is that
 *  you can tell the two apart.
 *
 *  ONLY ON A CLOSED RECORD, and this is not arbitrary: an out-of-band action is
 *  something somebody typed up afterwards, so a live escalation that has one
 *  already would be asserting that the supervisor stopped to write during the
 *  incident. A phone call is also the exact case the standing caveat names.
 *
 *  ATTRIBUTED TO THE SUPERVISOR WHO WOULD HAVE LOGGED IT — not to "System",
 *  which is the one author a manual entry can never have. */
export function manualFixturesFor(rec: EscalationRecord): TimelineSources["manual"] {
  if (rec.resolvedAt == null) return [];
  const at = Math.round((rec.triggeredAt + rec.resolvedAt) / 2);
  return [
    {
      id: `manual-seed-${rec.id}`,
      at,
      source: "manual",
      /* NEEDS-COPY-NICOLE. Coordination, not assessment — the same line the
         message fixtures hold. */
      text: "Called the emergency contact — guardian was already with her.",
      author: "You",
      actionType: "phoneCall",
    },
  ];
}

/** Everything the assembler needs for one escalation. */
export function timelineSourcesFor(
  rec: EscalationRecord,
  events: MonitoringEvent[],
  manual: TimelineSources["manual"],
  now: number
): TimelineSources {
  return {
    record: rec,
    support: supportMessagesFor(rec),
    teen: teenMessagesFor(rec),
    flags: flagsInWindowFor(rec, events),
    noteEvents: noteEventsFor(rec, now),
    manual,
  };
}
