"use client";

// PARENT DETAILS — the guardian and consent record on a teen's Account tab,
// below their own account facts (Figma-informed).
//
// CONSENT IS THE MOST CONSEQUENTIAL FIELD ON THIS PAGE. It decides what the
// platform may send and to whom, for a minor. So it is treated as a decision:
// the field carries a caution line, and a change goes through a confirm naming
// what it affects rather than saving as you type like the text fields do.
//
// THE FIGMA LABELS IT "Parent Consent (EDIT WITH CARE)". The shouted
// parenthetical becomes a caution line under the field instead — the product's
// copy law is sentence case, and a warning belongs beside the control it warns
// about rather than inside the label a screen reader announces.
//
// OPT-OUT REASON ONLY APPLIES TO A REFUSAL. Offering it beside "Consent given"
// invites someone to write a sentence that contradicts the field above it, so it
// renders read-only with an explanation until consent is declined or withdrawn.
//
// TODO-DATA: no guardian data exists upstream. Fields start empty, which is
// honest — an invented parent name on a minor's consent record would be worse
// than a blank.

import { useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import {
  CONSENT_LABEL,
  CONSENT_OPTIONS,
  optOutApplies,
  type ConsentStatus,
  type GuardianDetails,
} from "@/lib/record/guardian";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;
const FIELD = cn(
  "mt-1.5 block w-full rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5",
  "text-[14px] leading-[20px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
  RING
);

export function GuardianDetailsSection({
  teenName,
  guardian,
  onChange,
  canEdit,
}: {
  teenName: string;
  guardian: GuardianDetails;
  onChange: (patch: Partial<GuardianDetails>) => void;
  canEdit: boolean;
}) {
  const [pendingConsent, setPendingConsent] = useState<ConsentStatus | null>(
    null
  );
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const optOutOn = optOutApplies(guardian.consent);

  const text = (
    id: keyof GuardianDetails,
    label: string,
    placeholder: string,
    type = "text"
  ) => (
    <div>
      <label
        htmlFor={`guardian-${id}`}
        className="block text-[var(--text-muted)]"
        style={LABEL_STYLE}
      >
        {label}
      </label>
      {canEdit ? (
        <input
          id={`guardian-${id}`}
          type={type}
          value={guardian[id] as string}
          onChange={(e) => onChange({ [id]: e.target.value })}
          placeholder={placeholder}
          className={FIELD}
        />
      ) : (
        // Read tier: the VALUE, or an honest blank — never an editable-looking
        // box a reader can't use.
        <p className="mt-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
          {(guardian[id] as string) || (
            <span className="text-[var(--text-muted)]">Not recorded</span>
          )}
        </p>
      )}
    </div>
  );

  return (
    <section aria-label="Parent details" data-record-section="guardian">
      {/* TODO-COPY */}
      <h2 className={`mb-3 ${H2}`}>Parent details</h2>
      <div className="space-y-4 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4">
        {/* TODO-COPY */}
        {text("name", "Name", "Enter parent name")}
        {text("phone", "Phone number", "Enter phone", "tel")}
        {text("email", "Email", "Enter email", "email")}

        {/* CONSENT — a decision, not an edit. */}
        <div>
          <label
            htmlFor="guardian-consent"
            className="block text-[var(--text-muted)]"
            style={LABEL_STYLE}
          >
            {/* TODO-COPY */}
            Parent consent
          </label>
          {canEdit ? (
            <select
              id="guardian-consent"
              value={guardian.consent}
              onChange={(e) => {
                returnFocusTo.current = e.currentTarget;
                setPendingConsent(e.target.value as ConsentStatus);
              }}
              className={FIELD}
            >
              {CONSENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
              {CONSENT_LABEL[guardian.consent]}
            </p>
          )}
          {canEdit && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[var(--alert-warm-fg)]">
              <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              <span style={{ font: "var(--type-helper)" }}>
                {/* TODO-COPY — the Figma's "(EDIT WITH CARE)", said properly. */}
                Edit with care. This governs what we may send about {teenName}.
              </span>
            </p>
          )}
        </div>

        {/* OPT-OUT REASON — only meaningful against a refusal. */}
        <div>
          <label
            htmlFor="guardian-optOutReason"
            className="block text-[var(--text-muted)]"
            style={LABEL_STYLE}
          >
            {/* TODO-COPY */}
            Opt-out reason
          </label>
          {canEdit && optOutOn ? (
            <textarea
              id="guardian-optOutReason"
              value={guardian.optOutReason}
              onChange={(e) => onChange({ optOutReason: e.target.value })}
              rows={2}
              /* TODO-COPY */
              placeholder="What they told us, in their words where possible."
              className={cn(FIELD, "resize-y")}
            />
          ) : (
            <p className="mt-1.5 text-[14px] leading-[20px]">
              {guardian.optOutReason ? (
                <span className="text-[var(--text-primary)]">
                  {guardian.optOutReason}
                </span>
              ) : (
                <span className="text-[var(--text-muted)]">
                  {/* TODO-COPY — says WHY it is empty, rather than looking
                      like a field someone forgot to fill in. */}
                  {optOutOn
                    ? "No opt-out reason given"
                    : "Applies once consent is declined or withdrawn"}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingConsent}
        onOpenChange={(o) => !o && setPendingConsent(null)}
        returnFocusTo={returnFocusTo}
        /* TODO-COPY */
        title={`Set parent consent to ${
          pendingConsent ? CONSENT_LABEL[pendingConsent].toLowerCase() : ""
        }?`}
        description={
          /* TODO-COPY */
          pendingConsent && optOutApplies(pendingConsent)
            ? `This stops what we send about ${teenName} to their parent. Add the reason below so the record says why.`
            : pendingConsent === "granted"
              ? `This records that consent is in place for ${teenName}.`
              : `This records that consent for ${teenName} isn't on file.`
        }
        confirmLabel="Change consent"
        onConfirm={() => {
          if (!pendingConsent) return;
          onChange({ consent: pendingConsent });
          // TODO-COPY
          toast("Parent consent updated.");
          setPendingConsent(null);
        }}
      />
    </section>
  );
}
