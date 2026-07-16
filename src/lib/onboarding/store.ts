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
} from "@/lib/types";
import { PROFILE_SECTIONS } from "@/lib/onboarding/profile-sections";
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
  /** Admin-owned account config (§4 Roles & permissions, Phase 6). Top-level
   *  additions backfill via the shallow persist merge — no migration needed. */
  slots: { total: number; dailyNew: number };
  accountStatus: "active" | "deactivated";
  deactivatedOn: string | null; // display date, set at deactivation
  /** Session-only UI for the welcome-back modal (not persisted — shows once per
   *  session entry, reopenable from the dock). */
  welcomeOpen: boolean;
  welcomeAutoShown: boolean;
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
  /** Admin: mentor-slots config (§4 Phase 6). */
  setSlots: (patch: Partial<{ total: number; dailyNew: number }>) => void;
  /** Admin: reversible deactivation round-trip (§4 Phase 6). */
  setAccountStatus: (
    status: "active" | "deactivated",
    deactivatedOn?: string | null
  ) => void;
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
      welcomeOpen: false,
      welcomeAutoShown: false,
      _hasHydrated: false,

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
      // fieldKeys remapped). Convert state in place.
      version: 13,
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    }
  )
);
