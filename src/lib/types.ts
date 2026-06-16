// Core data model for the mentor onboarding prototype.
// Everything here is held client-side (zustand + localStorage) — see lib/onboarding/store.ts.
// A real backend would replace lib/mock-api.ts and persist this shape server-side.

export type ProfileStatus =
  | "invited" // invite received, not yet accepted
  | "pending" // account created, profile being built (Pending / Unpublished)
  | "in_review" // submitted, awaiting clinical recruitment review
  | "published" // approved & live (Published / Active)
  | "rejected"; // sent back for changes

export interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string; // base64 — mock for a real upload + URL
  interests: string[]; // interest tags this photo shows (from INTEREST_OPTIONS)
}

export interface MediaIntro {
  kind: "audio" | "video" | null;
  name: string | null;
  /** In-memory object URL for the recorded/uploaded clip (not persisted). */
  url: string | null;
  durationSec: number | null;
}

export interface DayAvailability {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export type WeeklySchedule = Record<Weekday, DayAvailability>;

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

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
  lifeExperiences: string[];
  interests: string[];
  additionalImages: UploadedImage[];
  messages: { online: string; offline: string };
  schedule: WeeklySchedule;
}

export function emptySchedule(): WeeklySchedule {
  return WEEKDAYS.reduce((acc, day) => {
    acc[day] = { enabled: false, start: "16:00", end: "19:00" };
    return acc;
  }, {} as WeeklySchedule);
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
    lifeExperiences: [],
    interests: [],
    additionalImages: [],
    messages: { online: "", offline: "" },
    schedule: emptySchedule(),
  };
}
