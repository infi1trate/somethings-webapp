"use client";

// ═══════════════════════════════════════════════════════════════════════════
// useTiering — THE ONE READ AND WRITE PATH FOR TIERS AND ESCALATIONS
//
// The chat's Care tab, the user record's TierCard and Monitoring's roster all
// come through here, so "one store, two views" is a property of the code and
// not of three surfaces remembering to agree. Fixtures (lib/tiering/seed.ts)
// and this session's writes (the store's `tierEvents`, `escalations`,
// `escalationHistory`) are merged at READ time — the house pattern the chat
// already used — so a scenario switch never has to re-seed the store.
//
// Mount-gated: every input is localStorage-backed or `now`-relative, so the
// server render sees nothing and the client fills in.

import { useMemo } from "react";
import type { EscalationState } from "@/lib/chat/types";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier, staffActorFor } from "@/lib/record/permission-map";
import { LIVE_ID } from "@/lib/record/subject";
import { useMounted } from "@/lib/use-mounted";
import { tierStateFor, type TierActor, type TierEvent, type TierState } from "@/lib/tiering/events";
import { isOpen } from "@/lib/tiering/escalation";
import { seedEscalationEvents, seedEscalationHistory, seedEscalations, seedTierEvents } from "@/lib/tiering/seed";
import type { RaiseTarget, Tier } from "@/lib/tiering/tiers";

export interface Tiering {
  ready: boolean;
  /** The viewer, as the actor any write is signed by. */
  viewer: TierActor;
  isSupervisor: boolean;
  /** Who the live mentor is, for naming `live` actors. */
  liveMentorName: string;
  eventsFor: (teenId: string) => TierEvent[];
  stateFor: (teenId: string) => TierState;
  /** The latest escalation on this teen, open or resolved. */
  escalationFor: (teenId: string) => EscalationState | undefined;
  openEscalationFor: (teenId: string) => EscalationState | undefined;
  /** Every escalation on file for the teen, oldest first. */
  escalationsFor: (teenId: string) => EscalationState[];
  /** The name an actor renders as, for this viewer. */
  nameOf: (a: TierActor) => string;
  raise: (input: { teenId: string; target: RaiseTarget; note: string; anchorMessageId: string | null; supervisorId?: string }) => EscalationState;
  requestStepDown: (input: { teenId: string; tier: Tier; reason: string; escalationId?: string; outcomeId?: string }) => boolean;
  setTier: (input: { teenId: string; tier: Tier; reason: string; escalationId?: string }) => boolean;
  decline: (input: { teenId: string; reason: string }) => boolean;
  putEscalation: (e: EscalationState) => void;
}

let seq = 0;
const nextId = (prefix: string, at: number) => `${prefix}-${at}-${(seq += 1)}`;

export function useTiering(now: number): Tiering {
  const mounted = useMounted();
  const chatScenarioId = useOnboardingStore((s) => s.chatScenarioId);
  const monitoringScenarioId = useOnboardingStore((s) => s.monitoringScenarioId);
  const persona = useOnboardingStore((s) => s.persona);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const lastName = useOnboardingStore((s) => s.draft.lastName);
  const written = useOnboardingStore((s) => s.tierEvents);
  const writtenEscalations = useOnboardingStore((s) => s.escalations);
  const writtenHistory = useOnboardingStore((s) => s.escalationHistory);
  const putEscalation = useOnboardingStore((s) => s.putEscalation);
  const appendTierEvent = useOnboardingStore((s) => s.appendTierEvent);

  const fixtures = useMemo(() => {
    if (!mounted) return null;
    const escalations = seedEscalations(now, chatScenarioId, monitoringScenarioId);
    return {
      escalations,
      events: [...seedTierEvents(now), ...seedEscalationEvents(escalations)],
      history: seedEscalationHistory(now),
    };
  }, [mounted, now, chatScenarioId, monitoringScenarioId]);

  const isSupervisor = isSupervisorTier(persona);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const liveMentorName = fullName;
  /* THE SAME ATTRIBUTION THE CARE PAGE WRITES — the signed-in name, falling
     back to the role — so one person is one byline on every host. */
  const viewer = useMemo<TierActor>(
    () =>
      isSupervisor
        ? { id: `staff-${persona}`, name: fullName || staffActorFor(persona), role: "supervisor" }
        : { id: LIVE_ID, name: fullName, role: "mentor" },
    [isSupervisor, persona, fullName]
  );

  return useMemo<Tiering>(() => {
    const all = [...(fixtures?.events ?? []), ...(mounted ? written : [])];
    const eventsFor = (teenId: string) => all.filter((e) => e.teenId === teenId);
    /* The store's record wins over the fixture's, by thread — the one a
       person has touched is the record (the chat page's rule, moved here). */
    const escalationFor = (teenId: string) =>
      (mounted ? writtenEscalations[teenId] : undefined) ?? fixtures?.escalations[teenId];
    const escalationsFor = (teenId: string) => {
      const list = [
        ...(fixtures?.history ?? []).filter((e) => e.threadId === teenId),
        ...(mounted ? writtenHistory : []).filter((e) => e.threadId === teenId),
      ];
      const current = escalationFor(teenId);
      /* The fixture's open escalation, superseded in the store by a new one,
         is still a thing that happened. */
      const fixture = fixtures?.escalations[teenId];
      if (fixture && current && fixture.id !== current.id && !list.some((e) => e.id === fixture.id)) list.push(fixture);
      if (current && !list.some((e) => e.id === current.id)) list.push(current);
      return list.sort((a, b) => a.openedAt - b.openedAt);
    };
    const nameOf = (a: TierActor) => {
      if (a.id === LIVE_ID) return persona === "mentor" || persona === "new-mentor" ? "You" : liveMentorName || "The mentor";
      if (a.role === "system") return "Intake";
      return a.name || (a.role === "supervisor" ? "A supervisor" : "The mentor");
    };
    const write = (e: Omit<TierEvent, "id" | "actor" | "at"> & { at?: number }) => {
      const at = e.at ?? Date.now();
      return appendTierEvent({ ...e, at, id: nextId("tier", at), actor: viewer } as TierEvent);
    };
    return {
      ready: !!fixtures,
      viewer,
      isSupervisor,
      liveMentorName,
      eventsFor,
      stateFor: (teenId) => tierStateFor(eventsFor(teenId)),
      escalationFor,
      openEscalationFor: (teenId) => {
        const e = escalationFor(teenId);
        return isOpen(e) ? e : undefined;
      },
      escalationsFor,
      nameOf,
      /* ═══ RAISING: THE ESCALATION EXISTS AT ONCE ═══ Safety first — a
         supervisor's confirmation applies to the tier PLACEMENT, not to
         whether the escalation exists. So the record is written open, the
         supervisor is notified in the same write, and the tier is a request
         beside it. Platform safety writes no tier event at all. */
      raise: ({ teenId, target, note, anchorMessageId, supervisorId = "s-brandy" }) => {
        const at = Date.now();
        const e: EscalationState = {
          id: `esc-${teenId}-${at}`,
          threadId: teenId,
          openedAt: at,
          anchorMessageId,
          supervisorNotifiedAt: at,
          supervisorId,
          assessment: {},
          resolvedAt: null,
          resolutionNoteId: null,
          requested: target,
          contextNote: note.trim(),
          safetyCheck: { answers: {}, submittedAt: null },
          outcomeId: null,
        };
        putEscalation(e);
        if (target !== "platform") {
          const from = tierStateFor(eventsFor(teenId)).tier;
          write({ at, teenId, kind: "requested", tier: target, fromTier: from, reason: note.trim(), escalationId: e.id });
        }
        return e;
      },
      requestStepDown: ({ teenId, tier, reason, escalationId, outcomeId }) =>
        write({ teenId, kind: "step-down-requested", tier, fromTier: tierStateFor(eventsFor(teenId)).tier, reason, escalationId, outcomeId }),
      /* A supervisor's placement. `confirmed` when it answers the pending
         request, `stepped-down` when it moves down, `placed` otherwise. */
      setTier: ({ teenId, tier, reason, escalationId }) => {
        const s = tierStateFor(eventsFor(teenId));
        const kind = s.pending && s.pending.tier === tier ? "confirmed" : s.tier !== null && tier > s.tier ? "stepped-down" : "placed";
        return write({ teenId, kind, tier, fromTier: s.tier, reason, escalationId: escalationId ?? s.pending?.escalationId });
      },
      decline: ({ teenId, reason }) => {
        const s = tierStateFor(eventsFor(teenId));
        if (!s.pending) return false;
        return write({ teenId, kind: "declined", tier: s.pending.tier, fromTier: s.tier, reason, escalationId: s.pending.escalationId });
      },
      putEscalation,
    };
  }, [fixtures, mounted, written, writtenEscalations, writtenHistory, persona, liveMentorName, isSupervisor, viewer, appendTierEvent, putEscalation]);
}
