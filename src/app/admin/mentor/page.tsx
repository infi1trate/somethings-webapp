"use client";

// Mentor Record (record-02 shell) — the staff-facing record for THE one
// store-backed mentor. Composed ONLY from already-reusable pieces: the
// passive previews (prop-fed, invariant 1), PROFILE_SECTIONS registry
// summaries, EditRow's locked read state, and the update-review chips.
// STRICTLY READ-ONLY: nothing here calls gated saves, dirty guards, or any
// mentor-facing store action (invariant 2) — the overflow actions are stub
// dialogs until R4, and record-03's review hub links into the EXISTING
// consoles (both consoles' composers are page-inline, not mountable
// components — deep links with ?from=record return nav, not embedding).
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
import { ChangeStateBadge } from "@/components/onboarding/change-row";
import { LiveProposedGrid } from "@/components/review/diff-card";
import {
  addressedStateOf,
  changeProgress,
} from "@/lib/onboarding/change-requests";
import {
  changesetSummary,
  gatedFieldMeta,
  relTime,
} from "@/lib/onboarding/profile-update";
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
import { saveAccountField } from "@/lib/mock-api";
import { PhotoRowCore } from "@/components/account/photo-row";
import { auditLineFor } from "@/lib/record/account-fields";
import {
  sectionsForTab,
  type ProfileSection,
} from "@/lib/onboarding/profile-sections";
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
  action,
}: {
  label: string;
  value: React.ReactNode;
  chip?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <EditRow
      label={label}
      value={value}
      chip={chip}
      secondaryAction={action}
      state="read"
      locked
      onEditStart={() => {}}
      onCancel={() => {}}
    />
  );
}

/** The staff "Request change" link — DiscardChange's link treatment. */
function requestChangeAction(href: string | null) {
  if (!href) return undefined;
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
    >
      Request change
    </Link>
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
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const activity = useOnboardingStore((s) => s.activity);
  const staffEditAccountField = useOnboardingStore(
    (s) => s.staffEditAccountField
  );
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const mentorish = persona === "mentor" || persona === "new-mentor";
  // One editing row at a time on the record's account section (no guard
  // dialog — each row saves or cancels explicitly before switching).
  const [accountEditing, setAccountEditing] = useState<string | null>(null);
  // Post-publish lane: the record mirrors /admin/profile-update's preview
  // toggle; "proposed" swaps the right-side phone to the working draft.
  const [previewSide, setPreviewSide] = useState<"live" | "proposed">("live");

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

  // Review lanes (mutually exclusive by construction): the pre-publish
  // submission loop only exists before a snapshot; the post-publish changeset
  // only exists after one.
  const preLane =
    !publishedSnapshot && (status === "in_review" || status === "rejected");
  const postLane = profileUpdate !== null;
  const reviewMode = resolveMode("reviewWorkflow", persona) === "review";
  const previewDraft: MentorDraft =
    postLane && previewSide === "proposed" ? draft : live;

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
  // Account rows: staff-editable for supervisors, read for leads.
  const accountMode: "edit" | "read" =
    resolveMode("accountSelfService", persona) === "edit" ? "edit" : "read";
  const staffActor = persona === "supervisor" ? "Supervisor" : "Lead mentor";
  // The record-scoped save (invariant 2): mock latency/failure, then the
  // staff write path — draft/staffPhoto update + staff-attributed activity.
  const staffSave =
    (fieldId: string) =>
    async (value: unknown): Promise<boolean> => {
      const res = await saveAccountField(fieldId, value);
      if (!res.ok) return false;
      staffEditAccountField(fieldId, value, staffActor);
      return true;
    };

  // Per-field "Request change" (review mode only) — a LINK into whichever
  // EXISTING composer currently serves that field (invariants 2/3/4: no new
  // mechanics, keys straight from PROFILE_SECTIONS, baselines captured where
  // they're captured today). No serving flow → no affordance.
  const requestChangeHref = (section: ProfileSection): string | null => {
    if (!reviewMode) return null;
    if (preLane) return `/admin/review?from=record&focus=${section.step}`;
    if (postLane && profileUpdate?.fields.some((f) => f.fieldId === section.fieldKey))
      return `/admin/profile-update?from=record&focus=${section.fieldKey}`;
    return null;
  };

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

    if (slot === "reviewWorkflow") {
      const linkCls =
        "inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
      return (
        <SectionShell key={slot} slot={slot}>
          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
            {preLane ? (
              // ── Pre-publish lane: the submission loop. The full composer
              // stays in /admin/review (its section list + composer are
              // page-inline, not mountable components — so this deep-links
              // with return nav rather than embedding; see record-03 notes).
              <div className="space-y-3">
                <p className="text-[15px] leading-[20px] text-[var(--text-primary)]">
                  {status === "in_review"
                    ? "Submitted for review — waiting on the team."
                    : "Changes requested — waiting on the mentor."}
                </p>
                {status === "rejected" && changeRequests.length > 0 && (
                  <>
                    <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
                      {(() => {
                        const p = changeProgress(changeRequests, draft);
                        return `${p.addressed} of ${p.total} addressed`;
                      })()}
                    </p>
                    <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-white">
                      {changeRequests.map((req) => (
                        <li
                          key={req.id}
                          className="flex items-start justify-between gap-3 px-3.5 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium leading-[18px] text-[var(--text-primary)]">
                              {req.sectionLabel}
                            </span>
                            <span className="block text-[13px] leading-[18px] text-[var(--text-secondary)]">
                              {req.note}
                            </span>
                          </span>
                          <ChangeStateBadge
                            state={addressedStateOf(req, draft)}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {reviewMode && (
                  <Link href="/admin/review?from=record" className={linkCls}>
                    {status === "in_review"
                      ? "Open review console"
                      : "View in review console"}
                  </Link>
                )}
              </div>
            ) : postLane && profileUpdate ? (
              // ── Post-publish lane: the changeset delta, rendered with the
              // SAME shared diff rows /admin/profile-update uses. Verdicts
              // (approve / send back) stay in the full console — deep link
              // with return nav.
              <div className="space-y-3">
                <p className="text-[15px] leading-[20px] text-[var(--text-primary)]">
                  {changesetSummary(profileUpdate)} ·{" "}
                  {profileUpdate.fields.length} change
                  {profileUpdate.fields.length === 1 ? "" : "s"}
                  <span className="text-[12px] text-[var(--text-muted)]">
                    {" "}
                    · submitted {relTime(profileUpdate.submittedAt).toLowerCase()}
                  </span>
                </p>
                <div className="space-y-2.5">
                  {profileUpdate.fields.map((f) => {
                    const proposed = (
                      draft as unknown as Record<string, unknown>
                    )[f.fieldId];
                    return (
                      <div
                        key={f.fieldId}
                        className="rounded-xl border border-[var(--border-subtle)] bg-white p-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-display text-[15px] font-bold leading-[22px] text-[var(--text-primary)]">
                            {gatedFieldMeta(f.fieldId)?.label ?? f.fieldId}
                          </p>
                          {f.fieldStatus === "changes-requested" ? (
                            <ChangesRequestedChip />
                          ) : (
                            <InReviewChip />
                          )}
                        </div>
                        <LiveProposedGrid
                          fieldId={f.fieldId}
                          live={f.liveValue}
                          proposed={proposed}
                        />
                        {f.fieldStatus === "changes-requested" &&
                          f.adminNote && (
                            <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-[13px] leading-[18px] text-orange-900">
                              Sent to {firstName}: {f.adminNote}
                            </p>
                          )}
                      </div>
                    );
                  })}
                </div>
                {reviewMode && (
                  <Link
                    href="/admin/profile-update?from=record"
                    className={linkCls}
                  >
                    Open full review
                  </Link>
                )}
              </div>
            ) : (
              // ── Neither lane active (§ record-03 empty state).
              <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
                {publishedSnapshot
                  ? "No open requests. This profile is live and current."
                  : "Nothing to review yet — this profile hasn't been submitted."}
              </p>
            )}
          </div>
        </SectionShell>
      );
    }

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
                    action={requestChangeAction(requestChangeHref(s))}
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
                    action={requestChangeAction(requestChangeHref(s))}
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
                action={requestChangeAction(requestChangeHref(s))}
              />
            ))}
          </RowCard>
        </SectionShell>
      );
    }

    if (slot === "account") {
      return (
        <SectionShell key={slot} slot={slot}>
          <div className="space-y-4">
            <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
              <PhotoRowCore
                value={staffPhoto}
                initial={firstName.trim().charAt(0).toUpperCase()}
                mode={accountMode}
                hint={auditLineFor(activity, "staffPhoto") ?? undefined}
                editing={accountEditing === "photo"}
                onEditStart={() => setAccountEditing("photo")}
                onClose={() => setAccountEditing(null)}
                onSave={async (pending) => {
                  const ok = await staffSave("staffPhoto")(pending);
                  return ok;
                }}
              />
            </div>
            {/* Identity + contact rows land in record-04a commits 2–3. */}
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
              <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
                Identity and contact rows land in the next passes.
              </p>
            </div>
          </div>
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

          {/* RIGHT — passive preview. Post-publish changesets add the
              Live|Proposed toggle (mirrors /admin/profile-update); it swaps
              the phone's data source, never adds editing (invariant 1). */}
          <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
            {postLane && (
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
            )}
            <PhonePreviewShell label="Live preview — what teens see on the match card">
              <MentorProfilePreview draft={previewDraft} />
            </PhonePreviewShell>
            <p className="text-xs text-[var(--text-muted)]">
              {postLane && previewSide === "proposed"
                ? "What teens will see after approval"
                : "What teens see right now"}
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
