"use client";

// Organization block of the Mentor Record's Mentorship tab (record-04b,
// re-homed in record Phase 1) — the org-owned fields that used to sit in
// settings (P11 Membership) and the Roles & permissions tab (slots,
// assignment). Staff surface only: supervisor edits where a real write path
// exists (slots), Lead Mentor reads everything. Store writes here are org
// actions (setSlots via the existing mock save) — never mentor-facing paths.
//
// Phase 2: attributes of a person are typography, not boxes — open RecordRow
// rows with hairline dividers, bare 16px heading. Phase 3 affordances:
// org-assigned facts (Role, Groups, Join date) carry the lock badge with a
// why; Status/Assignment are derived state (bound to the header overflow
// round trips) and show no affordance; slots are Direct edit.

import { useState } from "react";
import { RecordRow } from "@/components/record/row";
import { Input } from "@/components/ui/input";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { saveAccountField } from "@/lib/mock-api";

// Org-assigned placeholders — the single source now that settings shows only
// the passive membership line (record-04b).
export const MEMBERSHIP_GROUPS = ["North Carolina", "New Jersey"];
export const JOIN_DATE = "March 25, 2026";

// Interim lock explainer (gaps.md #83) — copy minted here, not in any spec.
const ORG_LOCK = {
  label: "Org-managed",
  reason: "Set by the organization — not editable on this record.",
};

// Moved from roles-permissions-editor (record-04b) with a read mode added:
// per-row direct save, non-negative-integer validation — unchanged. Renders
// through RecordRow since Phase 2.
function SlotRow({
  id,
  label,
  helper,
  value,
  commit,
  mode,
}: {
  id: "total" | "dailyNew";
  label: string;
  helper: string;
  value: number;
  commit: (n: number) => void;
  mode: "edit" | "read";
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [invalid, setInvalid] = useState(false);

  const valid = /^\d+$/.test(text.trim()); // non-negative integer
  const dirty = editing && text.trim() !== String(value);

  if (mode === "read") {
    // Role-gated: the affordance hides, the row stays (Lead Mentor view).
    return (
      <RecordRow
        label={label}
        value={String(value)}
        hint={helper}
        state="read"
        locked
        onEditStart={() => {}}
        onCancel={() => {}}
      />
    );
  }

  const save = async () => {
    if (!valid) {
      setInvalid(true);
      return;
    }
    setState("saving");
    const res = await saveAccountField(`slots.${id}`, Number(text));
    if (!res.ok) {
      setState("error");
      return;
    }
    commit(Number(text.trim()));
    setState("saved");
    setEditing(false);
  };

  return (
    <RecordRow
      label={label}
      value={String(value)}
      hint={helper}
      state={
        editing
          ? state === "saving"
            ? "saving"
            : state === "error"
              ? "error"
              : "edit"
          : state === "saved"
            ? "saved"
            : "read"
      }
      onEditStart={() => {
        setText(String(value));
        setInvalid(false);
        setState("idle");
        setEditing(true);
      }}
      onCancel={() => {
        setEditing(false);
        setState("idle");
      }}
      onSave={save}
      saveDisabled={!dirty && state !== "error"}
    >
      <div className="max-w-[10rem] space-y-1.5">
        <Input
          aria-label={label}
          inputMode="numeric"
          value={text}
          aria-invalid={invalid && !valid ? true : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
            if (state !== "idle") setState("idle");
          }}
        />
        {invalid && !valid && (
          <p className="text-[13px] leading-[18px] text-[var(--state-error)]">
            Enter a whole number, 0 or more.
          </p>
        )}
      </div>
    </RecordRow>
  );
}

export function OrganizationCard({ mode }: { mode: "edit" | "read" }) {
  const status = useOnboardingStore((s) => s.status);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const deactivatedOn = useOnboardingStore((s) => s.deactivatedOn);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const slots = useOnboardingStore((s) => s.slots);
  const setSlots = useOnboardingStore((s) => s.setSlots);

  const deactivated = accountStatus === "deactivated";
  const assigned = status === "published" && accountStatus === "active";

  return (
    <div>
      <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        Organization
      </h2>
      {/* Soft surface card (surface pass): containment at the group level,
          7 rows → inset separators (they start/end inside the card padding
          by construction; --icon-tertiary measures 3.80:1 on the card). */}
      <div className="mt-3 divide-y divide-[color:var(--icon-tertiary)] rounded-[var(--radius-surface)] bg-[var(--surface-card)] px-[var(--surface-pad)] py-2">
        {/* TODO(product): "Lead mentor" as a Role value — confirm it is a
            real, distinct role and how promotion is assigned (gaps.md #64).
            The record's subject is the store-backed mentor. */}
        <RecordRow
          label="Role"
          value="Mentor"
          state="read"
          lock={ORG_LOCK}
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* FUTURE FLOW: group assignment is supervisor-managed and arrives
            with the groups console — read-only until then (gaps.md #64).
            Plain text, not chips: pills are for status, not categories
            (Phase 2 restraint rules). */}
        <RecordRow
          label="Groups"
          value={MEMBERSHIP_GROUPS.join(", ")}
          state="read"
          lock={ORG_LOCK}
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        <RecordRow
          label="Join date"
          value={JOIN_DATE}
          state="read"
          lock={ORG_LOCK}
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* Status + Assignment bind to the same state the header/overflow
            deactivate flow controls — never stored separately, no affordance
            here (derived state, not an editable field). Dots are decorative;
            text carries meaning (gaps.md #65 interim green). */}
        <RecordRow
          label="Status"
          value={
            <span className="flex items-center gap-2">
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
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        <RecordRow
          label="Assignment status"
          value={
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: assigned ? "#3a7d44" : "var(--state-error)",
                }}
              />
              <span>{assigned ? "Assigned" : "Unassigned"}</span>
            </span>
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        <SlotRow
          id="total"
          label="Total slots"
          helper={`How many teens can be matched with ${firstName || "them"} at once`}
          value={slots.total}
          commit={(n) => setSlots({ total: n })}
          mode={mode}
        />
        <SlotRow
          id="dailyNew"
          label="Daily new teens"
          helper="How many new teens can join per day"
          value={slots.dailyNew}
          commit={(n) => setSlots({ dailyNew: n })}
          mode={mode}
        />
      </div>
    </div>
  );
}
