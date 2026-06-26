"use client";

// The mentor's revision tracker — a progress count + jumplist that FLOATS, fixed
// to the viewport (bottom-center on desktop, a near-full-width bottom bar on
// mobile) so it's always visible and never scrolls below the fold on short
// screens. A self-contained card (full border + drop shadow), mounted at the
// onboarding-layout root. Shown only while the profile is "needs changes".
//
// State machine: collapsed (progress count) → expanded (rows) → complete (CTA),
// reversible if progress regresses. Addressed state is derived from the live
// draft vs each request's baseline (see lib/onboarding/change-requests).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";
import { PREVIEW_PATH } from "@/lib/onboarding/steps";
import {
  addressedStateOf,
  changeProgress,
  isAddressed,
} from "@/lib/onboarding/change-requests";
import type { AddressedState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChangeRequestsDock() {
  const mounted = useMounted();
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const draft = useOnboardingStore((s) => s.draft);
  const confirmUnchanged = useOnboardingStore((s) => s.confirmUnchanged);
  const unconfirm = useOnboardingStore((s) => s.unconfirmChangeRequest);
  // Once published, post-publish revisions happen in mentor settings (not the
  // wizard), so the onboarding dock stays out of the way.
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);
  const [open, setOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (
    !mounted ||
    everPublished ||
    status !== "rejected" ||
    changeRequests.length === 0
  ) {
    return null;
  }

  const { addressed, total, allDone } = changeProgress(changeRequests, draft);

  return (
    // Floating card, fixed to the viewport: mobile = near-full-width bottom bar
    // (side gutters + iOS safe-area floor); desktop (lg) = a compact bottom-center
    // tray. z-30 sits above the mobile preview pill (z-20) but below dialogs
    // (z-50) so a modal still covers it. Rows expand UPWARD from the pinned bar.
    <div
      className={cn(
        "fixed z-30 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_12px_40px_-12px_rgba(31,30,29,0.35)]",
        // mobile: near-full-width bottom bar, side gutters, iOS safe-area floor
        "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
        // desktop: compact bottom-center tray
        "lg:inset-x-auto lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:w-auto lg:min-w-[24rem] lg:max-w-md",
        "max-h-[calc(100dvh-1.5rem)]", // never exceed the viewport
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
        allDone ? "border-emerald-700 bg-emerald-50" : "border-foreground/15"
      )}
    >
      {/* Expanded list — rows mirror the "a few things to update" modal items,
          plus a leading checkbox that tracks (and confirms) each change. */}
      {open && (
        <ul className="max-h-[min(60svh,26rem)] space-y-2.5 overflow-y-auto px-3 py-4 sm:px-6">
          {changeRequests.map((c) => {
            const state = addressedStateOf(c, draft);
            const confirming = confirmingId === c.id;
            return (
              <li key={c.id}>
                <div className="flex items-center gap-3 rounded-xl border border-foreground/12 py-2.5 pl-3 pr-2">
                  <DockCheck
                    state={state}
                    label={c.sectionLabel}
                    onClick={() => {
                      if (state === "edited") return; // auto — not toggleable
                      if (state === "confirmed-unchanged") {
                        unconfirm(c.id);
                        return;
                      }
                      // none: ticking an unchanged field → confirm, don't accept.
                      setConfirmingId(c.id);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => router.push(stepHref(c.stepId))}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">
                        {c.sectionLabel}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                        {c.note}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                </div>
                {confirming && (
                  <ConfirmUnchanged
                    onConfirm={() => {
                      confirmUnchanged(c.id);
                      setConfirmingId(null);
                    }}
                    onCancel={() => setConfirmingId(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Bar: complete (CTA) or progress. */}
      {allDone ? (
        <div className="flex min-h-14 items-center gap-3 px-5 py-2.5 sm:px-8">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
            aria-hidden
          >
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-bold leading-tight tracking-tight">
              All changes addressed
            </span>
            <span className="block text-xs text-muted-foreground">
              Send it back whenever you&apos;re ready.
            </span>
          </span>
          <Button size="sm" onClick={() => router.push(PREVIEW_PATH)}>
            Resubmit
          </Button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Hide change list" : "Show change list"}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronUp
              className={cn(
                "size-4 motion-safe:transition-transform",
                !open && "rotate-180"
              )}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Changes from your reviewer, ${addressed} of ${total} addressed`}
          className="flex min-h-14 items-center gap-3 px-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-8"
        >
          {/* STATUS — progress dots + count, informational weight. */}
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
            {changeRequests.map((c) => (
              <span
                key={c.id}
                className={cn(
                  "size-2 rounded-full",
                  isAddressed(c, draft) ? "bg-emerald-600" : "bg-foreground/25"
                )}
              />
            ))}
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
            {addressed} of {total} changes addressed
          </span>
          {/* AFFORDANCE — the disclosure control, given a chip treatment so it
              reads as the actionable element (still quieter than the page's
              primary CTA, which is a solid pill). */}
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-foreground/20 px-3 py-1 text-sm font-semibold text-foreground">
            {open ? "Hide" : "Review"}
            <ChevronUp
              className={cn(
                "size-4 motion-safe:transition-transform",
                !open && "rotate-180"
              )}
            />
          </span>
        </button>
      )}
    </div>
  );
}

// Leading control. Visual box is 24px (aligns with the row text); the tap target
// is expanded to ~44px via the `after` pseudo. Edited is auto-checked + inert.
function DockCheck({
  state,
  label,
  onClick,
}: {
  state: AddressedState;
  label: string;
  onClick: () => void;
}) {
  const checked = state !== "none";
  const auto = state === "edited";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={auto || undefined}
      aria-label={
        auto
          ? `${label}: updated automatically`
          : checked
            ? `Unconfirm ${label}`
            : `Mark ${label} addressed`
      }
      onClick={onClick}
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 outline-none after:absolute after:-inset-2.5 after:content-[''] motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        checked
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-foreground/30 hover:border-foreground/50",
        auto && "cursor-default"
      )}
    >
      {checked && <Check className="size-4" strokeWidth={3} />}
    </button>
  );
}

// The integrity prompt: friction appears ONLY when a mentor marks an unchanged
// field as done. Confirm → confirmed-unchanged; Cancel → back to none.
function ConfirmUnchanged({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2.5">
      <p className="text-xs leading-snug text-orange-900">
        You marked this done but didn&apos;t change anything. That&apos;s fine if
        it was already right — confirm?
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="xs" onClick={onConfirm}>
          Confirm
        </Button>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
