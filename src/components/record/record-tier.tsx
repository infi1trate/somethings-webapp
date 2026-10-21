"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TIER ON THE USER RECORD (Tiering & Escalation pack, Phase 4)
//
// The same `TierCard` the chat's Care tab renders, from the same store, at the
// top of the record's Overview — above "Worth a look". Role-gated:
//   mentor            → Escalate (the raise flow, in a dialog) and, on Tier 2
//                       or 3, Request step-down
//   supervisor/admin  → Update tier (TierUpdateModule)
//   lead mentor       → read-only. Only a supervisor confirms placement, and
//                       a lead cannot act on Care either (`canActOnCare`).
//
// Raising from here writes the SAME escalation record the chat writes, and the
// same `escalation-opened` chat event, so the conversation shows it the next
// time anyone opens it. There is no tiering page and no tier nav item.

import { useState } from "react";
import { TierCard } from "@/components/tiering/tier-card";
import { TierHistory } from "@/components/tiering/tier-history";
import { RaiseDialog, StepDownRequestDialog, TierUpdateDialog } from "@/components/tiering/tier-update-module";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { LIVE_ID } from "@/lib/record/subject";
import { useTiering } from "@/lib/tiering/use-tiering";

export function RecordTier({ teenId, firstName }: { teenId: string; firstName: string }) {
  const [now] = useState(() => Date.now());
  const tiering = useTiering(now);
  const persona = useOnboardingStore((s) => s.persona);
  const appendChatEvent = useOnboardingStore((s) => s.appendChatEvent);
  const [dialog, setDialog] = useState<"raise" | "step-down" | "update" | null>(null);
  if (!tiering.ready) return null;

  const state = tiering.stateFor(teenId);
  const open = tiering.openEscalationFor(teenId);
  const role = isSupervisorTier(persona) ? "supervisor" : persona === "mentor" || persona === "new-mentor" ? "mentor" : "read-only";
  const from = state.tier;

  return (
    <div data-record-tier>
      <TierCard
        state={state}
        now={now}
        name={firstName}
        role={role}
        onEscalate={open ? undefined : () => setDialog("raise")}
        onRequestStepDown={open ? undefined : () => setDialog("step-down")}
        onUpdateTier={() => setDialog("update")}
      />
      {open && (
        <p data-record-tier-open className="mt-2 text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          An escalation is open for {firstName}. It is worked through in the conversation&rsquo;s Care tab.
        </p>
      )}

      {dialog === "raise" && (
        <RaiseDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          name={firstName}
          current={state.tier}
          onConfirm={({ target, note }) => {
            const e = tiering.raise({ teenId, target, note, anchorMessageId: null });
            appendChatEvent({
              id: `ev-${teenId}-${e.openedAt}`,
              threadId: teenId,
              at: e.openedAt,
              kind: "escalation-opened",
              actorId: LIVE_ID,
              artifactId: e.id,
              artifactName: "an escalation",
            });
          }}
        />
      )}
      {dialog === "step-down" && (from === 2 || from === 3) && (
        <StepDownRequestDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          name={firstName}
          from={from}
          onRequest={({ tier, reason }) => tiering.requestStepDown({ teenId, tier, reason })}
        />
      )}
      {dialog === "update" && (
        <TierUpdateDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          state={state}
          name={firstName}
          nameOf={tiering.nameOf}
          onSetTier={({ tier, reason }) => tiering.setTier({ teenId, tier, reason })}
          onDecline={(reason) => tiering.decline({ teenId, reason })}
        />
      )}
    </div>
  );
}

/** ═══ THE RECORD CARE TAB'S AUDIT TRAIL ═══ `TierHistory`, from the same
 *  store and the same component as the chat Care tab's History sub-section
 *  — one store, two views. Read-only for every role. */
export function RecordTierHistory({ teenId, firstName }: { teenId: string; firstName: string }) {
  const [now] = useState(() => Date.now());
  const tiering = useTiering(now);
  if (!tiering.ready) return null;
  return (
    <TierHistory
      events={tiering.eventsFor(teenId)}
      escalations={tiering.escalationsFor(teenId)}
      nameOf={tiering.nameOf}
      mentorName={tiering.liveMentorName || "The mentor"}
      emptyName={firstName}
    />
  );
}
