"use client";

// ═══ THE NOTICES, READ ONCE FOR THE BELL AND TODAY (pack v5.0, C) ═══
// One hook, so the bell and Today read the same derived list through the same
// tiering store — Today's mirror rule ("computed by the SAME FUNCTION") held
// for the one new thing it shows. Nothing here writes except `markSeen`, which
// only the bell calls.

import { useState } from "react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { DEMO_PEOPLE, DEMO_TEENS } from "@/lib/record/people-demo";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { LIVE_ID } from "@/lib/record/subject";
import { teenDisplayName } from "@/lib/record/teen-name";
import { supportThread } from "@/lib/support/threads";
import { mentorNotices, supervisorAgenda, supervisorNotices, unreadNotices, type EscalationNotice, type NoticeInput } from "@/lib/tiering/notifications";
import { useTiering } from "@/lib/tiering/use-tiering";

const first = (name: string | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

export function useEscalationNotices(): {
  role: "supervisor" | "mentor";
  notices: EscalationNotice[];
  agenda: EscalationNotice[];
  unread: number;
  /** The last look, before `markSeen` moves it. */
  seenAt: number;
  markSeen: () => void;
} {
  const [now] = useState(() => Date.now());
  const tiering = useTiering(now);
  const persona = useOnboardingStore((s) => s.persona);
  const scenarioId = useOnboardingStore((s) => s.chatScenarioId);
  const seenAt = useOnboardingStore((s) => s.noticesSeenAt?.[persona] ?? 0);
  const markNoticesSeen = useOnboardingStore((s) => s.markNoticesSeen);
  const role = isSupervisorTier(persona) ? "supervisor" : "mentor";
  if (!tiering.ready) return { role, notices: [], agenda: [], unread: 0, seenAt, markSeen: () => {} };
  /* A supervisor sees every record teen's escalations; a mentor, their own. */
  const teens = role === "supervisor" ? DEMO_TEENS : DEMO_TEENS.filter((t) => t.mentorId === LIVE_ID);
  const input: NoticeInput = {
    escalations: teens.flatMap((t) => tiering.escalationsFor(t.id)),
    eventsFor: tiering.eventsFor,
    nameOf: tiering.nameOf,
    teenName: (id) => {
      const t = DEMO_TEENS.find((x) => x.id === id);
      return (t && first(teenDisplayName(t))) || "the teen";
    },
    mentorName: (id) => {
      const m = DEMO_TEENS.find((t) => t.id === id)?.mentorId;
      if (m === LIVE_ID) return first(tiering.liveMentorName) || "The mentor";
      return first(DEMO_PEOPLE.find((p) => p.id === m)?.name) || "The mentor";
    },
    supervisorName: (id) => first(DEMO_PEOPLE.find((p) => p.id === id)?.name) || "Your supervisor",
    supportFrom: (id) => (supportThread(id, persona, scenarioId, now)?.messages ?? []).filter((m) => !m.mine).map((m) => ({ at: m.at, text: m.text })),
    now,
  };
  const notices = role === "supervisor" ? supervisorNotices(input) : mentorNotices(input);
  return {
    role,
    notices,
    agenda: role === "supervisor" ? supervisorAgenda(input) : [],
    unread: unreadNotices(notices, seenAt),
    seenAt,
    markSeen: () => markNoticesSeen(persona, Date.now()),
  };
}
