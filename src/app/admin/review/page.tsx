"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { simulateReview } from "@/lib/mock-api";
import { PROFILE_SECTIONS } from "@/lib/onboarding/profile-sections";
import { snapshotValue } from "@/lib/onboarding/change-requests";
import type { ChangeRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  // record-03: the Mentor Record deep-links here (?from=record — return nav;
  // ?focus=<stepId> — open that section's composer and scroll to it). Nav
  // only: the approve/reject logic and its baseline capture are untouched.
  const query = use(searchParams);
  const fromRecord = query.from === "record";
  const returnHref = fromRecord ? "/admin/mentor" : "/admin/users";
  const focusStep = typeof query.focus === "string" ? query.focus : null;
  const draft = useOnboardingStore((s) => s.draft);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const setChangeRequests = useOnboardingStore((s) => s.setChangeRequests);
  const setRejection = useOnboardingStore((s) => s.setRejection);
  const capturePublishedSnapshot = useOnboardingStore(
    (s) => s.capturePublishedSnapshot
  );

  // Per-section note capture (inline reveal). `open` tracks which note fields are
  // visible; `notes` holds the text. A section is "flagged" once it has text.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    focusStep ? { [focusStep]: true } : {}
  );
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!focusStep || scrolledRef.current) return;
    const el = document.querySelector(`[data-review-section="${focusStep}"]`);
    if (!el) return;
    scrolledRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);

  const firstName = mounted ? draft.firstName || "this mentor" : "this mentor";
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "Jordan Rivera";

  const flagged = (step: string) => !!notes[step]?.trim();
  // Once any section is flagged the verdict is "reject", so the primary (filled)
  // CTA flips from "Approve and publish" to "Reject with comments".
  const hasFlags = PROFILE_SECTIONS.some((s) => flagged(s.step));

  const collectRequests = (): ChangeRequest[] =>
    PROFILE_SECTIONS.filter((s) => notes[s.step]?.trim()).map((s) => ({
      id: s.step,
      stepId: s.step,
      fieldKey: s.fieldKey,
      sectionLabel: s.label,
      note: notes[s.step].trim(),
      // Snapshot the field's current value now — the anchor for detecting an edit.
      baselineValue: snapshotValue(
        (draft as unknown as Record<string, unknown>)[s.fieldKey]
      ),
      confirmedUnchanged: false,
    }));

  const approve = async () => {
    setWorking(true);
    await simulateReview({ decision: "approved" });
    setChangeRequests([]);
    setRejection(null);
    setStatus("published");
    capturePublishedSnapshot(); // baseline for future post-publish edit detection
    // The reviewer stays in the console — back to the queue (mirrors reject).
    toast.success(`Approved ${mentorName}'s profile`);
    router.push(returnHref);
  };

  const reject = async () => {
    const requests = collectRequests();
    if (requests.length === 0) {
      toast.error("Add a note to at least one section first.");
      return;
    }
    setWorking(true);
    await simulateReview({ decision: "rejected", note: requests[0].note });
    setChangeRequests(requests);
    setRejection(null); // dock now drives the revision UI
    setStatus("rejected");
    toast.success(`Sent ${requests.length} change${requests.length === 1 ? "" : "s"} to ${mentorName}`);
    router.push(returnHref);
  };

  return (
    <AdminShell active="mentors">
      <div className="grid items-start gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_392px] lg:px-10">
        {/* LEFT — the reviewer's workspace */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.push(returnHref)}
            className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeft className="size-4" />
            {fromRecord ? "Back to record" : "Back to users"}
          </button>

          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Clinical review · submitted for review
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
            Review {mentorName}&apos;s profile
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Check what teens will see on the right. Flag anything that needs a
            change — each note goes to {firstName} tied to that section.
          </p>

          {/* Sections */}
          <div className="mt-6 space-y-3">
            {PROFILE_SECTIONS.map((section) => {
              const isFlagged = flagged(section.step);
              const isOpen = open[section.step] || isFlagged;
              return (
                <div
                  key={section.step}
                  data-review-section={section.step}
                  className={cn(
                    "rounded-2xl border bg-card p-4 transition-colors",
                    isFlagged && "border-brand ring-1 ring-brand"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display font-bold tracking-tight">
                        {section.label}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {mounted ? section.summary(draft) : "—"}
                      </p>
                    </div>
                    <Button
                      variant={isOpen ? "secondary" : "outline"}
                      size="sm"
                      className="shrink-0"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpen((o) => ({ ...o, [section.step]: !isOpen }))
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
                        htmlFor={`note-${section.step}`}
                        className="mb-1.5 block text-xs font-medium text-muted-foreground"
                      >
                        Note to {firstName} · {section.label}
                      </label>
                      <Textarea
                        id={`note-${section.step}`}
                        value={notes[section.step] ?? ""}
                        onChange={(e) =>
                          setNotes((n) => ({
                            ...n,
                            [section.step]: e.target.value,
                          }))
                        }
                        placeholder="What should they change in this section?"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions — the primary (filled) CTA is the verdict: Approve when
              nothing's flagged, Reject once any change is requested. */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              variant={hasFlags ? "secondary" : "default"}
              onClick={approve}
              disabled={working}
            >
              <Check className="size-4" />
              Approve and publish
            </Button>
            <Button
              size="lg"
              variant={hasFlags ? "default" : "secondary"}
              onClick={reject}
              disabled={working}
            >
              Reject with comments
            </Button>
          </div>
        </div>

        {/* RIGHT — passive phone preview (output only) */}
        <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
          {mounted ? (
            <PhoneFrame>
              <MentorProfilePreview draft={draft} />
            </PhoneFrame>
          ) : (
            <div className="h-[740px] w-[368px] max-w-full animate-pulse rounded-[46px] bg-muted/40" />
          )}
          <p className="text-xs text-muted-foreground">
            Read-only · what teens see
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
