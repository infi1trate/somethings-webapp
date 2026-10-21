// ═══════════════════════════════════════════════════════════════════════════
// WHERE A MONITORING ENTRY GOES (pack v3.0, Workstream A)
//
// Supervisors lost Chats from their nav: they reach a conversation through the
// Monitoring entry that needs them. So every entry links — to the teen's
// conversation where one exists, which in this prototype is the live mentor's
// caseload (the threads `lib/chat/seed.ts` builds from `teensForMentor`).
//
// ═══ NOT EVERY ENTRY HAS A CONVERSATION — answered default (Phase 0) ═══
// A record teen of another mentor has a record but no thread here, so the
// entry goes to the record; a generated roster row (`teen-gen-N`) has neither,
// and returns null so the caller renders it unlinked rather than as a door to
// nowhere.

import { chatThreadHref } from "@/lib/record/chat";
import { teensForMentor } from "@/lib/record/people-demo";
import { LIVE_ID, recordHrefFor } from "@/lib/record/subject";

let threads: Set<string> | null = null;
const hasThread = (id: string) => (threads ??= new Set(teensForMentor(LIVE_ID).map((t) => t.id))).has(id);

export type EntryLink = { href: string; kind: "conversation" | "record" };

export function monitoringEntryHref(entry: { recordId?: string }): EntryLink | null {
  const id = entry.recordId;
  if (!id) return null;
  if (hasThread(id)) return { href: chatThreadHref(id), kind: "conversation" };
  return { href: recordHrefFor(id, "monitoring"), kind: "record" };
}
