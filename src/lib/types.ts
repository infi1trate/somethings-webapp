// Core data model for the mentor onboarding prototype.
// Everything here is held client-side (zustand + localStorage) — see lib/onboarding/store.ts.
// A real backend would replace lib/mock-api.ts and persist this shape server-side.

export type ProfileStatus =
  | "invited" // invite received, not yet accepted
  | "pending" // account created, profile being built (Pending / Unpublished)
  | "in_review" // submitted, awaiting clinical recruitment review
  | "published" // approved & live (Published / Active)
  | "rejected"; // sent back for changes

/** One chosen interest and the photo the mentor attached to it (1:1 — the DB
 *  models interests this way: one representative photo per interest). */
export interface InterestEntry {
  name: string; // from INTEREST_OPTIONS
  photo: string | null; // downscaled WebP data URL of "me doing {name}", or null
}

/** One image on the "vibe board" — a feeling/aesthetic photo from the mentor's
 *  own camera roll, optionally framed by the prompt that surfaced it. The board
 *  reads as a curated set; see steps/vibe.tsx + vibe-board-field.tsx. */
export interface VibePhoto {
  id: string;
  photo: string; // downscaled WebP data URL
  prompt: string | null; // the prompt that framed this pick (context; null if free-added)
}

export interface MediaIntro {
  kind: "audio" | null;
  name: string | null;
  /** In-memory object URL for the recorded/uploaded clip (not persisted). */
  url: string | null;
  durationSec: number | null;
}

export interface MentorDraft {
  // Account
  password: string; // not persisted (see store) — prototype only
  // About you
  firstName: string;
  lastName: string;
  email: string;
  dob: string; // YYYY-MM-DD
  phone: string;
  // Profile
  profilePhoto: string | null; // background-removed cutout, data URL
  nickname: string;
  sex: string;
  pronouns: string[];
  races: string[];
  languages: string[];
  bio: string;
  spotifyUrl: string;
  media: MediaIntro;
  vibe: VibePhoto[]; // the "vibe board" — sits above interests on the profile
  interests: InterestEntry[];
}

export function emptyDraft(): MentorDraft {
  return {
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    dob: "",
    phone: "",
    profilePhoto: null,
    nickname: "",
    sex: "",
    pronouns: [],
    races: [],
    languages: [],
    bio: "",
    spotifyUrl: "",
    media: { kind: null, name: null, url: null, durationSec: null },
    vibe: [],
    interests: [],
  };
}
