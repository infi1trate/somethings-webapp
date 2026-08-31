"use client";

// Lead Mentor's clinical-review screen (role migration: lead-owned). A mentor
// profile on the left, the teen-facing phone preview on the right, and an
// anchored approve/reject decision flow.
//
// Interaction model (review-inline-feedback): feedback lives INSIDE each field
// card — there is no separate checklist/feedback panel.
//   • Default: read-only field cards + a sticky bar ("Approve and publish" /
//     "Reject with comments"). No per-row controls.
//   • "Reject with comments" enters review mode: every card gains an inline
//     "Needs change" toggle; the sticky bar becomes "Submit review · N flagged"
//     (live count) / "Cancel".
//   • Flagging a row expands a comment field IN that card, tints the card, and
//     shows a flag icon (non-color cues, WCAG 1.4.1); focus moves to the field.
//     Un-flagging collapses and clears it. One general-comments field sits just
//     above the sticky bar.
//
// Payload: approve → { decision: "approved" }; reject → { decision: "rejected",
// sectionFeedback: [{ sectionId, note }], generalComment }. Per-section
// feedback persists as ChangeRequest[] (the dock/revision UI reads it, keeping
// each note tied to its section for edit-detection); the general comment lands
// in rejectionNote.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Flag } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { PreviewDisclosure } from "@/components/settings/preview-disclosure";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";
import { simulateReview } from "@/lib/mock-api";
// MENTOR_MANAGED_SECTIONS, not PROFILE_SECTIONS: this screen's output is a
// change request the MENTOR has to act on. The first-moment story is curated by
// a lead or supervisor and the mentor can't see it, so flagging it would send
// them a task with nothing to open — it is out of the reviewable set.
import { MENTOR_MANAGED_SECTIONS } from "@/lib/onboarding/profile-sections";
import { snapshotValue } from "@/lib/onboarding/change-requests";
import type { ChangeRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

/** ═══ EACH REVIEWER IN THEIR OWN CHROME ═══
 *
 *  Same route, two rails — copied deliberately from `StaffShell` in
 *  `admin/mentor/page.tsx`, which solved this exact problem for the record:
 *  the Lead Mentor manages mentors from inside the mentor app, and the
 *  Supervisor works in the console. Putting a supervisor in `MentorShell` would
 *  swap their whole left rail for someone else's the moment they opened a
 *  review, which reads as having been navigated somewhere they did not ask to
 *  go — the milder version of the bug this change is fixing. */
function ReviewShell({
  lead,
  children,
}: {
  lead: boolean;
  children: React.ReactNode;
}) {
  return lead ? (
    <MentorShell active="mentors">{children}</MentorShell>
  ) : (
    <AdminShell active="mentors">{children}</AdminShell>
  );
}

export default function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  // record-03: the Mentor Record deep-links here (?from=record — return nav;
  // ?focus=<stepId> — enter review mode with that field pre-flagged).
  const query = use(searchParams);
  const fromRecord = query.from === "record";
  // Lead-owned flow (role migration): the default return is the lead's
  // mentors list — this console renders in the lead's own app chrome.
  const returnHref = fromRecord ? "/admin/mentor" : "/app/team";
  const focusStep = typeof query.focus === "string" ? query.focus : null;
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const setChangeRequests = useOnboardingStore((s) => s.setChangeRequests);
  const setRejection = useOnboardingStore((s) => s.setRejection);
  const capturePublishedSnapshot = useOnboardingStore(
    (s) => s.capturePublishedSnapshot,
  );

  // A deep-link with ?focus=<step> opens review mode with that field flagged —
  // the record's "request a change here" entry point.
  const [mode, setMode] = useState<"idle" | "review">(
    focusStep ? "review" : "idle",
  );
  const [flagged, setFlagged] = useState<Record<string, boolean>>(() =>
    focusStep ? { [focusStep]: true } : {},
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [generalComment, setGeneralComment] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  /** ═══ WHO MAY REVIEW A NEW MENTOR: THE LEAD *AND* THE SUPERVISOR TIER ═══
   *
   *  This used to be lead-only, and it bounced a supervisor to `/admin/mentor`.
   *  That redirect was the bug the product owner reported on 2026-08-31: from a
   *  supervisor's seat, "Review" on the Needs-review queue card — and the
   *  record's own "Review profile" — landed on the mentor's RECORD, a page that
   *  describes an established mentor, "as if the user already exists". The
   *  profile under review has not been approved yet; there is nothing there to
   *  see, and no way to approve it or send it back.
   *
   *  A supervisor sits ABOVE a lead mentor in this product's tiering — the same
   *  `isSupervisorTier` that already grants `canActOnCare`, the heavier
   *  permission of the two — so denying them the review a lead can do was
   *  backwards. They get the full console, review actions included.
   *
   *  A MENTOR STILL GOES TO THEIR OWN PROFILE. `new-mentor` and `mentor` have no
   *  business approving a profile, their own least of all. */
  const canReview = persona === "lead-mentor" || isSupervisorTier(persona);
  useEffect(() => {
    if (!mounted || canReview) return;
    router.replace("/app/profile");
  }, [mounted, canReview, router]);

  const firstName = mounted ? draft.firstName || "this mentor" : "this mentor";
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";

  const hasNote = (step: string) => !!notes[step]?.trim();
  const isFlagged = (step: string) => !!flagged[step];
  // A flagged row with no note yet — blocks submission (so a flagged row is
  // never silently dropped from the payload).
  const isIncomplete = (step: string) => isFlagged(step) && !hasNote(step);
  const flaggedCount = MENTOR_MANAGED_SECTIONS.filter((s) =>
    isFlagged(s.step),
  ).length;
  const hasIncomplete = MENTOR_MANAGED_SECTIONS.some((s) =>
    isIncomplete(s.step),
  );
  const canSubmit = flaggedCount > 0 && !hasIncomplete;
  const dirty =
    !!generalComment.trim() ||
    MENTOR_MANAGED_SECTIONS.some((s) => hasNote(s.step));

  const toggleFlag = (step: string, next: boolean) => {
    setFlagged((f) => ({ ...f, [step]: next }));
    // When a row is flagged its note textarea mounts with autoFocus (below),
    // moving focus into it (WCAG 2.2 AA). Un-flagging clears the note.
    if (!next) {
      // Un-flagging collapses AND clears its note + touched state.
      setNotes((n) => {
        const nn = { ...n };
        delete nn[step];
        return nn;
      });
      setTouched((t) => {
        const nt = { ...t };
        delete nt[step];
        return nt;
      });
    }
  };

  const openReview = () => setMode("review");

  const doCancel = () => {
    setMode("idle");
    setFlagged({});
    setNotes({});
    setTouched({});
    setGeneralComment("");
    setConfirmCancel(false);
  };
  const requestCancel = () => (dirty ? setConfirmCancel(true) : doCancel());

  const approve = async () => {
    setWorking(true);
    await simulateReview({ decision: "approved" });
    setChangeRequests([]);
    setRejection(null);
    setStatus("published");
    capturePublishedSnapshot(); // baseline for future post-publish edit detection
    toast.success(`Approved ${mentorName}'s profile`);
    router.push(returnHref);
  };

  const submitReject = async () => {
    // Guard (button is also disabled): needs ≥1 flagged row, each with a note.
    if (!canSubmit) {
      const firstEmpty = MENTOR_MANAGED_SECTIONS.find((s) =>
        isIncomplete(s.step),
      );
      if (firstEmpty) {
        setTouched((t) => ({ ...t, [firstEmpty.step]: true }));
        document.getElementById(`note-${firstEmpty.step}`)?.focus();
      }
      return;
    }
    // Payload: { decision, sectionFeedback: [{ sectionId, note }], generalComment }.
    // Persist per-section feedback as ChangeRequest[] (dock/revision UI), each
    // with a baseline snapshot of its field for the mentor's edit-detection.
    const feedback = MENTOR_MANAGED_SECTIONS.filter(
      (s) => isFlagged(s.step) && hasNote(s.step),
    ).map((s) => ({ section: s, note: notes[s.step].trim() }));
    const requests: ChangeRequest[] = feedback.map(({ section, note }) => ({
      id: section.step,
      stepId: section.step,
      fieldKey: section.fieldKey,
      sectionLabel: section.label,
      note,
      baselineValue: snapshotValue(
        (draft as unknown as Record<string, unknown>)[section.fieldKey],
      ),
      confirmedUnchanged: false,
    }));
    setWorking(true);
    await simulateReview({ decision: "rejected", note: feedback[0].note });
    setChangeRequests(requests);
    setRejection(generalComment.trim() || null); // general (not section-bound)
    setStatus("rejected");
    toast.success(
      `Sent ${requests.length} change${requests.length === 1 ? "" : "s"} to ${mentorName}`,
    );
    router.push(returnHref);
  };

  if (!mounted || !canReview) {
    // Pre-mount / mentor viewers (being redirected) — quiet shell.
    return (
      <ReviewShell lead={persona === "lead-mentor"}>
        <div className="min-h-dvh" />
      </ReviewShell>
    );
  }

  const reviewing = mode === "review";

  return (
    <ReviewShell lead={persona === "lead-mentor"}>
      <div className="grid items-start gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_392px] lg:px-10">
        {/* LEFT — the reviewer's workspace (min-h keeps the sticky bar pinned) */}
        <div className="flex min-h-[calc(100dvh-3rem)] min-w-0 flex-col">
          <button
            type="button"
            onClick={() => router.push(returnHref)}
            // SC 2.5.8 — 20px tall. `py-1.5` gives 32px; padding rather than
            // `touchTarget()` because `mb-4` puts content directly beneath and an
            // upward bleed would reach the header above it.
            className="mb-4 inline-flex items-center gap-1.5 rounded-md py-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeft className="size-4" />
            {fromRecord ? "Back to profile" : "Back to mentors"}
          </button>

          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Clinical review · submitted for review
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
            Review {mentorName}&apos;s profile
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {reviewing
              ? `Flag each field that needs work and tell ${firstName} what to change — your note goes to them tied to that field.`
              : "Check what teens will see on the right, then approve the profile or reject it with per-field comments."}
          </p>

          {/* Field cards — read-only reference. In review mode each card carries
              its own "Needs change" toggle and, when flagged, an inline note. */}
          <div className="mt-6 space-y-3">
            {MENTOR_MANAGED_SECTIONS.map((section) => {
              const on = isFlagged(section.step);
              const showError =
                isIncomplete(section.step) && touched[section.step];
              return (
                <div
                  key={section.step}
                  data-review-section={section.step}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border bg-card p-4 transition-colors",
                    on && "bg-brand/5",
                  )}
                >
                  {/* Accent left bar — decorative reinforcement, not the only
                      flagged cue (flag icon + toggle text carry it too). */}
                  {on && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1 bg-brand"
                    />
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p
                        id={`lbl-${section.step}`}
                        className="flex items-center gap-1.5 font-display font-bold tracking-tight"
                      >
                        {on && (
                          <Flag
                            className="size-3.5 shrink-0 fill-brand text-brand"
                            aria-hidden
                          />
                        )}
                        {section.label}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {section.summary(draft)}
                      </p>
                    </div>

                    {reviewing && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Checkbox
                          id={`flag-${section.step}`}
                          checked={on}
                          onCheckedChange={(v) =>
                            toggleFlag(section.step, v === true)
                          }
                          aria-label={`Flag ${section.label} — needs change`}
                        />
                        <Label
                          htmlFor={`flag-${section.step}`}
                          className="cursor-pointer text-sm font-medium text-muted-foreground"
                        >
                          Needs change
                        </Label>
                      </div>
                    )}
                  </div>

                  {reviewing && on && (
                    <div className="mt-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150">
                      <Textarea
                        id={`note-${section.step}`}
                        autoFocus
                        aria-labelledby={`lbl-${section.step}`}
                        aria-invalid={showError || undefined}
                        aria-describedby={
                          showError ? `err-${section.step}` : undefined
                        }
                        value={notes[section.step] ?? ""}
                        onChange={(e) =>
                          setNotes((n) => ({
                            ...n,
                            [section.step]: e.target.value,
                          }))
                        }
                        onBlur={() =>
                          setTouched((t) => ({ ...t, [section.step]: true }))
                        }
                        placeholder={`What should ${firstName} change here?`}
                      />
                      {showError && (
                        <p
                          id={`err-${section.step}`}
                          role="alert"
                          className="mt-1 text-xs font-medium text-destructive"
                        >
                          Add a note so {firstName} knows what to change.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* General comments — whole-profile note, just above the action bar
              (review mode only; not mirrored against the field list). */}
          {reviewing && (
            <div className="mt-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
              <Label
                htmlFor="general-comment"
                className="mb-1.5 block text-sm font-medium"
              >
                General comments{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="general-comment"
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
                placeholder="Anything for the whole profile that isn't tied to one field."
              />
            </div>
          )}

          {/* Sticky action bar — pinned to the bottom of the workspace. */}
          <div className="sticky bottom-0 z-10 mt-8 -mx-6 border-t border-border/80 bg-background/85 px-6 py-3 backdrop-blur lg:-mx-10 lg:px-10">
            {reviewing ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    onClick={submitReject}
                    disabled={!canSubmit || working}
                  >
                    Submit review · {flaggedCount} flagged
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={requestCancel}
                    disabled={working}
                  >
                    Cancel
                  </Button>
                </div>
                {!canSubmit && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {hasIncomplete
                      ? "Add a note to each flagged field to submit."
                      : "Flag at least one field and add a note to submit."}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={approve} disabled={working}>
                  <Check className="size-4" />
                  Approve and publish
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={openReview}
                  disabled={working}
                >
                  Reject with comments
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — passive phone preview (output only)
            
            ═══ THE MOST IMPORTANT OF THE SIX (RC-2) ═══
            
            This was `hidden lg:…`. On this page the preview is not context, it
            is THE ARTIFACT UNDER REVIEW — so below 1024px a supervisor was being
            asked to approve or reject a profile they could not see, with the
            decision buttons fully available. That is the worst shape this bug
            takes anywhere in the product.
            
            The sheet makes it reachable at every width, which closes the
            accessibility failure. It is NOT the final answer for tablet: a
            reviewer needs the artifact and the decision controls visible
            together, and a modal sheet is mutually exclusive with them by
            construction. The tablet layout is proposed in the Phase 4 report and
            deliberately NOT built here — see gaps row 264. */}
        <PreviewDisclosure
          /* TODO-COPY */
          triggerLabel="View the profile under review"
          title="The profile under review"
          caption={
            <p className="text-xs text-muted-foreground">
              Read-only · what teens see
            </p>
          }
        >
          {mounted ? (
            <PhoneFrame>
              <MentorProfilePreview draft={draft} />
            </PhoneFrame>
          ) : (
            // The skeleton follows the frame's ratio rather than a fixed height,
            // so it does not jump when the real frame swaps in at a width the
            // frame now adapts to.
            <div className="aspect-[360/754] w-full max-w-[360px] animate-pulse rounded-[46px] bg-muted/40" />
          )}
        </PreviewDisclosure>
      </div>

      {/* Cancel confirm — only when notes would be lost. */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard your review notes?</DialogTitle>
            <DialogDescription>
              You&apos;ve written feedback that hasn&apos;t been sent. Canceling
              clears every flag and note on this review.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={doCancel}>
              Discard notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReviewShell>
  );
}
