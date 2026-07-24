"use client";

// Profile Update Review — the supervisor delta review (§5.2). Shows ONLY the
// fields in the mentor's open changeset as Live → Proposed diff cards, with a
// per-card note composer, a Live|Proposed preview toggle (default Proposed —
// the thing being judged), and the §6 footer verdicts:
//   Approve and publish → confirm → approveProfileUpdate (all-or-nothing)
//   Send back with notes → sendBackProfileUpdate (noted fields flagged;
//   un-noted fields stay pending and publish with the next approval).

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
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
import { gatedFieldMeta, relTime } from "@/lib/onboarding/profile-update";
import { LiveProposedGrid } from "@/components/review/diff-card";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

// Phase 9 tab names (§3 rev) — requests display against the tab that hosts
// the field.
const SURFACE_LABEL: Record<string, string> = {
  profile: "Profile",
  "first-moments": "First moments",
};

export default function AdminProfileUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  // record-03: the Mentor Record deep-links here (?from=record — return nav;
  // ?focus=<fieldId> — open that field's composer and scroll to its card).
  const query = use(searchParams);
  const fromRecord = query.from === "record";
  const returnHref = fromRecord ? "/admin/mentor" : "/admin/users";
  const focusField = typeof query.focus === "string" ? query.focus : null;
  const draft = useOnboardingStore((s) => s.draft);
  const publishedSnapshot = useOnboardingStore((s) => s.publishedSnapshot);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const sendBackProfileUpdate = useOnboardingStore(
    (s) => s.sendBackProfileUpdate
  );
  const approveProfileUpdate = useOnboardingStore(
    (s) => s.approveProfileUpdate
  );

  // Per-card note composer (console pattern): `open` reveals the field,
  // `notes` holds the text; a card is flagged once it has text.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    focusField ? { [focusField]: true } : {}
  );
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!focusField || scrolledRef.current) return;
    const el = document.querySelector(`[data-diff-field="${focusField}"]`);
    if (!el) return;
    scrolledRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Preview toggle — defaults to Proposed: that's what's being judged (§5.2).
  const [previewSide, setPreviewSide] = useState<"live" | "proposed">(
    "proposed"
  );
  const [confirming, setConfirming] = useState(false);

  const update = mounted ? profileUpdate : null;
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";
  const firstName = draft.firstName || "the mentor";

  const noteCount = update
    ? update.fields.filter((f) => notes[f.fieldId]?.trim()).length
    : 0;
  const hasNotes = noteCount > 0;

  const approve = () => {
    approveProfileUpdate();
    setConfirming(false);
    toast("Published — teens now see the updated profile.");
    router.push(returnHref);
  };

  const sendBack = () => {
    if (!hasNotes) return;
    sendBackProfileUpdate(notes);
    toast(
      `Sent back with ${noteCount} note${noteCount === 1 ? "" : "s"} for ${firstName}.`
    );
    router.push(returnHref);
  };

  return (
    <AdminShell active="mentors">
      <div className="px-6 py-6 lg:px-10">
        <Link
          href={returnHref}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {fromRecord ? "Back to profile" : "Users"}
        </Link>

        {!update ? (
          <div className="mt-10 max-w-md">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Nothing to review
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              No profile updates waiting right now.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* LEFT — the delta */}
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Profile update · submitted {relTime(update.submittedAt).toLowerCase()}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
                Review {mentorName}&apos;s changes
              </h1>
              <p className="mt-2 max-w-prose text-sm text-[var(--text-secondary)]">
                Only the changed fields are shown — teens keep seeing the live
                profile until you approve. Notes go to {firstName} tied to that
                field.
              </p>

              <div className="mt-6 space-y-3">
                {update.fields.map((f) => {
                  const meta = gatedFieldMeta(f.fieldId);
                  const proposed = (
                    draft as unknown as Record<string, unknown>
                  )[f.fieldId];
                  const isFlagged = !!notes[f.fieldId]?.trim();
                  const isOpen = open[f.fieldId] || isFlagged;
                  const waiting = f.fieldStatus === "changes-requested";
                  return (
                    <div
                      key={f.fieldId}
                      data-diff-field={f.fieldId}
                      className={cn(
                        "rounded-2xl border bg-white p-4 transition-colors",
                        isFlagged
                          ? "border-orange-300 ring-1 ring-orange-200"
                          : "border-[var(--border-subtle)]",
                        waiting && !isFlagged && "opacity-70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                            {SURFACE_LABEL[meta?.surface ?? ""] ?? "Profile"}
                          </p>
                          <p className="font-display font-bold tracking-tight text-[var(--text-primary)]">
                            {meta?.label ?? f.fieldId}
                          </p>
                        </div>
                        <Button
                          variant={isOpen ? "secondary" : "outline"}
                          size="sm"
                          className="min-h-9 shrink-0"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setOpen((o) => ({ ...o, [f.fieldId]: !isOpen }))
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

                      {/* Shared diff presentation (components/review/diff-card
                          — record-03): the record's hub renders the SAME rows. */}
                      <LiveProposedGrid
                        fieldId={f.fieldId}
                        live={f.liveValue}
                        proposed={proposed}
                      />

                      {waiting && f.adminNote && (
                        <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-[13px] leading-[18px] text-orange-900">
                          Sent to {firstName}: {f.adminNote}
                        </p>
                      )}

                      {isOpen && (
                        <div className="mt-3">
                          <label
                            htmlFor={`pu-note-${f.fieldId}`}
                            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Note to {firstName} · {meta?.label ?? f.fieldId}
                          </label>
                          <Textarea
                            id={`pu-note-${f.fieldId}`}
                            value={notes[f.fieldId] ?? ""}
                            onChange={(e) =>
                              setNotes((n) => ({
                                ...n,
                                [f.fieldId]: e.target.value,
                              }))
                            }
                            placeholder="What should they change here?"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Verdicts (§5.2). Approve publishes EVERYTHING in the
                  changeset — all-or-nothing v1. */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  variant={hasNotes ? "secondary" : "default"}
                  onClick={() => setConfirming(true)}
                >
                  <Check className="size-4" />
                  Approve and publish
                </Button>
                <Button
                  size="lg"
                  variant={hasNotes ? "default" : "secondary"}
                  onClick={sendBack}
                  disabled={!hasNotes}
                >
                  Send back with notes
                </Button>
                {hasNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotes({});
                      setOpen({});
                    }}
                    className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]"
                  >
                    Clear notes
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT — preview with Live|Proposed toggle (default Proposed).
                Segmented control is an interim treatment (gaps.md #46). */}
            <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
              <div
                role="group"
                aria-label="Preview version"
                className="flex rounded-full border border-[var(--border-subtle)] bg-white p-1"
              >
                {(["live", "proposed"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={previewSide === side}
                    onClick={() => setPreviewSide(side)}
                    className={cn(
                      "min-h-9 rounded-full px-4 text-sm font-medium capitalize transition-colors",
                      previewSide === side
                        ? "bg-foreground text-background"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {side}
                  </button>
                ))}
              </div>
              <PhoneFrame>
                <MentorProfilePreview
                  draft={
                    previewSide === "live" && publishedSnapshot
                      ? publishedSnapshot
                      : draft
                  }
                />
              </PhoneFrame>
              <p className="text-xs text-[var(--text-muted)]">
                {previewSide === "live"
                  ? "What teens see right now"
                  : "What teens will see after approval"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* §6 confirm — publishing is immediate and teen-visible. */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Publish these changes?</DialogTitle>
            <DialogDescription>
              Teens will see the updated profile right away.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button className="min-h-11" onClick={approve}>
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
