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
// ═══ A PLATFORM CONCERN HAS ITS OWN FLOW (pack v3.0, Supersession 3) ═══ It
// was the picker's fourth option. Below the tiers, a quiet text link opens a
// lighter report — what the concern is, and Send — that writes a category,
// never a tier.
//
// ═══ ON CONFIRM THE ESCALATION OPENS AT ONCE ═══ Safety first: the
// supervisor's confirmation applies to tier PLACEMENT, not to whether the
// escalation exists (see `useTiering().raise`).
//
// DEFERRED: the context note is text only. A voice note needs recording and
// storage this prototype does not have; it is in the report.

import { useId, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CONTEXT_NOTE_MAX, TierSelect } from "@/components/tiering/tier-select";
import { PLATFORM, type RaiseTarget, type Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

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
  /** The platform-concern report, its own lighter flow. */
  const [platform, setPlatform] = useState(false);

  if (platform) {
    return (
      <PlatformReport
        name={name}
        onBack={() => setPlatform(false)}
        onSend={(text) => onConfirm({ target: PLATFORM, note: text })}
      />
    );
  }

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
        onPlatform={() => setPlatform(true)}
        onConfirm={({ tier, note }) => onConfirm({ target: tier, note })}
      />
    </div>
  );
}

/** ═══ THE PLATFORM-CONCERN REPORT ═══ Lighter than a raise: no tier, no
 *  alert colour, one field and Send. It still notifies the supervisor and
 *  opens as a review on the same record, so nothing about it is lost. */
function PlatformReport({ name, onBack, onSend }: { name: string; onBack: () => void; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div data-platform-report className="space-y-4">
      <button type="button" onClick={onBack} className={cn("inline-flex min-h-8 items-center gap-1 rounded-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]", RING)} style={{ font: "var(--type-field-label)" }}>
        <ArrowLeft aria-hidden className="size-3.5" />
        {/* TODO-COPY */}
        Back to raising an escalation
      </button>
      <div>
        <h3 className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
          {/* TODO-COPY */}
          Report a platform concern
        </h3>
        <p className="mt-0.5 text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
          {/* TODO-COPY */}
          Impersonation or account activity that doesn&rsquo;t look right. It goes to your supervisor and won&rsquo;t change {name}&rsquo;s tier.
        </p>
      </div>
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          What&rsquo;s the concern?
        </label>
        <textarea
          id={id}
          ref={ref}
          data-platform-note
          rows={3}
          maxLength={CONTEXT_NOTE_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={tried && !text.trim() ? true : undefined}
          className={cn(
            "block w-full resize-none rounded-[var(--radius-control)] border bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]",
            tried && !text.trim() ? "border-[color:var(--state-error)]" : "border-[color:var(--border-subtle)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        />
        {tried && !text.trim() && (
          <p role="alert" className="mt-1 text-[var(--state-error)]" style={{ font: "var(--type-field-label)" }}>
            {/* TODO-COPY */}
            Add a line about what you noticed.
          </p>
        )}
      </div>
      <button
        type="button"
        data-platform-send
        onClick={() => {
          setTried(true);
          if (!text.trim()) {
            ref.current?.focus();
            return;
          }
          onSend(text.trim());
        }}
        className={cn("inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--text-primary)] px-4 text-[var(--text-inverse)] hover:opacity-90", RING)}
        style={{ font: "var(--type-button)" }}
      >
        {/* TODO-COPY */}
        Send report
      </button>
    </div>
  );
}
