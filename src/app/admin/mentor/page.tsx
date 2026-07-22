"use client";

// Mentor Record (record-02 shell) — the staff-facing record for THE one
// store-backed mentor. Composed ONLY from already-reusable pieces: the
// passive previews (prop-fed, invariant 1), PROFILE_SECTIONS registry
// summaries, EditRow's locked read state, and the update-review chips.
// STRICTLY READ-ONLY this pass: nothing here calls gated saves, dirty
// guards, or any mentor-facing store action (invariant 2) — the overflow
// actions are stub dialogs until R4.
//
// Section visibility comes from lib/record/permission-map.ts via
// resolveMode — hidden sections genuinely do not render (no wrapper, no
// heading). Next 16 notes (invariant 5): use(searchParams) prop pattern,
// no page-root <Suspense>, store reads mounted-gated.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { EditRow } from "@/components/settings/edit-row";
import { PillButton } from "@/components/settings/pill-button";
import {
  ChangesRequestedChip,
  InReviewChip,
} from "@/components/profile-editor/update-review-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { sectionsForTab } from "@/lib/onboarding/profile-sections";
import {
  RECORD_SECTION_ORDER,
  resolveMode,
  type RecordSectionSlot,
} from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";
import type { MentorDraft, ProfileUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

// Membership record placeholders — mirrors account-editor's MEMBERSHIP_GROUPS
// and established-mentor join date (R4 centralizes; duplicating here keeps
// this pass free of editor-file diffs per record-02 acceptance).
const MEMBERSHIP_GROUPS = ["North Carolina", "New Jersey"];
const JOIN_DATE = "March 25, 2026";

// ?focus= values → record section slots (roster Review CTA sends "review").
const FOCUS_TO_SLOT: Record<string, RecordSectionSlot> = {
  review: "reviewWorkflow",
};

const SLOT_TITLES: Record<RecordSectionSlot, string> = {
  reviewWorkflow: "Review workflow",
  matchingProfile: "Matching profile",
  firstMoments: "First moments",
  schedule: "Schedule",
  account: "Account",
  internalNotes: "Internal notes",
  relationships: "Relationships",
};

/** Read-only chrome chip for a field that sits in the open changeset. */
function changesetChip(update: ProfileUpdate | null, fieldId: string) {
  const f = update?.fields.find((x) => x.fieldId === fieldId);
  if (!f) return undefined;
  return f.fieldStatus === "changes-requested" ? (
    <ChangesRequestedChip />
  ) : (
    <InReviewChip />
  );
}

/** Locked EditRow as a record read row — label + current value, no
 *  affordances (the shared component's locked state renders no Edit). */
function ReadRow({
  label,
  value,
  chip,
}: {
  label: string;
  value: React.ReactNode;
  chip?: React.ReactNode;
}) {
  return (
    <EditRow
      label={label}
      value={value}
      chip={chip}
      state="read"
      locked
      onEditStart={() => {}}
      onCancel={() => {}}
    />
  );
}

function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
      {children}
    </div>
  );
}

function SectionShell({
  slot,
  children,
}: {
  slot: RecordSectionSlot;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={SLOT_TITLES[slot]} data-record-section={slot}>
      <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        {SLOT_TITLES[slot]}
      </h2>
      {children}
    </section>
  );
}

function PlaceholderSection({ slot }: { slot: RecordSectionSlot }) {
  return (
    <SectionShell slot={slot}>
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Lands in a later pass.
        </p>
      </div>
    </SectionShell>
  );
}

export default function MentorRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  const query = use(searchParams);
  const focus = typeof query.focus === "string" ? query.focus : null;

  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const publishedSnapshot = useOnboardingStore((s) => s.publishedSnapshot);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const status = useOnboardingStore((s) => s.status);
  const mentorish = persona === "mentor" || persona === "new-mentor";

  // Staff-only surface: mentor personas land on their own settings instead.
  useEffect(() => {
    if (mounted && mentorish) router.replace("/app/profile");
  }, [mounted, mentorish, router]);

  // ?focus deep link → scroll once the target section exists (one-shot ref;
  // effect stays setState-free — the project's established pattern).
  const focusSlot = focus ? (FOCUS_TO_SLOT[focus] ?? null) : null;
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!mounted || mentorish || !focusSlot || scrolledRef.current) return;
    const el = document.querySelector(`[data-record-section="${focusSlot}"]`);
    if (!el) return;
    scrolledRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  if (!mounted || mentorish) {
    return (
      <AdminShell active="users">
        <div className="min-h-dvh" />
      </AdminShell>
    );
  }

  // The record shows the mentor AS TEENS SEE THEM: the published snapshot
  // when one exists, the live draft otherwise — the same data choice
  // /admin/profile-update makes for its "Live" preview side. Passive always.
  const live: MentorDraft = publishedSnapshot ?? draft;

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";
  const firstName = draft.firstName || "Jordan";
  const goesBy =
    draft.displayName.trim() &&
    draft.displayName.trim() !== draft.firstName.trim()
      ? draft.displayName.trim()
      : null;
  const deactivated = accountStatus === "deactivated";
  // Pre-publish "submitted for review" — the only state with a primary CTA.
  const submittedForReview = status === "in_review";
  // Destructive account actions are supervisor powers (accountOrg: edit).
  const canActOnAccount = resolveMode("accountOrg", persona) === "edit";

  const scrollToReview = () =>
    document
      .querySelector('[data-record-section="reviewWorkflow"]')
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ── Section renderers (this pass: two live, five placeholders) ──────────
  const renderSection = (slot: RecordSectionSlot): React.ReactNode => {
    // "account" is a render group over the two account permission rows —
    // hidden only if BOTH halves are hidden (see permission-map.ts).
    const hidden =
      slot === "account"
        ? resolveMode("accountSelfService", persona) === "hidden" &&
          resolveMode("accountOrg", persona) === "hidden"
        : resolveMode(slot, persona) === "hidden";
    if (hidden) return null; // genuinely absent — no wrapper, no heading

    if (slot === "matchingProfile") {
      const matchCard = sectionsForTab("profile").filter(
        (s) => s.group === "match-card"
      );
      const chat = sectionsForTab("profile").filter((s) => s.group === "chat");
      return (
        <SectionShell key={slot} slot={slot}>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[12px] font-medium uppercase leading-[16px] tracking-[0.3px] text-[var(--text-secondary)]">
                Match card
              </p>
              <RowCard>
                {matchCard.map((s) => (
                  <ReadRow
                    key={s.step}
                    label={s.label}
                    value={s.summary(live)}
                    chip={changesetChip(profileUpdate, s.fieldKey)}
                  />
                ))}
              </RowCard>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-medium uppercase leading-[16px] tracking-[0.3px] text-[var(--text-secondary)]">
                Chat
              </p>
              <RowCard>
                {chat.map((s) => (
                  <ReadRow
                    key={s.step}
                    label={s.label}
                    value={s.summary(live)}
                    chip={changesetChip(profileUpdate, s.fieldKey)}
                  />
                ))}
              </RowCard>
            </div>
          </div>
        </SectionShell>
      );
    }

    if (slot === "firstMoments") {
      return (
        <SectionShell key={slot} slot={slot}>
          <RowCard>
            {sectionsForTab("first-moments").map((s) => (
              <ReadRow
                key={s.step}
                label={s.label}
                value={s.summary(live)}
                chip={changesetChip(profileUpdate, s.fieldKey)}
              />
            ))}
          </RowCard>
        </SectionShell>
      );
    }

    return <PlaceholderSection key={slot} slot={slot} />;
  };

  return (
    <AdminShell active="users">
      <div className="px-6 py-6 lg:px-10">
        <Link
          href="/admin/users"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Users
        </Link>

        <div className="mt-4 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* LEFT — identity header + gated sections */}
          <div className="min-w-0">
            {resolveMode("identity", persona) !== "hidden" && (
              <header className="flex flex-wrap items-start gap-4">
                {live.accountPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={live.accountPhoto}
                    alt=""
                    className="size-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg font-bold text-secondary-foreground"
                  >
                    {firstName.trim().charAt(0).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="font-display text-2xl font-bold tracking-tight">
                      {mentorName}
                    </h1>
                    {/* Subject's role — the users-table Role chip treatment. */}
                    <span className="rounded-full border border-[#7b5bd6]/40 px-2.5 py-0.5 text-xs font-medium text-[#5b41a8]">
                      Mentor
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        deactivated
                          ? "bg-muted text-[var(--text-secondary)]"
                          : "bg-foreground text-background"
                      )}
                    >
                      {deactivated ? "Inactive" : "Active"}
                    </span>
                  </div>
                  {goesBy && (
                    <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--text-secondary)]">
                      goes by &ldquo;{goesBy}&rdquo;
                      {live.pronouns.length > 0 &&
                        ` · ${live.pronouns.join(" · ")}`}
                    </p>
                  )}
                  {!goesBy && live.pronouns.length > 0 && (
                    <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--text-secondary)]">
                      {live.pronouns.join(" · ")}
                    </p>
                  )}
                  <p className="mt-1 text-[12px] leading-[16px] text-[var(--text-muted)]">
                    {MEMBERSHIP_GROUPS.join(", ")} · Joined {JOIN_DATE}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {submittedForReview && (
                    <PillButton onClick={scrollToReview}>
                      Review profile
                    </PillButton>
                  )}
                  {canActOnAccount && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="More actions"
                          className="flex size-11 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
                        >
                          <MoreHorizontal className="size-5" aria-hidden />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-1.5">
                        <button
                          type="button"
                          onClick={() => setDeactivateOpen(true)}
                          className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--state-error)] transition-colors hover:bg-black/[0.04]"
                        >
                          Deactivate mentor
                        </button>
                        <button
                          type="button"
                          onClick={() => setUnpublishOpen(true)}
                          className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--state-error)] transition-colors hover:bg-black/[0.04]"
                        >
                          Unpublish profile
                        </button>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </header>
            )}

            <div className="mt-8 space-y-7">
              {RECORD_SECTION_ORDER.map(renderSection)}
            </div>
          </div>

          {/* RIGHT — passive preview of what teens see right now */}
          <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
            <PhonePreviewShell label="Live preview — what teens see on the match card">
              <MentorProfilePreview draft={live} />
            </PhonePreviewShell>
            <p className="text-xs text-[var(--text-muted)]">
              What teens see right now
            </p>
          </div>
        </div>
      </div>

      {/* Stub confirmations (record-02) — consequence copy is real (the
          deactivate copy is lifted from the settings Roles & permissions
          zone); the actions wire up in R4. */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate {mentorName}?</DialogTitle>
            <DialogDescription>
              They&apos;ll be removed from matching right away, and teens
              won&apos;t see their profile. Active mentorships are paused, not
              ended. You can reactivate them later — nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
            Prototype: this action isn&apos;t wired yet.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setDeactivateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => setDeactivateOpen(false)}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unpublish {firstName}&apos;s profile?</DialogTitle>
            <DialogDescription>
              Teens won&apos;t see {firstName} in matching until the profile
              is approved again. Their content isn&apos;t deleted — it goes
              back into review.
            </DialogDescription>
          </DialogHeader>
          <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
            Prototype: this action isn&apos;t wired yet.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setUnpublishOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => setUnpublishOpen(false)}
            >
              Unpublish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
