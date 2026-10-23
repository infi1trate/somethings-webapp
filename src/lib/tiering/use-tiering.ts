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
import type { ChatMessage, CrisisNote, EscalationState } from "@/lib/chat/types";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier, staffActorFor } from "@/lib/record/permission-map";
import { LIVE_ID } from "@/lib/record/subject";
import { useMounted } from "@/lib/use-mounted";
import { tierStateFor, type TierActor, type TierEvent, type TierState } from "@/lib/tiering/events";
import { CLOSE_OUT_TIER, assessmentOf, crisisSections, isOpen, sectionDone, type CrisisSectionId } from "@/lib/tiering/escalation";
import { noteComplete, sectionFields } from "@/lib/tiering/note-rows";
import { isAlertTier } from "@/lib/tiering/tiers";
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
  /* ═══ THE EXCHANGE (pack v2.0) — every move, on the one record ═══ */
  answer: (teenId: string, questionId: string, value: "yes" | "no") => void;
  submitAssessment: (teenId: string, summary: string) => void;
  /** S1. Tier 1–2 continues to S2; Tier 3–4 is the standard tier update and
   *  closes the escalation (the crisis-note flow does not apply). */
  confirm: (teenId: string, tier: Tier, reason: string) => boolean;
  /** `section` names the row being saved, so a re-save of a completed one
   *  is logged as an amendment (pack v6.1). */
  saveCrisisNote: (teenId: string, patch: Partial<CrisisNote>, section?: CrisisSectionId) => void;
  /** The outcome node: which outcome, and whether it is still the auto-tag. */
  chooseOutcome: (teenId: string, input: { id: string; autoTagged: boolean; basis?: string | null }) => void;
  /** The debrief node, after the outcome: saving it completes the step. */
  saveDebrief: (teenId: string, input: { debrief: string; debriefIsDraft: boolean; plan: string; additional: string }) => void;
  /** A chat moment added to the escalation, with an optional note. Append-only. */
  addMoment: (teenId: string, input: { message: ChatMessage; senderName: string; note: string }) => void;
  /** S4. Closes, files the follow-up, and steps the teen down. */
  close: (teenId: string, input: { followUpDays: number; reason: string }) => boolean;
  /** Platform safety: reviewed, closed, no tier event. */
  closeReviewed: (teenId: string, reason: string) => void;
  /** Dismiss the closed summary — per lens (pack v8.0). */
  seeWrap: (teenId: string, lens?: "mentor" | "supervisor") => void;
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
  const appendChatEvent = useOnboardingStore((s) => s.appendChatEvent);

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
    /* THE THREAD KEEPS ITS HISTORY: closing writes the `escalation-resolved`
       chat event the transcript's chip reads, whoever closes. */
    const closedInThread = (teenId: string, e: EscalationState, at: number) =>
      appendChatEvent({ id: `ev-${teenId}-${at}`, threadId: teenId, at, kind: "escalation-resolved", actorId: viewer.id, artifactId: e.id, artifactName: "the escalation" });
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
          resolvedAt: null,
          resolutionNoteId: null,
          requested: target,
          contextNote: note.trim(),
          safetyCheck: { answers: {}, submittedAt: null },
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
      answer: (teenId, questionId, value) => {
        const e = escalationFor(teenId);
        if (!isOpen(e)) return;
        const a = assessmentOf(e);
        if (a.submittedAt !== null) return;
        /* A change of mind before Submit replaces the answer; Q6's follow-up
           goes when Q6 goes back to No, so nothing stale is sent. */
        const answers = { ...a.answers, [questionId]: { value, at: Date.now() } };
        if (questionId === "q6" && value === "no") delete answers.q6b;
        putEscalation({ ...e, safetyCheck: { ...a, answers } });
      },
      submitAssessment: (teenId, summary) => {
        const e = escalationFor(teenId);
        if (!isOpen(e)) return;
        putEscalation({ ...e, mentorSummary: summary.trim(), safetyCheck: { ...assessmentOf(e), submittedAt: Date.now() } });
      },
      confirm: (teenId, tier, reason) => {
        const e = escalationFor(teenId);
        if (!isOpen(e) || !reason.trim()) return false;
        const s = tierStateFor(eventsFor(teenId));
        const at = Date.now();
        const kind = s.pending && s.pending.tier === tier ? "confirmed" : s.tier !== null && tier > s.tier ? "stepped-down" : "placed";
        if (!write({ at, teenId, kind, tier, fromTier: s.tier, reason, escalationId: e.id })) return false;
        /* RECORD METADATA, NEVER RENDERED: time to confirm. */
        const meta = { ...e.meta, timeToConfirmMs: at - e.openedAt };
        /* TIER 3–4 EXITS THE CRISIS-NOTE FLOW: the tier update is the whole
           answer, and the escalation closes with it. */
        if (tier >= 3) {
          putEscalation({ ...e, confirmedTier: tier, confirmedAt: at, meta, resolvedAt: at, outcome: { id: "tier_update", autoTagged: false, debrief: reason, debriefIsDraft: false, plan: "", additional: "", savedAt: at } });
          closedInThread(teenId, e, at);
        } else putEscalation({ ...e, confirmedTier: tier, confirmedAt: at, meta });
        return true;
      },
      saveCrisisNote: (teenId, patch, section) => {
        const e = escalationFor(teenId);
        if (!isOpen(e)) return; // append-only once closed
        const at = Date.now();
        const next = { ...e.crisisNote, ...patch };
        /* STAMP EACH SECTION ONCE, the first time it is complete — its row's
           time. An edit later re-saves the note, not the section's moment. */
        const sectionAt = { ...e.crisisNote?.sectionAt };
        for (const id of crisisSections(e.confirmedTier ?? 1)) {
          if (!sectionDone(next, id) || sectionAt[id] !== undefined) continue;
          /* Done BEFORE this save (a record from before the stamp existed):
             its moment is the note's previous write, not now. */
          sectionAt[id] = sectionDone(e.crisisNote, id) ? (e.crisisNote?.updatedAt ?? at) : at;
        }
        /* ═══ AN AMENDMENT IS APPENDED, NEVER OVERWRITTEN (pack v6.1) ═══ */
        const amended = section && sectionDone(e.crisisNote, section) ? [{ row: section, at, before: sectionFields(e.crisisNote, section) }] : [];
        putEscalation({ ...e, crisisNote: { ...next, sectionAt, updatedAt: at }, noteAmendments: [...(e.noteAmendments ?? []), ...amended] });
      },
      /* ═══ OUTCOME AND DEBRIEF ARE ROWS (pack v6.1) ═══ Either may be saved
         first. Choosing an outcome keeps a saved debrief (it used to reset
         `savedAt`, which un-did the debrief); a re-choice is an amendment. */
      chooseOutcome: (teenId, { id, autoTagged, basis }) => {
        const e = escalationFor(teenId);
        if (!isOpen(e)) return;
        const at = Date.now();
        const o = e.outcome;
        const amended = o?.id ? [{ row: "outcome", at, before: { id: o.id, autoTagged: o.autoTagged, basis: o.basis, chosenAt: o.chosenAt } }] : [];
        putEscalation({
          ...e,
          outcome: { debrief: "", debriefIsDraft: true, plan: "", additional: "", savedAt: null, ...o, id, autoTagged, basis: basis ?? null, chosenAt: at },
          noteAmendments: [...(e.noteAmendments ?? []), ...amended],
        });
      },
      saveDebrief: (teenId, input) => {
        const e = escalationFor(teenId);
        if (!isOpen(e)) return;
        const at = Date.now();
        const o = e.outcome;
        const amended = o?.savedAt ? [{ row: "debrief", at, before: { debrief: o.debrief, debriefIsDraft: o.debriefIsDraft, plan: o.plan, additional: o.additional, savedAt: o.savedAt } }] : [];
        /* No outcome yet: the debrief is held on an outcome with no id, which
           counts for nothing until one is chosen (`rowDone`). */
        putEscalation({ ...e, outcome: { id: "", autoTagged: false, ...o, ...input, savedAt: at }, noteAmendments: [...(e.noteAmendments ?? []), ...amended] });
      },
      addMoment: (teenId, { message, senderName, note }) => {
        const e = escalationFor(teenId);
        if (!isOpen(e)) return;
        if ((e.moments ?? []).some((m) => m.messageId === message.id)) return; // once per message
        const at = Date.now();
        putEscalation({
          ...e,
          moments: [
            ...(e.moments ?? []),
            {
              id: `mo-${teenId}-${at}`,
              at,
              messageId: message.id,
              note: note.trim(),
              actor: { id: viewer.id, name: viewer.name, role: viewer.role === "supervisor" ? "supervisor" : "mentor" },
              quote: { text: message.text ?? "", sender: message.sender, senderName, at: message.at },
            },
          ],
        });
      },
      close: (teenId, { followUpDays, reason }) => {
        const e = escalationFor(teenId);
        if (!isOpen(e) || !reason.trim()) return false;
        /* ═══ CLOSE IS GATED ON THE NOTE (blocked constant, pack v6.1) ═══
           Enforced in the write, not only by the locked node. */
        if (e.confirmedTier !== undefined && isAlertTier(e.confirmedTier) && !noteComplete(e, e.confirmedTier)) return false;
        const at = Date.now();
        const s = tierStateFor(eventsFor(teenId));
        /* THE STEP DOWN — CLOSE_OUT_TIER, a blocked constant (see its note). */
        if (s.tier !== CLOSE_OUT_TIER) write({ at, teenId, kind: "stepped-down", tier: CLOSE_OUT_TIER, fromTier: s.tier, reason, escalationId: e.id });
        putEscalation({ ...e, resolvedAt: at, followUp: { dueAt: at + followUpDays * 86_400_000, status: null } });
        closedInThread(teenId, e, at);
        return true;
      },
      closeReviewed: (teenId, reason) => {
        const e = escalationFor(teenId);
        if (!isOpen(e) || !reason.trim()) return;
        const at = Date.now();
        putEscalation({ ...e, resolvedAt: at, meta: { ...e.meta, timeToConfirmMs: at - e.openedAt }, outcome: { id: "reviewed", autoTagged: false, debrief: reason.trim(), debriefIsDraft: false, plan: "", additional: "", savedAt: at } });
        closedInThread(teenId, e, at);
      },
      seeWrap: (teenId, lens = "mentor") => {
        const e = escalationFor(teenId);
        if (!e || e.resolvedAt === null) return;
        /* Written once, never moved (append-only). */
        if (lens === "supervisor") {
          if (!e.supervisorWrapSeenAt) putEscalation({ ...e, supervisorWrapSeenAt: Date.now() });
        } else if (!e.wrapSeenAt) putEscalation({ ...e, wrapSeenAt: Date.now() });
      },
    };
  }, [fixtures, mounted, written, writtenEscalations, writtenHistory, persona, liveMentorName, isSupervisor, viewer, appendTierEvent, appendChatEvent, putEscalation]);
}
