// Core data model for the mentor onboarding prototype.
// Everything here is held client-side (zustand + localStorage) — see lib/onboarding/store.ts.
// A real backend would replace lib/mock-api.ts and persist this shape server-side.

export type ProfileStatus =
  | "invited" // invite received, not yet accepted
  | "pending" // account created, profile being built (Pending / Unpublished)
  | "in_review" // submitted, awaiting clinical recruitment review
  | "published" // approved & live (Published / Active)
  | "rejected"; // changes requested — sent back for revision (badge: "Needs changes")

/** Completion status for the four non-profile hub steps (Story, Training,
 *  Scheduling, Away messages). */
export type HubStepStatus = "not_started" | "in_progress" | "done";

/** The four non-profile hub steps. The Profile step is derived from
 *  ProfileStatus (see lib/onboarding/hub.ts), so it isn't keyed here. */
export type HubStepKey = "story" | "training" | "scheduling" | "away";

/** The Profile step's review sub-state shown in the hub — the spec's vocabulary,
 *  DERIVED from ProfileStatus + progress (see lib/onboarding/hub.ts). */
export type ProfileStepStatus =
  | "not_started"
  | "draft"
  | "in_review"
  | "returned"
  | "approved";

/** How a change request has been addressed. Derived, not just stored: `edited`
 *  is auto-detected from the live field value vs its baseline; `confirmed-
 *  unchanged` is an explicit override; `none` is neither. See
 *  lib/onboarding/change-requests.ts. */
export type AddressedState = "none" | "edited" | "confirmed-unchanged";

/** One change the reviewer asked for, tied 1:1 to a single profile field.
 *  Written by the admin review screen; read by the welcome-back modal, the
 *  per-step note card, and the revision dock. */
export interface ChangeRequest {
  id: string;
  stepId: string; // STEP_ORDER slug the mentor jumps to (e.g. "bio")
  fieldKey: string; // the single MentorDraft field this request governs (1:1)
  sectionLabel: string; // human label, e.g. "Bio"
  note: string; // reviewer's free text — treat as untrusted for layout
  /** Snapshot of `fieldKey`'s value when the profile entered "needs changes" —
   *  the comparison anchor for auto-detecting an edit. */
  baselineValue: unknown;
  /** Mentor explicitly confirmed the field is fine as-is despite no change. */
  confirmedUnchanged: boolean;
}

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

/** One canned first message (§4 “First messages”) — sent automatically when a
 *  teen opens the mentor's chat for the first time. Delivered in chat, never
 *  rendered on the match card / phone preview. */
export interface FirstMessage {
  id: string;
  text: string;
}

/** The two first-message channels — which list sends depends on whether the
 *  mentor is online when the teen opens the chat. */
export interface FirstMessages {
  online: FirstMessage[];
  offline: FirstMessage[];
}

/** One image slide of a story (§4) — image only; the old eyebrow/header text
 *  fields are killed (text lives on the image itself). Max 6 per story,
 *  UI-enforced. Delivered in chat, not on the match card. */
export interface StorySlide {
  id: string;
  photo: string; // downscaled WebP data URL
}

/** LIBRARY-READY (§4 rev): stories are modeled as a collection so future story
 *  types can join without another migration. Today exactly ONE entry exists —
 *  the 'first-moment' story shown on the First moments tab. */
export interface Story {
  id: string;
  type: "first-moment";
  slides: StorySlide[];
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
  /** Teen-facing MATCH CARD photo — the background-removed cutout in the phone
   *  preview header (renamed from `profilePhoto`, §4 Phase 3). Distinct from
   *  the internal `accountPhoto` on the settings Profile tab. */
  matchCardPhoto: string | null;
  /** Account photo (Profile tab) — the mentor's avatar in chats and other
   *  teen-facing surfaces (product-confirmed 2026-07-17; the spec's "internal"
   *  note in §4 is wrong). Distinct from the match-card cutout
   *  (`matchCardPhoto`). Saved directly from settings; never enters the
   *  review loop. */
  accountPhoto: string | null;
  nickname: string;
  sex: string;
  genderIdentity: string;
  pronouns: string[];
  races: string[];
  languages: string[];
  bio: string;
  spotifyUrl: string;
  media: MediaIntro;
  vibe: VibePhoto[]; // the "vibe board" — sits above interests on the profile
  interests: InterestEntry[];
  // First-moments content (§4 rev) — chat-delivered, previewed as a chat
  // thread on the First moments tab (never on the match card).
  firstMessages: FirstMessages;
  stories: Story[];
}

export function emptyDraft(): MentorDraft {
  return {
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    dob: "",
    phone: "",
    matchCardPhoto: null,
    accountPhoto: null,
    nickname: "",
    sex: "",
    genderIdentity: "",
    pronouns: [],
    races: [],
    languages: [],
    bio: "",
    spotifyUrl: "",
    media: { kind: null, name: null, url: null, durationSec: null },
    vibe: [],
    interests: [],
    firstMessages: { online: [], offline: [] },
    stories: [{ id: "first-moment", type: "first-moment", slides: [] }],
  };
}

/** The single 'first-moment' story (§4 rev keeps exactly one today). */
export function firstMomentStory(stories: Story[]): Story {
  return (
    stories.find((s) => s.type === "first-moment") ?? {
      id: "first-moment",
      type: "first-moment",
      slides: [],
    }
  );
}
