// ═══════════════════════════════════════════════════════════════════════════
// THE TIERING FIXTURES — one seed for the chat, the record and Monitoring
//
// ═══ ONE STORE, TWO VIEWS (answered 2026-10-20: "Yes unify the data") ═══
// Every teen on every surface is a record teen (`people-demo`, t1–t26), and
// a chat thread id IS that id. Their tier is read off ONE log: these fixture
// events, merged at read time with what this session has written to the
// store (`tierEvents`). The Monitoring roster's cast was remapped onto record
// teens of matching tenure, so the teen in the Tier 1 lane is the teen whose
// chat shows the banner.
//
// ═══ THE OPEN CRISIS COMES FROM EITHER DEV AXIS ═══ Jordan Tate's Tier 1
// escalation is the chat's "Escalation active" scenario and Monitoring's
// Alert scenarios alike — the same fixture, so the two cannot disagree about
// who is in crisis. Either axis raising it raises it everywhere.

import { crisisEscalationFixture, scenarioEscalations } from "@/lib/chat/seed";
import type { EscalationState } from "@/lib/chat/types";
import { LIVE_ID } from "@/lib/record/subject";
import { DEMO_TEENS } from "@/lib/record/people-demo";
import type { TierActor, TierEvent, TierEventKind } from "@/lib/tiering/events";
import type { Tier } from "@/lib/tiering/tiers";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** The supervisor the fixtures' placements are signed by. */
export const SEED_SUPERVISOR: TierActor = { id: "s-stephen", name: "Stephen Rowe", role: "supervisor" };
/** The store-backed mentor — named at render (see `actorName`). */
export const LIVE_MENTOR: TierActor = { id: LIVE_ID, name: "", role: "mentor" };

type Step = { kind: TierEventKind; tier: Tier; daysAgo: number; reason: string; actor?: TierActor; escalationId?: string; outcomeId?: string };

/** ═══ THE NON-GENERAL TEENS, AND HOW THEY GOT THERE ═══ Everyone else is
 *  placed in Tier 4 at intake. TODO-DATA: reasons are illustrative.
 *
 *  INTAKE IS SIGNED BY A SUPERVISOR, not by "the system": a placement is a
 *  tier-setting event, and the gate (`appendable`) refuses one from anyone
 *  else. The unit test caught the first version doing exactly that. */
const PATHS: Record<string, Step[]> = {
  /* Jordan — the chat's escalation teen. Tier 3 since a hard month at home. */
  t13: [
    { kind: "placed", tier: 4, daysAgo: 122, reason: "Placed at intake." },
    { kind: "placed", tier: 3, daysAgo: 6, reason: "Things at home got harder; weekly check-ins while it settles." },
  ],
  /* Imani — Tier 1 on Friday, stepped down to Tier 2 on the crisis note
     (Monitoring's "From T1 · Fri"). */
  t21: [
    { kind: "placed", tier: 4, daysAgo: 151, reason: "Placed at intake." },
    { kind: "requested", tier: 1, daysAgo: 4, reason: "Said she was scared to go home tonight.", actor: LIVE_MENTOR, escalationId: "esc-t21-hist" },
    { kind: "confirmed", tier: 1, daysAgo: 4, reason: "Confirmed with the mentor on the call.", escalationId: "esc-t21-hist" },
    { kind: "step-down-requested", tier: 2, daysAgo: 2, reason: "Crisis note: her aunt is with her and they have a plan.", actor: LIVE_MENTOR, escalationId: "esc-t21-hist", outcomeId: "guardian" },
    { kind: "stepped-down", tier: 2, daysAgo: 2, reason: "Crisis note reviewed. Tier 2 for the 7-day minimum.", escalationId: "esc-t21-hist" },
  ],
  /* Riley — a flag surge yesterday (Monitoring's 48h surge). */
  t15: [
    { kind: "placed", tier: 4, daysAgo: 44, reason: "Placed at intake." },
    { kind: "placed", tier: 2, daysAgo: 0.2, reason: "Four flags in 48 hours; live coaching while we understand it." },
  ],
  /* Naomi — at the end of Tier 3's dwell (Monitoring's "Step-down ready"). */
  t17: [
    { kind: "placed", tier: 4, daysAgo: 210, reason: "Placed at intake." },
    { kind: "placed", tier: 3, daysAgo: 13.5, reason: "Low mood after exams; weekly check-ins." },
  ],
  /* Simone — a slow burn. */
  t19: [
    { kind: "placed", tier: 4, daysAgo: 176, reason: "Placed at intake." },
    { kind: "placed", tier: 3, daysAgo: 8.5, reason: "Engagement dropping week on week; checking in." },
  ],
  /* Ravi — two days in. */
  t22: [
    { kind: "placed", tier: 4, daysAgo: 143, reason: "Placed at intake." },
    { kind: "placed", tier: 3, daysAgo: 1.5, reason: "Mentioned trouble sleeping twice this week." },
  ],
};

/** Every record teen's fixture log, relative to `now`. */
export function seedTierEvents(now: number): TierEvent[] {
  const out: TierEvent[] = [];
  for (const teen of DEMO_TEENS) {
    const steps = PATHS[teen.id] ?? [{ kind: "placed", tier: 4, daysAgo: teen.joinedDaysAgo ?? 30, reason: "Placed at intake." }];
    let prev: Tier | null = null;
    steps.forEach((s, i) => {
      out.push({
        id: `tier-seed-${teen.id}-${i}`,
        teenId: teen.id,
        at: Math.round(now - s.daysAgo * DAY),
        kind: s.kind,
        tier: s.tier,
        fromTier: prev,
        actor: s.actor ?? SEED_SUPERVISOR,
        reason: s.reason,
        escalationId: s.escalationId,
        outcomeId: s.outcomeId,
      });
      if (s.kind === "placed" || s.kind === "confirmed" || s.kind === "stepped-down") prev = s.tier;
    });
  }
  return out;
}

/** Is a Tier 1 alert live on the Monitoring axis? The Tiers group's Alert,
 *  or any escalation-lifecycle scenario (each has one open). */
export const tierAlertLive = (scenarioId: string | null) =>
  scenarioId === "tiers-alert" || (scenarioId?.startsWith("escalation-") ?? false);

/** The open escalations the scenarios put on screen, keyed by teen id. */
export function seedEscalations(now: number, chatScenarioId: string, monitoringScenarioId: string | null): Record<string, EscalationState> {
  const out: Record<string, EscalationState> = { ...scenarioEscalations(chatScenarioId, now) };
  if (tierAlertLive(monitoringScenarioId) && !out.t13) out.t13 = crisisEscalationFixture(now);
  return out;
}

/** The tier request an open fixture escalation carries — the mentor's raise,
 *  awaiting a supervisor. Platform safety carries none. */
export function seedEscalationEvents(escalations: Record<string, EscalationState>): TierEvent[] {
  return Object.values(escalations).flatMap((e) =>
    e.requested === "platform"
      ? []
      : [
          {
            id: `tier-raise-${e.id}`,
            teenId: e.threadId,
            at: e.openedAt,
            kind: "requested" as const,
            tier: (e.requested ?? 1) as Tier,
            fromTier: null,
            actor: LIVE_MENTOR,
            reason: e.contextNote || "Raised an escalation.",
            escalationId: e.id,
          },
        ]
  );
}

/** Resolved escalations already on file — Imani's Friday crisis, so History
 *  has a finished story to tell (the pack's "resolved-with-history"). */
export function seedEscalationHistory(now: number): EscalationState[] {
  const opened = now - 4 * DAY;
  return [
    {
      id: "esc-t21-hist",
      threadId: "t21",
      openedAt: opened,
      anchorMessageId: null,
      supervisorNotifiedAt: opened,
      supervisorId: "s-brandy",
      resolvedAt: now - 2 * DAY,
      resolutionNoteId: null,
      requested: 1,
      contextNote: "Said she was scared to go home tonight.",
      /* A COMPLETE RECORD (pack v2.0) — the closed-with-history case: every
         stage filled, read by History as one story. */
      safetyCheck: {
        answers: Object.fromEntries(["q1", "q2", "q3", "q4", "q5", "q6"].map((id, i) => [id, { value: i < 3 ? "yes" : "no", at: opened + (i + 2) * MINUTE }])) as Record<string, { value: "yes" | "no"; at: number }>,
        submittedAt: opened + 12 * MINUTE,
      },
      mentorSummary: "Imani is with her aunt now and agreed to a plan for tonight.",
      confirmedTier: 1,
      confirmedAt: opened + 4 * MINUTE,
      meta: { timeToConfirmMs: 4 * MINUTE },
      crisisNote: {
        subtype: "suicidal_ideation",
        tags: ["housing"],
        safetyPlan: { status: "created", usage: "Imani will text her aunt and her mentor if it gets bad tonight." },
        resources: { shared: true, list: "988 Suicide & Crisis Lifeline" },
        referral: { made: true, list: ["therapist"] },
        contact: { engaged: true, details: "Her aunt, by phone; she came home within the hour." },
        services: { contacted: false, which: [] },
        updatedAt: opened + 40 * MINUTE,
      },
      outcome: {
        id: "guardian",
        autoTagged: true,
        debrief: "Imani's aunt came home within the hour. Imani agreed a safety plan and a referral to a therapist.",
        debriefIsDraft: false,
        plan: "Daily check-ins for a week; therapist intake booked.",
        additional: "",
        savedAt: now - 2 * DAY - 30 * MINUTE,
      },
      followUp: { dueAt: now - DAY, status: "affirmed_stable" },
      wrapSeenAt: now - 2 * DAY + 10 * MINUTE,
    },
  ];
}
