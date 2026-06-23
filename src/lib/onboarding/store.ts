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

interface OnboardingState {
  draft: MentorDraft;
  status: ProfileStatus;
  completed: string[]; // slugs the mentor has saved
  rejectionNote: string | null;
  /** Section-tied changes the reviewer requested; read by the dock, the welcome
   *  modal, and the per-step note cards. */
  changeRequests: ChangeRequest[];
  /** Per-step completion for the four non-profile hub steps. The Profile step's
   *  status is derived from `status` (see lib/onboarding/hub.ts), not stored here. */
  hubSteps: Record<HubStepKey, HubStepStatus>;
  /** Shown-once flag for the hub's first-visit welcome modal. Set true the first
   *  time the hub opens the intro, so it never reappears. Persisted. */
  hubWelcomeSeen: boolean;
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
      hubSteps: emptyHubSteps(),
      hubWelcomeSeen: false,
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

      setHasHydrated: () => set({ _hasHydrated: true }),

      reset: () =>
        set({
          draft: emptyDraft(),
          status: "invited",
          completed: [],
          rejectionNote: null,
          changeRequests: [],
          hubSteps: emptyHubSteps(),
          hubWelcomeSeen: false,
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
      // hub welcome modal) replaces the old submit toast. Convert state in place.
      version: 8,
      migrate: (persisted, version) => {
        const s = persisted as {
          draft?: Record<string, unknown>;
          rejectionNote?: string | null;
          changeRequests?: unknown;
          hubSteps?: unknown;
          hubWelcomeSeen?: unknown;
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
        return s as unknown as OnboardingState;
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
      // reload, and large) — both stay in-memory only.
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
        hubSteps: state.hubSteps,
        hubWelcomeSeen: state.hubWelcomeSeen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    }
  )
);
