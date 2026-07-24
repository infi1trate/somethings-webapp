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
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Clock3,
  EyeOff,
  Info,
  MessagesSquare,
  MoreHorizontal,
  Sparkles,
  Video,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { displayOrEmpty, RecordRow } from "@/components/record/row";
import { PersonRow } from "@/components/record/person-row";
import {
  escalationVisible,
  getDemoOverview,
  recencyPhrase,
  relativeAgo,
  relLength,
  responseBucket,
} from "@/lib/record/mentees-demo";
import { PillButton } from "@/components/settings/pill-button";
import {
  ChangesRequestedChip,
  InReviewChip,
} from "@/components/profile-editor/update-review-bits";
import { changeProgress } from "@/lib/onboarding/change-requests";
import { changesetSummary, relTime } from "@/lib/onboarding/profile-update";
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
  FOCUS_TO_TAB,
  railDefaultFor,
  recordTabsForRole,
} from "@/lib/record/tabs";
import { roleForPersona } from "@/components/settings/tabs-config";
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

/** Soft surface cards — the grouped-list containment: card tone one step
 *  lighter than the s1 canvas, 16px radius, 24px horizontal / 20px vertical
 *  internal padding, NO shadow. The boundary is surface contrast (1.10:1);
 *  the contour border is DEFINITION, not division — darkest neutral at 8%,
 *  decorative (visual-quality pass, Prompt 1). CARD_ROWS composes with the
 *  rows' own 14px rhythm (py-1.5 + 14 = 20 effective); CARD_PAD is for
 *  prose and mosaic content. */
const CARD_ROWS =
  "rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5";
const CARD_PAD =
  "rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-[var(--surface-pad-y)]";

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

/** Middle-ellipsis for raw URLs — a URL must never wrap across three lines
 *  of a care product's record page; the full value rides on title and in
 *  the field's detail surface where one exists. */
const midTruncate = (s: string, max = 44) =>
  s.length <= max ? s : `${s.slice(0, 26)}…${s.slice(-15)}`;

/** Rail panels (Prompt 4): card tone + contour, 20px padding. */
const RAIL_PANEL =
  "rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5";

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
  // Role-gated tab set (Prompt C): Insights shows only for lead-mentor
  // (+ admin/super-admin, no persona here); everyone else sees the base set.
  const visibleTabs = recordTabsForRole(roleForPersona(persona));
  const tabParam = typeof query.tab === "string" ? query.tab : null;
  const focusTab = focus ? (FOCUS_TO_TAB[focus] ?? null) : null;
  const activeTab =
    tabParam && visibleTabs.some((t) => t.id === tabParam)
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
  // "Now" captured once (lazy init) — the reference point for the Overview's
  // demo elapsed-time values; keeps render pure (no Date.now() in render).
  const [now] = useState(() => Date.now());
  const [noteDraft, setNoteDraft] = useState("");
  const setAccountStatus = useOnboardingStore((s) => s.setAccountStatus);

  if (!mounted || mentorish) {
    return (
      <AdminShell active="mentors">
        <div className="px-6 py-6 lg:px-10" aria-busy="true" aria-label="Loading mentor record">
          <div className="mt-1 flex items-center gap-4">
            <div className="size-14 shrink-0 animate-pulse rounded-[14px] bg-muted/40" />
            <div className="flex-1 space-y-2">
              <div className="h-7 w-72 animate-pulse rounded-md bg-muted/40" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>
          <div className="mt-5 flex gap-6 pb-3 lg:ml-[72px]">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-16 animate-pulse rounded-md bg-muted/40" />
            ))}
          </div>
          <div className="mt-6 grid items-start gap-8 lg:ml-[72px] lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
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
  // goes-by dropped from the header (Prompt 3) — it lives on Profile ›
  // Display name.
  const deactivated = accountStatus === "deactivated";
  // Pre-publish "submitted for review" — feeds the overflow's Review entry.
  const submittedForReview = status === "in_review";
  // Destructive account actions are supervisor powers (accountOrg: edit).
  const canActOnAccount = resolveMode("accountOrg", persona) === "edit";
  // Account rows: staff-editable for supervisors, read for leads.
  const accountMode: "edit" | "read" =
    resolveMode("accountSelfService", persona) === "edit" ? "edit" : "read";
  const staffActor = persona === "supervisor" ? "Supervisor" : "Lead mentor";
  // Overview data (Prompt B). TODO-DATA: illustrative fixtures — no IMP-6
  // aggregation layer or mentee entity exists in this prototype. Mount-gated
  // above, so Date.now() here is client-only. Mentee names/avatars are gated
  // to supervisor tier; below that (lead) rows degrade to counts + durations.
  const overview = getDemoOverview(now);
  const supervisorTier = persona === "supervisor";

  // ── Attention by exception (Prompt C) ─────────────────────────────────
  // One strip at a time, highest severity wins; the rest surface via "and N
  // more". Healthy record → no items → no strip (absence of chrome is the
  // reward state). All copy TODO-COPY. Vocabulary law: escalations name the
  // observable cause ("No reply in 5 days"), never a predicted departure.
  type Attention = {
    id: string;
    severity: "critical" | "warm" | "warning";
    line: string;
    href: string | null;
    linkLabel: string | null;
  };
  const attentionItems: Attention[] = [];
  // 1. Open escalation on a mentee (critical family).
  if (publishedSnapshot) {
    const esc = overview.mentees.filter((m) =>
      escalationVisible(m.escalation, now)
    );
    if (esc.length > 0) {
      const first = esc[0].escalation!;
      attentionItems.push({
        id: "escalation",
        severity: "critical",
        line:
          esc.length === 1
            ? `1 mentee needs attention · ${first.reason}`
            : `${esc.length} mentees need attention · ${first.reason}`,
        href: null,
        linkLabel: null,
      });
    }
  }
  // 2. Change request waiting (warm family) — the existing review state, only
  // when something is genuinely open (never the healthy "live and current").
  const reviewAttention: Attention | null = preLane
    ? status === "in_review"
      ? {
          id: "review",
          severity: "warm",
          line: "Submitted for review — waiting on the team.",
          href: "/admin/review?from=record",
          linkLabel: "Open review console",
        }
      : {
          id: "review",
          severity: "warm",
          line: `Changes requested — waiting on the mentor (${(() => {
            const p = changeProgress(changeRequests, draft);
            return `${p.addressed} of ${p.total} addressed`;
          })()}).`,
          href: "/admin/review?from=record",
          linkLabel: "View in review console",
        }
    : postLane && profileUpdate
      ? {
          id: "review",
          severity: "warm",
          line: `${changesetSummary(profileUpdate)} · ${profileUpdate.fields.length} change${profileUpdate.fields.length === 1 ? "" : "s"} waiting`,
          href: "/admin/profile-update?from=record",
          linkLabel: "Open full review",
        }
      : null;
  if (reviewAttention) attentionItems.push(reviewAttention);
  // 3. Mentor quiet: no activity in 5+ days (warning family) — stated as the
  // observation, never as risk.
  if (publishedSnapshot && overview.metrics.lastActiveAt != null) {
    const days = Math.floor((now - overview.metrics.lastActiveAt) / 86_400_000);
    if (days >= 5) {
      attentionItems.push({
        id: "quiet",
        severity: "warning",
        line: `No activity in ${days} days`,
        href: null,
        linkLabel: null,
      });
    }
  }
  // 4. Sustained signal drop (warning) — needs 7-day-below-target time series
  // that this prototype has no source for, so it never fires. TODO: wire to
  // IMP-6/MO-8 when the coaching flow lands.
  const attention = attentionItems[0] ?? null;
  const attentionMore = Math.max(0, attentionItems.length - 1);
  // Severity → flat tint families (no shadow/gradient); the word always
  // travels with the color (WCAG 1.4.1).
  const ATTENTION_FAMILY: Record<Attention["severity"], string> = {
    critical: "border-red-300 bg-red-50 text-red-900",
    warm: "border-orange-300 bg-orange-50 text-orange-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
  };
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

    // reviewWorkflow: the inline hub was consolidated into the Overview
    // status strip (surface pass, Phase 4 — Overview is status + pointers
    // only); the per-field detail lives in the consoles the strip links to.

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
              {/* 8 rows → inset separators. */}
              <div className={INSET_DIVIDERS}>
                {matchCard.map((s) => {
                  const raw = s.summary(live);
                  // Raw URLs never wrap — middle-ellipsis, full value on
                  // title (and in the console when a lane serves the field).
                  const value =
                    s.fieldKey === "spotifyUrl" &&
                    typeof raw === "string" &&
                    raw !== "—" ? (
                      <span title={raw}>{midTruncate(raw)}</span>
                    ) : (
                      raw
                    );
                  return (
                    <ReadRow
                      key={s.step}
                      label={s.label}
                      value={value}
                      chip={changesetChip(profileUpdate, s.fieldKey)}
                      onPress={reviewPress(s)}
                    />
                  );
                })}
              </div>
            </div>
            <div className={CARD_ROWS}>
              <h3
                className="pb-1.5 pt-3.5 text-[var(--text-primary)]"
                style={{ font: "var(--type-card-title)" }}
              >
                Chat
              </h3>
              {/* 2 rows → no separators. */}
              <div>
                {chat.map((s) => (
                  <ReadRow
                    key={s.step}
                    label={s.label}
                    value={s.summary(live)}
                    chip={changesetChip(profileUpdate, s.fieldKey)}
                    onPress={reviewPress(s)}
                  />
                ))}
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
          helper="Edits route through review"
        >
          {fmEmpty ? (
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
      // A collection of people → shared PersonRow (Prompt B). Team members'
      // records don't exist in this prototype, so the rows are non-pressable
      // (no dead chevrons). Mentee count stays a plain caption.
      return (
        <SectionShell key={slot} slot={slot}>
          {!publishedSnapshot ? (
            // Empty state is a statement about the person — no box.
            <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Nothing here yet — relationships appear once this mentor is
              published and matched.
            </p>
          ) : (
            <div className={CARD_ROWS}>
              {overview.team.map((t) => (
                <PersonRow key={t.id} name={t.name} secondary={t.roleLabel} />
              ))}
              <div className="py-2.5">
                <p
                  className="text-[var(--text-secondary)]"
                  style={{ font: "var(--type-row-label)" }}
                >
                  Active mentees
                </p>
                <p
                  className="text-[var(--text-primary)] tabular-nums"
                  style={{ font: "var(--type-row-value)" }}
                >
                  {profileHidden
                    ? `${MENTEE_COUNT} · matching paused while unpublished`
                    : MENTEE_COUNT}
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
          {/* Designed empty state (Prompt 4) — existing copy reused. */}
          <div
            className={cn(
              CARD_PAD,
              "flex min-h-[240px] flex-col items-center justify-center gap-3 text-center"
            )}
          >
            <CalendarClock
              className="size-5 text-[var(--text-muted)]"
              aria-hidden
            />
            <p
              className="max-w-[36ch] text-[var(--text-secondary)]"
              style={{ font: "var(--type-row-value)" }}
            >
              Scheduling lands with the settings build — staff editing is
              planned here.
            </p>
          </div>
        </SectionShell>
      );
    }

    return null;
  };

  return (
    <AdminShell active="mentors">
      <div ref={containerRef} className="px-6 py-6 lg:px-10">
        {/* Back link rides the shared axis (name / tabs / cards — Prompt 3
            alignment discipline) so the header zone reads as one region. */}
        <div className="lg:ml-[72px]">
          <Link
            href="/admin/users"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Users
          </Link>
        </div>

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
          <header className="mt-3 grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4">
            {live.accountPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={live.accountPhoto}
                alt=""
                className="size-14 rounded-[14px] object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-[14px] font-display text-lg font-bold"
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

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1
                  className="text-[var(--text-primary)]"
                  style={{
                    font: "var(--type-display)",
                    letterSpacing: "var(--type-display-tracking)",
                  }}
                >
                  {mentorName}
                </h1>
                {/* The header's ONLY pill: role + status. Active = green
                    dot alone; exceptional states add the word (the model
                    has no Paused/Suspended yet — matrix grows with it). */}
                <span
                  aria-label={`Mentor, ${
                    deactivated
                      ? "deactivated"
                      : profileHidden
                        ? "unpublished"
                        : "active"
                  }`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]"
                >
                  <span
                    aria-hidden
                    className="size-[7px] shrink-0 rounded-full"
                    style={{
                      backgroundColor: deactivated
                        ? "var(--state-error)"
                        : profileHidden
                          ? "#ea580c"
                          : "#3a7d44",
                    }}
                  />
                  {deactivated
                    ? "Mentor · Deactivated"
                    : profileHidden
                      ? "Mentor · Unpublished"
                      : "Mentor"}
                </span>
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
                {[
                  live.pronouns.join(", "),
                  MEMBERSHIP_GROUPS.join(", "),
                  `${MENTEE_COUNT} of ${slots.total} mentees`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
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

        {/* ── Attention banner: the top attention item, mirrored into the
            chrome so it travels across tabs — but only when severity warrants
            (critical/warm; warning-family items live in the Overview strip
            only). Passive tint from the item's severity family, 16px radius,
            no shadow. TODO(Prompt A): fold into the condensing header band. */}
        {attention &&
          attention.severity !== "warning" &&
          activeTab !== "overview" && (
          <div
            className={cn(
              "mt-5 flex max-w-[900px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-surface)] border px-[var(--surface-pad-x)] py-3 lg:ml-[72px]",
              ATTENTION_FAMILY[attention.severity]
            )}
          >
            <p className="min-w-0 flex-1 text-[13px] leading-[18px]">
              {attention.line}
            </p>
            {reviewMode && attention.href && (
              <button
                type="button"
                onClick={() => switchTab("overview")}
                className="-my-2.5 inline-flex min-h-11 items-center rounded-sm text-[13px] font-medium leading-[18px] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
              >
                Review
              </button>
            )}
          </div>
        )}

        {/* ── Tab bar: text tabs directly on the canvas — the surface pass
            deleted the full-bleed baseline hairline (spacing does the work);
            the active tab keeps its weight + 2px underline unchanged.
            Labels match the mentor-facing settings tabs where they overlap
            (registry: lib/record/tabs.ts; unbuilt entries render nothing). */}
        <nav
          aria-label="Record sections"
          className="mt-5 flex gap-6 overflow-x-auto lg:ml-[72px]"
        >
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              aria-current={activeTab === t.id ? "page" : undefined}
              className={cn(
                "min-h-11 shrink-0 border-b-2 pb-1 text-[14px] leading-[20px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
                activeTab === t.id
                  ? "border-[var(--text-primary)] font-medium text-[var(--text-primary)]"
                  : "border-transparent font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content column caps at 900px (rail excluded) and stays anchored
            to the shared axis — cards stop stretching on wide viewports
            (Prompt 4 composition). Rail fixed at 300px. */}
        <div className="mt-6 grid items-start gap-8 lg:ml-[72px] lg:grid-cols-[minmax(0,900px)_300px]">
          {/* LEFT — the active tab's content: sections MOVED, not restyled
              (Phase 1 content mapping); gating unchanged via resolveMode
              inside each renderer. */}
          <div className="min-w-0 space-y-7">
            {activeTab === "overview" && (
              // ── Overview mosaic (surface pass, Phase 4): status +
              // pointers only, as a card grid. Collapses to one column
              // below lg (the page's existing container breakpoint).
              <>
                {/* Attention by exception (Prompt C): one strip, highest
                    severity; healthy = no strip (the reward state). The rest
                    surface via "and N more". Word + tint together (1.4.1). */}
                {attention && (
                  <section
                    aria-label="Attention"
                    data-record-section="attention"
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-surface)] border px-[var(--surface-pad-x)] py-3",
                      ATTENTION_FAMILY[attention.severity]
                    )}
                  >
                    {attention.severity === "warning" ? (
                      <Clock3 className="size-4 shrink-0" aria-hidden />
                    ) : (
                      <AlertCircle className="size-4 shrink-0" aria-hidden />
                    )}
                    <p className="min-w-0 flex-1 text-[14px] leading-[20px]">
                      {attention.line}
                      {attentionMore > 0 && (
                        <span className="opacity-70">
                          {" "}
                          · and {attentionMore} more
                        </span>
                      )}
                    </p>
                    {reviewMode && attention.href && (
                      <Link
                        href={attention.href}
                        className="-my-2.5 inline-flex min-h-11 shrink-0 items-center rounded-sm text-[13px] font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
                      >
                        {attention.linkLabel}
                      </Link>
                    )}
                  </section>
                )}

                {/* Mentees — hero card. Capacity lives in the header-right
                    caption (a fact), not a card of its own. Mentee names +
                    avatars are supervisor-tier only; below that the card
                    degrades to counts + durations with no layout shift. */}
                {resolveMode("accountOrg", persona) !== "hidden" &&
                  (() => {
                    const active = MENTEE_COUNT;
                    const open = Math.max(0, slots.total - active);
                    return (
                      <section
                        aria-label="Mentees"
                        data-record-section="mentees"
                        className={CARD_PAD}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h2
                            className="text-[var(--text-primary)]"
                            style={{ font: "var(--type-card-title)" }}
                          >
                            Mentees
                          </h2>
                          {publishedSnapshot && (
                            <span
                              className="text-[var(--text-secondary)] tabular-nums"
                              style={{ font: "var(--type-helper)" }}
                            >
                              {active} active · {open} slot{open === 1 ? "" : "s"} open
                            </span>
                          )}
                        </div>

                        {!publishedSnapshot ? (
                          <p
                            className="mt-3 text-[var(--text-secondary)]"
                            style={{ font: "var(--type-row-value)" }}
                          >
                            Nothing here yet — mentees appear once this mentor
                            is published and matched.
                          </p>
                        ) : !supervisorTier ? (
                          // Below supervisor tier: no names or avatars.
                          <p
                            className="mt-3 text-[var(--text-primary)] tabular-nums"
                            style={{ font: "var(--type-row-value)" }}
                          >
                            {active} mentees · together{" "}
                            {relLength(
                              Math.max(...overview.mentees.map((m) => m.matchedAt)),
                              now
                            )}
                            –
                            {relLength(
                              Math.min(...overview.mentees.map((m) => m.matchedAt)),
                              now
                            )}
                          </p>
                        ) : (
                          <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
                            {overview.mentees.map((m) => {
                              const esc = escalationVisible(m.escalation, now);
                              return (
                                <PersonRow
                                  key={m.id}
                                  name={m.name}
                                  secondary={`${relLength(m.matchedAt, now)} · ${recencyPhrase(m.lastInteractionAt, now)}`}
                                  trailing={
                                    <>
                                      {esc && (
                                        <span className="rounded-full border border-orange-300 px-2 py-0.5 text-[11px] font-medium leading-none text-orange-700">
                                          Escalated
                                        </span>
                                      )}
                                      {m.videoCount30d > 0 && (
                                        <span
                                          className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-medium leading-none text-[var(--text-secondary)]"
                                          title={`${m.videoCount30d} video calls in the last 30 days`}
                                        >
                                          <Video className="size-3" aria-hidden />
                                          {m.videoCount30d}
                                        </span>
                                      )}
                                    </>
                                  }
                                />
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })()}

                {/* How it's going + Team (paired). "How it's going" renders
                    sentences from the metrics; any null line is suppressed,
                    and if no lines render the card is dropped and Team goes
                    full-width. */}
                {(() => {
                  const m = overview.metrics;
                  const lines: { text: string; info: string }[] = [];
                  if (m.avgResponseMinutes != null)
                    lines.push({
                      // TODO-COPY (voice pass): response-time bucket copy.
                      text: responseBucket(m.avgResponseMinutes),
                      info: "Average time to reply to mentees over the last 3 days, online hours only.",
                    });
                  if (m.matchesActivePast90 != null)
                    lines.push({
                      text: `${m.matchesActivePast90.active} of ${m.matchesActivePast90.total} matches active past 90 days`,
                      info: "How many of this mentor's matches have had activity in the last 90 days.",
                    });
                  if (m.lastActiveAt != null)
                    lines.push({
                      text: `Last active ${relativeAgo(m.lastActiveAt, now)}`,
                      info: "When this mentor was last active in the app.",
                    });
                  const showGoing = publishedSnapshot && lines.length > 0;
                  return (
                    <div
                      className={cn(
                        "grid gap-4",
                        showGoing && "lg:grid-cols-2"
                      )}
                    >
                      {showGoing && (
                        <section aria-label="How it's going" className={CARD_PAD}>
                          <h2
                            className="text-[var(--text-primary)]"
                            style={{ font: "var(--type-card-title)" }}
                          >
                            How it&apos;s going
                          </h2>
                          <ul className="mt-3 space-y-2">
                            {lines.map((l) => (
                              <li
                                key={l.text}
                                className="flex items-start gap-1.5 text-[var(--text-primary)] tabular-nums"
                                style={{ font: "var(--type-row-value)" }}
                              >
                                <span className="min-w-0">{l.text}</span>
                                <span
                                  tabIndex={0}
                                  title={l.info}
                                  aria-label={l.info}
                                  className="mt-0.5 shrink-0 rounded-sm text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
                                >
                                  <Info className="size-3.5" aria-hidden />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {/* Team — supervisor + lead mentor. Non-pressable: their
                          records don't exist in this prototype (no dead
                          chevrons). */}
                      <section aria-label="Team" className={CARD_PAD}>
                        <h2
                          className="text-[var(--text-primary)]"
                          style={{ font: "var(--type-card-title)" }}
                        >
                          Team
                        </h2>
                        <div className="mt-2">
                          {overview.team.map((t) => (
                            <PersonRow
                              key={t.id}
                              name={t.name}
                              secondary={t.roleLabel}
                            />
                          ))}
                        </div>
                      </section>
                    </div>
                  );
                })()}

                {/* Recent activity — events only (vocabulary law), newest
                    first, 5 max. "View all" opens the rail's Activity feed. */}
                <section aria-label="Recent activity" className={CARD_PAD}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2
                      className="text-[var(--text-primary)]"
                      style={{ font: "var(--type-card-title)" }}
                    >
                      Recent activity
                    </h2>
                    <button
                      type="button"
                      onClick={() => setRailChoice("activity")}
                      className={cn(JUMP_LINK, "-my-2.5")}
                    >
                      View all
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {overview.events.slice(0, 5).map((e) => (
                      <li
                        key={e.id}
                        className="flex items-baseline justify-between gap-3 py-1"
                      >
                        <span
                          className="min-w-0 text-[var(--text-primary)]"
                          style={{ font: "var(--type-row-value)" }}
                        >
                          {e.text}
                        </span>
                        <span
                          className="shrink-0 text-[var(--text-muted)] tabular-nums"
                          style={{ font: "var(--type-helper)" }}
                        >
                          {relativeAgo(e.at, now)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
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
            {activeTab === "insights" && (
              // Prompt C — reserved slot for the IMP-6 consolidation; empty
              // state only (do not build content). Role-gated to lead-mentor
              // in the tab registry. TODO-COPY.
              <section
                aria-label="Insights"
                data-record-section="insights"
                className={cn(
                  CARD_PAD,
                  "flex min-h-[240px] flex-col items-center justify-center gap-3 text-center"
                )}
              >
                <Sparkles
                  className="size-5 text-[var(--text-muted)]"
                  aria-hidden
                />
                <p
                  className="max-w-[42ch] text-[var(--text-secondary)]"
                  style={{ font: "var(--type-row-value)" }}
                >
                  Mentor insights are on the way — trends, signals, and
                  coaching starters will live here.
                </p>
              </section>
            )}
          </div>

          {/* RIGHT — utility rail (Phase 1; refined Prompt 4): Preview /
              Notes / Activity. The default segment is contextual per tab
              (railDefaultFor), always user-switchable. The preview stays
              passive and prop-fed (invariant 1). Stacks below the content
              under lg. The segmented control's top edge aligns with the
              first content card's top edge exactly (per-tab offset — tabs
              with canvas headings push their first card down). */}
          <aside
            aria-label="Record rail"
            className="min-w-0 lg:sticky lg:top-6 lg:mt-[var(--rail-offset)]"
            style={
              {
                "--rail-offset": `${
                  activeTab === "overview"
                    ? 0
                    : activeTab === "schedule" || activeTab === "mentorship"
                      ? 36
                      : 56
                }px`,
              } as React.CSSProperties
            }
          >
            <div
              role="group"
              aria-label="Rail view"
              className="mx-auto flex w-fit rounded-full bg-[var(--surface-card)] p-0.5"
            >
              {railSegments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  aria-pressed={railSegment === seg.id}
                  onClick={() => setRailChoice(seg.id)}
                  className={cn(
                    "min-h-7 rounded-full px-3 text-[11px] font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
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
                    className="flex rounded-full bg-[var(--surface-card)] p-1"
                  >
                    {(["live", "proposed"] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        aria-pressed={previewSide === side}
                        onClick={() => setPreviewSide(side)}
                        className={cn(
                          "min-h-9 rounded-full px-4 text-sm font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
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
                {/* Defined mount (Prompt 4): card tone + contour, 16px
                    padding around the phone, caption 8px below — the phone
                    no longer floats against the canvas. The 360px frame
                    scales inside an absolutely-positioned box so its
                    untransformed width can't widen the page (gaps.md #76). */}
                <div className="w-full rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4">
                  <div className="relative h-[548px] w-full overflow-hidden">
                    <div className="absolute left-1/2 top-0 w-[360px] origin-top -translate-x-1/2 scale-[0.74]">
                      <div className="relative">
                        <PhonePreviewShell label="Live preview — what teens see on the match card">
                          <MentorProfilePreview draft={previewDraft} />
                        </PhonePreviewShell>
                        {profileHidden && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[46px] bg-[var(--surface-s1)]/70 backdrop-blur-[2px]">
                            {/* No shadow, no border — the card tone on the
                                blurred veil separates the chip on its own. */}
                            <span className="flex items-center gap-2 rounded-full bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
                              <EyeOff className="size-4" aria-hidden />
                              Hidden from teens
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <p
                    className="mt-2 text-center text-[var(--text-muted)]"
                    style={{ font: "var(--type-helper)" }}
                  >
                    {profileHidden
                      ? "Unpublished — teens can't see this profile right now"
                      : postLane && previewSide === "proposed"
                        ? "What teens will see after approval"
                        : "What teens see right now"}
                  </p>
                </div>
              </div>
            )}

            {railSegment === "notes" && notesVisible && (
              <div className={cn("mt-3 space-y-3", RAIL_PANEL)}>
                {/* The channel divider — persistent, not dismissible:
                    confusing internal notes with change requests must be
                    hard. Moved intact from the notes section (Phase 1). */}
                <p
                  className="text-[var(--text-muted)]"
                  style={{ font: "var(--type-helper)", lineHeight: 1.5 }}
                >
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
                  {/* Composer input inverts — canvas tone inside the card
                      (record-only override; the shared Textarea keeps its
                      border everywhere else). */}
                  <Textarea
                    id="internal-note"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Context for the next person on this record…"
                    className="border-0 bg-[var(--surface-s1)] shadow-none"
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
                  // Caption style, 12px under the composer block (Prompt 4).
                  <p
                    className="text-[var(--text-muted)]"
                    style={{ font: "var(--type-helper)", lineHeight: 1.5 }}
                  >
                    No notes yet. Anything written here stays internal.
                  </p>
                ) : (
                  // Deliberately NOT the change-request note treatment (no
                  // orange, no "From the review team") — canvas-tone nested
                  // surfaces keep the channels far apart, borderless.
                  <ul className="space-y-2.5">
                    {internalNotes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-xl bg-[var(--surface-s1)] px-3.5 py-3"
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
              <div className={cn("mt-3", RAIL_PANEL)}>
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
