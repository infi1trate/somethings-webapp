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
//
// Phase 1 (structure): three zones — identity header (display-scale name,
// true status only, one primary action), text tabs driven by
// lib/record/tabs.ts (?tab= in the URL, per-tab scroll memory), and a right
// utility rail (Preview / Notes / Activity segments, contextual default).
//
// Phases 2–3 (visual language + edit legibility): typography for attributes
// of a person, containers for collections of objects. Person attributes are
// OPEN RecordRow runs under bare 16px headings — hairline dividers only, no
// boxes; collections (notes, diff cards, relationship entries) keep their
// card treatment. Restraint: ONE filled button on the page (header Message),
// max two pill families (dark status + review orange), no drop shadows
// (phone-frame chrome excepted — shared preview, see gaps.md #81). Three
// affordances: Edit (pencil), Request change (corner-up-right, existing flow
// or clearly-stubbed), lock badge with a why. Roles hide affordances only.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CornerUpRight,
  EyeOff,
  MapPin,
  MoreHorizontal,
  UserRound,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import {
  displayOrEmpty,
  RecordRow,
  ROW_LINK,
} from "@/components/record/row";
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
import { StaffFieldRow } from "@/components/account/field-rows";
import {
  accountFieldLabel,
  auditLineFor,
  formatDob,
} from "@/lib/record/account-fields";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RACE_OPTIONS, SEX_OPTIONS } from "@/lib/options";
import {
  OrganizationCard,
  JOIN_DATE,
  MEMBERSHIP_GROUPS,
} from "@/components/record/organization";
import { toast } from "sonner";
import {
  sectionsForTab,
  type ProfileSection,
} from "@/lib/onboarding/profile-sections";
import {
  resolveMode,
  type RecordSectionSlot,
} from "@/lib/record/permission-map";
import {
  BUILT_RECORD_TABS,
  FOCUS_TO_TAB,
  railDefaultFor,
} from "@/lib/record/tabs";
import { useMounted } from "@/lib/use-mounted";
import type { ActivityItem, MentorDraft, ProfileUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

// Membership placeholders — centralized in components/record/organization
// (record-04b did the R4 centralization). ?focus= deep links map to tabs in
// lib/record/tabs.ts (FOCUS_TO_TAB) since Phase 1.

// Stub org data (record-05): the record's one mentor has four active
// mentees. Single source for the header capacity item, the Overview
// snapshot, and the Relationships row.
const MENTEE_COUNT = 4;

// Jump-link treatment shared by the record's "go somewhere else" links
// (DiscardChange's link anatomy — same as requestChangeAction).
const JUMP_LINK =
  "inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

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

/** Hairline dividers between open rows — the ONLY separation person
 *  attributes get (no boxes). --border-subtle measures ~1.1:1 against s1
 *  (fails the 3:1 non-text minimum this page is held to), so rows use
 *  --icon-tertiary (#8a8275, ≥3:1) as an interim until a --border-strong
 *  token exists (gaps.md #79). */
const DIVIDERS = "divide-y divide-[color:var(--icon-tertiary)]";

/** Read-only record row: label + value, optional review chip and a
 *  Phase 3 affordance node on the right. */
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
    <RecordRow
      label={label}
      value={displayOrEmpty(value)}
      chip={chip}
      secondaryAction={action}
      state="read"
      locked
      onEditStart={() => {}}
      onCancel={() => {}}
    />
  );
}

function SectionShell({
  slot,
  helper,
  children,
}: {
  slot: RecordSectionSlot;
  /** One-line clarifier under the heading (muted 12px) — optional. */
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={SLOT_TITLES[slot]} data-record-section={slot}>
      {/* Bare typographic heading — 16px. Spec asks medium weight; Avantt
          ships Bold only (gaps.md #12), so this is 700 like --type-title-sm. */}
      <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        {SLOT_TITLES[slot]}
      </h2>
      {helper && (
        <p className="mt-1 text-[12px] leading-[16px] text-[var(--text-muted)]">
          {helper}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </section>
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
  const internalNotes = useOnboardingStore((s) => s.internalNotes);
  const addInternalNote = useOnboardingStore((s) => s.addInternalNote);
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  const setProfileHidden = useOnboardingStore((s) => s.setProfileHidden);
  const slots = useOnboardingStore((s) => s.slots);
  const mentorish = persona === "mentor" || persona === "new-mentor";
  // One editing row at a time on the record's account section (no guard
  // dialog — each row saves or cancels explicitly before switching).
  const [accountEditing, setAccountEditing] = useState<string | null>(null);
  // Post-publish lane: the record mirrors /admin/profile-update's preview
  // toggle; "proposed" swaps the rail phone to the working draft.
  const [previewSide, setPreviewSide] = useState<"live" | "proposed">("live");

  // Staff-only surface: mentor personas land on their own settings instead.
  useEffect(() => {
    if (mounted && mentorish) router.replace("/app/profile");
  }, [mounted, mentorish, router]);

  // ── Tabs (Phase 1) ────────────────────────────────────────────────────
  // The active tab lives in the URL (?tab=, mirroring settings) so record
  // views are shareable. ?focus= deep links (roster CTA, shell avatars) map
  // to tabs via FOCUS_TO_TAB. Derived from the query, never state.
  const tabParam = typeof query.tab === "string" ? query.tab : null;
  const focusTab = focus ? (FOCUS_TO_TAB[focus] ?? null) : null;
  const activeTab =
    tabParam && BUILT_RECORD_TABS.some((t) => t.id === tabParam)
      ? tabParam
      : (focusTab ?? "overview");

  // Per-tab scroll memory: each tab remembers its position in the shell's
  // inner scroller and restores it on return. {scroll:false} on the push
  // keeps the router's own scroll reset out of the way (the reset is what
  // defeated naive scrolls in record-03).
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollMemRef = useRef<Record<string, number>>({});
  const prevTabRef = useRef(activeTab);
  // Rail segment override — null means "the tab's contextual default";
  // switching tabs clears it so each tab lands on its own default.
  const [railChoice, setRailChoice] = useState<
    "preview" | "notes" | "activity" | null
  >(null);

  const getScroller = () =>
    (containerRef.current?.closest(".overflow-y-auto") as HTMLElement | null) ??
    null;

  const switchTab = (id: string) => {
    if (id === activeTab) return;
    const scroller = getScroller();
    scrollMemRef.current[activeTab] = scroller
      ? scroller.scrollTop
      : window.scrollY;
    setRailChoice(null);
    router.push(`/admin/mentor?tab=${id}`, { scroll: false });
  };

  // Restore runs post-render whenever the tab actually changed (guarded —
  // DOM write only, no setState; the project's established effect shape).
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    const remembered = scrollMemRef.current[activeTab] ?? 0;
    const scroller = getScroller();
    if (scroller) scroller.scrollTop = remembered;
    else window.scrollTo(0, remembered);
  });

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const setAccountStatus = useOnboardingStore((s) => s.setAccountStatus);

  if (!mounted || mentorish) {
    return (
      <AdminShell active="users">
        <div className="px-6 py-6 lg:px-10" aria-busy="true" aria-label="Loading mentor record">
          <div className="mt-1 flex items-start gap-4">
            <div className="size-17 shrink-0 animate-pulse rounded-2xl bg-muted/40" />
            <div className="flex-1 space-y-2 pt-1.5">
              <div className="h-8 w-72 animate-pulse rounded-md bg-muted/40" />
              <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>
          <div className="mt-6 flex gap-6 border-b border-[var(--border-subtle)] pb-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-16 animate-pulse rounded-md bg-muted/40" />
            ))}
          </div>
          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-7">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <div className="mb-2 h-5 w-40 animate-pulse rounded-md bg-muted/40" />
                  <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-muted/40" />
                </div>
              ))}
            </div>
            <div>
              <div className="mx-auto h-7 w-44 animate-pulse rounded-full bg-muted/40" />
              <div className="mt-3 h-[420px] animate-pulse rounded-[var(--radius-card)] bg-muted/40" />
            </div>
          </div>
        </div>
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
  // Empty-avatar letterform: first + last initials on a brand tint.
  const initials = (
    (draft.firstName.trim().charAt(0) || "J") +
    (draft.lastName.trim().charAt(0) || "R")
  ).toUpperCase();
  const goesBy =
    draft.displayName.trim() &&
    draft.displayName.trim() !== draft.firstName.trim()
      ? draft.displayName.trim()
      : null;
  const deactivated = accountStatus === "deactivated";
  // Pre-publish "submitted for review" — feeds the overflow's Review entry.
  const submittedForReview = status === "in_review";
  // Open change requests → the banner under the header (Phase 2). The two
  // lanes are mutually exclusive by construction.
  const openRequestCount =
    preLane && status === "rejected"
      ? changeRequests.length
      : (profileUpdate?.fields.filter(
          (f) => f.fieldStatus === "changes-requested"
        ).length ?? 0);
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

  // Per-field "Request change" — a LINK into whichever EXISTING composer
  // currently serves that field (invariants 2/3/4: no new mechanics, keys
  // straight from PROFILE_SECTIONS, baselines captured where they're
  // captured today). Null = no serving flow right now.
  const requestChangeHref = (section: ProfileSection): string | null => {
    if (preLane) return `/admin/review?from=record&focus=${section.step}`;
    if (postLane && profileUpdate?.fields.some((f) => f.fieldId === section.fieldKey))
      return `/admin/profile-update?from=record&focus=${section.fieldKey}`;
    return null;
  };

  // Phase 3: review-mediated fields ALWAYS show the same affordance (same
  // field → same affordance everywhere); role gating hides it for non-review
  // viewers at the call site. When no lane can serve the field the link is a
  // clearly-marked stub — staff-initiated change requests don't exist in
  // this prototype (the composers only serve open submissions, record-03).
  // TODO(record-p3): replace the stub with a real staff-initiated
  // change-request flow when one exists (gaps.md #81).
  const proposeAction = (section: ProfileSection): React.ReactNode => {
    if (!reviewMode) return undefined; // role-gated: affordance hides only
    const href = requestChangeHref(section);
    if (href) {
      return (
        <Link href={href} className={ROW_LINK}>
          <CornerUpRight className="size-3.5" aria-hidden />
          Request change
        </Link>
      );
    }
    return (
      <button
        type="button"
        className={ROW_LINK}
        onClick={() =>
          toast("Staff-started change requests aren't built yet.")
        }
      >
        <CornerUpRight className="size-3.5" aria-hidden />
        Request change
      </button>
    );
  };

  // ── Right rail (Phase 1) ─────────────────────────────────────────────
  // Segments the viewer can't see are genuinely absent (Lead Mentor never
  // sees a Notes segment — record-05's zero-trace rule); a hidden default
  // falls through to Activity.
  const notesVisible = resolveMode("internalNotes", persona) !== "hidden";
  const railSegments: { id: "preview" | "notes" | "activity"; label: string }[] =
    [
      { id: "preview", label: "Preview" },
      ...(notesVisible ? [{ id: "notes" as const, label: "Notes" }] : []),
      { id: "activity", label: "Activity" },
    ];
  const railDefault = (() => {
    const d = railDefaultFor(activeTab);
    return d === "notes" && !notesVisible ? ("activity" as const) : d;
  })();
  const railSegment = railChoice ?? railDefault;

  // Staff-facing wording for the rail's Activity segment — the mentor feed
  // says "The Somethings team…"; here the actor is named.
  const staffActivityText = (a: ActivityItem): string => {
    const actor = a.actor ?? "Somethings team";
    switch (a.type) {
      case "staff_account_edit":
        return `${actor} updated ${a.fieldIds
          .map(accountFieldLabel)
          .join(", ")}`;
      case "profile_unpublished":
        return `${actor} unpublished the profile`;
      case "profile_republished":
        return `${actor} republished the profile`;
      case "profile_changes_requested":
        return "Changes requested on a profile update";
      case "profile_update_live":
        return "A profile update went live";
    }
  };

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
          {/* De-boxed (Phase 2): the hub is status + links about the person;
              only the object lists inside (requests, field diffs) keep
              container treatment. */}
          <div>
            {preLane ? (
              // ── Pre-publish lane: the submission loop. The full composer
              // stays in /admin/review (its section list + composer are
              // page-inline, not mountable components — so this deep-links
              // with return nav rather than embedding; see record-03 notes).
              <div className="space-y-3">
                <p className="flex flex-wrap items-center gap-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
                  {status === "in_review" ? <InReviewChip /> : <ChangesRequestedChip />}
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
        <SectionShell
          key={slot}
          slot={slot}
          helper="Everything teens see — edits route through review"
        >
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-[12px] font-medium uppercase leading-[16px] tracking-[0.3px] text-[var(--text-secondary)]">
                Match card
              </p>
              <div className={DIVIDERS}>
                {matchCard.map((s) => (
                  <ReadRow
                    key={s.step}
                    label={s.label}
                    value={s.summary(live)}
                    chip={changesetChip(profileUpdate, s.fieldKey)}
                    action={proposeAction(s)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-medium uppercase leading-[16px] tracking-[0.3px] text-[var(--text-secondary)]">
                Chat
              </p>
              <div className={DIVIDERS}>
                {chat.map((s) => (
                  <ReadRow
                    key={s.step}
                    label={s.label}
                    value={s.summary(live)}
                    chip={changesetChip(profileUpdate, s.fieldKey)}
                    action={proposeAction(s)}
                  />
                ))}
              </div>
            </div>
          </div>
        </SectionShell>
      );
    }

    if (slot === "firstMoments") {
      return (
        <SectionShell
          key={slot}
          slot={slot}
          helper="Edits route through review"
        >
          <div className={DIVIDERS}>
            {sectionsForTab("first-moments").map((s) => (
              <ReadRow
                key={s.step}
                label={s.label}
                value={s.summary(live)}
                chip={changesetChip(profileUpdate, s.fieldKey)}
                action={proposeAction(s)}
              />
            ))}
          </div>
        </SectionShell>
      );
    }

    if (slot === "account") {
      return (
        <SectionShell
          key={slot}
          slot={slot}
          helper="Staff edits apply right away"
        >
          {/* One open run (Phase 2): photo, then identity, then contact —
              the old three-box grouping is carried by row order alone. */}
          <div className={DIVIDERS}>
            <PhotoRowCore
              value={staffPhoto}
              initial={firstName.trim().charAt(0).toUpperCase()}
              mode={accountMode}
              row={RecordRow}
              hint={auditLineFor(activity, "staffPhoto") ?? undefined}
              editing={accountEditing === "photo"}
              onEditStart={() => setAccountEditing("photo")}
              onClose={() => setAccountEditing(null)}
              onSave={async (pending) => {
                const ok = await staffSave("staffPhoto")(pending);
                return ok;
              }}
            />
            {/* Identity — LockedRow in mentor settings ("Contact support to
                change this"); the point of the record is that they unlock
                HERE, on the staff write path. */}
              <StaffFieldRow<string>
                label="First name"
                value={draft.firstName}
                display={(v) => v || "—"}
                editor={(pending, set) => (
                  <Input
                    aria-label="First name"
                    className="max-w-sm"
                    value={pending}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
                validate={(v) => v.trim().length > 0}
                onSave={staffSave("firstName")}
                mode={accountMode}
                hint={auditLineFor(activity, "firstName") ?? undefined}
                editing={accountEditing === "firstName"}
                onEditStart={() => setAccountEditing("firstName")}
                onClose={() => setAccountEditing(null)}
              />
              <StaffFieldRow<string>
                label="Last name"
                value={draft.lastName}
                display={(v) => v || "—"}
                editor={(pending, set) => (
                  <Input
                    aria-label="Last name"
                    className="max-w-sm"
                    value={pending}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
                validate={(v) => v.trim().length > 0}
                onSave={staffSave("lastName")}
                mode={accountMode}
                hint={auditLineFor(activity, "lastName") ?? undefined}
                editing={accountEditing === "lastName"}
                onEditStart={() => setAccountEditing("lastName")}
                onClose={() => setAccountEditing(null)}
              />
              <StaffFieldRow<string>
                label="Date of birth"
                value={draft.dob}
                display={(v) => formatDob(v)}
                editor={(pending, set) => (
                  <Input
                    aria-label="Date of birth"
                    type="date"
                    className="max-w-sm"
                    value={pending}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
                validate={(v) => v.trim().length > 0}
                onSave={staffSave("dob")}
                mode={accountMode}
                hint={auditLineFor(activity, "dob") ?? undefined}
                editing={accountEditing === "dob"}
                onEditStart={() => setAccountEditing("dob")}
                onClose={() => setAccountEditing(null)}
              />
              <StaffFieldRow<string>
                label="Sex"
                value={draft.sex}
                display={(v) =>
                  SEX_OPTIONS.find((o) => o.value === v)?.label ?? "—"
                }
                editor={(pending, set) => (
                  <Select value={pending} onValueChange={set}>
                    <SelectTrigger
                      aria-label="Sex"
                      className="w-full max-w-sm"
                    >
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEX_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                onSave={staffSave("sex")}
                mode={accountMode}
                hint={auditLineFor(activity, "sex") ?? undefined}
                editing={accountEditing === "sex"}
                onEditStart={() => setAccountEditing("sex")}
                onClose={() => setAccountEditing(null)}
              />
              <StaffFieldRow<string[]>
                label="Race"
                value={draft.races}
                display={(v) => (v.length ? v.join(", ") : "—")}
                editor={(pending, set) => (
                  <MultiSelectChips
                    options={RACE_OPTIONS}
                    value={pending}
                    onChange={set}
                  />
                )}
                onSave={staffSave("races")}
                mode={accountMode}
                hint={auditLineFor(activity, "races") ?? undefined}
                editing={accountEditing === "races"}
                onEditStart={() => setAccountEditing("races")}
                onClose={() => setAccountEditing(null)}
              />
            {/* Contact — the mentor-facing verification flows stay in
                settings; staff set values directly (record-scoped path). */}
              <StaffFieldRow<string>
                label="Phone number"
                value={draft.phone}
                display={(v) => v || "—"}
                editor={(pending, set) => (
                  <Input
                    aria-label="Phone number"
                    type="tel"
                    className="max-w-sm"
                    value={pending}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
                validate={(v) => v.trim().length > 0}
                onSave={staffSave("phone")}
                mode={accountMode}
                hint={auditLineFor(activity, "phone") ?? undefined}
                editing={accountEditing === "phone"}
                onEditStart={() => setAccountEditing("phone")}
                onClose={() => setAccountEditing(null)}
              />
              <StaffFieldRow<string>
                label="Email"
                value={draft.email}
                display={(v) => v || "—"}
                editor={(pending, set) => (
                  <Input
                    aria-label="Email"
                    type="email"
                    className="max-w-sm"
                    value={pending}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
                validate={(v) => v.includes("@")}
                onSave={staffSave("email")}
                mode={accountMode}
                hint={auditLineFor(activity, "email") ?? undefined}
                editing={accountEditing === "email"}
                onEditStart={() => setAccountEditing("email")}
                onClose={() => setAccountEditing(null)}
              />
          </div>
        </SectionShell>
      );
    }

    // internalNotes: no longer a section — the composer lives in the right
    // rail's Notes segment (Phase 1), content unchanged.

    if (slot === "relationships") {
      // Stub org data (record-05): rows are link-STYLED but inert — the
      // destinations don't exist in this prototype.
      const inertLink =
        "text-[15px] leading-[20px] text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-2";
      return (
        <SectionShell key={slot} slot={slot}>
          {!publishedSnapshot ? (
            // Empty state is a statement about the person — no box.
            <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Nothing here yet — relationships appear once this mentor is
              published and matched.
            </p>
          ) : (
            // A collection of people — list rows EARN their container
            // (Phase 2: containers are for collections of objects).
            <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
              <div className="px-[var(--card-pad)] py-2.5">
                <p className="text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
                  Assigned supervisor
                </p>
                <span className={inertLink}>Stephen Rowe</span>
              </div>
              <div className="px-[var(--card-pad)] py-2.5">
                <p className="text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
                  Assigned lead mentor
                </p>
                <span className={inertLink}>Brandy Forrestor</span>
              </div>
              <div className="px-[var(--card-pad)] py-2.5">
                <p className="text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
                  Active mentees
                </p>
                <p className="text-[15px] leading-[20px] text-[var(--text-primary)]">
                  {profileHidden ? "4 · matching paused while unpublished" : "4"}
                </p>
              </div>
            </div>
          )}
        </SectionShell>
      );
    }

    if (slot === "schedule") {
      return (
        <SectionShell key={slot} slot={slot}>
          <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
            Scheduling lands with the settings build — staff editing is
            planned here.
          </p>
        </SectionShell>
      );
    }

    return null;
  };

  return (
    <AdminShell active="users">
      <div ref={containerRef} className="px-6 py-6 lg:px-10">
        <Link
          href="/admin/users"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Users
        </Link>

        {/* ── Identity header (Phase 1): 68px rounded-square avatar,
            display-scale name, TRUE status only (role is context — it lives
            in the meta line, not a badge), one icon-prefixed meta line, and
            ONE filled primary (Message) with everything else in overflow. */}
        {resolveMode("identity", persona) !== "hidden" && (
          <header className="mt-4 flex flex-wrap items-start gap-4">
            {live.accountPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={live.accountPhoto}
                alt=""
                className="size-17 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-17 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-bold"
                style={{
                  // No brand ramp exists in the tokens (single --brand
                  // stop) — tint + darkest-stop letterform interims via
                  // color-mix (gaps.md #75).
                  backgroundColor:
                    "color-mix(in oklab, var(--brand) 12%, white)",
                  color: "color-mix(in oklab, var(--brand) 60%, black)",
                }}
              >
                {initials}
              </span>
            )}

            {/* basis keeps the name column readable — actions wrap below on
                narrow screens instead of squeezing the h1 to nothing. */}
            <div className="min-w-0 flex-1 basis-56">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1
                  className="text-[var(--text-primary)]"
                  style={{
                    // Proposed display stop (gaps.md #74): the type scale
                    // tops out at --type-title-lg (24/32), below the header
                    // spec — token proposed in settings-tokens.css rather
                    // than hardcoding here.
                    font: "var(--type-display)",
                    letterSpacing: "var(--type-display-tracking)",
                  }}
                >
                  {mentorName}
                </h1>
                {/* Only TRUE status earns badge weight beside the name. */}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    deactivated
                      ? "bg-muted text-[var(--text-secondary)]"
                      : profileHidden
                        ? "border border-orange-300 text-orange-700"
                        : "bg-foreground text-background"
                  )}
                >
                  {deactivated
                    ? "Inactive"
                    : profileHidden
                      ? "Unpublished"
                      : "Active"}
                </span>
              </div>
              {/* Meta line — role + context at 13px, icon-prefixed, one
                  wrapping line. Groups stand in for location (no location
                  field exists in the model — killed in the original spec). */}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0" aria-hidden />
                  Mentor
                  {goesBy && <> · goes by &ldquo;{goesBy}&rdquo;</>}
                  {live.pronouns.length > 0 && (
                    <> · {live.pronouns.join(" · ")}</>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {MEMBERSHIP_GROUPS.join(", ")}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                  Joined {JOIN_DATE}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5 shrink-0" aria-hidden />
                  {MENTEE_COUNT} of {slots.total} mentees
                </span>
                <span className="flex items-center gap-1.5">
                  <UserRoundCheck className="size-3.5 shrink-0" aria-hidden />
                  Supervised by Stephen Rowe
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* ONE filled primary — Message, the most common staff verb
                  (stub: messaging isn't part of this prototype). Everything
                  else lives in the overflow. */}
              <PillButton
                onClick={() =>
                  toast("Messaging isn't part of this prototype yet.")
                }
              >
                Message
              </PillButton>
              {(canActOnAccount || submittedForReview) && (
                <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
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
                    {submittedForReview && (
                      <button
                        type="button"
                        onClick={() => {
                          setOverflowOpen(false);
                          switchTab("overview");
                        }}
                        className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-black/[0.04]"
                      >
                        Review profile
                      </button>
                    )}
                    {canActOnAccount && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setOverflowOpen(false);
                            setDeactivateOpen(true);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-black/[0.04]",
                            deactivated
                              ? "text-[var(--text-primary)]"
                              : "text-[var(--state-error)]"
                          )}
                        >
                          {deactivated
                            ? "Reactivate mentor"
                            : "Deactivate mentor"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOverflowOpen(false);
                            setUnpublishOpen(true);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-black/[0.04]",
                            profileHidden
                              ? "text-[var(--text-primary)]"
                              : "text-[var(--state-error)]"
                          )}
                        >
                          {profileHidden
                            ? "Republish profile"
                            : "Unpublish profile"}
                        </button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </header>
        )}

        {/* ── Change-request banner (Phase 2): passive status tint from the
            review-note family (ChangeNoteCard: orange-50 fill, orange-300
            border — the component carries a border, so this does too; no
            shadow). Text at the family's darkest in-use stop, 13px. */}
        {openRequestCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3">
            <p className="text-[13px] leading-[18px] text-orange-900">
              {openRequestCount} change
              {openRequestCount === 1 ? "" : "s"} requested — waiting on the
              mentor.
            </p>
            <button
              type="button"
              onClick={() => switchTab("overview")}
              className="-my-2.5 inline-flex min-h-11 items-center rounded-sm text-[13px] font-medium leading-[18px] text-orange-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Review
            </button>
          </div>
        )}

        {/* ── Tab bar (Phase 1): text tabs on a hairline — the active tab
            carries weight + a 2px underline, no boxed chrome. Labels match
            the mentor-facing settings tabs where they overlap (registry:
            lib/record/tabs.ts; unbuilt entries render nothing). Baseline
            hairline uses --icon-tertiary for ≥3:1 (gaps.md #79). */}
        <nav
          aria-label="Record sections"
          className="mt-6 flex gap-6 overflow-x-auto border-b border-[color:var(--icon-tertiary)]"
        >
          {BUILT_RECORD_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              aria-current={activeTab === t.id ? "page" : undefined}
              className={cn(
                "-mb-px min-h-11 shrink-0 border-b-2 pb-1 text-[14px] leading-[20px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
                activeTab === t.id
                  ? "border-[var(--text-primary)] font-medium text-[var(--text-primary)]"
                  : "border-transparent font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
          {/* LEFT — the active tab's content: sections MOVED, not restyled
              (Phase 1 content mapping); gating unchanged via resolveMode
              inside each renderer. */}
          <div className="min-w-0 space-y-7">
            {activeTab === "overview" && (
              <>
                {renderSection("reviewWorkflow")}
                {/* Capacity snapshot — status + a jump link only; the
                    editable slots live on Mentorship (Overview never renders
                    an editable copy of a field that lives elsewhere). */}
                {resolveMode("accountOrg", persona) !== "hidden" && (
                  <section aria-label="Capacity" data-record-section="capacity">
                    <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
                      Capacity
                    </h2>
                    {/* An attribute snapshot — typography, no box (Phase 2). */}
                    <p className="mt-3 text-[14px] leading-[20px] text-[var(--text-primary)]">
                      {MENTEE_COUNT} of {slots.total} mentee slots filled ·{" "}
                      {slots.dailyNew} new teen
                      {slots.dailyNew === 1 ? "" : "s"} per day
                    </p>
                    <button
                      type="button"
                      onClick={() => switchTab("mentorship")}
                      className={JUMP_LINK}
                    >
                      Manage in Mentorship
                    </button>
                  </section>
                )}
                {renderSection("relationships")}
                {/* Latest-note pointer — text + a jump to the rail's Notes
                    segment; the composer itself lives only in the rail. */}
                {notesVisible && internalNotes.length > 0 && (
                  <section
                    aria-label="Latest note"
                    data-record-section="latest-note"
                  >
                    <h2 className="mb-3 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
                      Latest note
                    </h2>
                    <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
                      <p className="text-[12px] font-medium leading-[16px] text-[var(--text-muted)]">
                        {internalNotes[0].author} ·{" "}
                        {relTime(internalNotes[0].createdAt)}
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[14px] leading-[20px] text-[var(--text-primary)]">
                        {internalNotes[0].text}
                      </p>
                      <button
                        type="button"
                        onClick={() => setRailChoice("notes")}
                        className={JUMP_LINK}
                      >
                        Open notes
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
            {activeTab === "profile" && renderSection("matchingProfile")}
            {activeTab === "first-moments" && renderSection("firstMoments")}
            {activeTab === "schedule" && renderSection("schedule")}
            {activeTab === "account" && renderSection("account")}
            {activeTab === "mentorship" && (
              <>
                {resolveMode("accountOrg", persona) !== "hidden" && (
                  <section
                    aria-label="Mentorship"
                    data-record-section="mentorship"
                  >
                    <OrganizationCard
                      mode={
                        resolveMode("accountOrg", persona) === "edit"
                          ? "edit"
                          : "read"
                      }
                    />
                  </section>
                )}
                {renderSection("relationships")}
              </>
            )}
          </div>

          {/* RIGHT — utility rail (Phase 1): Preview / Notes / Activity.
              The default segment is contextual per tab (railDefaultFor),
              always user-switchable. The preview stays passive and prop-fed
              (invariant 1); post-publish changesets keep the Live|Proposed
              toggle. Stacks below the content under lg so nothing is lost
              on small screens. */}
          <aside aria-label="Record rail" className="min-w-0 lg:sticky lg:top-6">
            <div
              role="group"
              aria-label="Rail view"
              className="mx-auto flex w-fit rounded-full border border-[var(--border-subtle)] bg-white p-0.5"
            >
              {railSegments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  aria-pressed={railSegment === seg.id}
                  onClick={() => setRailChoice(seg.id)}
                  className={cn(
                    "min-h-7 rounded-full px-3 text-[11px] font-medium leading-none transition-colors",
                    railSegment === seg.id
                      ? "bg-foreground text-background"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {seg.label}
                </button>
              ))}
            </div>

            {railSegment === "preview" && (
              <div className="mt-3 flex flex-col items-center gap-3">
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
                {/* The 360px phone frame scaled into the rail; the inner box
                    is absolutely positioned so its untransformed width can't
                    widen the page (gaps.md #76). */}
                <div className="relative h-[535px] w-full">
                  <div className="absolute left-1/2 top-0 w-[360px] origin-top -translate-x-1/2 scale-[0.72]">
                    <div className="relative">
                      <PhonePreviewShell label="Live preview — what teens see on the match card">
                        <MentorProfilePreview draft={previewDraft} />
                      </PhonePreviewShell>
                      {profileHidden && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[46px] bg-[var(--surface-s1)]/70 backdrop-blur-[2px]">
                          {/* No shadow — elevation isn't part of this page's
                              language (Phase 2 restraint rules). */}
                          <span className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-s0)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
                            <EyeOff className="size-4" aria-hidden />
                            Hidden from teens
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {profileHidden
                    ? "Unpublished — teens can't see this profile right now"
                    : postLane && previewSide === "proposed"
                      ? "What teens will see after approval"
                      : "What teens see right now"}
                </p>
              </div>
            )}

            {railSegment === "notes" && notesVisible && (
              <div className="mt-3 space-y-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
                {/* The channel divider — persistent, not dismissible:
                    confusing internal notes with change requests must be
                    hard. Moved intact from the notes section (Phase 1). */}
                <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
                  Internal — visible to supervisors and admins only. Mentors
                  never see notes; use change requests for anything the mentor
                  should read.
                </p>
                <div>
                  <label
                    htmlFor="internal-note"
                    className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Add a note
                  </label>
                  <Textarea
                    id="internal-note"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Context for the next person on this record…"
                  />
                  <div className="mt-2">
                    {/* Outline — the header primary is the page's ONE filled
                        button (Phase 2 restraint rules). */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!noteDraft.trim()) return;
                        addInternalNote(noteDraft, staffActor);
                        setNoteDraft("");
                      }}
                      disabled={!noteDraft.trim()}
                      className="min-h-11 rounded-full px-5"
                    >
                      Add note
                    </Button>
                  </div>
                </div>
                {internalNotes.length === 0 ? (
                  <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
                    No notes yet. Anything written here stays internal.
                  </p>
                ) : (
                  // Deliberately NOT the change-request note treatment (no
                  // orange, no "From the review team") — author + timestamp
                  // header rows on plain white keep the channels far apart.
                  <ul className="space-y-2.5">
                    {internalNotes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-xl border border-[var(--border-subtle)] bg-white px-3.5 py-3"
                      >
                        <p className="text-[12px] font-medium leading-[16px] text-[var(--text-muted)]">
                          {n.author} · {relTime(n.createdAt)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[14px] leading-[20px] text-[var(--text-primary)]">
                          {n.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {railSegment === "activity" && (
              <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)] p-[var(--card-pad)]">
                {activity.length === 0 ? (
                  <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
                    Nothing yet — entries appear as this record changes.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {activity.map((a) => (
                      <li key={a.id}>
                        <p className="text-[12px] font-medium leading-[16px] text-[var(--text-muted)]">
                          {relTime(a.createdAt)}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--text-primary)]">
                          {staffActivityText(a)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Deactivate/reactivate (record-04b) — the REAL zone, moved from the
          settings Roles & permissions tab: same setAccountStatus round trip,
          same consequence copy + product ASSUMPTION. State-aware, reversible.
          ASSUMPTION(product): mentorships pause rather than end, and paused
          teens are flagged for reassignment after N days. Verify with ops;
          adjust body copy if wrong. */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deactivated
                ? `Reactivate ${mentorName}?`
                : `Deactivate ${mentorName}?`}
            </DialogTitle>
            <DialogDescription>
              {deactivated
                ? "They'll be matchable again right away."
                : "They'll be removed from matching right away, and teens won't see their profile. Active mentorships are paused, not ended. You can reactivate them later — nothing is deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setDeactivateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={deactivated ? "default" : "destructive"}
              className="min-h-11"
              onClick={() => {
                if (deactivated) {
                  setAccountStatus("active");
                  toast("Reactivated.");
                } else {
                  setAccountStatus(
                    "deactivated",
                    new Date().toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })
                  );
                  toast("Deactivated.");
                }
                setDeactivateOpen(false);
              }}
            >
              {deactivated ? "Reactivate" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unpublish/republish (record-05) — teen-visibility round trip; the
          entry is staff-attributed so the mentor sees WHO acted. */}
      <Dialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {profileHidden
                ? `Republish ${firstName}'s profile?`
                : `Unpublish ${firstName}'s profile?`}
            </DialogTitle>
            <DialogDescription>
              {profileHidden
                ? "Teens will see this profile in matching again right away."
                : `Teens won't see ${firstName} in matching until you publish them again. Their content isn't deleted, and current mentorships aren't touched.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setUnpublishOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={profileHidden ? "default" : "destructive"}
              className="min-h-11"
              onClick={() => {
                setProfileHidden(!profileHidden, staffActor);
                toast(profileHidden ? "Republished." : "Unpublished.");
                setUnpublishOpen(false);
              }}
            >
              {profileHidden ? "Republish" : "Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
