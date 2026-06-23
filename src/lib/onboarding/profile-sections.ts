// The mentor profile broken into reviewable sections, each tied 1:1 to the
// builder step a mentor jumps back to AND the single draft field it governs.
// Used by the admin review screen (per-section "Request a change" + baseline
// capture) and to label the change requests the dock/modal/cards read.
// `step` values are STEP_ORDER slugs (see steps.ts).

import type { MentorDraft } from "@/lib/types";

export interface ProfileSection {
  step: string; // STEP_ORDER slug — where "Go to" / "Jump back in" lands
  fieldKey: keyof MentorDraft; // the single draft field this section governs (1:1)
  label: string; // human label shown to admin + mentor
  /** Compact read-only summary of the current value, for the review list. */
  summary: (draft: MentorDraft) => string;
}

const EMPTY = "—";

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    step: "profile-photo",
    fieldKey: "profilePhoto",
    label: "Profile photo",
    summary: (d) => (d.profilePhoto ? "Photo added" : "No photo yet"),
  },
  {
    step: "nickname",
    fieldKey: "nickname",
    label: "Display name",
    summary: (d) => d.nickname || d.firstName || EMPTY,
  },
  {
    step: "languages",
    fieldKey: "languages",
    label: "Languages",
    summary: (d) => (d.languages.length ? d.languages.join(", ") : EMPTY),
  },
  {
    step: "bio",
    fieldKey: "bio",
    label: "Bio",
    summary: (d) => d.bio || EMPTY,
  },
  {
    step: "spotify",
    fieldKey: "spotifyUrl",
    label: "On repeat (Spotify)",
    summary: (d) => d.spotifyUrl || EMPTY,
  },
  {
    step: "media",
    fieldKey: "media",
    label: "Audio intro",
    summary: (d) =>
      d.media.kind
        ? `${d.media.kind} intro${
            d.media.durationSec
              ? ` · ${Math.floor(d.media.durationSec / 60)}:${String(
                  d.media.durationSec % 60
                ).padStart(2, "0")}`
              : ""
          }`
        : EMPTY,
  },
  {
    step: "vibe",
    fieldKey: "vibe",
    label: "My vibe",
    summary: (d) =>
      d.vibe.length
        ? `${d.vibe.length} photo${d.vibe.length === 1 ? "" : "s"}`
        : EMPTY,
  },
  {
    step: "interests",
    fieldKey: "interests",
    label: "Interests",
    summary: (d) =>
      d.interests.length ? d.interests.map((i) => i.name).join(", ") : EMPTY,
  },
];
