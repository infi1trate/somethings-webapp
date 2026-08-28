"use client";

// PARENT DETAILS — the guardian and consent record on a teen's Account tab,
// below their own account facts.
//
// BUILT ON StaffFieldRow, the account card's established editable-row component
// (24 call sites), rather than raw inputs. That matters twice over here: the card
// reads like every other account card, and a field only persists on an explicit
// Save. The first version saved on every keystroke — on a minor's consent record
// a stray key should not silently become the record.
//
// `mode="read"` hides the edit affordance without changing the layout, which is
// exactly the tier gating this needs: below supervisor/lead the rows still show
// their values, with nothing to press.
//
// CONSENT IS THE MOST CONSEQUENTIAL FIELD ON THIS PAGE. It decides what the
// platform may send about a minor, so it keeps a caution line and a confirm on
// top of the row's own Save.
//
// THE FIGMA LABELS IT "Parent Consent (EDIT WITH CARE)". The shouted
// parenthetical is the caution line instead — the copy law is sentence case, and
// a warning belongs beside the control rather than inside the label a screen
// reader announces as the field's name.
//
// OPT-OUT REASON ONLY APPLIES TO A REFUSAL. Offering it beside "Consent given"
// invites a sentence that contradicts the field above it, so it stays read-only
// until consent is declined or withdrawn and says why.
//
// TODO-DATA: no guardian data exists upstream. Fields start empty, which is
// honest — an invented parent name on a minor's consent record would be worse
// than a blank.

import { useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { StaffFieldRow } from "@/components/account/field-rows";
import { RecordRow } from "@/components/record/row";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import { touchTarget } from "@/lib/touch-target";
import { cn } from "@/lib/utils";
import {
  CONSENT_LABEL,
  CONSENT_OPTIONS,
  optOutApplies,
  type ConsentStatus,
  type GuardianDetails,
} from "@/lib/record/guardian";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";

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
  // One open row at a time — the same orchestration staff-profile-fields uses.
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingConsent, setPendingConsent] = useState<ConsentStatus | null>(
    null
  );
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const optOutOn = optOutApplies(guardian.consent);
  const mode = canEdit ? "edit" : "read";

  const rowProps = (key: string) => ({
    mode: mode as "edit" | "read",
    editing: editing === key,
    onEditStart: () => setEditing(key),
    onClose: () => setEditing(null),
  });

  /** Every field writes through the same store action; resolving true puts the
   *  row into its saved state. */
  const save = (key: keyof GuardianDetails) => async (pending: string) => {
    onChange({ [key]: pending });
    return true;
  };

  const blank = (v: string) =>
    v || <span className="text-[var(--text-muted)]">Not recorded</span>;

  return (
    <section aria-label="Parent details" data-record-section="guardian">
      {/* TODO-COPY */}
      <h2 className={`mb-3 ${H2}`}>Parent details</h2>
      <div className="rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]">
        {/* TODO-COPY */}
        <StaffFieldRow<string>
          {...rowProps("name")}
          label="Name"
          value={guardian.name}
          display={blank}
          editor={(p, set) => (
            <Input
              value={p}
              placeholder="Enter parent name"
              onChange={(e) => set(e.target.value)}
              aria-label="Parent name"
            />
          )}
          onSave={save("name")}
        />
        <StaffFieldRow<string>
          {...rowProps("phone")}
          label="Phone number"
          value={guardian.phone}
          display={blank}
          editor={(p, set) => (
            <Input
              type="tel"
              value={p}
              placeholder="Enter phone"
              onChange={(e) => set(e.target.value)}
              aria-label="Parent phone number"
            />
          )}
          onSave={save("phone")}
        />
        <StaffFieldRow<string>
          {...rowProps("email")}
          label="Email"
          value={guardian.email}
          display={blank}
          editor={(p, set) => (
            <Input
              type="email"
              value={p}
              placeholder="Enter email"
              onChange={(e) => set(e.target.value)}
              aria-label="Parent email"
            />
          )}
          onSave={save("email")}
        />

        {/* CONSENT — a decision on top of a save, so the select requests and the
            confirm commits. Not a StaffFieldRow: its Save would be a second,
            weaker gate on the same change. */}
        <RecordRow
          label="Parent consent"
          value={
            canEdit ? (
              <span className="flex min-w-0 flex-col gap-1.5">
                <Select
                  value={guardian.consent}
                  onValueChange={(v) => setPendingConsent(v as ConsentStatus)}
                >
                  {/* 36px visual, 44px target — the compact height is
                      deliberate (see active-hours.tsx); asked and confirmed.
                      `touchTarget(36)` extends ±4px, vertical only. */}
                  <SelectTrigger
                    className={cn(touchTarget(36), "h-9 w-[220px] max-w-full")}
                    aria-label="Parent consent"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONSENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="flex items-start gap-1.5 text-[var(--alert-warm-fg)]">
                  <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span style={{ font: "var(--type-helper)" }}>
                    {/* TODO-COPY — the Figma's "(EDIT WITH CARE)", said
                        properly and beside the control it warns about. */}
                    Edit with care. This governs what we may send about{" "}
                    {teenName}.
                  </span>
                </span>
              </span>
            ) : (
              CONSENT_LABEL[guardian.consent]
            )
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />

        {/* OPT-OUT REASON — editable only against a refusal. */}
        {canEdit && optOutOn ? (
          <StaffFieldRow<string>
            {...rowProps("optOutReason")}
            label="Opt-out reason"
            value={guardian.optOutReason}
            display={(v) =>
              v || (
                <span className="text-[var(--text-muted)]">
                  {/* TODO-COPY */}
                  No opt-out reason given
                </span>
              )
            }
            editor={(p, set) => (
              <Input
                value={p}
                /* TODO-COPY */
                placeholder="What they told us, in their words where possible."
                onChange={(e) => set(e.target.value)}
                aria-label="Opt-out reason"
              />
            )}
            onSave={save("optOutReason")}
          />
        ) : (
          <RecordRow
            label="Opt-out reason"
            value={
              guardian.optOutReason || (
                <span className="text-[var(--text-muted)]">
                  {/* TODO-COPY — says WHY it is empty, rather than reading as a
                      field somebody forgot. */}
                  {optOutOn
                    ? "No opt-out reason given"
                    : "Applies once consent is declined or withdrawn"}
                </span>
              )
            }
            state="read"
            locked
            onEditStart={() => {}}
            onCancel={() => {}}
          />
        )}
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
          if (pendingConsent) onChange({ consent: pendingConsent });
        }}
      />
    </section>
  );
}
