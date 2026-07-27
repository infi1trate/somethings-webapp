"use client";

// Lead Mentor's clinical-review screen (role migration: lead-owned). A read-only
// mentor profile on the left, the teen-facing phone preview on the right, and an
// anchored approve/reject decision flow.
//
// Interaction model (review-refactor):
//   • The section list is READ-ONLY reference — no per-row controls.
//   • A sticky action bar is pinned to the bottom of the workspace, always
//     reachable: "Approve and publish" (primary) + "Reject with comments"
//     (outline toggle).
//   • Reject progressively reveals a "What needs to change?" panel — a
//     fieldset/legend checklist of the profile sections. Checking a section
//     expands an inline note tied to it (unchecking collapses AND clears it);
//     an optional general-comments field sits at the bottom; "Submit review"
//     sends it. Notes survive toggling approve/reject without submitting.
//
// Payload: approve → { decision: "approved" }; reject → { decision: "rejected",
// sectionFeedback: [{ sectionId, note }], generalComment }. The per-section
// feedback persists as ChangeRequest[] (the dock/revision UI reads it, keeping
// each note tied to its section for edit-detection); the general comment lands
// in rejectionNote.

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  // ?focus=<stepId> — open the reject panel with that section pre-checked).
  const query = use(searchParams);
  const fromRecord = query.from === "record";
  // Lead-owned flow (role migration): the default return is the lead's
  // mentors list — this console renders in the lead's own app chrome.
  const returnHref = fromRecord ? "/admin/mentor" : "/app/mentors";
  const focusStep = typeof query.focus === "string" ? query.focus : null;
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const setChangeRequests = useOnboardingStore((s) => s.setChangeRequests);
  const setRejection = useOnboardingStore((s) => s.setRejection);
  const capturePublishedSnapshot = useOnboardingStore(
    (s) => s.capturePublishedSnapshot
  );

  // A deep-link with ?focus=<step> opens straight into the reject panel with
  // that section pre-checked — the record's "request a change here" entry point.
  const [mode, setMode] = useState<"idle" | "reject">(focusStep ? "reject" : "idle");
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    focusStep ? { [focusStep]: true } : {}
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [generalComment, setGeneralComment] = useState("");
  const [working, setWorking] = useState(false);

  const panelRef = useRef<HTMLElement>(null);

  // Lead-owned flow (role migration): approve/send-back belongs to the Lead
  // Mentor. Mentors go to their own profile; the Supervisor views state on
  // the record instead (view + edit oversight, no review actions).
  const isLead = persona === "lead-mentor";
  useEffect(() => {
    if (!mounted || isLead) return;
    router.replace(persona === "supervisor" ? "/admin/mentor" : "/app/profile");
  }, [mounted, isLead, persona, router]);

  // Move focus into the reject panel when it opens (WCAG 2.2 AA); respect
  // reduced-motion for the accompanying scroll.
  useEffect(() => {
    if (mode !== "reject") return;
    const el = panelRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [mode]);

  const firstName = mounted ? draft.firstName || "this mentor" : "this mentor";
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "Jordan Rivera";

  const hasNote = (step: string) => !!notes[step]?.trim();
  const isFlagged = (step: string) => !!checked[step] && hasNote(step);
  // A checked section with no note yet — blocks submission (so a flagged
  // section is never silently dropped from the payload).
  const isIncomplete = (step: string) => !!checked[step] && !hasNote(step);
  const hasFlag = PROFILE_SECTIONS.some((s) => isFlagged(s.step));
  const hasIncomplete = PROFILE_SECTIONS.some((s) => isIncomplete(s.step));
  const canSubmit = hasFlag && !hasIncomplete;

  const toggleSection = (step: string, next: boolean) =>
    setChecked((c) => {
      const nc = { ...c, [step]: next };
      if (!next) {
        // Unchecking collapses AND clears its note + touched state.
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
      return nc;
    });

  const openReject = useCallback(() => setMode("reject"), []);
  const cancelReject = useCallback(() => setMode("idle"), []); // notes preserved

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
    // Guard (button is also disabled): needs ≥1 section checked with a note.
    if (!canSubmit) {
      const firstEmpty = PROFILE_SECTIONS.find((s) => isIncomplete(s.step));
      if (firstEmpty) {
        setTouched((t) => ({ ...t, [firstEmpty.step]: true }));
        document.getElementById(`note-${firstEmpty.step}`)?.focus();
      }
      return;
    }
    // Payload: { decision, sectionFeedback: [{ sectionId, note }], generalComment }.
    // Persist per-section feedback as ChangeRequest[] (dock/revision UI), with a
    // baseline snapshot per field for the mentor's edit-detection.
    const feedback = PROFILE_SECTIONS.filter((s) => isFlagged(s.step)).map((s) => ({
      sectionId: s.step,
      note: notes[s.step].trim(),
      section: s,
    }));
    const requests: ChangeRequest[] = feedback.map(({ section, note }) => ({
      id: section.step,
      stepId: section.step,
      fieldKey: section.fieldKey,
      sectionLabel: section.label,
      note,
      baselineValue: snapshotValue(
        (draft as unknown as Record<string, unknown>)[section.fieldKey]
      ),
      confirmedUnchanged: false,
    }));
    setWorking(true);
    await simulateReview({ decision: "rejected", note: feedback[0].note });
    setChangeRequests(requests);
    setRejection(generalComment.trim() || null); // general comment (not section-bound)
    setStatus("rejected");
    toast.success(
      `Sent ${requests.length} change${requests.length === 1 ? "" : "s"} to ${mentorName}`
    );
    router.push(returnHref);
  };

  if (!mounted || !isLead) {
    // Pre-mount / non-lead viewers (being redirected) — quiet shell.
    return (
      <MentorShell active="mentors">
        <div className="min-h-dvh" />
      </MentorShell>
    );
  }

  return (
    <MentorShell active="mentors">
      <div className="grid items-start gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_392px] lg:px-10">
        {/* LEFT — the reviewer's workspace (min-h keeps the sticky bar pinned) */}
        <div className="flex min-h-[calc(100dvh-3rem)] min-w-0 flex-col">
          <button
            type="button"
            onClick={() => router.push(returnHref)}
            className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
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
            Check what teens will see on the right. When something needs work,
            reject with comments — each note goes to {firstName} tied to its
            section.
          </p>

          {/* Read-only section list — reference only, no per-field controls.
              A flagged section (checked + noted in the reject panel) shows a
              quiet marker so the reviewer sees what they've already flagged. */}
          <div className="mt-6 space-y-3">
            {PROFILE_SECTIONS.map((section) => (
              <div
                key={section.step}
                data-review-section={section.step}
                className={cn(
                  "rounded-2xl border bg-card p-4 transition-colors",
                  isFlagged(section.step) && "border-brand ring-1 ring-brand"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display font-bold tracking-tight">
                      {section.label}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {section.summary(draft)}
                    </p>
                  </div>
                  {isFlagged(section.step) && (
                    <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                      Change requested
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Progressive disclosure — the reject panel (checklist + notes). */}
          {mode === "reject" && (
            <section
              ref={panelRef}
              tabIndex={-1}
              aria-labelledby="reject-panel-heading"
              className="mt-6 rounded-2xl border bg-card p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-200"
            >
              <h2
                id="reject-panel-heading"
                className="font-display text-lg font-bold tracking-tight"
              >
                What needs to change?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check each section that needs work and tell {firstName} what to
                change. They&apos;ll get your notes tied to each section.
              </p>

              <fieldset className="mt-4 space-y-1">
                <legend className="sr-only">
                  Profile sections that need changes
                </legend>
                {PROFILE_SECTIONS.map((section) => {
                  const on = !!checked[section.step];
                  const showError = isIncomplete(section.step) && touched[section.step];
                  return (
                    <div
                      key={section.step}
                      className={cn(
                        "rounded-xl px-1 py-1.5 transition-colors",
                        on && "bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`chk-${section.step}`}
                          checked={on}
                          onCheckedChange={(v) =>
                            toggleSection(section.step, v === true)
                          }
                        />
                        <Label
                          htmlFor={`chk-${section.step}`}
                          id={`lbl-${section.step}`}
                          className="cursor-pointer font-medium"
                        >
                          {section.label}
                        </Label>
                      </div>

                      {on && (
                        <div className="mt-2 pl-7 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150">
                          <Textarea
                            id={`note-${section.step}`}
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
                            placeholder={`What should ${firstName} change in ${section.label}?`}
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
              </fieldset>

              <div className="mt-4">
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
                  placeholder="Anything for the whole profile that isn't tied to one section."
                />
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  onClick={submitReject}
                  disabled={!canSubmit || working}
                  className="sm:self-start"
                >
                  Submit review
                </Button>
                {!canSubmit && (
                  <p className="text-xs text-muted-foreground">
                    {hasIncomplete
                      ? "Add a note to each checked section to submit."
                      : "Check at least one section and add a note to submit."}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Sticky action bar — pinned to the bottom of the workspace, always
              reachable while the list scrolls above it. */}
          <div className="sticky bottom-0 z-10 mt-8 -mx-6 border-t border-border/80 bg-background/85 px-6 py-3 backdrop-blur lg:-mx-10 lg:px-10">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={approve} disabled={working}>
                <Check className="size-4" />
                Approve and publish
              </Button>
              <Button
                size="lg"
                variant="outline"
                aria-expanded={mode === "reject"}
                onClick={mode === "reject" ? cancelReject : openReject}
                disabled={working}
              >
                {mode === "reject" ? "Cancel" : "Reject with comments"}
              </Button>
            </div>
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
          <p className="text-xs text-muted-foreground">Read-only · what teens see</p>
        </div>
      </div>
    </MentorShell>
  );
}
