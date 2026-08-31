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
  EyeOff,
  MessagesSquare,
  MoreHorizontal,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { displayOrEmpty, RecordRow } from "@/components/record/row";
import { SpotifyChip } from "@/components/record/spotify-chip";
import { InterestTags, PlainTags } from "@/components/record/interest-tags";
import { SegmentedControl } from "@/components/record/segmented-control";
import { PillButton } from "@/components/settings/pill-button";
import {
  ChangesRequestedChip,
  InReviewChip,
  saveGatedWithToasts,
} from "@/components/profile-editor/update-review-bits";
// The shared First-moments row set — same component every other mentor record
// renders, so this record can't drift into its own paradigm again.
import { FirstMomentsRows } from "@/components/record/person-profile";
import { clientId } from "@/lib/files";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { PreviewTrigger } from "@/components/settings/preview-disclosure";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { saveAccountField } from "@/lib/mock-api";
import { PhotoRowCore } from "@/components/account/photo-row";
import { StaffFieldRow } from "@/components/account/field-rows";
import {
  auditLineFor,
  formatDob,
} from "@/lib/record/account-fields";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RACE_OPTIONS, SEX_OPTIONS } from "@/lib/options";
import { OrganizationCard } from "@/components/record/organization";
import {
  LEAD_PERSONA_ID,
  defaultMenteeStatus,
} from "@/lib/record/people-demo";
import { currentMenteesOf } from "@/lib/record/relationships";
import { ROLE_BADGE_TONE, ROLE_LABEL } from "@/components/record/role-label";
import { toast } from "sonner";
import {
  sectionsForTab,
  type ProfileSection,
} from "@/lib/onboarding/profile-sections";
import {
  staffActorFor,  resolveMode,
  type RecordSectionSlot,
} from "@/lib/record/permission-map";
import {
  liveLifecycle,
  STATUS_LABELS,
} from "@/lib/record/mentor-status";
import { RecordOverview } from "@/components/record/record-overview";
import { ActiveHoursEditor } from "@/components/record/active-hours";
import { StaffProfileFields } from "@/components/record/staff-profile-fields";
import { MentorshipPractice } from "@/components/record/mentorship-practice";
import { Supervision } from "@/components/record/supervision";
import {
  FOCUS_TO_TAB,
  recordTabsFor,
  subjectRoleFromParam,
} from "@/lib/record/tabs";
import { roleForPersona } from "@/components/settings/tabs-config";
import { useMounted } from "@/lib/use-mounted";
import { firstMomentStory } from "@/lib/types";
import type { MentorDraft, ProfileUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

// Membership placeholders — centralized in components/record/organization
// (record-04b did the R4 centralization). ?focus= deep links map to tabs in
// lib/record/tabs.ts (FOCUS_TO_TAB) since Phase 1.

// The mentee count is DERIVED, not stubbed — see activeMenteeCount below. The
// old `MENTEE_COUNT = 4` constant is gone: an ended match must not be counted,
// and the mentee list derives its own figure from the fixtures + the
// menteeActive overrides, so a hardcoded header number gave two different
// answers to one question on a single screen ("4 of 5 mentees" over a list
// reading "3 active").

const SLOT_TITLES: Record<RecordSectionSlot, string> = {
  reviewWorkflow: "Review workflow",
  matchingProfile: "Matching profile",
  firstMoments: "First moments",
  schedule: "Schedule",
  account: "Account",
  internalNotes: "Internal notes",
  relationships: "Relationships",
};

// Header role word by SUBJECT role (the person whose record this is). The
// status/lifecycle vocabulary is a mentor concept; for non-mentor subjects
// (dev preview only) the word still names the role honestly.
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

/** Elevated surface cards (Hybrid pass — supersedes the earlier flat, no-shadow
 *  doctrine): card tone one step lighter than the s1 canvas, 20px radius,
 *  24px horizontal / 20px vertical padding, a soft layered shadow + the 8%
 *  contour for a crisp edge. CARD_ROWS composes with the rows' own 14px rhythm
 *  (py-1.5 + 14 = 20 effective); CARD_PAD is for prose and mosaic content. */
const CARD_ROWS =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]";
const CARD_PAD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-[var(--surface-pad-y)] shadow-[var(--shadow-card)]";

/** Inset separators — ONLY inside cards with 5+ rows (fewer lean on the
 *  14px row rhythm alone). One rule: top borders on rows after the first
 *  (never bottom, never after the last, never full-bleed), inset by the
 *  card padding, square ends (the row box carries no radius — the hover
 *  highlight is a pseudo-layer), lightest border token. Decorative:
 *  redundant with spacing (supersedes the earlier ≥3:1 divider stance —
 *  visual-quality pass, Prompt 2). */
// NOT divide-y: Tailwind v4's divide-y compiles to BOTTOM borders on all
// but the last child — the spec's one rule is TOP borders on rows after
// the first, never bottom.
const INSET_DIVIDERS =
  "[&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]";

/** Read-only record row: label + value + optional review chip. Pressable
 *  (Variant A) only when onPress is provided — review-mediated rows get the
 *  console deep link when a lane serves them, Variant B otherwise. */
function ReadRow({
  label,
  value,
  chip,
  onPress,
}: {
  label: string;
  value: React.ReactNode;
  chip?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <RecordRow
      label={label}
      value={displayOrEmpty(value)}
      chip={chip}
      onPress={onPress}
      state="read"
      locked
      onEditStart={() => {}}
      onCancel={() => {}}
    />
  );
}

/** Long-form value (Bio) as a read-only field container — the "form card"
 *  treatment: a subtle boxed surface with roomy line-height. */
function BioValue({ text }: { text: string }) {
  return (
    <span
      className="block rounded-xl border border-[color:var(--border-contour)] bg-[var(--surface-s1)] px-3.5 py-2.5 text-[var(--text-primary)]"
      style={{ font: "var(--type-row-value)" }}
    >
      {text}
    </span>
  );
}

/** Persona-aware staff chrome (role migration): the Lead Mentor — the role
 *  that manages mentors — views the record inside their own mentor-app shell;
 *  the Supervisor keeps the console chrome. Same route, two rails. */
function StaffShell({
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

function SectionShell({
  slot,
  helper,
  action,
  children,
}: {
  slot: RecordSectionSlot;
  /** One-line clarifier under the heading (muted 12px) — optional. */
  helper?: string;
  /** ═══ A CONTROL ON THE HEADING'S OWN ROW, TOP-RIGHT ═══
   *
   *  Used for the teen-facing preview CTA below `lg`, where the rail that shows
   *  the preview inline is hidden. It belongs on this row rather than inside the
   *  cards below because it acts on the SECTION — "show me all of this as a teen
   *  sees it" — and because the top of the section is where a reader is before
   *  they have scrolled into the fields. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={SLOT_TITLES[slot]} data-record-section={slot}>
      {/* Bare typographic heading — 16px. Spec asks medium weight; Avantt
          ships Bold only (gaps.md #12), so this is 700 like --type-title-sm.
          The row is a flex only so `action` can sit at its right end; with no
          action the heading renders exactly as it did. */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
          {SLOT_TITLES[slot]}
        </h2>
        {action}
      </div>
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
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);
  const caseloads = useOnboardingStore((s) => s.caseloads);
  const slots = useOnboardingStore((s) => s.slots);
  const mentorGroups = useOnboardingStore((s) => s.mentorGroups);
  const menteeStatus = useOnboardingStore((s) => s.menteeStatus);
  const activity = useOnboardingStore((s) => s.activity);
  const staffEditAccountField = useOnboardingStore(
    (s) => s.staffEditAccountField
  );
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  // Notes + Activity rail tabs are deferred (rolling out later) — the store
  // fields (internalNotes / activity feed) stay; only the record UI is pulled.
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  const setProfileHidden = useOnboardingStore((s) => s.setProfileHidden);
  const mentorish = persona === "mentor" || persona === "new-mentor";
  // The Lead Mentor manages mentors (role migration) — they view this record
  // inside their own app chrome; the mount gate keeps hydration stable.
  const isLead = mounted && persona === "lead-mentor";
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

  // ── Tabs ──────────────────────────────────────────────────────────────
  // The active tab lives in the URL (?tab=, mirroring settings) so record
  // views are shareable. ?focus= deep links (roster CTA, shell avatars) map
  // to tabs via FOCUS_TO_TAB. Derived from the query, never state.
  //
  // TWO gates, kept separate (see lib/record/tabs.ts): the tab SET depends on
  // the record's SUBJECT role (existence — a supervisor record has Supervision,
  // not Mentorship) AND the VIEWER role (permission — currently no built tab is
  // viewer-gated). The dev toggle is the VIEWER; the subject defaults to
  // "mentor" (this prototype's one record) and is overridable via the dev-only
  // ?subjectRole= param to preview/verify the non-mentor subject cases.
  const subjectRole = subjectRoleFromParam(query.subjectRole);
  const visibleTabs = recordTabsFor({
    viewerRole: roleForPersona(persona),
    subjectRole,
  });
  const tabParam = typeof query.tab === "string" ? query.tab : null;
  const focusTab = focus ? (FOCUS_TO_TAB[focus] ?? null) : null;
  const activeTab =
    tabParam && visibleTabs.some((t) => t.id === tabParam)
      ? tabParam
      : (focusTab ?? "overview");

  // The teen-facing preview rail (phone + "Live to teens" panel) belongs to the
  // profile-family tabs only — it describes the teen-facing profile's
  // publication state and has no meaning beside Organization / Mentorship /
  // Account content. Every other tab spans the full width.
  const showRail = activeTab === "profile" || activeTab === "first-moments";
  /** The preview overlay below `lg`, opened from the section heading. */
  const [previewOpen, setPreviewOpen] = useState(false);
  /** THE CTA, placed by whichever section is showing. `PreviewTrigger` carries
   *  its own `lg:hidden`, so a section cannot mount it into a width where the
   *  rail is already visible. */
  const previewCta = showRail ? (
    <PreviewTrigger
      /* TODO-COPY — the section heading beside it says which profile. */
      label="Preview"
      onClick={() => setPreviewOpen(true)}
    />
  ) : null;



  // Per-tab scroll memory: each tab remembers its position in the shell's
  // inner scroller and restores it on return. {scroll:false} on the push
  // keeps the router's own scroll reset out of the way (the reset is what
  // defeated naive scrolls in record-03).
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollMemRef = useRef<Record<string, number>>({});
  const prevTabRef = useRef(activeTab);

  const getScroller = () =>
    (containerRef.current?.closest(".overflow-y-auto") as HTMLElement | null) ??
    null;

  const switchTab = (id: string) => {
    if (id === activeTab) return;
    const scroller = getScroller();
    scrollMemRef.current[activeTab] = scroller
      ? scroller.scrollTop
      : window.scrollY;
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
  const setAccountStatus = useOnboardingStore((s) => s.setAccountStatus);

  if (!mounted || mentorish) {
    return (
      <StaffShell lead={isLead}>
        <div className="px-6 py-6 lg:px-10" aria-busy="true" aria-label="Loading mentor profile">
          <div className="mt-1 flex items-center gap-4">
            <div className="size-14 shrink-0 animate-pulse rounded-[14px] bg-muted/40" />
            <div className="flex-1 space-y-2">
              <div className="h-7 w-72 animate-pulse rounded-md bg-muted/40" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>
          <div className="mt-5 flex gap-6 pb-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-16 animate-pulse rounded-md bg-muted/40" />
            ))}
          </div>
          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-7">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <div className="mb-2 h-5 w-40 animate-pulse rounded-md bg-muted/40" />
                  <div className="h-28 animate-pulse rounded-[var(--radius-surface)] bg-muted/40" />
                </div>
              ))}
            </div>
            <div>
              <div className="mx-auto h-7 w-44 animate-pulse rounded-full bg-muted/40" />
              <div className="mt-3 h-[420px] animate-pulse rounded-[var(--radius-surface)] bg-muted/40" />
            </div>
          </div>
        </div>
      </StaffShell>
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
  // Direct staff edit of teen-facing content (Lead Mentor). When editable the
  // read rows become StaffFieldRow editors; otherwise they stay read + request-
  // change (supervisor oversight).
  const matchingEditable = resolveMode("matchingProfile", persona) === "edit";
  const fmEditable = resolveMode("firstMoments", persona) === "edit";
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
  // goes-by dropped from the header (Prompt 3) — it lives on Profile ›
  // Display name.
  const deactivated = accountStatus === "deactivated";
  // Lifecycle standing (shared vocabulary with the Mentors roster) derived from
  // the store's existing axes. deactivated → Deactivated, unpublished → Paused,
  // pre-publish → In Training, else Active. A manual staff override (set from
  // the roster or the record's Status row) wins over the derived value.
  const lifecycle =
    mentorStatuses["live"] ?? liveLifecycle(status, accountStatus, profileHidden);
  // Header: ONE status statement (the role pill's dot) + a meta line of
  // pronouns · location · caseload.
  const headerLifecycle = lifecycle;
  const headerCaseloadTotal = caseloads["live"]?.total ?? slots.total;
  // ONE derivation of the active count, shared by the header meta and the
  // Mentorship tab, so the two can't disagree. An ended match never counts.
  // CURRENT matches only — unmatching frees a caseload slot, which is the
  // header's whole job.
  const activeMenteeCount = currentMenteesOf("live", {
    events: relationshipEvents,
  }).filter(
    (t) => (menteeStatus[t.id] ?? defaultMenteeStatus(t)) === "active"
  ).length;
  // Visibility readout for the rail preview — is this profile actually being
  // seen by potential mentee matches? Derived from the lifecycle (existing
  // axes), never color-alone: the label is the source of truth, the dot + pulse
  // are decorative (WCAG 1.4.1). Live/mentoring states pulse; the rest are calm.
  const visibility: {
    dot: string;
    label: string;
    sub: string;
    pulse: boolean;
  } =
    lifecycle === "active" || lifecycle === "guided"
      ? {
          dot: "var(--dot-positive)",
          label: "Live to teens",
          sub: "Shown to potential matches right now",
          pulse: true,
        }
      : lifecycle === "in-training"
        ? {
            dot: "var(--dot-warning)",
            label: "Not live yet",
            sub: "Goes live once the profile is approved",
            pulse: false,
          }
        : lifecycle === "deactivated"
          ? {
              dot: "var(--dot-critical)",
              label: "Deactivated",
              sub: "Not shown to teens",
              pulse: false,
            }
          : {
              // paused — published but hidden from teens
              dot: "var(--dot-warning)",
              label: "Hidden from teens",
              sub: "Paused — not shown to matches",
              pulse: false,
            };
  // Pre-publish "submitted for review" — feeds the overflow's Review entry.
  /** THE RAIL'S CONTENT, mounted twice — see the note at the `<aside>`.
   *
   *  Preview only: Notes + Activity tabs are deferred (rolling out later), so
   *  the rail's own segmented control is gone for now. (This was a JSX comment
   *  sitting beside the root element; as a `const` that made two roots.) */
  const previewRail = (
      <div className="flex flex-col items-center gap-3">
          {postLane && (
            <SegmentedControl
              size="md"
              ariaLabel="Preview version"
              options={[
                { value: "live" as const, label: "Live" },
                { value: "proposed" as const, label: "Proposed" },
              ]}
              value={previewSide}
              onChange={(v) => setPreviewSide(v)}
            />
          )}
          {/* Preview "tool" (elevated pass): a glass panel that FRAMES the
              device without ever cropping it. The frame renders at its own
              size — 266px, see the note below — rather than being a 360px
              frame scaled down, so it reserves exactly the layout box it
              paints and the device and its drop shadow are never masked on
              any side. (This comment described CSS `zoom`, which Phase 4
              removed; the no-clipping property it valued is unchanged.) */}
          <div className="w-full rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--glass-bg)] p-4 shadow-[var(--shadow-card)] backdrop-blur-[var(--glass-blur)]">
            {/* Visibility readout — the subtle "is this profile being seen
                by potential matches" signal (lifecycle-derived). Text
                carries the meaning; the dot is decorative; live states get
                a soft pulse (motion-safe). role=group + aria-label name the
                dot+label pair as one region. */}
            <div
              role="group"
              aria-label={`Profile visibility: ${visibility.label}. ${visibility.sub}`}
              className="mb-4 flex items-center gap-2.5 rounded-[var(--radius-control)] bg-[var(--surface-s1)] px-3 py-2 ring-1 ring-[color:var(--border-contour)]"
            >
              <span
                aria-hidden
                className="relative flex size-2.5 shrink-0 items-center justify-center"
              >
                {visibility.pulse && (
                  <span
                    className="absolute inline-flex size-2.5 rounded-full opacity-60 motion-safe:animate-ping"
                    style={{ backgroundColor: visibility.dot }}
                  />
                )}
                <span
                  className="relative size-2 rounded-full"
                  style={{ backgroundColor: visibility.dot }}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium leading-[16px] text-[var(--text-primary)]">
                  {visibility.label}
                </span>
                <span className="block text-[12px] leading-[15px] text-[var(--text-muted)]">
                  {visibility.sub}
                </span>
              </span>
            </div>
            {/* ═══ `zoom: 0.74` REMOVED (RC-2, Phase 4) ═══
              
                The old comment defended zoom on the grounds that it scales
                layout and paint together, so the shadow is never clipped
                and the untransformed width cannot widen the rail. Both
                true, and both now achieved by a frame that is genuinely
                that size instead of a 360px frame drawn smaller.
              
                WHY ZOOM HAD TO GO ANYWAY: it multiplies the reader's own
                text size. Someone at 200% got 148% inside this rail, and
                no amount of browser zoom could recover it — SC 1.4.4 is
                not satisfiable from inside a page that does this.
              
                266px ≈ 360 × 0.74, so the rendered size is unchanged. It
                is a `max-w` rather than a `w`, so the frame also shrinks
                with the rail instead of overflowing it. */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-[266px]">
                <PhonePreviewShell label="Live preview — what teens see on the match card">
                  <MentorProfilePreview draft={previewDraft} />
                </PhonePreviewShell>
                {profileHidden && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[46px] bg-[var(--surface-s1)]/70 backdrop-blur-[2px]">
                    <span className="flex items-center gap-2 rounded-full bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-card)]">
                      <EyeOff className="size-4" aria-hidden />
                      Hidden from teens
                    </span>
                  </div>
                )}
              </div>
            </div>
            {postLane && (
              <p
                className="mt-4 text-center text-[var(--text-muted)]"
                style={{ font: "var(--type-helper)" }}
              >
                {previewSide === "proposed"
                  ? "Preview of pending edits — live once approved"
                  : "The current live version"}
              </p>
            )}
          </div>
        </div>
  );

  const submittedForReview = status === "in_review";
  // Destructive account actions (accountOrg: edit) — the Lead Mentor manages
  // mentors (role migration); the Supervisor retains them as oversight.
  const canActOnAccount = resolveMode("accountOrg", persona) === "edit";
  // Account rows: staff-editable for both staff roles (lead owns the flows).
  const accountMode: "edit" | "read" =
    resolveMode("accountSelfService", persona) === "edit" ? "edit" : "read";
  const staffActor = staffActorFor(persona);
  // Overview data (Prompt B). TODO-DATA: illustrative fixtures — no IMP-6
  // aggregation layer or mentee entity exists in this prototype. Mount-gated
  // above, so Date.now() here is client-only. Mentee names/avatars render for
  // the manager tier (lead — the primary manager — and supervisor oversight);
  // the future read-mostly middle tier would degrade to counts + durations.

  // ── Attention by exception — REMOVED (user request: "remove these in-record
  // notifications for now, we can rebuild these later").
  //
  // This derived a single highest-severity strip from mentee recency
  // (waiting-on-mentor / teen-quiet), open escalations, review state and mentor
  // quiet, and rendered it as a band above the tab bar. The band is gone and the
  // whole derivation with it — dead code behind a removed surface rots.
  //
  // Rebuilding: the inputs all still exist and are still used elsewhere —
  // `menteeRecency` + `escalationVisible` (lib/record/mentees-demo.ts, which the
  // mentee table's inline row chips already use) and `AttentionCard` itself
  // (components/record/attention-card.tsx, still exercised on /dev/components).
  // Git history has the exact derivation if it's wanted verbatim.
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

  // Review-mediated rows: the WHOLE ROW is the affordance (Prompt 2). Press
  // opens whichever existing console serves the field. When no lane can
  // serve it — quiet published state — the row is Variant B: not pressable,
  // no chevron (this replaces the old stub-toast link; staff-initiated
  // change requests still don't exist — gaps.md #81, updated #89).
  const reviewPress = (section: ProfileSection): (() => void) | undefined => {
    if (!reviewMode) return undefined; // role-gated: Variant B for this viewer
    const href = requestChangeHref(section);
    return href ? () => router.push(href) : undefined;
  };

  // ── Right rail ───────────────────────────────────────────────────────
  // Notes + Activity tabs are deferred (rolling out later) — the rail now shows
  // only the teen-facing Preview, so the segmented control is gone.

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

    // reviewWorkflow: the inline hub was consolidated into the Overview
    // status strip (surface pass, Phase 4 — Overview is status + pointers
    // only); the per-field detail lives in the consoles the strip links to.

    if (slot === "matchingProfile") {
      const matchCard = sectionsForTab("profile").filter(
        (s) => s.group === "match-card"
      );
      return (
        <SectionShell
          key={slot}
          slot={slot}
          action={previewCta}
          helper={
            matchingEditable
              ? "Everything teens see — edit any field directly."
              : "Everything teens see — edits route through review"
          }
        >
          {/* Eyebrows are gone as a class (Prompt 1) — cards carry their own
              headers (card-title token, no divider under them; the divide
              scope wraps only the rows). Card gap 16px. */}
          <div className="space-y-4">
            <div className={CARD_ROWS}>
              <h3
                className="pb-1.5 pt-3.5 text-[var(--text-primary)]"
                style={{ font: "var(--type-card-title)" }}
              >
                Match card
              </h3>
              {/* 8 rows → inset separators. Lead: inline staff editors;
                  others: read + request-change. */}
              <div className={INSET_DIVIDERS}>
                {matchingEditable ? (
                  <StaffProfileFields
                    sections={matchCard}
                    live={live}
                    activity={activity}
                    staffActor={staffActor}
                  />
                ) : (
                  matchCard.map((s) => {
                    const raw = s.summary(live);
                    // Rich field renderers (elevated pass): teen-facing fields
                    // render as data chips / tags instead of plain text —
                    // Spotify as a data chip (no raw URL), interests + languages
                    // as tags, bio in a read-only field container.
                    let value: React.ReactNode = raw;
                    if (
                      s.fieldKey === "spotifyUrl" &&
                      typeof raw === "string" &&
                      raw !== "—" &&
                      live.spotifyUrl
                    ) {
                      value = <SpotifyChip key={live.spotifyUrl} url={live.spotifyUrl} />;
                    } else if (s.fieldKey === "interests") {
                      value = (
                        <InterestTags items={live.interests.map((i) => i.name)} />
                      );
                    } else if (s.fieldKey === "languages") {
                      value = <PlainTags items={live.languages} />;
                    } else if (s.fieldKey === "bio" && live.bio) {
                      value = <BioValue text={live.bio} />;
                    }
                    return (
                      <ReadRow
                        key={s.step}
                        label={s.label}
                        value={value}
                        chip={changesetChip(profileUpdate, s.fieldKey)}
                        onPress={reviewPress(s)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </SectionShell>
      );
    }

    if (slot === "firstMoments") {
      const fmSections = sectionsForTab("first-moments");
      const fmEmpty = fmSections.every((s) => {
        const v = s.summary(live);
        return v == null || v === "" || v === "—";
      });
      return (
        <SectionShell
          key={slot}
          slot={slot}
          action={previewCta}
          helper={
            fmEditable
              ? /* TODO-COPY */
                "What a teen gets the first time they open the chat — the messages, then the story. One message per line."
              : "Edits route through review"
          }
        >
          {fmEditable ? (
            // SAME row set as every other mentor's record (person-profile.tsx).
            // This used to mount StaffProfileFields, which renders the mentor's
            // own accordion editor — an Online/Offline segmented control plus an
            // "Add message" list builder — so this one record behaved unlike the
            // other six. Staff now read and edit the same two lanes everywhere;
            // the mentor's own self-view keeps the richer editor.
            <div className={CARD_ROWS}>
              <FirstMomentsRows
                online={live.firstMessages.online.map((m) => m.text)}
                offline={live.firstMessages.offline.map((m) => m.text)}
                editable
                // No review chip: first moments aren't gated, so these fields
                // can never sit in the changeset. The gated Profile tab keeps
                // its chips.
                slides={firstMomentStory(live.stories).slides}
                onSaveSlides={(slides) => {
                  const current = firstMomentStory(live.stories);
                  const rest = live.stories.filter(
                    (s) => s.type !== "first-moment"
                  );
                  saveGatedWithToasts({
                    stories: [...rest, { ...current, slides }],
                  });
                }}
                onSaveLane={(lane, lines) => {
                  // Preserve each message's existing id so the changeset diffs
                  // against the same entities instead of looking fully rewritten.
                  const prev = live.firstMessages[lane];
                  saveGatedWithToasts({
                    firstMessages: {
                      ...live.firstMessages,
                      [lane]: lines.map((text, i) => ({
                        id: prev[i]?.id ?? clientId("fm"),
                        text,
                      })),
                    },
                  });
                }}
              />
            </div>
          ) : fmEmpty ? (
            // Designed empty state (Prompt 4): centered in a single card —
            // intentional, not abandoned.
            <div
              className={cn(
                CARD_PAD,
                "flex min-h-[240px] flex-col items-center justify-center gap-3 text-center"
              )}
            >
              <MessagesSquare
                className="size-5 text-[var(--text-muted)]"
                aria-hidden
              />
              {/* TODO-COPY: no existing empty string for this tab. */}
              <p
                className="max-w-[40ch] text-[var(--text-secondary)]"
                style={{ font: "var(--type-row-value)" }}
              >
                Nothing here yet — first messages and the story are written
                during onboarding.
              </p>
            </div>
          ) : (
            // 2 rows → card, no separators.
            <div className={CARD_ROWS}>
              {fmSections.map((s) => (
                <ReadRow
                  key={s.step}
                  label={s.label}
                  value={s.summary(live)}
                  chip={changesetChip(profileUpdate, s.fieldKey)}
                  onPress={reviewPress(s)}
                />
              ))}
            </div>
          )}
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
          {/* One surface card (surface pass): photo, then identity, then
              contact — 8 rows → inset separators. */}
          <div className={cn(CARD_ROWS, INSET_DIVIDERS)}>
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
                settings; staff set values directly (record-scoped path).

                NO ContactActions here, unlike the fixture-person record. These
                rows are PRESSABLE editors: StaffFieldRow → RecordRow wraps the
                whole row in a <button> when editable, so a nested <button>/<a>
                would be invalid HTML and its click bubbles up and opens the
                editor (observed). Staff lose nothing — pressing the row opens an
                input holding the value, which is strictly more than copy.
                Parity needs a trailing slot on RecordRow rendered OUTSIDE its
                button; that's a shared-primitive change, see gaps.md. */}
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

    // "relationships" retired: Team + the mentee list moved to the Mentorship
    // practice tab (the tab split). renderSection no longer handles it.

    if (slot === "schedule") {
      // Active Hours — editable by staff who hold schedule=edit (lead +
      // supervisor). Exists on every record.
      return (
        <SectionShell key={slot} slot={slot}>
          <ActiveHoursEditor
            editable={resolveMode("schedule", persona) === "edit"}
          />
        </SectionShell>
      );
    }

    return null;
  };

  return (
    <StaffShell lead={isLead}>
      <div ref={containerRef} className="px-6 py-6 lg:px-10">
        {/* Back link — both staff roles return to Team, the one staff
            directory (the supervisor's separate Users surface is retired). */}
        <Link
          href="/app/team"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Team
        </Link>

        {/* ── Identity header (Prompt 3 lockup): one horizontal unit — 56px
            avatar in the gutter, two hugging text rows on the shared axis
            (name x = tab text x = card x), actions centered on the avatar
            band. Row 1: name + the header's ONLY pill (role badge with a
            leading 7px status dot — the default state earns a dot,
            exceptional states earn a word; never color alone, WCAG 1.4.1).
            Row 2: pronouns · location · capacity, no icons. Join date lives
            in Mentorship; supervisor lives in Relationships — the header
            states identity, the record states facts. */}
        {resolveMode("identity", persona) !== "hidden" && (
          // ── Identity header CARD (elevated pass): the avatar + name + role
          //    pill + meta live inside a defined elevated card; actions sit
          //    top-right on wide, wrap below on narrow.
          <header className="mt-3 flex flex-col gap-5 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-5 py-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:px-7 sm:py-6">
            {/* PRESENCE sits bottom-right of the avatar — the one place it
                appears. Same treatment as UserRecordShell's header. */}
            <span className="relative shrink-0">
            {live.accountPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={live.accountPhoto}
                alt=""
                className="size-16 rounded-2xl object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-16 items-center justify-center rounded-2xl font-display text-2xl font-bold"
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
            </span>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1
                  className="text-[var(--text-primary)]"
                  style={{
                    font: "var(--type-record-name)",
                    letterSpacing: "var(--type-record-name-tracking)",
                  }}
                >
                  {mentorName}
                </h1>
                {/* ONE STATUS STATEMENT: the role badge carries its own tint
                    (badge-role-* taxonomy) AND the state dot. No separate
                    "Active" pill, no avatar dot — a reader counts one thing.
                    The tint map is shared with the directory cell and the
                    UserRecordShell header, so a role can't look like two
                    different things in two places. */}
                <span
                  aria-label={`${ROLE_LABEL[subjectRole]} — ${STATUS_LABELS[headerLifecycle]}`}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-3 py-1",
                    ROLE_BADGE_TONE[subjectRole]
                  )}
                  style={{ font: "var(--type-label-sm)" }}
                >
                  {ROLE_LABEL[subjectRole]}
                </span>
                {/* EXCEPTIONS GET A WORD — a second chip, never folded into the
                    role pill and never colour alone. Default (active) renders
                    nothing, which is the whole of the standing signal now that
                    the pill's dot is gone: that dot meant STANDING, and presence
                    took its place on the avatar. */}
                {headerLifecycle !== "active" && (
                  <span
                    className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--status-attention-bg)] px-2.5 py-1 text-[var(--status-attention-fg)]"
                    style={{ font: "var(--type-label-sm)" }}
                  >
                    {STATUS_LABELS[headerLifecycle]}
                  </span>
                )}
              </div>
              {/* Meta: pronouns · location · capacity — middots, no icons.
                  Groups stand in for location (no location field exists). */}
              <p
                className="text-[var(--text-secondary)]"
                style={{
                  font: "var(--type-meta)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {/* pronouns · location · caseload. The JOIN DATE left the
                    header — a reference fact, owned by Organization. Groups
                    stand in for location (no location field exists). */}
                {[
                  live.pronouns.join(", "),
                  mentorGroups.join(", "),
                  `${activeMenteeCount} of ${headerCaseloadTotal} mentees`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
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
                      className="flex size-11 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
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
                        className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]"
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
                            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--tint-hover)]",
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
                            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--tint-hover)]",
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

        {/* ── Tab bar: text tabs directly on the canvas — the surface pass
            deleted the full-bleed baseline hairline (spacing does the work);
            the active tab keeps its weight + 2px underline unchanged.
            Labels match the mentor-facing settings tabs where they overlap
            (registry: lib/record/tabs.ts; unbuilt entries render nothing). */}
        <nav
          aria-label="Profile sections"
          className="mt-6 flex gap-1 overflow-x-auto border-b border-[color:var(--border-contour)]"
        >
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              aria-current={activeTab === t.id ? "page" : undefined}
              className={cn(
                "relative min-h-11 shrink-0 rounded-md px-3 py-2 text-[14px] leading-[20px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
                activeTab === t.id
                  ? "font-semibold text-[var(--text-primary)]"
                  : "font-normal text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              {t.label}
              {activeTab === t.id && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--text-primary)]"
                />
              )}
            </button>
          ))}
        </nav>

        {/* Content column caps at 900px (rail excluded) and stays anchored
            to the shared axis — cards stop stretching on wide viewports
            (Prompt 4 composition). Rail fixed at 340px so the device preview +
            its drop shadow sit inside the panel with breathing room. */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,900px)_340px]">
          {/* LEFT — the active tab's content. The teen-facing preview rail
              only rides alongside the profile-family tabs; every other tab
              (Overview, Organization, Mentorship, Supervision, Schedule,
              Account) spans the full width. */}
          <div className={cn("min-w-0 space-y-7", !showRail && "lg:col-span-2")}>
            {activeTab === "overview" && (
              <RecordOverview mentorName={mentorName} />
            )}
            {activeTab === "profile" && renderSection("matchingProfile")}
            {activeTab === "first-moments" && renderSection("firstMoments")}
            {activeTab === "schedule" && renderSection("schedule")}
            {/* ORGANIZATION above ACCOUNT (Figma 2162:5663). Its own tab is
                gone: Team moved to Mentorship (the care network, not paperwork)
                and these four rows are account facts — the same drawer as name,
                phone and email — so the tab held nothing. Rendered as a sibling
                above the Account shell, which titles its own section. */}
            {activeTab === "account" && (
              <div className="space-y-7">
                {resolveMode("accountOrg", persona) !== "hidden" && (
                  <section
                    aria-label="Organization"
                    data-record-section="organization"
                  >
                    <h2 className="mb-3 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
                      Organization
                    </h2>
                    <OrganizationCard
                      mode={
                        resolveMode("accountOrg", persona) === "edit"
                          ? "edit"
                          : "read"
                      }
                    />
                  </section>
                )}
                {renderSection("account")}
              </div>
            )}
            {/* Mentorship (subject = mentor / lead mentor) — the practice
                surface: mentees, caseload, availability, team. */}
            {activeTab === "mentorship" && (
              <MentorshipPractice />
            )}
            {/* Supervision (subject = lead mentor / supervisor). Reachable here
                only via the dev ?subjectRole= preview — real staff records live
                at /admin/person/[id], where the id resolves real supervisees. */}
            {activeTab === "supervision" && (
              <Supervision subjectId={LEAD_PERSONA_ID} />
            )}
          </div>

          {/* RIGHT — the teen-facing Preview rail. Scoped to the profile-family
              tabs only (see showRail): it shows the teen-facing match card + the
              "Live to teens" publication panel, which describe the profile, so
              they have no meaning beside Organization / Mentorship / Account /
              Schedule content. Passive and prop-fed (invariant 1). */}
          {/* ═══ THE PREVIEW: A DESKTOP COLUMN AND A MOBILE PANEL, ONE MARKUP ═══
              The rail used to render at every width and simply STACK below the
              content on a narrow screen — so a reader on a phone had the whole
              record to scroll before reaching the teen-facing card, and the CTA
              that would take them there did not exist. It is now `lg`-only, with
              the same `previewRail` node mounted in a right-edge panel below
              `lg`, opened from the section heading's own row.

              ONE NODE, TWO MOUNTS. The version toggle, the visibility readout,
              the "Hidden from teens" overlay and the pending-edits caption all
              travel with it — a mobile reader gets the rail, not a reduced copy
              of it that would drift the first time one of those changed. */}
          {/* ═══ NEVER BOTH AT ONCE ═══
              `!previewOpen` is not a visual condition — the aside is already
              `display:none` below `lg`, and above `lg` the panel cannot open
              because the CTA carries `lg:hidden`. It exists so `previewRail` is
              never in the document TWICE.
              WHY THAT MATTERS: the preview's silhouette defines document-global
              SVG ids (`bust`, `bustMaskMid`, …), so a second copy duplicates
              them and every `url(#…)` in it resolves to the first copy's defs —
              which, with that copy hidden, means referencing into a
              `display:none` subtree. Both copies render identically so nothing
              LOOKS wrong; an id sweep is what found it.
              The alternative was per-instance ids via `useId`, rejected because
              `CutoutSpray` in the same file deliberately renders its filters
              ONCE and documents duplicate global ids as an accepted tradeoff.
              Two conventions for one problem in one file is worse than not
              creating the duplicate. See design-system-gaps row 309. */}
          {showRail && !previewOpen && (
          <aside
            aria-label="Profile rail"
            className="hidden min-w-0 lg:sticky lg:top-6 lg:mt-[56px] lg:block"
          >
            {previewRail}
          </aside>
          )}
          {/* BELOW `lg`: the same rail in a right-edge panel. Radix portals it,
              so it sits outside the grid and occupies no column — mounting it
              here keeps it beside the branch it mirrors. */}
          {showRail && (
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogContent variant="side" className="lg:hidden">
                <DialogHeader>
                  {/* TODO-COPY. A panel that slides over the record has no
                      context around it, so it names what it is showing. */}
                  <DialogTitle>What teens see on the match card</DialogTitle>
                </DialogHeader>
                {/* THE BODY SCROLLS, THE HEADING AND CLOSE DO NOT. The rail is
                    taller than a phone once the visibility readout and the
                    caption are stacked above and below the device frame. */}
                <DialogBody>{previewRail}</DialogBody>
              </DialogContent>
            </Dialog>
          )}
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
    </StaffShell>
  );
}
