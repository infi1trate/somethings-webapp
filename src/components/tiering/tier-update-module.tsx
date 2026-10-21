"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TierUpdateModule — a supervisor's placement (pack, Phase 4)
//
// ═══ A TIER CHANGE IS A PROPERTY OF AN UPDATE, NEVER A BARE BUTTON ═══ The
// tier is chosen, a reason is REQUIRED, and the result is posted to the
// record as an append-only event. Extracted once: the user record hosts it
// today, the chat hosts it for a supervisor observing a conversation, and
// the Monitoring surfaces can host it later without a second composer.
//
// What it allows is `placementsFrom` — up anywhere, down one step on the
// tier's exit document, Tier 1 to Tier 3 only on a "no longer a threat"
// crisis note. A pending request is pre-selected and quoted, and the
// supervisor can decline it ("Keep in Tier N") with a reason instead.
//
// Also here, because they are the same dialog grammar: the mentor's
// step-down REQUEST, and the raise flow's dialog host for the record.

import { useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import { RaiseFlow } from "@/components/tiering/raise-flow";
import { describeEvent, placementsFrom, type TierActor, type TierState } from "@/lib/tiering/events";
import { EXIT_DOCUMENT, EXITS_TO, TIER_NAME, type RaiseTarget, type Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function ReasonField({
  label,
  value,
  onChange,
  invalid,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  placeholder: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
        {label}
      </label>
      <textarea
        id={id}
        data-tier-reason
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        className={cn(
          "block w-full resize-none rounded-[var(--radius-control)] border bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          invalid ? "border-[color:var(--state-error)]" : "border-[color:var(--border-subtle)]",
          RING
        )}
        style={{ font: "var(--type-body)" }}
      />
      {invalid && (
        <p role="alert" className="mt-1 text-[var(--state-error)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          A reason is required — it is the record.
        </p>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, slot }: { children: React.ReactNode; onClick: () => void; slot: string }) {
  return (
    <button
      type="button"
      data-tier-submit={slot}
      onClick={onClick}
      className={cn("inline-flex min-h-10 items-center rounded-full bg-[var(--text-primary)] px-4 text-[var(--text-inverse)] transition-opacity hover:opacity-90", RING)}
      style={{ font: "var(--type-button)" }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, slot }: { children: React.ReactNode; onClick: () => void; slot: string }) {
  return (
    <button
      type="button"
      data-tier-secondary={slot}
      onClick={onClick}
      className={cn("inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-contour)] px-4 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
      style={{ font: "var(--type-body)" }}
    >
      {children}
    </button>
  );
}

/** ═══ THE MODULE ═══ Content only, so a host can put it in a dialog, a pane
 *  or a sheet. */
export function TierUpdateModule({
  state,
  name,
  nameOf,
  onSetTier,
  onDecline,
  onDone,
}: {
  state: TierState;
  name: string;
  nameOf: (a: TierActor) => string;
  onSetTier: (input: { tier: Tier; reason: string }) => void;
  onDecline: (reason: string) => void;
  onDone: () => void;
}) {
  const pending = state.pending;
  /* The "no longer a threat" crisis-note exit retired with the mentor's
     Resolve (Escalation Exchange, pack v2.0); the close-out's own step down
     is `CLOSE_OUT_TIER`. */
  const options = placementsFrom(state.tier);
  const [tier, setTier] = useState<Tier | null>(pending && options.find((o) => o.tier === pending.tier)?.allowed ? pending.tier : null);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const groupId = useId();
  const choice = options.find((o) => o.tier === tier);
  const exitDoc = choice?.stepDown && state.tier !== null && state.tier !== 4 ? EXIT_DOCUMENT[state.tier] : null;

  const submit = () => {
    setTried(true);
    if (tier === null || !reason.trim()) return;
    onSetTier({ tier, reason: reason.trim() });
    onDone();
  };
  const decline = () => {
    setTried(true);
    if (!reason.trim()) return;
    onDecline(reason.trim());
    onDone();
  };

  return (
    <div data-tier-update className="space-y-4">
      {pending && (
        <div data-tier-update-pending className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
          <p className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
            {describeEvent(pending, nameOf(pending.actor))}
          </p>
          <p className="mt-0.5 text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
            &ldquo;{pending.reason}&rdquo;
          </p>
        </div>
      )}

      <div>
        <p id={groupId} className="mb-2 text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          {state.tier ? `${name} is in Tier ${state.tier} · ${TIER_NAME[state.tier]}. Move to` : `Place ${name} in`}
        </p>
        <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-2 gap-2">
          {options.map((o) => {
            const selected = o.tier === tier;
            return (
              <button
                key={o.tier}
                type="button"
                role="radio"
                data-tier-option={o.tier}
                aria-checked={selected}
                aria-disabled={!o.allowed || undefined}
                onClick={() => o.allowed && setTier(o.tier)}
                className={cn(
                  "flex min-h-11 flex-col items-start gap-1 rounded-[var(--radius-inset)] border px-3 py-2 text-left",
                  !o.allowed
                    ? "cursor-not-allowed border-dashed border-[color:var(--border-default)] opacity-70"
                    : selected
                      ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)]"
                      : "border-[color:var(--border-subtle)] bg-[var(--surface-s1)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                <TierLozenge tier={o.tier} long />
                {!o.allowed && o.why && (
                  <span className="text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
                    {o.why}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {tried && tier === null && !pending && (
          <p role="alert" className="mt-1.5 text-[var(--state-error)]" style={{ font: "var(--type-field-label)" }}>
            {/* TODO-COPY */}
            Choose a tier.
          </p>
        )}
      </div>

      <ReasonField
        /* TODO-COPY. A step down records the tier's exit document. */
        label={exitDoc ? `${exitDoc} — why ${name} is ready to step down` : "Reason — posted to the record"}
        value={reason}
        onChange={setReason}
        invalid={tried && !reason.trim()}
        placeholder={exitDoc ? "What has changed, and what support stays in place" : "What you saw and decided"}
      />

      <div className="flex flex-wrap gap-2">
        <PrimaryButton slot="post" onClick={submit}>
          {/* TODO-COPY */}
          {pending && tier === pending.tier ? `Confirm Tier ${tier}` : "Post update"}
        </PrimaryButton>
        {pending && state.tier !== null && (
          <GhostButton slot="decline" onClick={decline}>
            {/* TODO-COPY */}
            Keep in Tier {state.tier}
          </GhostButton>
        )}
      </div>
    </div>
  );
}

export function TierUpdateDialog({
  open,
  onOpenChange,
  ...module
}: Omit<React.ComponentProps<typeof TierUpdateModule>, "onDone"> & { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="tier-update-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{/* TODO-COPY */}Update {module.name}&rsquo;s tier</DialogTitle>
          <DialogDescription>
            {/* TODO-COPY */}
            Posted to the record with your reason. Nothing here can be edited later; a correction is a new update.
          </DialogDescription>
        </DialogHeader>
        {open && <TierUpdateModule {...module} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

/** ═══ A MENTOR ASKS TO STEP DOWN ═══ Never a direct step down — see
 *  `canSetTier`. The request renders the pending chip; a supervisor
 *  completes the exit document on their side. */
export function StepDownRequestDialog({
  open,
  onOpenChange,
  name,
  from,
  onRequest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  from: Exclude<Tier, 1 | 4>;
  onRequest: (input: { tier: Tier; reason: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const to = EXITS_TO[from];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="step-down-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{/* TODO-COPY */}Request a step down</DialogTitle>
          <DialogDescription>
            {/* TODO-COPY */}
            Asks your supervisor to move {name} from Tier {from} to Tier {to}. They decide, and complete the exit document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TierLozenge tier={from} long />
            <span aria-hidden className="text-[var(--text-muted)]">→</span>
            <TierLozenge tier={to} long />
          </div>
          <ReasonField
            /* TODO-COPY */
            label={`Why ${name} is ready`}
            value={reason}
            onChange={setReason}
            invalid={tried && !reason.trim()}
            placeholder="What has changed"
          />
          <PrimaryButton
            slot="request"
            onClick={() => {
              setTried(true);
              if (!reason.trim()) return;
              onRequest({ tier: to, reason: reason.trim() });
              onOpenChange(false);
            }}
          >
            {/* TODO-COPY */}
            Send request
          </PrimaryButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The raise flow in a dialog — the user record's host. Same flow as the
 *  chat's rail takeover, minus the checklist that only makes sense beside
 *  the conversation. */
export function RaiseDialog({
  open,
  onOpenChange,
  name,
  current,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  current: Tier | null;
  onConfirm: (input: { target: RaiseTarget; note: string }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="raise-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{/* TODO-COPY */}Raise an escalation</DialogTitle>
          <DialogDescription>{/* TODO-COPY */}Your supervisor is told the moment you confirm.</DialogDescription>
        </DialogHeader>
        {open && (
          <RaiseFlow
            heading={false}
            name={name}
            current={current}
            onCancel={() => onOpenChange(false)}
            onConfirm={(input) => {
              onConfirm(input);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
