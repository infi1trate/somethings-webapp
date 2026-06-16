"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { emptyDraft, type MentorDraft, type ProfileStatus } from "@/lib/types";

interface OnboardingState {
  draft: MentorDraft;
  status: ProfileStatus;
  completed: string[]; // slugs the mentor has saved
  rejectionNote: string | null;
  _hasHydrated: boolean;

  update: (patch: Partial<MentorDraft>) => void;
  markComplete: (slug: string) => void;
  setStatus: (status: ProfileStatus) => void;
  acceptInvite: (prefill: Partial<MentorDraft>) => void;
  setRejection: (note: string | null) => void;
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

      setHasHydrated: () => set({ _hasHydrated: true }),

      reset: () =>
        set({
          draft: emptyDraft(),
          status: "invited",
          completed: [],
          rejectionNote: null,
        }),
    }),
    {
      name: "somethings.mentor-onboarding",
      // v2: interests went from string[] → InterestEntry[] (1:1 interest↔photo)
      // and the separate additionalImages gallery was removed. Convert old
      // persisted drafts in place so a reload doesn't break on the new shape.
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as { draft?: Record<string, unknown> };
        if (s?.draft && version < 2) {
          const d = s.draft;
          if (Array.isArray(d.interests)) {
            d.interests = (d.interests as unknown[]).map((it) =>
              typeof it === "string" ? { name: it, photo: null } : it
            );
          }
          delete d.additionalImages;
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    }
  )
);
