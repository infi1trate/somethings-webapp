"use client";

// Roles & permissions — ADMIN-ONLY settings tab (§4 Phase 6). Four sections:
//  1. Profile change review — a compact read of THIS mentor's open
//     profileUpdate changeset (Profile Update Review); the actual review
//     (diff cards, notes, approve) lives on /admin/profile-update.
//  2. Assignment status — read-only indicator row.
//  3. Mentor slots — per-row direct save, non-negative-integer validation.
//  4. Deactivate user — destructive zone, §4 copy, reversible round-trip.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { EditRow } from "@/components/settings/edit-row";
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
import { changesetSummary, relTime } from "@/lib/onboarding/profile-update";
import { saveAccountField } from "@/lib/mock-api";
import { cn } from "@/lib/utils";

// ── 1. Profile change review ────────────────────────────────────────────────

function ChangeReviewSection() {
  const draft = useOnboardingStore((s) => s.draft);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const firstName = draft.firstName || "this mentor";
  const flaggedCount =
    profileUpdate?.fields.filter((f) => f.fieldStatus === "changes-requested")
      .length ?? 0;

  return (
    <section aria-label="Profile change review">
      <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        Profile change review
      </h2>
      <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
        {!profileUpdate ? (
          <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
            No changes waiting for review.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] leading-[20px] text-[var(--text-primary)]">
                {changesetSummary(profileUpdate)} ·{" "}
                {profileUpdate.fields.length} change
                {profileUpdate.fields.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-[12px] leading-[16px] text-[var(--text-muted)]">
                {flaggedCount > 0
                  ? `Waiting on ${firstName} — sent back with notes on ${flaggedCount} change${flaggedCount === 1 ? "" : "s"}.`
                  : `Submitted ${relTime(profileUpdate.submittedAt).toLowerCase()} — waiting for review.`}
              </p>
            </div>
            <Button asChild variant="outline" className="min-h-11 shrink-0">
              <Link href="/admin/profile-update">
                {flaggedCount > 0 ? "View" : "Review changes"}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── 2 + 3. Assignment status + Mentor slots ────────────────────────────────

function SlotRow({
  id,
  label,
  helper,
  value,
  commit,
}: {
  id: "total" | "dailyNew";
  label: string;
  helper: string;
  value: number;
  commit: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [invalid, setInvalid] = useState(false);

  const valid = /^\d+$/.test(text.trim()); // non-negative integer
  const dirty = editing && text.trim() !== String(value);

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

// ── 4. Deactivate zone ──────────────────────────────────────────────────────

function DeactivateZone({ mentorName }: { mentorName: string }) {
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const deactivatedOn = useOnboardingStore((s) => s.deactivatedOn);
  const setAccountStatus = useOnboardingStore((s) => s.setAccountStatus);
  const [confirming, setConfirming] = useState(false);
  const deactivated = accountStatus === "deactivated";

  // ASSUMPTION(product): mentorships pause rather than end, and paused teens
  // are flagged for reassignment after N days. Verify with ops; adjust body
  // copy if wrong.
  const deactivate = () => {
    setAccountStatus(
      "deactivated",
      new Date().toLocaleDateString(undefined, { dateStyle: "long" })
    );
    setConfirming(false);
    toast("Deactivated.");
  };
  const reactivate = () => {
    setAccountStatus("active");
    setConfirming(false);
    toast("Reactivated.");
  };

  return (
    <section aria-label="Deactivate user" className="mt-2">
      <div
        className={cn(
          "rounded-[var(--radius-card)] border p-[var(--card-pad)]",
          deactivated
            ? "border-[var(--border-subtle)] bg-[var(--surface-s0)]"
            : "border-[var(--state-error)]/40 bg-white"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
              {deactivated ? "Reactivate user" : "Deactivate user"}
            </h2>
            <p className="mt-0.5 text-[14px] leading-[20px] text-[var(--text-secondary)]">
              {deactivated
                ? `Deactivated on ${deactivatedOn ?? "—"}`
                : "Removes them from matching and hides their profile from teens."}
            </p>
          </div>
          {deactivated ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setConfirming(true)}
            >
              Reactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              className="min-h-11 border-[var(--state-error)]/50 text-[var(--state-error)] hover:bg-red-50 hover:text-[var(--state-error)]"
              onClick={() => setConfirming(true)}
            >
              Deactivate {mentorName}
            </Button>
          )}
        </div>
      </div>

      {/* Nielsen #5 — never one tap. Radix: focus-trapped, Esc closes,
          focus returns to the trigger. */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deactivated ? "Reactivate" : "Deactivate"} {mentorName}?
            </DialogTitle>
            <DialogDescription>
              {deactivated
                ? "They'll be matchable again right away."
                : "They'll be removed from matching right away, and teens won't see their profile. Active mentorships are paused, not ended. You can reactivate them later — nothing is deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            {deactivated ? (
              <Button className="min-h-11" onClick={reactivate}>Reactivate</Button>
            ) : (
              <Button
                onClick={deactivate}
                className="min-h-11 bg-[var(--state-error)] text-white hover:bg-[var(--state-error)]/90"
              >
                Deactivate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── Tab root ────────────────────────────────────────────────────────────────

export function RolesPermissionsEditor() {
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const slots = useOnboardingStore((s) => s.slots);
  const setSlots = useOnboardingStore((s) => s.setSlots);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";
  const assigned = status === "published" && accountStatus === "active";

  return (
    <div className="max-w-3xl space-y-5 pb-16">
      <ChangeReviewSection />

      <section aria-label="Assignment status">
        <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
          Assignment
        </h2>
        <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
          {/* Read-only indicator row (no Edit affordance). */}
          <div className="flex items-center gap-4 px-[var(--card-pad)] py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
                Assignment status
              </div>
              <div className="flex items-center gap-1.5 text-[15px] leading-[20px] text-[var(--text-primary)]">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    assigned ? "bg-emerald-600" : "bg-[var(--state-inactive)]"
                  )}
                />
                {assigned ? "Assigned — matchable" : "Unassigned"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Mentor slots">
        <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
          Mentor slots
        </h2>
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
          <SlotRow
            id="total"
            label="Total slots"
            helper={`How many teens can be matched with ${draft.firstName || "them"} at once`}
            value={slots.total}
            commit={(n) => setSlots({ total: n })}
          />
          <SlotRow
            id="dailyNew"
            label="Daily new teens"
            helper="How many new teens can join per day"
            value={slots.dailyNew}
            commit={(n) => setSlots({ dailyNew: n })}
          />
        </div>
      </section>

      <DeactivateZone mentorName={mentorName} />
    </div>
  );
}
