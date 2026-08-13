"use client";

// Shared UI for the Profile Update Review flow (mentor side): status chips,
// the review-team note callout, the discard confirm, the changes-requested
// page banner, and the toast-aware gated save. Copy strings per spec §6 —
// calm and clear; no playful register in a review context.

import { useState } from "react";
import { AlertCircle, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { gatedFieldMeta } from "@/lib/onboarding/profile-update";
import type { MentorDraft } from "@/lib/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// Neutral/quiet chip — not success, not warning (token gap: no neutral chip
// variant exists in §2; interim on muted surface — gaps.md #43).
export function InReviewChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--tint-press)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
      <Clock3 className="size-3" aria-hidden />
      In review
    </span>
  );
}

// Amber — matches the onboarding "Needs changes" treatment.
export function ChangesRequestedChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
      <AlertCircle className="size-3" aria-hidden />
      Changes requested
    </span>
  );
}

/** "From the review team" callout — mirrors the onboarding note treatment. */
export function ReviewNoteCallout({ note }: { note: string }) {
  return (
    <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
        From the review team
      </p>
      <p className="mt-1 text-sm leading-relaxed text-orange-900">{note}</p>
    </div>
  );
}

/** Helper line under a pending value (§6 helper.pending). */
export function pendingHelper(fieldId: string): string {
  const noun = gatedFieldMeta(fieldId)?.noun ?? "profile";
  return `Teens still see your current ${noun} until this is approved.`;
}

/** "Discard change" action + its confirm dialog, wired to the store. */
export function DiscardChange({ fieldId }: { fieldId: string }) {
  const discard = useOnboardingStore((s) => s.discardProfileUpdateField);
  const [open, setOpen] = useState(false);
  const noun = gatedFieldMeta(fieldId)?.noun ?? "profile";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
          RING
        )}
      >
        Discard change
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard this change?</DialogTitle>
            <DialogDescription>
              Teens will keep seeing your current {noun}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Keep it
            </Button>
            <Button
              className="min-h-11"
              onClick={() => {
                discard(fieldId);
                setOpen(false);
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Page banner — shown only while the changeset has flagged fields (§4.2).
 *  Clicking scrolls to the first flagged element ([data-flagged-field]). */
export function ChangesBanner() {
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const flagged =
    profileUpdate?.fields.filter((f) => f.fieldStatus === "changes-requested") ??
    [];
  if (flagged.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() =>
        document
          .querySelector("[data-flagged-field]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      className={cn(
        "mb-5 flex w-full items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3.5 text-left text-sm leading-relaxed text-orange-900",
        RING
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">
          {flagged.length === 1
            ? "The review team left a note on 1 of your changes."
            : `The review team left notes on ${flagged.length} of your changes.`}
        </span>{" "}
        Look for the highlighted sections below.
      </span>
    </button>
  );
}

/** Gated save with the §6 toasts: "Saved — in review…" on first enqueue,
 *  "Updated — back in review." on a resubmission. One toast per transition. */
export function saveGatedWithToasts(patch: Partial<MentorDraft>) {
  const before = useOnboardingStore.getState().profileUpdate;
  const had = new Map(
    (before?.fields ?? []).map((f) => [f.fieldId, f.fieldStatus])
  );
  useOnboardingStore.getState().saveGatedFields(patch);
  const after = useOnboardingStore.getState().profileUpdate;
  if (!useOnboardingStore.getState().publishedSnapshot) return;
  for (const f of after?.fields ?? []) {
    if (!(f.fieldId in (patch as Record<string, unknown>))) continue;
    const prev = had.get(f.fieldId);
    if (prev === undefined) {
      toast("Saved — in review before it goes live.");
    } else if (prev === "changes-requested" && f.fieldStatus === "pending") {
      toast("Updated — back in review.");
    }
  }
}
