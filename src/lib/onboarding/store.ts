"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  emptyDraft,
  type ChangeRequest,
  type HubStepKey,
  type HubStepStatus,
  type MentorDraft,
  type MentorLifecycleStatus,
  type ProfileStatus,
  type ProfileUpdate,
  type ActivityItem,
  type Persona,
  type InternalNote,
} from "@/lib/types";
import {
  DEFAULT_SCHEDULE,
  cloneSchedule,
  type Schedule,
} from "@/lib/schedule";
// Type-only: the shape of a staff edit to another person's profile. people-demo
// holds no store import, so this stays one-directional.
import type { PersonProfile } from "@/lib/record/people-demo";
// activity/read-state is a pure logic module with no store import — same
// one-directional discipline as care-demo below.
import {
  clearRow as clearOverlayRow,
  markRead as markOverlayRead,
  restoreRow as restoreOverlayRow,
  type ActivityScope,
  type ReadOverlay,
} from "@/lib/activity/read-state";
// care-demo is a pure data module with no store import — one-directional.
import type {
  CareFlagClosure,
  CareReviewDecision,
  CareUpdateRecord,
} from "@/lib/record/care-demo";
import type { RelationshipEvent } from "@/lib/record/relationships";
import { guardianFor } from "@/lib/record/guardian";
import type { AccountLock, GuardianDetails } from "@/lib/record/guardian";
import {
  PROFILE_SECTIONS,
  normForCompare,
} from "@/lib/onboarding/profile-sections";
import {
  isGatedField,
  isImmediateTeenFacingField,
  cloneValue,
} from "@/lib/onboarding/profile-update";
import { emptyHubSteps } from "@/lib/onboarding/hub";

// A persisted-shape copy of the draft (no password, no volatile blob url) — the
// approved baseline used to detect post-publish edits in the mentor's settings.
function snapshotDraft(draft: MentorDraft): MentorDraft {
  return JSON.parse(
    JSON.stringify({
      ...draft,
      password: "",
      media: { ...draft.media, url: null },
    })
  ) as MentorDraft;
}

/** Notification preferences (settings-03), keyed PER PERSONA (the dev lens's
 *  four states each keep their own switches) → category id → on/off. Sparse:
 *  a missing persona or category means "use the category's default" (see
 *  notifications-config.ts), so no exhaustive backfill is needed. */
export type NotificationPrefs = Record<string, Record<string, boolean>>;

/** A mentee match's standing. "paused" has NOT ended — see menteeStatus. */
export type MenteeStatus = "active" | "paused" | "deactivated";

/** A mentor's caseload setting (caseload prompt): capacity mode + total mentee
 *  slots. "automatic" = capacity adjusts by the matching algorithm (TODO-DATA:
 *  no algorithm exists in this prototype — honest stub); "custom" = the lead
 *  set it by hand. Sparse per-mentor map — a missing entry means "automatic at
 *  the mentor's default capacity" (people-demo `capacity`, or `slots.total`
 *  for the store-backed "live" mentor). */
export type Caseload = { mode: "automatic" | "custom"; total: number };

interface OnboardingState {
  draft: MentorDraft;
  status: ProfileStatus;
  completed: string[]; // slugs the mentor has saved
  rejectionNote: string | null;
  /** Section-tied changes the reviewer requested; read by the dock, the welcome
   *  modal, and the per-step note cards. */
  changeRequests: ChangeRequest[];
  /** The last approved version of the profile, captured when it's published.
   *  Diffed against the live draft to detect post-publish edits; `everPublished`
   *  is simply `publishedSnapshot !== null`. */
  publishedSnapshot: MentorDraft | null;
  /** Per-step completion for the four non-profile hub steps. The Profile step's
   *  status is derived from `status` (see lib/onboarding/hub.ts), not stored here. */
  hubSteps: Record<HubStepKey, HubStepStatus>;
  /** Shown-once flag for the hub's first-visit welcome modal. Set true the first
   *  time the hub opens the intro, so it never reappears. Persisted. */
  hubWelcomeSeen: boolean;
  /** Staff-owned account config (§4 Roles & permissions, Phase 6). Top-level
   *  additions backfill via the shallow persist merge — no migration needed. */
  slots: { total: number; dailyNew: number };
  accountStatus: "active" | "deactivated";
  deactivatedOn: string | null; // display date, set at deactivation
  /** Post-publish changeset (Profile Update Review). One open changeset max;
   *  teens keep seeing publishedSnapshot until approval. */
  profileUpdate: ProfileUpdate | null;
  /** Mentor-side activity feed (send-backs, approvals). */
  activity: ActivityItem[];
  /** Dev persona lens (Phase 10) — drives the settings role + sidebar avatar. */
  persona: Persona;
  /** Lead Mentor / Supervisor own account photo (Account › Photo row) —
   *  internal, direct-save, never teen-visible, never review-gated. */
  staffPhoto: string | null;
  /** Internal staff notes on the Mentor Record (record-05) — never
   *  mentor-visible; append-only. */
  internalNotes: InternalNote[];
  /** record-05: staff-controlled teen visibility ("Unpublish profile").
   *  Hidden ≠ deactivated: content and mentorships stay; teens just don't
   *  see the profile until it's republished. */
  profileHidden: boolean;
  /** True once the mentor has left the "You're approved!" screen via its CTA
   *  and entered their live home — so the dev persona lens (and the submitted
   *  page's own guard) can tell "just approved, not yet acknowledged" apart
   *  from "established, logged in." Reset with the mentor. */
  enteredHome: boolean;
  /** Session-only UI for the welcome-back modal (not persisted — shows once per
   *  session entry, reopenable from the dock). */
  welcomeOpen: boolean;
  welcomeAutoShown: boolean;
  /** Notification switches, per persona → category id (settings-03). */
  notificationPrefs: NotificationPrefs;
  /** Per-mentor caseload overrides, keyed by mentor id ("live" = the
   *  store-backed mentor). Sparse — see the Caseload type note. */
  caseloads: Record<string, Caseload>;
  /** Manual lifecycle-status overrides set by staff (lead + supervisor) from the
   *  roster or record, keyed by mentor id ("live" = the store-backed mentor).
   *  Sparse: a missing key falls back to the fixture status (demo mentors) or
   *  the derived liveLifecycle (the store mentor). When set for "live" it wins
   *  over the derived standing everywhere it renders. */
  mentorStatuses: Record<string, MentorLifecycleStatus>;
  /** Manual availability INTENT overrides (open to new mentees?) set by staff,
   *  keyed by mentor id. Sparse: missing → fixture `accepting` (demo) or true
   *  (live). Only the accepting/not-accepting intent is stored — "Full" is
   *  always derived from the caseload (count === cap), never stored. */
  mentorAccepting: Record<string, boolean>;
  /** Per-MENTEE match standing, keyed by teen id. Sparse: a missing key falls
   *  back to the fixture's own `active` (see defaultMenteeStatus). Replaces the
   *  old binary `menteeActive` — the mentee table shows three states, and two
   *  parallel sources for one fact is how they drift apart.
   *
   *  "paused" has NOT ended: the row stays in the list but stops counting as
   *  active. Only "deactivated" moves a mentee to Past mentees. */
  menteeStatus: Record<string, MenteeStatus>;
  /** APPROVED presentation reviews, keyed by review id. APPEND-ONLY BY DESIGN:
   *  there is no setter that edits or removes an entry, because the record is
   *  append-only — a correction is a NEW review whose approval lands as its own
   *  entry referencing the original. Sparse: a missing key means that review is
   *  still pending, which is what puts it in the action slot. */
  careReviews: Record<string, CareReviewDecision>;
  /** v33 — CLOSED CARE FLAGS, keyed by flag id. Append-only, like careReviews: a
   *  close is recorded, never unrecorded, and a closed flag leaves the task
   *  region because the record now holds its resolution — not because anything
   *  was deleted. */
  careFlagClosures: Record<string, CareFlagClosure>;
  /** v34 — is the Care tab's assistant rail expanded? A PER-USER PREFERENCE, not
   *  per-record: a reader who wants the history table at full width wants it on
   *  every teen, and re-collapsing on each navigation would be the product
   *  forgetting something it was told. */
  careRailOpen: boolean;
  /** THE ACTIVITY LEDGER'S READ/CLEAR OVERLAY (v35). Keyed
   *  `viewerId::scope::eventId` — see lib/activity/read-state.ts for why scope is
   *  part of the key and not a filter over it (standing rule 10).
   *
   *  NEVER stored on an event row (rule 9). The events are fixtures in
   *  lib/activity/seed.ts and are not persisted at all; only this overlay is,
   *  because only this is the viewer's own state. */
  activityRead: ReadOverlay;
  /** WHICH SEED SCENARIO THE LEDGER IS SHOWING (v36). Prototype chrome, but
   *  persisted deliberately: the read/clear overlay is keyed by event id, so a
   *  reload that reset the scenario would leave the overlay pointing at events
   *  that were no longer on screen — and the A2 persistence would never actually
   *  be exercised, because every reload would re-seed from scratch. */
  activityScenarioId: string;
  setActivityScenarioId: (id: string) => void;
  seedActivityRead: (overlay: ReadOverlay) => void;
  markActivityRowsRead: (
    viewerId: string,
    scope: ActivityScope,
    eventIds: string[]
  ) => void;
  clearActivityRow: (
    viewerId: string,
    scope: ActivityScope,
    eventId: string
  ) => void;
  restoreActivityRow: (
    viewerId: string,
    scope: ActivityScope,
    eventId: string
  ) => void;
  /** Care updates a supervisor has written, keyed by update id. APPEND-ONLY:
   *  no setter edits or removes one. "Editing" an update appends an amendment
   *  whose `amends` names the original, and both keep rendering. */
  careUpdates: Record<string, CareUpdateRecord>;
  /** When a supervisor last hit refresh on a teen's AI summary, keyed by teen
   *  id. TODO-DATA: regeneration isn't wired, so this only re-stamps the
   *  "Updated" date — but it has to persist, or the date would jump backwards
   *  on the next navigation. */
  careSummaryRefreshedAt: Record<string, number>;
  /** APPEND-ONLY log of ended pairings — unmatches and unassignments.
   *
   *  An ARRAY, not a map: the same pair could conceivably end, resume and end
   *  again, and a map keyed by pair would overwrite the first ending. There is
   *  no setter that edits or removes an entry, and nothing here touches account
   *  state — that is the whole point of the field existing. The current edge is
   *  DERIVED by replaying this over the fixture edge (lib/record/relationships),
   *  so history and present state cannot disagree. */
  relationshipEvents: RelationshipEvent[];
  /** Parent/guardian consent record per teen. Sparse — a missing key means
   *  nothing has been entered, which is rendered as empty rather than as a
   *  placeholder: an invented parent name on a minor's consent record would be
   *  worse than a blank. */
  guardians: Record<string, GuardianDetails>;
  /** ACCOUNT LOCKS, keyed by person id. Locking blocks the person's email and
   *  phone from signing up AGAIN, which is a different and heavier thing than
   *  deactivation — see lib/record/guardian. Sparse: a missing key means not
   *  locked. */
  accountLocks: Record<string, AccountLock>;
  /** Staff edits to ANOTHER person's teen-facing profile, keyed by person id.
   *  Sparse and PARTIAL: a missing key (or field) falls back to the fixture in
   *  people-demo, so this map holds only what a lead/supervisor changed.
   *
   *  Why a separate map rather than `draft`: `draft` is the ONE store-backed
   *  mentor's own profile with the whole gated review-changeset flow attached.
   *  A lead editing someone else's record is a staff edit to a different
   *  person, not a change request against their own — same pattern as
   *  `caseloads` / `mentorStatuses`. Never keyed by "live". */
  personProfiles: Record<string, PersonProfile>;
  /** Staff edits to another person's Active Hours, keyed by person id. Whole
   *  schedules (the editor commits all of it), fixture default underneath. */
  personSchedules: Record<string, Schedule>;
  /** The record subject's org role + group memberships — staff-editable on the
   *  Mentorship › Organization card. Single-mentor prototype, so plain fields
   *  rather than per-mentor keyed maps. */
  mentorRole: string;
  mentorGroups: string[];
  /** The mentor's Active Hours (availability schedule) — editable on the
   *  record's Schedule tab (staff) and the mentor self-view. */
  schedule: Schedule;
  _hasHydrated: boolean;

  update: (patch: Partial<MentorDraft>) => void;
  markComplete: (slug: string) => void;
  setStatus: (status: ProfileStatus) => void;
  acceptInvite: (prefill: Partial<MentorDraft>) => void;
  setRejection: (note: string | null) => void;
  setChangeRequests: (requests: ChangeRequest[]) => void;
  /** Snapshot the current draft as the approved/published version (called on
   *  approve). Anchors post-publish change detection. */
  capturePublishedSnapshot: () => void;
  /** Set one non-profile hub step's completion status. */
  setHubStep: (key: HubStepKey, status: HubStepStatus) => void;
  /** Mark the hub's first-visit welcome modal as seen (one-way). */
  markHubWelcomeSeen: () => void;
  /** Mentor confirmed an unchanged field is fine as-is (explicit override). */
  confirmUnchanged: (id: string) => void;
  /** Undo a confirmed-unchanged back to none. */
  unconfirmChangeRequest: (id: string) => void;
  setWelcomeOpen: (open: boolean) => void;
  markWelcomeAutoShown: () => void;
  /** Staff: mentor-slots config (§4 Phase 6). */
  setSlots: (patch: Partial<{ total: number; dailyNew: number }>) => void;
  /** Staff: reversible deactivation round-trip (§4 Phase 6). */
  setAccountStatus: (
    status: "active" | "deactivated",
    deactivatedOn?: string | null
  ) => void;
  /** Gated save (§1.6): writes the draft AND enqueues each changed gated
   *  field into the open changeset, capturing liveValue from the published
   *  snapshot at enqueue time (§1.5 — never re-derived). Editing an enqueued
   *  field is absorbed; a changes-requested field flips back to pending
   *  (resubmission); editing back to the live value drops the field. Plain
   *  draft write pre-publish. */
  saveGatedFields: (patch: Partial<MentorDraft>) => void;
  /** Discard one proposed change: draft reverts to the enqueue-time live
   *  value; last field discarded clears the changeset silently. */
  discardProfileUpdateField: (fieldId: string) => void;
  /** Reviewer (Lead Mentor) send-back: noted fields flip to changes-requested; un-noted fields
   *  stay pending inside the changes-requested changeset (spec §3 note). */
  sendBackProfileUpdate: (notes: Record<string, string>) => void;
  /** Reviewer (Lead Mentor) approve: apply every proposed value (snapshot the draft), clear
   *  the changeset, fire the activity item (§1.4 all-or-nothing). */
  approveProfileUpdate: () => void;
  markActivityRead: () => void;
  /** RECORD-SCOPED staff edit (record-04a, invariant 2): sets one account
   *  field (draft key, or the top-level staffPhoto) and appends ONE
   *  staff-attributed activity entry — the audit trail for "Last changed
   *  by". Never fires mentor-facing toasts; never touches gated saves,
   *  changesets, or snapshots. */
  staffEditAccountField: (
    fieldId: string,
    value: unknown,
    actor: string
  ) => void;
  /** RECORD-SCOPED: a Lead Mentor's DIRECT edit of a teen-facing profile field.
   *  Unlike staffEditAccountField, it also writes the publishedSnapshot (when
   *  one exists) so the change is what teens see immediately — a direct edit,
   *  not a review changeset. Logs the same staff-attributed audit entry. */
  staffEditProfileField: (
    fieldId: string,
    value: unknown,
    actor: string
  ) => void;
  /** RECORD-SCOPED (record-05): append one internal staff note. */
  addInternalNote: (text: string, author: string) => void;
  /** RECORD-SCOPED (record-05): hide/restore teen visibility, with a
   *  staff-attributed activity entry (never reads as the mentor's action). */
  setProfileHidden: (hidden: boolean, actor: string) => void;
  setPersona: (p: Persona) => void;
  setStaffPhoto: (url: string | null) => void;
  /** Set one notification switch for the given persona (settings-03). */
  setNotificationPref: (
    persona: Persona,
    categoryId: string,
    enabled: boolean
  ) => void;
  /** Set a mentor's caseload (full value — the caller resolves the current
   *  override-or-default before writing). Caseload prompt. */
  setCaseload: (mentorId: string, caseload: Caseload) => void;
  /** Manually set a mentor's lifecycle status (staff toggle from the roster /
   *  record). Writes the override map keyed by mentor id. */
  setMentorStatus: (mentorId: string, status: MentorLifecycleStatus) => void;
  /** Manually set a mentor's availability INTENT (open to new mentees?). "Full"
   *  stays derived from the caseload — only this intent is stored. */
  setMentorAccepting: (mentorId: string, accepting: boolean) => void;
  setMenteeStatus: (teenId: string, status: MenteeStatus) => void;
  /** Record a supervisor's decision on a pending review. NO update/delete
   *  counterpart exists, on purpose (see careReviews). */
  approveCareReview: (decision: CareReviewDecision) => void;
  /** Appends a flag closure. No counterpart reopens one — see the field. */
  closeCareFlag: (closure: CareFlagClosure) => void;
  setCareRailOpen: (open: boolean) => void;
  /** Append a care update. No update/delete counterpart, on purpose. */
  addCareUpdate: (update: CareUpdateRecord) => void;
  refreshCareSummary: (teenId: string, at: number) => void;
  /** End a pairing. APPENDS — there is deliberately no un-end and no delete. */
  endRelationship: (event: RelationshipEvent) => void;
  setGuardian: (teenId: string, patch: Partial<GuardianDetails>) => void;
  /** Pass null to UNLOCK. A lock blocks a real person from returning, so the
   *  remedy has to exist. */
  setAccountLock: (personId: string, lock: AccountLock | null) => void;
  /** Release a manual lifecycle override so the DERIVED standing shows again.
   *  Without this the override map was a one-way door: `mentorStatuses[id] ??
   *  liveLifecycle(...)` meant one dropdown click permanently masked the real
   *  accountStatus/profileHidden axes. */
  clearMentorStatus: (mentorId: string) => void;
  /** Staff edits to the record subject's org role + group memberships. */
  setMentorRole: (role: string) => void;
  setMentorGroups: (groups: string[]) => void;
  /** Replace the Active Hours schedule (the editor commits the whole thing). */
  setSchedule: (schedule: Schedule) => void;
  /** Staff edit to another person's profile — MERGES the patch over any
   *  existing override, so callers send only the field they changed. */
  setPersonProfile: (personId: string, patch: PersonProfile) => void;
  /** Staff edit to another person's Active Hours (whole schedule). */
  setPersonSchedule: (personId: string, schedule: Schedule) => void;
  /** The "You're approved!" CTA — the mentor has entered their live home. */
  markHomeEntered: () => void;
  setHasHydrated: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      status: "invited",
      completed: [],
      rejectionNote: null,
      changeRequests: [],
      publishedSnapshot: null,
      hubSteps: emptyHubSteps(),
      hubWelcomeSeen: false,
      slots: { total: 16, dailyNew: 1 },
      accountStatus: "active",
      deactivatedOn: null,
      profileUpdate: null,
      activity: [],
      welcomeOpen: false,
      welcomeAutoShown: false,
      _hasHydrated: false,
      persona: "mentor",
      staffPhoto: null,
      internalNotes: [],
      profileHidden: false,
      enteredHome: false,
      notificationPrefs: {},
      caseloads: {},
      mentorStatuses: {},
      mentorAccepting: {},
      menteeStatus: {},
      careReviews: {},
      careFlagClosures: {},
      careRailOpen: true,
      activityRead: {},
      activityScenarioId: "typical-shift",
      careUpdates: {},
      careSummaryRefreshedAt: {},
      relationshipEvents: [],
      guardians: {},
      accountLocks: {},
      personProfiles: {},
      personSchedules: {},
      mentorRole: "Mentor",
      mentorGroups: ["North Carolina", "New Jersey"],
      schedule: cloneSchedule(DEFAULT_SCHEDULE),

      update: (patch) =>
        set((state) => ({ draft: { ...state.draft, ...patch } })),

      markComplete: (slug) =>
        set((state) =>
          state.completed.includes(slug)
            ? state
            : { completed: [...state.completed, slug] }
        ),

      setStatus: (status) => set({ status }),

      acceptInvite: (prefill) =>
        set((state) => {
          // Seed the DB-sourced basics, but only into fields the mentor hasn't
          // already filled (so a revisit never clobbers their edits).
          const merged = { ...state.draft } as unknown as Record<string, unknown>;
          const existing = state.draft as unknown as Record<string, unknown>;
          for (const [key, value] of Object.entries(prefill)) {
            const current = existing[key];
            const isEmpty =
              current == null ||
              current === "" ||
              (Array.isArray(current) && current.length === 0);
            if (isEmpty) merged[key] = value;
          }
          return {
            status: state.status === "invited" ? "pending" : state.status,
            draft: merged as unknown as MentorDraft,
          };
        }),

      setRejection: (note) => set({ rejectionNote: note }),

      setChangeRequests: (requests) => set({ changeRequests: requests }),

      capturePublishedSnapshot: () =>
        set((state) => ({ publishedSnapshot: snapshotDraft(state.draft) })),

      setHubStep: (key, status) =>
        set((state) => ({ hubSteps: { ...state.hubSteps, [key]: status } })),

      markHubWelcomeSeen: () => set({ hubWelcomeSeen: true }),

      confirmUnchanged: (id) =>
        set((state) => ({
          changeRequests: state.changeRequests.map((c) =>
            c.id === id ? { ...c, confirmedUnchanged: true } : c
          ),
        })),

      unconfirmChangeRequest: (id) =>
        set((state) => ({
          changeRequests: state.changeRequests.map((c) =>
            c.id === id ? { ...c, confirmedUnchanged: false } : c
          ),
        })),

      setWelcomeOpen: (welcomeOpen) => set({ welcomeOpen }),

      markWelcomeAutoShown: () => set({ welcomeAutoShown: true }),

      setSlots: (patch) =>
        set((state) => ({ slots: { ...state.slots, ...patch } })),

      setAccountStatus: (accountStatus, deactivatedOn = null) =>
        set({ accountStatus, deactivatedOn }),

      saveGatedFields: (patch) =>
        set((state) => {
          const draft = { ...state.draft, ...patch };
          const snap = state.publishedSnapshot;
          if (!snap) return { draft }; // pre-publish: plain write
          const now = Date.now();

          // ── Immediate teen-facing keys (first moments) ────────────────────
          // These are NOT gated, so they never enter the changeset. But the
          // record and the phone preview read `publishedSnapshot ?? draft`, so
          // writing only the draft would leave staff looking at the OLD value
          // forever. Move the snapshot too, and log ONE activity entry so the
          // change stays auditable without asking anyone to approve it.
          const immediateKeys = Object.keys(patch).filter(
            isImmediateTeenFacingField
          );
          const immediate: Partial<OnboardingState> = {};
          if (immediateKeys.length > 0) {
            immediate.publishedSnapshot = {
              ...snap,
              ...Object.fromEntries(
                immediateKeys.map((k) => [
                  k,
                  (draft as unknown as Record<string, unknown>)[k],
                ])
              ),
            } as typeof snap;
            immediate.activity = [
              {
                id: `act-${now}`,
                type: "profile_update_live" as const,
                fieldIds: immediateKeys,
                createdAt: now,
                read: false,
              },
              ...state.activity,
            ];
          }

          const prior = state.profileUpdate;
          let fields = prior ? [...prior.fields] : [];
          let touched = false;
          for (const key of Object.keys(patch)) {
            if (!isGatedField(key)) continue;
            const proposed = (draft as unknown as Record<string, unknown>)[key];
            const existing = fields.find((f) => f.fieldId === key);
            const live = existing
              ? existing.liveValue
              : cloneValue(
                  (snap as unknown as Record<string, unknown>)[key]
                );
            const differs =
              JSON.stringify(normForCompare(key as keyof MentorDraft, proposed)) !==
              JSON.stringify(normForCompare(key as keyof MentorDraft, live));
            if (!differs) {
              if (existing) {
                fields = fields.filter((f) => f.fieldId !== key);
                touched = true;
              }
              continue;
            }
            if (existing) {
              if (existing.fieldStatus === "changes-requested") {
                // Resubmission: back to pending; the note is resolved.
                fields = fields.map((f) =>
                  f.fieldId === key
                    ? { ...f, fieldStatus: "pending" as const, adminNote: null }
                    : f
                );
                touched = true;
              }
              // pending fields absorb further edits — liveValue stays fixed.
            } else {
              fields.push({
                fieldId: key,
                liveValue: live,
                fieldStatus: "pending",
                adminNote: null,
              });
              touched = true;
            }
          }
          if (fields.length === 0)
            return { draft, profileUpdate: null, ...immediate };
          const status =
            touched || !prior
              ? ("pending" as const) // new/resubmitted work → back in the queue
              : prior.status;
          return {
            draft,
            profileUpdate: {
              id: prior?.id ?? `pu-${now}`,
              status,
              submittedAt: prior?.submittedAt ?? now,
              updatedAt: now,
              fields,
            },
            ...immediate,
          };
        }),

      discardProfileUpdateField: (fieldId) =>
        set((state) => {
          const u = state.profileUpdate;
          const field = u?.fields.find((f) => f.fieldId === fieldId);
          if (!u || !field) return state;
          const fields = u.fields.filter((f) => f.fieldId !== fieldId);
          const draft = {
            ...state.draft,
            [fieldId]: cloneValue(field.liveValue),
          } as MentorDraft;
          return {
            draft,
            profileUpdate: fields.length
              ? { ...u, fields, updatedAt: Date.now() }
              : null, // last field discarded → cleared silently
          };
        }),

      sendBackProfileUpdate: (notes) =>
        set((state) => {
          const u = state.profileUpdate;
          if (!u) return state;
          const now = Date.now();
          const fields = u.fields.map((f) =>
            notes[f.fieldId]?.trim()
              ? {
                  ...f,
                  fieldStatus: "changes-requested" as const,
                  adminNote: notes[f.fieldId].trim(),
                }
              : f // un-noted fields stay pending, publish with next approval
          );
          const flagged = fields
            .filter((f) => f.fieldStatus === "changes-requested")
            .map((f) => f.fieldId);
          return {
            profileUpdate: {
              ...u,
              status: "changes-requested",
              updatedAt: now,
              fields,
            },
            activity: [
              {
                id: `act-${now}`,
                type: "profile_changes_requested" as const,
                fieldIds: flagged,
                createdAt: now,
                read: false,
              },
              ...state.activity,
            ],
          };
        }),

      approveProfileUpdate: () =>
        set((state) => {
          const u = state.profileUpdate;
          if (!u) return state;
          const now = Date.now();
          return {
            // Apply every proposed value: the draft holds proposed; discarded
            // fields were already reverted — snapshotting IS the publish.
            publishedSnapshot: snapshotDraft(state.draft),
            profileUpdate: null,
            activity: [
              {
                id: `act-${now}`,
                type: "profile_update_live" as const,
                fieldIds: u.fields.map((f) => f.fieldId),
                createdAt: now,
                read: false,
              },
              ...state.activity,
            ],
          };
        }),

      markActivityRead: () =>
        set((state) =>
          state.activity.some((a) => !a.read)
            ? { activity: state.activity.map((a) => (a.read ? a : { ...a, read: true })) }
            : state
        ),

      staffEditAccountField: (fieldId, value, actor) =>
        set((state) => {
          const now = Date.now();
          const entry = {
            id: `act-${now}`,
            type: "staff_account_edit" as const,
            fieldIds: [fieldId],
            createdAt: now,
            read: false,
            actor,
          };
          if (fieldId === "staffPhoto") {
            return {
              staffPhoto: (value as string | null) ?? null,
              activity: [entry, ...state.activity],
            };
          }
          return {
            draft: { ...state.draft, [fieldId]: value },
            activity: [entry, ...state.activity],
          };
        }),

      staffEditProfileField: (fieldId, value, actor) =>
        set((state) => {
          const now = Date.now();
          const entry = {
            id: `act-${now}`,
            type: "staff_account_edit" as const,
            fieldIds: [fieldId],
            createdAt: now,
            read: false,
            actor,
          };
          // Direct edit: write the draft AND (when published) the snapshot the
          // record + teens read from, so the change is live immediately.
          return {
            draft: { ...state.draft, [fieldId]: value },
            publishedSnapshot: state.publishedSnapshot
              ? { ...state.publishedSnapshot, [fieldId]: value }
              : state.publishedSnapshot,
            activity: [entry, ...state.activity],
          };
        }),

      addInternalNote: (text, author) =>
        set((state) => ({
          internalNotes: [
            {
              id: `note-${Date.now()}`,
              text: text.trim(),
              author,
              createdAt: Date.now(),
            },
            ...state.internalNotes,
          ],
        })),

      setProfileHidden: (hidden, actor) =>
        set((state) => {
          const now = Date.now();
          return {
            profileHidden: hidden,
            activity: [
              {
                id: `act-${now}`,
                type: hidden
                  ? ("profile_unpublished" as const)
                  : ("profile_republished" as const),
                fieldIds: [],
                createdAt: now,
                read: false,
                actor,
              },
              ...state.activity,
            ],
          };
        }),

      setPersona: (p) => set({ persona: p }),

      markHomeEntered: () => set({ enteredHome: true }),
      setStaffPhoto: (url) => set({ staffPhoto: url }),

      setNotificationPref: (persona, categoryId, enabled) =>
        set((state) => ({
          notificationPrefs: {
            ...state.notificationPrefs,
            [persona]: {
              ...(state.notificationPrefs[persona] ?? {}),
              [categoryId]: enabled,
            },
          },
        })),

      setCaseload: (mentorId, caseload) =>
        set((state) => ({
          caseloads: { ...state.caseloads, [mentorId]: caseload },
        })),

      setMentorStatus: (mentorId, status) =>
        set((state) => ({
          mentorStatuses: { ...state.mentorStatuses, [mentorId]: status },
        })),

      setMentorAccepting: (mentorId, accepting) =>
        set((state) => ({
          mentorAccepting: { ...state.mentorAccepting, [mentorId]: accepting },
        })),
      setMenteeStatus: (teenId, status) =>
        set((state) => ({
          menteeStatus: { ...state.menteeStatus, [teenId]: status },
        })),
      setCareRailOpen: (open) => set({ careRailOpen: open }),

      // ── ACTIVITY LEDGER OVERLAY (v35) ───────────────────────────────────
      // Each action delegates to lib/activity/read-state.ts. The store holds the
      // map and nothing else: it does not know the key format, and there is NO
      // action that removes an entry — standing rule 11, clearing is never
      // deleting, and the module deliberately exports no delete.
      setActivityScenarioId: (id) =>
        // Switching scenario drops the overlay so the new scenario seeds from its
        // own fixture decision about what starts unread. NOT a delete of anything
        // meaningful (rule 11 is about a viewer clearing a ROW) — this is the
        // prototype simulator swapping one fixture ledger for another.
        set({ activityScenarioId: id, activityRead: {} }),
      seedActivityRead: (overlay) => set({ activityRead: overlay }),
      markActivityRowsRead: (viewerId, scope, eventIds) =>
        set((s) => ({
          activityRead: markOverlayRead(
            s.activityRead,
            viewerId,
            scope,
            eventIds
          ),
        })),
      clearActivityRow: (viewerId, scope, eventId) =>
        set((s) => ({
          activityRead: clearOverlayRow(s.activityRead, viewerId, scope, eventId),
        })),
      restoreActivityRow: (viewerId, scope, eventId) =>
        set((s) => ({
          activityRead: restoreOverlayRow(
            s.activityRead,
            viewerId,
            scope,
            eventId
          ),
        })),
      closeCareFlag: (closure) =>
        set((state) => ({
          careFlagClosures: {
            ...state.careFlagClosures,
            [closure.flagId]: closure,
          },
        })),
      approveCareReview: (decision) =>
        set((state) => ({
          careReviews: { ...state.careReviews, [decision.reviewId]: decision },
        })),
      addCareUpdate: (update) =>
        set((state) => ({
          careUpdates: { ...state.careUpdates, [update.id]: update },
        })),
      refreshCareSummary: (teenId, at) =>
        set((state) => ({
          careSummaryRefreshedAt: { ...state.careSummaryRefreshedAt, [teenId]: at },
        })),
      endRelationship: (event) =>
        set((state) => ({
          relationshipEvents: [...state.relationshipEvents, event],
        })),
      setGuardian: (teenId, patch) =>
        set((state) => ({
          guardians: {
            ...state.guardians,
            // Seeded from the FIXTURE, not from empty: every teen has a
            // guardian on file, so a first edit to one field must not blank the
            // other four. Merged on top of any earlier staff edit.
            [teenId]: { ...guardianFor(teenId), ...state.guardians[teenId], ...patch },
          },
        })),
      setAccountLock: (personId, lock) =>
        set((state) => {
          const next = { ...state.accountLocks };
          if (lock) next[personId] = lock;
          else delete next[personId];
          return { accountLocks: next };
        }),
      setPersonProfile: (personId, patch) =>
        set((state) => ({
          personProfiles: {
            ...state.personProfiles,
            // Merge, so editing the bio doesn't wipe an earlier interests edit.
            [personId]: { ...state.personProfiles[personId], ...patch },
          },
        })),
      setPersonSchedule: (personId, schedule) =>
        set((state) => ({
          personSchedules: { ...state.personSchedules, [personId]: schedule },
        })),
      clearMentorStatus: (mentorId) =>
        set((state) => {
          const next = { ...state.mentorStatuses };
          delete next[mentorId];
          return { mentorStatuses: next };
        }),

      setMentorRole: (role) => set({ mentorRole: role }),
      setMentorGroups: (groups) => set({ mentorGroups: groups }),
      setSchedule: (schedule) => set({ schedule }),

      setHasHydrated: () => set({ _hasHydrated: true }),

      reset: () =>
        set({
          draft: emptyDraft(),
          status: "invited",
          completed: [],
          rejectionNote: null,
          changeRequests: [],
          publishedSnapshot: null,
          hubSteps: emptyHubSteps(),
          hubWelcomeSeen: false,
          slots: { total: 16, dailyNew: 1 },
          accountStatus: "active",
          deactivatedOn: null,
          profileUpdate: null,
          activity: [],
          staffPhoto: null, // persona is a dev lens, not data — reset leaves it
          internalNotes: [],
          profileHidden: false,
          enteredHome: false,
          notificationPrefs: {}, // dev lens keeps switches per persona; reset clears
          caseloads: {}, // caseload overrides reset with the mentor
          mentorStatuses: {}, // status overrides reset with the mentor
          mentorAccepting: {}, // availability intent resets with the mentor
          menteeStatus: {},
          careReviews: {}, // dev "start over" restores the pending reviews
          careFlagClosures: {}, // …and reopens the closed flags
          careRailOpen: true,
          activityRead: {}, // dev "start over" returns every row to its seed state
          activityScenarioId: "typical-shift",
          careUpdates: {},
          careSummaryRefreshedAt: {},
          relationshipEvents: [], // dev "start over" restores the fixture edges
          guardians: {},
          accountLocks: {},
          // Staff edits to other people's records clear too — reset is the dev
          // "start over", and leaving them would strand edits whose fixture
          // baseline has just been restored.
          personProfiles: {},
          personSchedules: {},
          mentorRole: "Mentor",
          mentorGroups: ["North Carolina", "New Jersey"],
          schedule: cloneSchedule(DEFAULT_SCHEDULE),
          welcomeOpen: false,
          welcomeAutoShown: false,
        }),
    }),
    {
      name: "somethings.mentor-onboarding",
      // v2: interests string[] → InterestEntry[] + drop additionalImages. v3: vibe
      // board. v4: genderIdentity. v5: changeRequests list (replaces rejectionNote).
      // v6: changeRequests gain stepId/fieldKey/baselineValue/confirmedUnchanged
      // (replacing step/done). v7: add hubSteps. v8: hubWelcomeSeen (first-visit
      // hub welcome modal) replaces the old submit toast. v9: publishedSnapshot
      // (post-publish change detection). v10: accountPhoto (internal/account
      // photo on the settings Profile tab). v11: profilePhoto → matchCardPhoto
      // (§4 Phase 3 rename — draft, snapshot, and persisted change-request
      // field mappings). v12: firstMessages + storySlides (§4 Phase 3
      // extensions; snapshot backfilled so published mentors don't read as
      // falsely dirty). v13: storySlides → stories[] (LIBRARY-READY §4 rev —
      // single 'first-moment' entry; draft, snapshot, and change-request
      // fieldKeys remapped). v14: profileUpdate changeset + activity feed;
      // post-publish in_review/rejected retired. Convert state in place.
      // v19: notificationPrefs (settings-03) — sparse per-persona switch map;
      // backfill {} (defaults live in notifications-config.ts, not the store).
      // v20: caseloads (caseload prompt) — sparse per-mentor {mode,total} map;
      // backfill {} (defaults: people-demo capacity / slots.total for "live").
      // v21: mentorStatuses (manual status toggle) — sparse per-mentor override
      // map; backfill {} (fallback = fixture status / derived liveLifecycle).
      // v22: mentorAccepting (availability intent toggle) — sparse per-mentor
      // bool map; backfill {} (fallback = fixture accepting / true for "live").
      // v23: mentorRole + mentorGroups (staff-editable org role + memberships) —
      // backfill "Mentor" / the default groups.
      // v24: schedule (Active Hours) — backfill DEFAULT_SCHEDULE.
      // v25: menteeActive (per-mentee active/inactive override) — sparse map;
      //      backfill {} so a missing key falls back to the fixture's `active`.
      // v26: personProfiles + personSchedules (staff edits to OTHER people's
      //      teen-facing profile + Active Hours) — sparse maps keyed by person
      //      id; backfill {} so every field falls back to the people-demo
      //      fixture until a lead/supervisor actually changes it.
      // v28: menteeActive (boolean) → menteeStatus (active/paused/deactivated).
      //      The mentee table shows three states; a boolean can only carry two,
      //      and keeping both would be two sources for one fact. Migrate in
      //      place: false → "deactivated", anything else → "active".
      // v27: first moments UNGATED. Any open changeset may still hold
      //      firstMessages/stories entries that no longer have a review path —
      //      they'd be stuck in a queue nothing can approve. APPLY them (the
      //      draft already holds the proposed value, so publishing is just
      //      snapshotting it — same reasoning as approveProfileUpdate), drop the
      //      entries, and clear the changeset when nothing gated remains.
      // v29: careReviews (approved presentation reviews, keyed by review id) —
      //      sparse map; backfill {} so every fixture review reads as pending
      //      again. Append-only: no setter edits or removes an entry.
      // v30: careUpdates + careSummaryRefreshedAt — sparse maps, both additive.
      //      Backfill {} so a record with no staff-written updates reads as one.
      // v31: relationshipEvents (append-only ended-pairing log) — backfill [] so
      //      an older persisted state reads as "no pairing has been ended".
      // v32: guardians (parent consent per teen) + accountLocks (signup blocks)
      //      — both sparse and additive; backfill {}.
      // v33: careFlagClosures (escalation / risk-flag closures, keyed by flag
      //      id) — sparse and additive; backfill {} so an older persisted state
      //      reads as "no flag has been closed". Append-only.
      // v36: activityScenarioId (which seed scenario the Activity ledger shows)
      //      — a SCALAR, so the backfill is a default rather than {}. Defaults to
      //      the typical shift: the scenario the surface is meant to be judged on.
      // v35: activityRead (the Activity ledger's per-viewer read/clear overlay,
      //      keyed viewerId::scope::eventId) — a MAP, backfilled {}. An empty
      //      overlay means every event reads as unread, which is correct for a
      //      viewer who has never opened the feed. SCOPE IS IN THE KEY; see
      //      lib/activity/read-state.ts and standing rule 10.
      // v34: careRailOpen (Care assistant rail expanded?) — a SCALAR, not a
      //      map, so the backfill is a default rather than {}. Defaults OPEN:
      //      the rail is the tab's opening state, and a reader who has never
      //      touched it should see what it offers.
      version: 36,
      migrate: (persisted, version) => {
        const s = persisted as {
          draft?: Record<string, unknown>;
          rejectionNote?: string | null;
          changeRequests?: unknown;
          hubSteps?: unknown;
          hubWelcomeSeen?: unknown;
          publishedSnapshot?: unknown;
        };
        if (s?.draft) {
          const d = s.draft;
          if (version < 2) {
            if (Array.isArray(d.interests)) {
              d.interests = (d.interests as unknown[]).map((it) =>
                typeof it === "string" ? { name: it, photo: null } : it
              );
            }
            delete d.additionalImages;
          }
          if (version < 3 && !Array.isArray(d.vibe)) {
            d.vibe = []; // new field — backfill so reads don't break
          }
          if (version < 4 && typeof d.genderIdentity !== "string") {
            d.genderIdentity = ""; // new field — backfill so reads don't break
          }
          // v10: internal/account photo (settings Profile tab).
          if (version < 10 && !("accountPhoto" in d)) {
            d.accountPhoto = null;
          }
        }
        // v5: change-request list supersedes the single rejectionNote. Backfill an
        // empty list; carry any old note over as one item so a mid-revision reload
        // doesn't lose it.
        if (version < 5 && !Array.isArray(s.changeRequests)) {
          s.changeRequests = s.rejectionNote
            ? [
                {
                  id: "legacy",
                  step: "bio",
                  sectionLabel: "Your profile",
                  note: s.rejectionNote,
                  done: false,
                },
              ]
            : [];
        }
        // v6: map old change requests (step/done) onto the new shape. Snapshot the
        // baseline from the persisted draft so nothing reads as "edited" until the
        // mentor actually edits.
        if (version < 6 && Array.isArray(s.changeRequests)) {
          const fieldFor = (stepId: string) =>
            PROFILE_SECTIONS.find((sec) => sec.step === stepId)?.fieldKey ?? "bio";
          s.changeRequests = (s.changeRequests as Record<string, unknown>[]).map(
            (c) => {
              const stepId = (c.stepId as string) ?? (c.step as string) ?? "bio";
              const fieldKey = (c.fieldKey as string) ?? fieldFor(stepId);
              const baselineValue =
                "baselineValue" in c
                  ? c.baselineValue
                  : s.draft?.[fieldKey] ?? null;
              return {
                id: c.id,
                stepId,
                fieldKey,
                sectionLabel: c.sectionLabel,
                note: c.note,
                baselineValue,
                confirmedUnchanged:
                  (c.confirmedUnchanged as boolean) ?? Boolean(c.done),
              };
            }
          );
        }
        // v7: backfill hub-step state.
        if (version < 7) {
          if (typeof s.hubSteps !== "object" || s.hubSteps === null) {
            s.hubSteps = emptyHubSteps();
          }
        }
        // v8: first-visit hub welcome modal flag (replaces the old submit toast).
        if (version < 8) {
          if (typeof s.hubWelcomeSeen !== "boolean") {
            s.hubWelcomeSeen = false;
          }
        }
        // v9: post-publish change-detection baseline.
        if (version < 9) {
          if (!("publishedSnapshot" in s)) {
            s.publishedSnapshot = null;
          }
        }
        // v11: profilePhoto → matchCardPhoto (§4 Phase 3). Rename the field on
        // the live draft AND the published snapshot, and remap any persisted
        // change-request fieldKeys so nothing dangles. (Timing of snapshot
        // capture is untouched — this converts stored data in place.)
        if (version < 11) {
          const renamePhoto = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (rec && "profilePhoto" in rec) {
              rec.matchCardPhoto = rec.profilePhoto;
              delete rec.profilePhoto;
            }
          };
          renamePhoto(s.draft);
          renamePhoto(s.publishedSnapshot);
          if (Array.isArray(s.changeRequests)) {
            for (const c of s.changeRequests as Record<string, unknown>[]) {
              if (c.fieldKey === "profilePhoto") c.fieldKey = "matchCardPhoto";
            }
          }
        }
        // v12: First messages + First moment story (§4 Phase 3). Backfill BOTH
        // the draft and the published snapshot — a snapshot missing the keys
        // would make every published mentor read as dirty on these sections.
        if (version < 12) {
          const backfill = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (!rec) return;
            if (!("firstMessages" in rec)) {
              rec.firstMessages = { online: [], offline: [] };
            }
            if (!("storySlides" in rec)) {
              rec.storySlides = [];
            }
          };
          backfill(s.draft);
          backfill(s.publishedSnapshot);
        }
        // v13: storySlides → stories[] (LIBRARY-READY, §4 rev). The old flat
        // slide list becomes the single 'first-moment' story's slides.
        if (version < 13) {
          const toStories = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (!rec || "stories" in rec) return;
            rec.stories = [
              {
                id: "first-moment",
                type: "first-moment",
                slides: Array.isArray(rec.storySlides) ? rec.storySlides : [],
              },
            ];
            delete rec.storySlides;
          };
          toStories(s.draft);
          toStories(s.publishedSnapshot);
          if (Array.isArray(s.changeRequests)) {
            for (const c of s.changeRequests as Record<string, unknown>[]) {
              if (c.fieldKey === "storySlides") c.fieldKey = "stories";
            }
          }
        }
        // v14: Profile Update Review — post-publish in_review/rejected are
        // retired (published mentors stay published; the changeset replaces
        // the lock/reject loop). Stale whole-profile requests are dropped.
        if (version < 14) {
          if (!("profileUpdate" in s)) (s as Record<string, unknown>).profileUpdate = null;
          if (!Array.isArray((s as Record<string, unknown>).activity)) (s as Record<string, unknown>).activity = [];
          const st = s as unknown as { status?: string; publishedSnapshot?: unknown; changeRequests?: unknown };
          if (st.publishedSnapshot && (st.status === "in_review" || st.status === "rejected")) {
            st.status = "published";
            st.changeRequests = [];
          }
        }
        // v15: nickname → displayName (§9 v1.1 name-model split). Rename on
        // draft + snapshot, remap changeset/activity/change-request field ids,
        // and seed an empty display name from firstName (the §9.1 onboarding
        // seed, applied retroactively).
        if (version < 15) {
          const renameName = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (!rec) return;
            if ("nickname" in rec) {
              rec.displayName = rec.displayName ?? rec.nickname;
              delete rec.nickname;
            }
            if (!rec.displayName && typeof rec.firstName === "string") {
              rec.displayName = rec.firstName;
            }
          };
          renameName(s.draft);
          renameName(s.publishedSnapshot);
          if (Array.isArray(s.changeRequests)) {
            for (const c of s.changeRequests as Record<string, unknown>[]) {
              if (c.fieldKey === "nickname") c.fieldKey = "displayName";
            }
          }
          const st = s as unknown as {
            profileUpdate?: { fields?: { fieldId?: string }[] } | null;
            activity?: { fieldIds?: string[] }[];
          };
          for (const f of st.profileUpdate?.fields ?? []) {
            if (f.fieldId === "nickname") f.fieldId = "displayName";
          }
          for (const a of st.activity ?? []) {
            if (Array.isArray(a.fieldIds)) {
              a.fieldIds = a.fieldIds.map((id) =>
                id === "nickname" ? "displayName" : id
              );
            }
          }
        }
        // v16: Phase 10 personas + staff photo.
        if (version < 16) {
          const st = s as unknown as { persona?: unknown; staffPhoto?: unknown };
          if (typeof st.persona !== "string") st.persona = "mentor";
          if (!("staffPhoto" in st)) st.staffPhoto = null;
        }
        // v17: record-05 — internal staff notes + teen-visibility flag.
        if (version < 17) {
          const st = s as unknown as {
            internalNotes?: unknown;
            profileHidden?: unknown;
          };
          if (!Array.isArray(st.internalNotes)) st.internalNotes = [];
          if (typeof st.profileHidden !== "boolean") st.profileHidden = false;
        }
        // v18: "entered home" flag for the dev lens / approved-screen gate.
        // Backfill: an already-published mentor has, by definition, been
        // through approval — treat them as home so they don't see a spurious
        // "You're approved!" on the next Mentor switch.
        if (version < 18) {
          const st = s as unknown as {
            enteredHome?: unknown;
            publishedSnapshot?: unknown;
          };
          if (typeof st.enteredHome !== "boolean") {
            st.enteredHome = st.publishedSnapshot != null;
          }
        }
        // v19: notification preferences map (settings-03). Sparse — an empty
        // object means "all categories at their default".
        if (version < 19) {
          const st = s as unknown as { notificationPrefs?: unknown };
          if (typeof st.notificationPrefs !== "object" || st.notificationPrefs === null) {
            st.notificationPrefs = {};
          }
        }
        // v20: per-mentor caseload overrides (caseload prompt). Sparse — an
        // empty object means "automatic at each mentor's default capacity".
        if (version < 20) {
          const st = s as unknown as { caseloads?: unknown };
          if (typeof st.caseloads !== "object" || st.caseloads === null) {
            st.caseloads = {};
          }
        }
        if (version < 21) {
          const st = s as unknown as { mentorStatuses?: unknown };
          if (
            typeof st.mentorStatuses !== "object" ||
            st.mentorStatuses === null
          ) {
            st.mentorStatuses = {};
          }
        }
        if (version < 22) {
          const st = s as unknown as { mentorAccepting?: unknown };
          if (
            typeof st.mentorAccepting !== "object" ||
            st.mentorAccepting === null
          ) {
            st.mentorAccepting = {};
          }
        }
        if (version < 23) {
          const st = s as unknown as {
            mentorRole?: unknown;
            mentorGroups?: unknown;
          };
          if (typeof st.mentorRole !== "string") st.mentorRole = "Mentor";
          if (!Array.isArray(st.mentorGroups))
            st.mentorGroups = ["North Carolina", "New Jersey"];
        }
        if (version < 24) {
          const st = s as unknown as { schedule?: unknown };
          if (typeof st.schedule !== "object" || st.schedule === null) {
            st.schedule = cloneSchedule(DEFAULT_SCHEDULE);
          }
        }
        if (version < 25) {
          const st = s as unknown as { menteeActive?: unknown };
          if (typeof st.menteeActive !== "object" || st.menteeActive === null) {
            st.menteeActive = {};
          }
        }
        if (version < 26) {
          const st = s as unknown as {
            personProfiles?: unknown;
            personSchedules?: unknown;
          };
          if (
            typeof st.personProfiles !== "object" ||
            st.personProfiles === null
          ) {
            st.personProfiles = {};
          }
          if (
            typeof st.personSchedules !== "object" ||
            st.personSchedules === null
          ) {
            st.personSchedules = {};
          }
        }
        if (version < 27) {
          // Release first-moments fields from any open changeset, publishing
          // the mentor's proposed value rather than discarding their work.
          const st = s as unknown as {
            profileUpdate?: ProfileUpdate | null;
            draft?: Record<string, unknown>;
            publishedSnapshot?: Record<string, unknown> | null;
          };
          const u = st.profileUpdate;
          if (u && Array.isArray(u.fields)) {
            const releasing = u.fields.filter((f) =>
              isImmediateTeenFacingField(f.fieldId)
            );
            if (releasing.length > 0) {
              // The draft holds the proposed value — snapshotting it publishes.
              if (st.publishedSnapshot && st.draft) {
                for (const f of releasing) {
                  st.publishedSnapshot[f.fieldId] = st.draft[f.fieldId];
                }
              }
              const rest = u.fields.filter(
                (f) => !isImmediateTeenFacingField(f.fieldId)
              );
              st.profileUpdate = rest.length > 0 ? { ...u, fields: rest } : null;
            }
          }
        }
        if (version < 28) {
          const st = s as unknown as {
            menteeActive?: Record<string, boolean>;
            menteeStatus?: Record<string, MenteeStatus>;
          };
          if (typeof st.menteeStatus !== "object" || st.menteeStatus === null) {
            const out: Record<string, MenteeStatus> = {};
            for (const [id, wasActive] of Object.entries(st.menteeActive ?? {})) {
              out[id] = wasActive === false ? "deactivated" : "active";
            }
            st.menteeStatus = out;
          }
          delete st.menteeActive;
        }
        if (version < 32) {
          const st = s as unknown as {
            guardians?: Record<string, GuardianDetails>;
            accountLocks?: Record<string, AccountLock>;
          };
          if (typeof st.guardians !== "object" || st.guardians === null)
            st.guardians = {};
          if (typeof st.accountLocks !== "object" || st.accountLocks === null)
            st.accountLocks = {};
        }
        if (version < 31) {
          const st = s as unknown as { relationshipEvents?: RelationshipEvent[] };
          if (!Array.isArray(st.relationshipEvents)) st.relationshipEvents = [];
        }
        if (version < 30) {
          const st = s as unknown as {
            careUpdates?: Record<string, CareUpdateRecord>;
            careSummaryRefreshedAt?: Record<string, number>;
          };
          if (typeof st.careUpdates !== "object" || st.careUpdates === null) {
            st.careUpdates = {};
          }
          if (
            typeof st.careSummaryRefreshedAt !== "object" ||
            st.careSummaryRefreshedAt === null
          ) {
            st.careSummaryRefreshedAt = {};
          }
        }
        if (version < 29) {
          // careReviews is new and additive — backfill the empty map so every
          // fixture review reads as pending on an older persisted state.
          const st = s as unknown as {
            careReviews?: Record<string, CareReviewDecision>;
          };
          if (typeof st.careReviews !== "object" || st.careReviews === null) {
            st.careReviews = {};
          }
          // v36: a scalar preference — backfill the default, not {}.
          const st36 = persisted as { activityScenarioId?: unknown };
          if (typeof st36.activityScenarioId !== "string") {
            st36.activityScenarioId = "typical-shift";
          }
          // v35: a MAP — {} is the right backfill (see the version log above).
          const st35 = persisted as { activityRead?: unknown };
          if (
            typeof st35.activityRead !== "object" ||
            st35.activityRead === null
          ) {
            st35.activityRead = {};
          }
          // v34: a scalar preference — backfill the default, not {}.
          const st34 = persisted as { careRailOpen?: unknown };
          if (typeof st34.careRailOpen !== "boolean") {
            st34.careRailOpen = true;
          }
          // v33: same backfill, same reasoning as careReviews above.
          const st33 = persisted as { careFlagClosures?: unknown };
          if (
            typeof st33.careFlagClosures !== "object" ||
            st33.careFlagClosures === null
          ) {
            st33.careFlagClosures = {};
          }
        }
        return s as unknown as OnboardingState;
      },
      // Self-healing merge — defense-in-depth for the shape transforms.
      // `migrate` only runs when the stored version MISmatches; twice in dev
      // we observed a store stamped with the current version WITHOUT its
      // transforms applied (rehydrate/write race), which would otherwise never
      // repair. This mirrors the v10–v12 shape changes idempotently on every
      // rehydrate. Data plumbing only — snapshot-capture timing is untouched.
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<OnboardingState>),
        } as OnboardingState;
        const repair = (o: unknown) => {
          const rec = o as Record<string, unknown> | null | undefined;
          if (!rec) return;
          if ("profilePhoto" in rec) {
            rec.matchCardPhoto = rec.matchCardPhoto ?? rec.profilePhoto;
            delete rec.profilePhoto;
          }
          if (!("accountPhoto" in rec)) rec.accountPhoto = null;
          if (!("firstMessages" in rec)) {
            rec.firstMessages = { online: [], offline: [] };
          }
          // storySlides (v12 shape) → stories[] (v13); backfill when absent.
          if (!("stories" in rec)) {
            rec.stories = [
              {
                id: "first-moment",
                type: "first-moment",
                slides: Array.isArray(rec.storySlides) ? rec.storySlides : [],
              },
            ];
          }
          delete rec.storySlides;
          // nickname (≤v14 shape) → displayName (v15). Shape repair only —
          // the firstName seed is one-time (migrate), not per-rehydrate, so a
          // deliberately cleared display name stays cleared.
          if ("nickname" in rec) {
            rec.displayName = rec.displayName ?? rec.nickname;
            delete rec.nickname;
          }
          if (typeof rec.displayName !== "string") rec.displayName = "";
        };
        repair(merged.draft);
        repair(merged.publishedSnapshot);
        if (Array.isArray(merged.changeRequests)) {
          for (const c of merged.changeRequests as unknown as Record<
            string,
            unknown
          >[]) {
            if (c.fieldKey === "profilePhoto") c.fieldKey = "matchCardPhoto";
            if (c.fieldKey === "storySlides") c.fieldKey = "stories";
            if (c.fieldKey === "nickname") c.fieldKey = "displayName";
          }
        }
        for (const f of merged.profileUpdate?.fields ?? []) {
          if (f.fieldId === "nickname") f.fieldId = "displayName";
        }
        // v16 shape (top-level persona + staffPhoto).
        if (typeof (merged as { persona?: unknown }).persona !== "string") {
          merged.persona = "mentor";
        }
        if (typeof merged.staffPhoto === "undefined") merged.staffPhoto = null;
        if (typeof (merged as { enteredHome?: unknown }).enteredHome !== "boolean") {
          merged.enteredHome = merged.publishedSnapshot != null;
        }
        // v19 shape: notificationPrefs is always a plain object.
        if (
          typeof (merged as { notificationPrefs?: unknown }).notificationPrefs !==
            "object" ||
          merged.notificationPrefs === null
        ) {
          merged.notificationPrefs = {};
        }
        // v20 shape: caseloads is always a plain object.
        if (
          typeof (merged as { caseloads?: unknown }).caseloads !== "object" ||
          merged.caseloads === null
        ) {
          merged.caseloads = {};
        }
        // v21 shape: mentorStatuses is always a plain object.
        if (
          typeof (merged as { mentorStatuses?: unknown }).mentorStatuses !==
            "object" ||
          merged.mentorStatuses === null
        ) {
          merged.mentorStatuses = {};
        }
        // v22 shape: mentorAccepting is always a plain object.
        if (
          typeof (merged as { mentorAccepting?: unknown }).mentorAccepting !==
            "object" ||
          merged.mentorAccepting === null
        ) {
          merged.mentorAccepting = {};
        }
        // v23 shape: mentorRole (string) + mentorGroups (array).
        if (typeof (merged as { mentorRole?: unknown }).mentorRole !== "string") {
          merged.mentorRole = "Mentor";
        }
        if (!Array.isArray((merged as { mentorGroups?: unknown }).mentorGroups)) {
          merged.mentorGroups = ["North Carolina", "New Jersey"];
        }
        // v24 shape: schedule is always a Schedule object.
        if (
          typeof (merged as { schedule?: unknown }).schedule !== "object" ||
          merged.schedule === null
        ) {
          merged.schedule = cloneSchedule(DEFAULT_SCHEDULE);
        }
        // v32 shape: both new maps are always plain objects.
        if (
          typeof (merged as { guardians?: unknown }).guardians !== "object" ||
          merged.guardians === null
        ) {
          merged.guardians = {};
        }
        if (
          typeof (merged as { accountLocks?: unknown }).accountLocks !== "object" ||
          merged.accountLocks === null
        ) {
          merged.accountLocks = {};
        }
        // v31 shape: relationshipEvents is always an ARRAY (not a map).
        if (!Array.isArray((merged as { relationshipEvents?: unknown }).relationshipEvents)) {
          merged.relationshipEvents = [];
        }
        // v30 shape: the care-update maps are always plain objects.
        if (
          typeof (merged as { careUpdates?: unknown }).careUpdates !== "object" ||
          merged.careUpdates === null
        ) {
          merged.careUpdates = {};
        }
        if (
          typeof (merged as { careSummaryRefreshedAt?: unknown })
            .careSummaryRefreshedAt !== "object" ||
          merged.careSummaryRefreshedAt === null
        ) {
          merged.careSummaryRefreshedAt = {};
        }
        // v29 shape: careReviews is always a plain object.
        if (
          typeof (merged as { careReviews?: unknown }).careReviews !== "object" ||
          merged.careReviews === null
        ) {
          merged.careReviews = {};
        }
        // v28 shape: menteeStatus is always a plain object.
        if (
          typeof (merged as { menteeStatus?: unknown }).menteeStatus !== "object" ||
          merged.menteeStatus === null
        ) {
          merged.menteeStatus = {};
        }
        // v26 shape: the person-override maps are always plain objects.
        if (
          typeof (merged as { personProfiles?: unknown }).personProfiles !==
            "object" ||
          merged.personProfiles === null
        ) {
          merged.personProfiles = {};
        }
        if (
          typeof (merged as { careFlagClosures?: unknown }).careFlagClosures !==
            "object" ||
          merged.careFlagClosures === null
        ) {
          merged.careFlagClosures = {};
        }
        if (
          typeof (merged as { careRailOpen?: unknown }).careRailOpen !== "boolean"
        ) {
          merged.careRailOpen = true;
        }
        if (
          typeof (merged as { activityRead?: unknown }).activityRead !==
            "object" ||
          merged.activityRead === null
        ) {
          merged.activityRead = {};
        }
        if (
          typeof (merged as { activityScenarioId?: unknown })
            .activityScenarioId !== "string"
        ) {
          merged.activityScenarioId = "typical-shift";
        }
        if (
          typeof (merged as { personSchedules?: unknown }).personSchedules !==
            "object" ||
          merged.personSchedules === null
        ) {
          merged.personSchedules = {};
        }
        // v27 invariant: NO ungated field may sit in the changeset. Such an
        // entry is unreachable — no surface can approve it — so it would pin a
        // "Profile updates" queue item forever. Idempotent, so it also repairs a
        // store stamped v27 whose migrate didn't run (the rehydrate/write race
        // this merge exists for).
        if (merged.profileUpdate) {
          const keep = merged.profileUpdate.fields.filter(
            (f) => !isImmediateTeenFacingField(f.fieldId)
          );
          if (keep.length !== merged.profileUpdate.fields.length) {
            merged.profileUpdate =
              keep.length > 0
                ? { ...merged.profileUpdate, fields: keep }
                : null;
          }
        }
        return merged;
      },
      // Quota-resilient: if a write exceeds the localStorage limit (or storage
      // is unavailable, e.g. SSR / private mode), keep working in-memory
      // instead of throwing.
      storage: createJSONStorage(() => ({
        getItem: (name) =>
          typeof localStorage === "undefined"
            ? null
            : localStorage.getItem(name),
        setItem: (name, value) => {
          if (typeof localStorage === "undefined") return;
          try {
            localStorage.setItem(name, value);
          } catch {
            // Out of quota / private mode — the draft stays in memory.
          }
        },
        removeItem: (name) => {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(name);
          }
        },
      })),
      // Never persist the password, or the recorded clip's blob URL (dead after
      // reload, and large) — both stay in-memory only. The snapshot is already
      // stored in that safe shape (see snapshotDraft).
      partialize: (state) => ({
        draft: {
          ...state.draft,
          password: "",
          media: { ...state.draft.media, url: null },
        },
        status: state.status,
        completed: state.completed,
        rejectionNote: state.rejectionNote,
        changeRequests: state.changeRequests,
        publishedSnapshot: state.publishedSnapshot,
        hubSteps: state.hubSteps,
        hubWelcomeSeen: state.hubWelcomeSeen,
        slots: state.slots,
        accountStatus: state.accountStatus,
        deactivatedOn: state.deactivatedOn,
        profileUpdate: state.profileUpdate,
        activity: state.activity,
        persona: state.persona,
        staffPhoto: state.staffPhoto,
        internalNotes: state.internalNotes,
        profileHidden: state.profileHidden,
        enteredHome: state.enteredHome,
        notificationPrefs: state.notificationPrefs,
        caseloads: state.caseloads,
        mentorStatuses: state.mentorStatuses,
        mentorAccepting: state.mentorAccepting,
        menteeStatus: state.menteeStatus,
        careReviews: state.careReviews,
        careFlagClosures: state.careFlagClosures,
        careRailOpen: state.careRailOpen,
        activityRead: state.activityRead,
        activityScenarioId: state.activityScenarioId,
        careUpdates: state.careUpdates,
        careSummaryRefreshedAt: state.careSummaryRefreshedAt,
        relationshipEvents: state.relationshipEvents,
        guardians: state.guardians,
        accountLocks: state.accountLocks,
        personProfiles: state.personProfiles,
        personSchedules: state.personSchedules,
        mentorRole: state.mentorRole,
        mentorGroups: state.mentorGroups,
        schedule: state.schedule,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    }
  )
);
