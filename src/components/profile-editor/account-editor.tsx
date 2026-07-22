"use client";

// The settings ACCOUNT tab (§4 Phase 9, decision #10 — formerly the Profile
// tab): account plumbing only, nothing teen-facing. Two groups of dense
// EditRows divided by hairlines:
//   Personal details — locked read rows (First/Last name, DOB, Sex, Race):
//     no Edit affordance, no per-row support text; ONE group-level line with
//     a real support link carries the "contact support" affordance.
//   Account — the two §4 change-flow credentials (phone, email), instant.
// The teen-facing fields that used to live here moved to the Profile tab's
// groups: pronouns + chat avatar (Chat group) — see matching-profile-editor.
// One row edits at a time; leaving a modified row is guarded.

import { useCallback, useEffect, useRef, useState } from "react";
import { EditRow } from "@/components/settings/edit-row";
import { PillButton } from "@/components/settings/pill-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  saveAccountField,
  sendVerificationCode,
  verifyCode,
} from "@/lib/mock-api";
import { SEX_OPTIONS } from "@/lib/options";
import { PhotoRowCore } from "@/components/account/photo-row";
import type { SettingsRole } from "@/components/settings/tabs-config";

const EMPTY = "—";

type ReportDirty = (id: string, dirty: boolean) => void;

interface RowProps {
  editing: boolean;
  onEditStart: () => void;
  onClose: () => void;
  reportDirty: ReportDirty;
}

// ── Simple rows ─────────────────────────────────────────────────────────────

function fmtDob(dob: string): string {
  if (!dob) return EMPTY;
  const d = new Date(`${dob}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? dob
    : d.toLocaleDateString(undefined, { dateStyle: "long" });
}

function LockedRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <EditRow
      label={label}
      value={value}
      hint={hint}
      state="read"
      locked
      onEditStart={() => {}}
      onCancel={() => {}}
    />
  );
}

// ── Membership group (§4 Phase 11, decision #13) — org-assigned records ────
// Read-only for EVERY persona; all four rows exist from day one (org-assigned
// at signup — a brand-new mentor is never "empty" here). Renders between
// Personal details and Account. Deliberately NO group support note: the
// Personal details note is scoped to identity fields only (§4 item 2).

// Placeholder assignment data — safe, real-looking names (§4).
const MEMBERSHIP_GROUPS = ["North Carolina", "New Jersey"];

function membershipJoinDate(persona: string): string {
  // New mentors joined "recently" (org-assigned on day one — never empty);
  // established personas use the spec's example date.
  if (persona === "new-mentor") {
    const d = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString(undefined, { dateStyle: "long" });
  }
  return "March 25, 2026";
}

function MembershipGroup({ role }: { role: SettingsRole }) {
  const persona = useOnboardingStore((s) => s.persona);
  // Status BINDS to the same state the Roles & permissions deactivate/
  // reactivate flow controls (setAccountStatus) — never stored separately.
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const deactivatedOn = useOnboardingStore((s) => s.deactivatedOn);

  // TODO(product): "Lead mentor" as a Role value — confirm it is a real,
  // distinct role (vs. a Mentor with extra permissions) and how promotion is
  // assigned. (Spec's verbatim TODO unavailable — composed to intent, see
  // design-system-gaps.md #64.)
  const roleLabel =
    role === "supervisor"
      ? "Supervisor"
      : role === "lead"
        ? "Lead mentor"
        : "Mentor";

  const deactivated = accountStatus === "deactivated";

  return (
    <section aria-label="Membership">
      <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        Membership
      </h2>
      <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
        <LockedRow label="Role" value={roleLabel} />
        {/* FUTURE FLOW: group assignment is supervisor-managed and arrives
            with the groups console — until then this row is read-only
            everywhere. (Spec's verbatim comment unavailable — composed to
            intent, see design-system-gaps.md #64.) */}
        <LockedRow
          label="Groups"
          value={
            <span className="flex flex-wrap items-center gap-1.5 py-0.5">
              {MEMBERSHIP_GROUPS.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[13px] leading-[18px] text-[var(--text-primary)]"
                >
                  {g}
                </span>
              ))}
            </span>
          }
          hint={
            role === "supervisor"
              ? "The groups you oversee"
              : "The groups you work with"
          }
        />
        <LockedRow label="Join date" value={membershipJoinDate(persona)} />
        <LockedRow
          label="Status"
          value={
            <span className="flex items-center gap-2">
              {/* Dot is decorative — the text carries the meaning (§4).
                  Active green is an interim token (gaps.md #65). */}
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: deactivated
                    ? "var(--state-error)"
                    : "#3a7d44",
                }}
              />
              <span>
                {deactivated
                  ? `Deactivated · ${deactivatedOn ?? "—"}`
                  : "Active"}
              </span>
            </span>
          }
        />
      </div>
    </section>
  );
}

// ── Photo row (§4 Phase 10) — Lead Mentor / Supervisor ONLY ────────────────
// Thin settings wrapper (record-04a) over the extracted PhotoRowCore: wires
// the store + direct mock save EXACTLY as before — same states, same dirty
// reporting ("photo"), same guard behavior. Mentor personas never render it.
function PhotoRow(props: RowProps & { initial: string }) {
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const setStaffPhoto = useOnboardingStore((s) => s.setStaffPhoto);
  return (
    <PhotoRowCore
      value={staffPhoto}
      initial={props.initial}
      onSave={async (pending) => {
        const res = await saveAccountField("staffPhoto", pending);
        if (!res.ok) return false;
        setStaffPhoto(pending);
        return true;
      }}
      editing={props.editing}
      onEditStart={props.onEditStart}
      onClose={props.onClose}
      reportDirty={props.reportDirty}
    />
  );
}

// ── Change-flow rows (§4: phone + email are flows, not bare inputs) ────────
// Account fields are INSTANT by design (§2/§4: phone + email are internal,
// never teen-visible) — no review loop here. The teen-facing fields that used
// to live on this tab (pronouns, chat avatar) moved to the Profile tab and
// are gated there.

function PhoneRow(props: RowProps) {
  const phone = useOnboardingStore((s) => s.draft.phone);
  const update = useOnboardingStore((s) => s.update);
  const [next, setNext] = useState("");
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<"idle" | "saved" | "error">("idle");
  const [errText, setErrText] = useState("That didn't save. Try again.");

  const dirty = props.editing && (next.trim() !== "" || step === "code");
  useEffect(() => {
    props.reportDirty("phone", dirty);
    return () => props.reportDirty("phone", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const resetFlow = useCallback(() => {
    setNext("");
    setCode("");
    setStep("enter");
    setFlow("idle");
  }, []);

  // Fresh flow on each edit session; discard on unsaved exit.
  const prev = useRef(props.editing);
  useEffect(() => {
    if (props.editing !== prev.current && flow !== "saved") resetFlow();
    prev.current = props.editing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editing]);

  const requestCode = async () => {
    setBusy(true);
    setFlow("idle");
    const res = await sendVerificationCode(next);
    setBusy(false);
    if (!res.ok) {
      setErrText("That didn't send. Try again.");
      setFlow("error");
      return;
    }
    setStep("code");
  };

  const confirm = async () => {
    setBusy(true);
    setFlow("idle");
    const ok =
      (await verifyCode(code)).ok &&
      (await saveAccountField("phone", next)).ok;
    setBusy(false);
    if (!ok) {
      setErrText("That code didn't match. Try again.");
      setFlow("error");
      return;
    }
    update({ phone: next }); // instant by design — internal field, no review loop
    resetFlow();
    setFlow("saved");
    props.onClose();
  };

  return (
    <EditRow
      label="Phone number"
      value={phone || EMPTY}
      state={
        props.editing
          ? flow === "error"
            ? "error"
            : "edit"
          : flow === "saved"
            ? "saved"
            : "read"
      }
      onEditStart={props.onEditStart}
      onCancel={() => {
        resetFlow();
        props.onClose();
      }}
      onSave={step === "code" ? confirm : requestCode}
      errorMessage={errText}
      customActions
    >
      {step === "enter" ? (
        <>
          <div className="max-w-sm space-y-1.5">
            <Input
              aria-label="New phone number"
              type="tel"
              placeholder="(555) 555-0123"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                if (flow !== "idle") setFlow("idle");
              }}
            />
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              We&apos;ll text a code to confirm it&apos;s yours.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PillButton
              onClick={requestCode}
              loading={busy}
              disabled={!next.trim() || next.trim() === phone}
            >
              Text a code
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="max-w-sm space-y-1.5">
            <label
              htmlFor="pf-phone-code"
              className="block text-sm font-medium text-foreground"
            >
              Enter the 6-digit code we texted to {next}
            </label>
            <Input
              id="pf-phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="w-36 tracking-[0.3em]"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                if (flow !== "idle") setFlow("idle");
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <PillButton onClick={confirm} loading={busy} disabled={code.length !== 6}>
              Confirm new number
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Keep my current number
            </button>
          </div>
        </>
      )}
    </EditRow>
  );
}

function EmailRow(props: RowProps) {
  const email = useOnboardingStore((s) => s.draft.email);
  const update = useOnboardingStore((s) => s.update);
  const [next, setNext] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<"idle" | "saved" | "error">("idle");

  const valid = /\S+@\S+\.\S+/.test(next.trim());
  const dirty = props.editing && (next.trim() !== "" || step === "confirm");
  useEffect(() => {
    props.reportDirty("email", dirty);
    return () => props.reportDirty("email", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const resetFlow = useCallback(() => {
    setNext("");
    setStep("enter");
    setFlow("idle");
  }, []);

  const prev = useRef(props.editing);
  useEffect(() => {
    if (props.editing !== prev.current && flow !== "saved") resetFlow();
    prev.current = props.editing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editing]);

  const confirm = async () => {
    setBusy(true);
    setFlow("idle");
    const res = await saveAccountField("email", next.trim());
    setBusy(false);
    if (!res.ok) {
      setFlow("error");
      return;
    }
    update({ email: next.trim() }); // instant by design — internal field, no review loop
    resetFlow();
    setFlow("saved");
    props.onClose();
  };

  return (
    <EditRow
      label="Email"
      value={email || EMPTY}
      state={
        props.editing
          ? flow === "error"
            ? "error"
            : "edit"
          : flow === "saved"
            ? "saved"
            : "read"
      }
      onEditStart={props.onEditStart}
      onCancel={() => {
        resetFlow();
        props.onClose();
      }}
      onSave={confirm}
      customActions
    >
      {step === "enter" ? (
        <>
          <div className="max-w-sm">
            <Input
              aria-label="New email"
              type="email"
              placeholder="you@example.com"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                if (flow !== "idle") setFlow("idle");
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <PillButton
              onClick={() => setStep("confirm")}
              disabled={!valid || next.trim() === email}
            >
              Continue
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
            You&apos;re changing your sign-in email to{" "}
            <span className="font-medium text-foreground">{next.trim()}</span>.
            We&apos;ll send updates there from now on.
          </p>
          <div className="flex items-center gap-3">
            <PillButton onClick={confirm} loading={busy}>
              Confirm change
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Keep my current email
            </button>
          </div>
        </>
      )}
    </EditRow>
  );
}

// ── Groups + tab root ───────────────────────────────────────────────────────

function RowGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        {title}
      </h2>
      <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
        {children}
      </div>
    </section>
  );
}

// Editable rows only — locked rows (names, DOB, sex, race) never hit the
// row-switch guard.
const ROW_LABELS: Record<string, string> = {
  photo: "Photo",
  phone: "Phone number",
  email: "Email",
};

export function AccountEditor({
  role = "mentor",
  initialOpen = null,
  onDirtyChange,
}: {
  /** Phase 10: lead + supervisor get the Photo row (their own account photo);
   *  mentor personas must NOT render it. */
  role?: SettingsRole;
  /** Row id to open in edit + scroll to on arrival ("photo" — the sidebar
   *  avatar's deep link). Reapplies when the URL param changes. */
  initialOpen?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const lastName = useOnboardingStore((s) => s.draft.lastName);
  const dob = useOnboardingStore((s) => s.draft.dob);
  const sex = useOnboardingStore((s) => s.draft.sex);
  const races = useOnboardingStore((s) => s.draft.races);
  const sexLabel = SEX_OPTIONS.find((o) => o.value === sex)?.label ?? EMPTY;
  const hasPhotoRow = role !== "mentor";
  const validInitial =
    initialOpen === "photo" && hasPhotoRow ? "photo" : null;
  const [editingId, setEditingId] = useState<string | null>(validInitial);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  // Deep-link scroll (sidebar avatar → Photo row) — target set via the
  // render-adjust pattern; the effect marks handled targets in a ref.
  const [scrollTarget, setScrollTarget] = useState<string | null>(validInitial);
  const [prevInitialOpen, setPrevInitialOpen] = useState(initialOpen);
  if (initialOpen !== prevInitialOpen) {
    setPrevInitialOpen(initialOpen);
    if (validInitial) {
      setEditingId(validInitial);
      setScrollTarget(validInitial);
    }
  }
  const scrolledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scrollTarget || scrolledRef.current === scrollTarget) return;
    scrolledRef.current = scrollTarget;
    document
      .querySelector(`[data-row="${scrollTarget}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollTarget]);
  // Plain state (not a ref): children report from effects, so a setState here
  // is legal, and render-time reads (requestEdit) stay rule-clean.
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});

  const reportDirty = useCallback<ReportDirty>((id, dirty) => {
    setDirtyMap((m) => (Boolean(m[id]) === dirty ? m : { ...m, [id]: dirty }));
  }, []);

  useEffect(() => {
    onDirtyChange?.(Object.values(dirtyMap).some(Boolean));
  }, [dirtyMap, onDirtyChange]);

  // One row edits at a time; leaving a MODIFIED row via another Edit is
  // guarded inline (§6) — untouched rows just swap.
  const requestEdit = (id: string) => {
    if (editingId && editingId !== id && dirtyMap[editingId]) {
      setPendingEditId(id);
      return;
    }
    setEditingId(id);
  };
  const closeEdit = () => setEditingId(null);
  const discardAndEdit = () => {
    setEditingId(pendingEditId); // the abandoned row resets via its transition effect
    setPendingEditId(null);
  };

  const rowProps = (id: string): RowProps => ({
    editing: editingId === id,
    onEditStart: () => requestEdit(id),
    onClose: closeEdit,
    reportDirty,
  });

  // Killed production fields (Location, Zipcode, Groups, Role, the duplicate
  // Email) are fully absent — no parked remnants.
  return (
    <div className="space-y-5">
      {/* Photo row (§4 Phase 10) — first row of Account, lead/supervisor only:
          their own photo, distinct from every mentor asset. Standalone card
          (not inside Personal details — that group is locked + support-line
          scoped; this row is editable). */}
      {hasPhotoRow && (
        <section aria-label="Photo">
          <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
            <PhotoRow
              {...rowProps("photo")}
              initial={(firstName?.trim()?.[0] || "S").toUpperCase()}
            />
          </div>
        </section>
      )}

      <section aria-label="Personal details">
        <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
          Personal details
        </h2>
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
          {/* §9 v1.1 + Phase 9: ACCOUNT IDENTITY — ops-only, locked
              post-approval. Rows carry no per-row support text (§4 rev); the
              one group-level line below owns the support affordance. The
              teen-facing name is Display name on the Profile tab. */}
          <LockedRow label="First name" value={firstName || EMPTY} />
          <LockedRow label="Last name" value={lastName || EMPTY} />
          <LockedRow label="Date of birth" value={fmtDob(dob)} />
          <LockedRow label="Sex" value={sexLabel} />
          <LockedRow label="Race" value={races.length ? races.join(", ") : EMPTY} />
        </div>
        {/* Interim §4 support-line copy — revised spec unavailable (gaps.md
            #53); mailto target is a placeholder pending the real support URL. */}
        <p className="mt-2 px-[var(--card-pad)] text-[12px] leading-[16px] text-[var(--text-muted)]">
          The Somethings team manages these details.{" "}
          <a
            href="mailto:support@somethings.com"
            className="rounded-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            Contact support
          </a>{" "}
          to change something.
        </p>
      </section>

      <MembershipGroup role={role} />

      <RowGroup title="Account">
        <PhoneRow {...rowProps("phone")} />
        <EmailRow {...rowProps("email")} />
      </RowGroup>

      {/* Row-switch guard (§6) — inline prompt, not a browser alert. */}
      <Dialog
        open={pendingEditId !== null}
        onOpenChange={(open) => !open && setPendingEditId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              Your changes to{" "}
              {editingId ? ROW_LABELS[editingId] ?? "this field" : "this field"}{" "}
              will be lost if you edit another field now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setPendingEditId(null)}>
              Keep editing
            </Button>
            <Button className="min-h-11" onClick={discardAndEdit}>Discard changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
