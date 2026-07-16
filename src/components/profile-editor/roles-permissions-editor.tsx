"use client";

// Roles & permissions — ADMIN-ONLY settings tab (§4 Phase 6). Four sections:
//  1. Profile change review — the admin-side entry to the approval loop for
//     THIS mentor, scaled down from the review console (/admin/review). It
//     READS pending changes and RESOLVES them with the console's exact,
//     load-bearing machinery: per-section notes → ChangeRequests whose
//     baselineValue is captured via snapshotValue AT THE MOMENT OF REJECTION,
//     approve → publish + capturePublishedSnapshot. Reused, not reimplemented.
//  2. Assignment status — read-only indicator row.
//  3. Mentor slots — per-row direct save, non-negative-integer validation.
//  4. Deactivate user — destructive zone, §4 copy, reversible round-trip.

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { EditRow } from "@/components/settings/edit-row";
import { PillButton } from "@/components/settings/pill-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  PROFILE_SECTIONS,
  changedProfileSections,
} from "@/lib/onboarding/profile-sections";
import { snapshotValue } from "@/lib/onboarding/change-requests";
import { simulateReview, saveAccountField } from "@/lib/mock-api";
import type { ChangeRequest, MentorDraft } from "@/lib/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const TAB_LABEL: Record<string, string> = {
  matching: "Matching profile",
  "first-moments": "First moments",
};

// ── 1. Profile change review ────────────────────────────────────────────────

function ChangeReviewSection() {
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const publishedSnapshot = useOnboardingStore((s) => s.publishedSnapshot);
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const setChangeRequests = useOnboardingStore((s) => s.setChangeRequests);
  const setRejection = useOnboardingStore((s) => s.setRejection);
  const capturePublishedSnapshot = useOnboardingStore(
    (s) => s.capturePublishedSnapshot
  );

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState(false);

  const firstName = draft.firstName || "this mentor";
  // Pending = the sections whose submitted value differs from the published
  // baseline (both content tabs), shown while the profile sits in review.
  const pendingSteps =
    status === "in_review" && publishedSnapshot
      ? changedProfileSections(draft, publishedSnapshot)
      : [];
  const pending = PROFILE_SECTIONS.filter((s) => pendingSteps.includes(s.step));
  const flagged = (step: string) => !!notes[step]?.trim();
  const hasFlags = pending.some((s) => flagged(s.step));

  // Console machinery, scaled to the per-mentor context (NOT reimplemented):
  // baselineValue snapshots the live field via snapshotValue at rejection time.
  const collectRequests = (): ChangeRequest[] =>
    pending
      .filter((s) => flagged(s.step))
      .map((s) => ({
        id: s.step,
        stepId: s.step,
        fieldKey: s.fieldKey,
        sectionLabel: s.label,
        note: notes[s.step].trim(),
        baselineValue: snapshotValue(
          (draft as unknown as Record<string, unknown>)[s.fieldKey]
        ),
        confirmedUnchanged: false,
      }));

  const approveAll = async () => {
    setWorking(true);
    await simulateReview({ decision: "approved" });
    setChangeRequests([]);
    setRejection(null);
    setStatus("published");
    capturePublishedSnapshot(); // baseline for future post-publish edit detection
    setWorking(false);
    setNotes({});
    toast("Approved — changes are live.");
  };

  const sendDecisions = async () => {
    const requests = collectRequests();
    if (requests.length === 0) {
      toast.error("Add a note to at least one section first.");
      return;
    }
    setWorking(true);
    await simulateReview({ decision: "rejected", note: requests[0].note });
    setChangeRequests(requests);
    setRejection(null);
    setStatus("rejected");
    setWorking(false);
    setNotes({});
    toast(`Sent ${requests.length} change${requests.length === 1 ? "" : "s"} back.`);
  };

  return (
    <section aria-label="Profile change review">
      <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        Profile change review
      </h2>
      <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
        {status === "rejected" && changeRequests.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Waiting on {firstName} — {changeRequests.length} requested change
              {changeRequests.length === 1 ? "" : "s"} outstanding:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[14px] leading-[20px] text-[var(--text-primary)]">
              {changeRequests.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.sectionLabel}</span>
                  <span className="text-[var(--text-secondary)]"> — {r.note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : pending.length === 0 ? (
          <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
            No changes waiting for review.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
              {pending.length} section{pending.length === 1 ? "" : "s"} changed
              since the last approved version:
            </p>
            {pending.map((s) => {
              const isFlagged = flagged(s.step);
              const isOpen = open[s.step] || isFlagged;
              const before = publishedSnapshot
                ? s.summary(publishedSnapshot as MentorDraft)
                : "—";
              return (
                <div
                  key={s.step}
                  className={cn(
                    "rounded-xl border bg-white p-3.5 transition-colors",
                    isFlagged
                      ? "border-orange-300 ring-1 ring-orange-200"
                      : "border-[var(--border-subtle)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
                        {TAB_LABEL[s.tab]}
                      </p>
                      <p className="font-display text-[15px] font-bold leading-[22px] text-[var(--text-primary)]">
                        {s.label}
                      </p>
                      {/* Resubmission diff awareness: approved baseline → submitted */}
                      <p className="mt-0.5 truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
                        Was: {before}
                      </p>
                      <p className="truncate text-[13px] leading-[18px] text-[var(--text-primary)]">
                        Now: {s.summary(draft)}
                      </p>
                    </div>
                    <Button
                      variant={isOpen ? "secondary" : "outline"}
                      size="sm"
                      className="min-h-11 shrink-0"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpen((o) => ({ ...o, [s.step]: !isOpen }))
                      }
                    >
                      {isFlagged ? (
                        <>
                          <Pencil className="size-3.5" />
                          Change requested
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" />
                          Request a change
                        </>
                      )}
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="mt-3">
                      <label
                        htmlFor={`rp-note-${s.step}`}
                        className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
                      >
                        Note to {firstName} · {s.label}
                      </label>
                      <Textarea
                        id={`rp-note-${s.step}`}
                        value={notes[s.step] ?? ""}
                        onChange={(e) =>
                          setNotes((n) => ({ ...n, [s.step]: e.target.value }))
                        }
                        placeholder="What should they change in this section?"
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <PillButton
                onClick={hasFlags ? sendDecisions : approveAll}
                loading={working}
              >
                {hasFlags ? "Send changes back" : "Approve all"}
              </PillButton>
              {hasFlags && (
                <button
                  type="button"
                  onClick={approveAll}
                  disabled={working}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] disabled:opacity-50",
                    RING
                  )}
                >
                  Approve everything instead
                </button>
              )}
            </div>
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
