"use client";

// ═══════════════════════════════════════════════════════════════════════════
// RaiseFlow — raising an escalation (Tiering & Escalation pack, Phase 2)
//
// One flow, whatever the entry: the Care tab's Escalate, the conversation's
// "Raise an escalation", a message's "Raise an escalation about this
// message", or the user record. Hosted as a RAIL TAKEOVER in chat (the
// conversation stays visible beside it — a mentor writing "what's
// happening?" needs to read what happened) and in a dialog on the record.
//
// Three steps on one surface, in order: pick a tier, say what is going on,
// confirm. ═══ SINCE pack v10.0 ═══ all three are `TierSelect` in raise mode
// (`tier-select.tsx`) — the same control the supervisor confirms and updates
// a tier with. This file hosts it: the heading, and the switch to the
// platform-concern report. The inline radio list it used to carry is
// deleted, not orphaned.
//
// ═══ THE PLATFORM-CONCERN REPORT IS DELETED (pack v11.0, Supersession 4) ═══
// v3 moved it out of the tier picker to a quiet link below it; v11 removes
// the link, which left the report unreachable — so it is deleted, not
// orphaned. Routing a non-risk concern is an open product question. Records
// that already carry `requested: "platform"` keep the supervisor's "Mark
// reviewed" path.
//
// ═══ ON CONFIRM THE ESCALATION OPENS AT ONCE ═══ Safety first: the
// supervisor's confirmation applies to tier PLACEMENT, not to whether the
// escalation exists (see `useTiering().raise`).
//
// DEFERRED: the context note is text only. A voice note needs recording and
// storage this prototype does not have; it is in the report.

import { TierSelect } from "@/components/tiering/tier-select";
import type { RaiseTarget, Tier } from "@/lib/tiering/tiers";


export function RaiseFlow({
  name,
  current,
  onCancel,
  onConfirm,
  heading = true,
}: {
  /** The teen's first name. */
  name: string;
  current: Tier | null;
  onCancel: () => void;
  onConfirm: (input: { target: RaiseTarget; note: string }) => void;
  /** Off when the host (a dialog) already titles it. */
  heading?: boolean;
}) {
  return (
    <div data-raise-flow className="space-y-5">
      {heading && (
        <div>
          <h3 className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
            {/* TODO-COPY */}
            Raise an escalation
          </h3>
          <p className="mt-0.5 text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
            {/* TODO-COPY */}
            Your supervisor is told the moment you confirm.
          </p>
        </div>
      )}
      <TierSelect
        mode="raise"
        name={name}
        current={current}
        onCancel={onCancel}
        onConfirm={({ tier, note }) => onConfirm({ target: tier, note })}
      />
    </div>
  );
}
