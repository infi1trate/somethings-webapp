// Core data model for the mentor onboarding prototype.
// Everything here is held client-side (zustand + localStorage) — see lib/onboarding/store.ts.
// A real backend would replace lib/mock-api.ts and persist this shape server-side.

/** Dev-toggle persona (§ Phase 10, decision #11 rev) — which hat the viewer
 *  wears. Maps onto SettingsRole for tab gating (see tabs-config). "Admin" is
 *  renamed Supervisor everywhere (decision #12). */
/** Who is viewing. "admin" is a STUB tier (MO-9.1): full supervisor capability
 *  plus, eventually, managing supervisors — those functions don't exist yet, so
 *  nothing here grants them. Everywhere that means "supervisor or above" asks
 *  isSupervisorTier() rather than comparing to a literal. */
export type Persona =
  | "new-mentor"
  | "mentor"
  | "lead-mentor"
  | "supervisor"
  | "admin";

export type ProfileStatus =
  | "invited" // invite received, not yet accepted
  | "pending" // account created, profile being built (Pending / Unpublished)
  | "in_review" // submitted, awaiting clinical recruitment review
  | "published" // approved & live (Published / Active)
  | "rejected"; // changes requested — sent back for revision (badge: "Needs changes")

/** Mentor lifecycle standing shown on the Mentors roster + record (a scaled
 *  replacement for the old binary active/inactive + "Incomplete profile" flag).
 *  Ordered progression — see STATUS_ORDER in lib/record/mentor-status.ts.
 *  - in-training: setting up account + completing training; cannot mentor yet
 *    (ABSORBS the old "Incomplete" profile flag).
 *  - guided: full mentor, capped at 5 mentees, under closer supervision.
 *  - active: full mentor, no cap constraints beyond normal.
 *  - paused: account live, no active mentees, temporarily cannot mentor.
 *  - deactivated: off-boarded. */
export type MentorLifecycleStatus =
  | "in-training"
  | "guided"
  | "active"
  | "paused"
  | "deactivated";

/** Whether a mentor is open to new mentees — a SEPARATE axis from lifecycle
 *  status, meaningful only for statuses that can mentor (guided, active). For
 *  in-training/paused/deactivated it is not applicable (represented as null and
 *  rendered "—"). "full" is derived from the caseload (count === cap); see
 *  availabilityFor() in lib/record/mentor-status.ts. */
export type MentorAvailability = "accepting" | "full" | "not-accepting";

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
 *  fields are killed (text lives on the image itself). Delivered in chat, not
 *  on the match card.
 *
 *  THREE PER STORY, and VERTICAL (9:16 — a phone held upright), UI-enforced.
 *  Was six: a story is now defined as exactly three mobile-oriented images, so
 *  the editor offers three slots and the tiles carry the phone's aspect rather
 *  than a 3:4 crop no delivered slide ever had.
 *
 *  STAFF-MANAGED (user decision). A mentor does not add, edit or SEE their own
 *  story — a lead mentor or supervisor curates it on the mentor's record. The
 *  mentor's own First moments tab holds their first messages only. */
export interface StorySlide {
  id: string;
  /** A downscaled WebP data URL for a real upload; fixture stories point at a
   *  file under /public/stories instead, so demo slides cost the source tree
   *  nothing. Both are just an <img src>. */
  photo: string;
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
   *  preview header (renamed from `profilePhoto`, §4 Phase 3). Lives in the
   *  Profile tab's Match card group (Phase 9). Distinct from `accountPhoto`. */
  matchCardPhoto: string | null;
  /** CHAT AVATAR — the mentor's avatar in chats and other teen-facing
   *  surfaces (product-confirmed 2026-07-17). Lives in the Profile tab's Chat
   *  group (Phase 9); plain photo, no cut-out. Teen-visible ⇒ gated
   *  post-publish (Profile Update Review changeset). */
  accountPhoto: string | null;
  /** Teen-facing display name (§9 v1.1) — gated through the review
   *  changeset. Distinct from firstName/lastName (account identity:
   *  ops/admin only, never teen-visible, locked post-approval). Seeded
   *  from firstName at onboarding. */
  displayName: string;
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

// ── Profile Update Review (post-publish changeset) ─────────────────────────
// One open changeset per mentor, max. Gated edits enqueue here; teens keep
// seeing the last approved profile (publishedSnapshot) until admin approval.
// Cleared on approval or when the last field is discarded.

export interface ProfileUpdateField {
  fieldId: string; // MentorDraft key, e.g. "bio"
  /** Live value snapshotted AT ENQUEUE TIME — never re-derived (§1.5). */
  liveValue: unknown;
  fieldStatus: "pending" | "changes-requested";
  adminNote: string | null;
}

export interface ProfileUpdate {
  id: string;
  status: "pending" | "changes-requested";
  submittedAt: number;
  updatedAt: number;
  fields: ProfileUpdateField[];
}

/** One internal staff note on the Mentor Record (record-05) — supervisor/
 *  admin channel ONLY. Mentors never see these; anything the mentor should
 *  read goes through change requests instead. Append-only (audit-log
 *  semantics). */
export interface InternalNote {
  id: string;
  text: string;
  author: string; // staff actor label, e.g. "Supervisor"
  createdAt: number;
}

export interface ActivityItem {
  id: string;
  type:
    | "profile_changes_requested"
    | "profile_update_live"
    /** record-04a: a staff member edited an account field on the Mentor
     *  Record. Staff-attributed (never reads as the mentor's own action)
     *  and doubles as the record's "Last changed by" audit trail. */
    | "staff_account_edit"
    /** record-05: staff hid / restored the profile's teen visibility. */
    | "profile_unpublished"
    | "profile_republished";
  fieldIds: string[];
  createdAt: number;
  read: boolean;
  /** Staff actor label for staff_account_edit ("Supervisor" / "Lead mentor"). */
  actor?: string;
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
    displayName: "",
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
