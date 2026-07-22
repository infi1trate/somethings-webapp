"use client";

// Organization subsection of the Mentor Record's Account section
// (record-04b) — the org-owned fields that used to sit in settings (P11
// Membership) and the Roles & permissions tab (slots, assignment). Staff
// surface only: supervisor edits where a real write path exists (slots),
// Lead Mentor reads everything. Store writes here are org actions
// (setSlots via the existing mock save) — never mentor-facing paths.

import { useState } from "react";
import { EditRow } from "@/components/settings/edit-row";
import { Input } from "@/components/ui/input";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { saveAccountField } from "@/lib/mock-api";

// Org-assigned placeholders — the single source now that settings shows only
// the passive membership line (record-04b).
export const MEMBERSHIP_GROUPS = ["North Carolina", "New Jersey"];
export const JOIN_DATE = "March 25, 2026";

function ReadOrgRow({
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

// Moved from roles-permissions-editor (record-04b) with a read mode added:
// per-row direct save, non-negative-integer validation — unchanged.
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
    return <ReadOrgRow label={label} value={String(value)} hint={helper} />;
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
    <EditRow
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
    </EditRow>
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
      <p className="mb-1.5 text-[12px] font-medium uppercase leading-[16px] tracking-[0.3px] text-[var(--text-secondary)]">
        Organization
      </p>
      <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
        {/* TODO(product): "Lead mentor" as a Role value — confirm it is a
            real, distinct role and how promotion is assigned (gaps.md #64).
            The record's subject is the store-backed mentor. */}
        <ReadOrgRow label="Role" value="Mentor" />
        {/* FUTURE FLOW: group assignment is supervisor-managed and arrives
            with the groups console — read-only until then (gaps.md #64). */}
        <ReadOrgRow
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
        />
        <ReadOrgRow label="Join date" value={JOIN_DATE} />
        {/* Status + Assignment bind to the same state the header/overflow
            deactivate flow controls — never stored separately. Dots are
            decorative; text carries meaning (gaps.md #65 interim green). */}
        <ReadOrgRow
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
        />
        <ReadOrgRow
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
