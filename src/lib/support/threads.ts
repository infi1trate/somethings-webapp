// ═══════════════════════════════════════════════════════════════════════════
// WHAT A SUPPORT THREAD SAYS (SUP-4)
//
// A row in the list opens one of these. Two sources, matching the list:
//   · a supervisor row reads the chat fixture's own messages for that contact
//     (`chatScenario`), so the thread here and the one on /app/chat's Support
//     tab are the same conversation until SUP-5 retires that tab
//   · a cohort / group / other row is a PLACEHOLDER thread (answered:
//     placeholder data is fine), shaped by its row's preview so the last
//     message is the one the list previews
// Plus whatever this session sent (`outbox.ts`), appended by the view.
//
// ONE LONG MESSAGE IS DELIBERATE: the Fall 2026 cohort's orientation note is
// past the truncation threshold, so "Show more" is on screen in the default
// fixture rather than only in a test.

import { chatScenario } from "@/lib/chat/seed";
import { DEMO_PEOPLE } from "@/lib/record/people-demo";
import { SECTION_ORDER, supportDirectory, type SupportRow, type SupportSectionId } from "@/lib/support/directory";
import type { Persona } from "@/lib/types";

export interface SupportMessage {
  id: string;
  at: number;
  mine: boolean;
  text: string;
  /** Who wrote it, in a group thread; absent 1:1. */
  author?: string;
}

export interface SupportThreadData {
  row: SupportRow;
  /** "pinned" for a contact pinned from outside the directory. */
  section: SupportSectionId | "pinned";
  /** The header's second line: a person's role, or what kind of thread. */
  role: string;
  messages: SupportMessage[];
}

const MIN = 60_000;

/** TODO-COPY / TODO-DATA, every line. Authors are first names: these are
 *  group threads among mentors, not records. */
const PLACEHOLDER: Record<string, { author?: string; mine?: boolean; text: string; ago: number }[]> = {
  "c-fall-26": [
    {
      author: "Brandy",
      text:
        "Welcome to the Fall 2026 cohort, everyone. A few things to have on hand before your first calls. " +
        "Your training modules stay open in Resources for the whole term, so go back to them whenever a situation feels new. " +
        "Check-ins with your lead mentor are every other Thursday; if a time stops working, say so here and we'll move it. " +
        "If something a teen says worries you, you don't have to decide what it means on your own: write it down in their own words, " +
        "raise it from the conversation, and your lead mentor will see it straight away. " +
        "And the obvious one, which is still worth saying: you're not expected to have every answer. Asking is part of the job.",
      ago: 26 * 60 * MIN,
    },
    { mine: true, text: "Thanks, this is really helpful.", ago: 25 * 60 * MIN },
    { author: "Brandy", text: "The orientation recording is up in Resources.", ago: 3 * 60 * MIN },
  ],
  "c-spring-26": [
    { author: "Omar", text: "Great session today. Notes are in the shared folder.", ago: 9 * 24 * 60 * MIN + 30 * MIN },
    { author: "Omar", text: "Thanks, everyone. See you at the next check-in.", ago: 9 * 24 * 60 * MIN },
  ],
  "g-nj": [
    { author: "Maria", text: "Anyone have a good opener for a first call?", ago: 2 * 24 * 60 * MIN },
  ],
  "g-il": [
    { author: "Devon", text: "Meetup notes are pinned at the top.", ago: 243 * 24 * 60 * MIN },
  ],
  "o-help": [
    { author: "Somethings", text: "Reply here if the app is acting up.", ago: 20 * MIN },
  ],
  "o-team": [
    { author: "Somethings", text: "Welcome to Somethings!", ago: 400 * 24 * 60 * MIN },
  ],
};

const KIND: Record<Exclude<SupportSectionId, "supervisors">, string> = {
  cohorts: "Cohort",
  groups: "Group",
  other: "Somethings",
};

export function supportThread(
  id: string,
  persona: Persona,
  chatScenarioId: string,
  now: number
): SupportThreadData | null {
  const sections = supportDirectory(persona, chatScenarioId, now);
  for (const sid of SECTION_ORDER) {
    const row = sections.find((s) => s.id === sid)?.rows.find((r) => r.id === id);
    if (!row) continue;
    if (sid === "supervisors") {
      const person = DEMO_PEOPLE.find((p) => p.id === id);
      /* The chat fixture is a MENTOR's conversations, so only a mentor's
         supervisor threads read it; the list's row says the same. */
      const mentor = persona === "mentor" || persona === "new-mentor";
      const messages = (mentor ? (chatScenario(chatScenarioId, now).messages[id] ?? []) : [])
        .filter((m) => m.text)
        .map((m) => ({ id: m.id, at: m.at, mine: m.sender === "mentor", text: m.text! }));
      return {
        row,
        section: sid,
        /* TODO-COPY, as the chat fixture's subtitle. */
        role: person?.role === "supervisor" ? "Supervisor" : "Lead mentor",
        messages,
      };
    }
    const messages = (PLACEHOLDER[id] ?? []).map((m, i) => ({
      id: `${id}-p${i + 1}`,
      at: now - m.ago,
      mine: !!m.mine,
      text: m.text,
      ...(m.author ? { author: m.author } : {}),
    }));
    return { row, section: sid, role: KIND[sid], messages };
  }
  return null;
}

/** A message past this many characters renders clamped, with "Show more". */
export const LONG_MESSAGE_CHARS = 320;
export const isLongMessage = (text: string) => text.length > LONG_MESSAGE_CHARS;

/** ═══ RUNS ═══ Consecutive messages from one sender (and one author) within
 *  ten minutes. The timestamp sits under a run's LAST bubble, and a group
 *  thread names the author over its FIRST. */
const RUN_GAP = 10 * MIN;
export function runBreaks(messages: { at: number; mine: boolean; author?: string }[]): {
  first: boolean;
  last: boolean;
}[] {
  return messages.map((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const same = (a?: typeof m, b?: typeof m) =>
      !!a && !!b && a.mine === b.mine && a.author === b.author && Math.abs(b.at - a.at) < RUN_GAP;
    return { first: !same(prev, m), last: !same(m, next) };
  });
}

/** ═══ THE PINNED MENTOR'S THREAD (support-beside-hub) ═══ A supervisor and
 *  the mentor whose conversation they are watching, while an escalation is
 *  open on it. PLACEHOLDER (answered: placeholder data is fine), TODO-COPY:
 *  neutral, no clinical content, nothing that names the teen. */
export function pinnedThread(p: { id: string; name: string; shortName?: string }, now: number): SupportThreadData {
  const messages: SupportMessage[] = [
    { id: `${p.id}-pin1`, at: now - 6 * MIN, mine: false, text: "I've raised an escalation and I'm working through the checklist now." },
    { id: `${p.id}-pin2`, at: now - 4 * MIN, mine: true, text: "Thank you. I'm here. Keep the conversation going, and tell me if anything changes." },
  ];
  const last = messages[messages.length - 1];
  return {
    row: { id: p.id, name: p.name, ...(p.shortName ? { shortName: p.shortName } : {}), presence: "online", preview: last.text, previewFromViewer: true, at: last.at, unread: 0 },
    section: "pinned",
    /* TODO-COPY */
    role: "Mentor",
    messages,
  };
}
