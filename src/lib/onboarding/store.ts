"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  emptyDraft,
  type ChangeRequest,
  type HubStepKey,
  type HubStepStatus,
  type MentorDraft,
  type ProfileStatus,
  type ProfileUpdate,
  type ActivityItem,
  type Persona,
  type InternalNote,
} from "@/lib/types";
import {
  PROFILE_SECTIONS,
  normForCompare,
} from "@/lib/onboarding/profile-sections";
import { isGatedField, cloneValue } from "@/lib/onboarding/profile-update";
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
      slots: { total: 5, dailyNew: 1 },
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
          if (fields.length === 0) return { draft, profileUpdate: null };
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
          slots: { total: 5, dailyNew: 1 },
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
      version: 20,
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    }
  )
);
