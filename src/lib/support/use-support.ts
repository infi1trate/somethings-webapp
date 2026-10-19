// ═══════════════════════════════════════════════════════════════════════════
// ONE SOURCE FOR SUPPORT'S ROWS AND ITS UNREAD (SUP-5)
//
// There were three readers of "what is unread in Support": the chat list's
// `Support · N` (gone with the tab this phase), the top bar's CTA badge
// (`ConsoleShell`, from the chat fixture), and the panel's own rows (the
// directory). Two of them could disagree — the CTA counted only supervisor
// threads, the panel also counted cohorts and groups — and that is the
// "two sources of truth" the pack retires (Nielsen H4).
//
// Now both the CTA and the panel call this. The rows are the directory with
// this session on top (what was read, what was sent), and the badge is
// derived from those same rows: the number of CONVERSATIONS with something
// unread, as the chat list counted, because a reader decides where to look,
// not how much to read.

import { useMemo } from "react";
import { useNavClock } from "@/lib/app-shell/shell-config";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { supportDirectory, type SupportSection } from "@/lib/support/directory";
import { useOutbox, useSupportRead, type OutboxMessage } from "@/lib/support/outbox";

export function overlaySession(
  sections: SupportSection[],
  outbox: readonly OutboxMessage[],
  read: ReadonlySet<string>
): SupportSection[] {
  return sections.map((s) => ({
    ...s,
    rows: s.rows.map((r) => {
      const last = outbox.filter((m) => m.threadId === r.id).at(-1);
      return {
        ...r,
        unread: read.has(r.id) ? 0 : r.unread,
        ...(last ? { preview: last.text, previewFromViewer: true, at: last.at } : {}),
      };
    }),
  }));
}

/** Conversations with something unread. */
export const supportUnreadCount = (sections: SupportSection[]) =>
  sections.reduce((n, s) => n + s.rows.filter((r) => r.unread > 0).length, 0);

export function useSupportSections(): { sections: SupportSection[]; now: number } {
  const persona = useOnboardingStore((s) => s.persona);
  const chatScenarioId = useOnboardingStore((s) => s.chatScenarioId);
  const now = useNavClock();
  const outbox = useOutbox();
  const read = useSupportRead();
  const sections = useMemo(
    () => overlaySession(supportDirectory(persona, chatScenarioId, now), outbox, read),
    [persona, chatScenarioId, now, outbox, read]
  );
  return { sections, now };
}

export function useSupportUnread(): number {
  const { sections } = useSupportSections();
  return supportUnreadCount(sections);
}
