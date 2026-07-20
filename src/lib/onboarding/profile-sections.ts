// The mentor profile broken into reviewable sections, each tied 1:1 to the
// builder step a mentor jumps back to AND the single draft field it governs.
// Used by the admin review screen (per-section "Request a change" + baseline
// capture) and to label the change requests the dock/modal/cards read.
// `step` values are STEP_ORDER slugs (see steps.ts).

import { firstMomentStory } from "@/lib/types";
import type { MediaIntro, MentorDraft } from "@/lib/types";

export interface ProfileSection {
  step: string; // STEP_ORDER slug — where "Go to" / "Jump back in" lands
  fieldKey: keyof MentorDraft; // the single draft field this section governs (1:1)
  label: string; // human label shown to admin + mentor
  /** Which settings tab hosts this section (Phase 9 IA: "profile" is the
   *  teen-facing tab, formerly "matching"; first-chat content stays on the
   *  First moments tab). Change detection + admin review use the full list;
   *  each tab's editor uses its own subset. */
  tab: "profile" | "first-moments";
  /** Labeled group inside the Profile tab (§4 rev): "match-card" = the match
   *  card the teen swipes; "chat" = what teens see inside the chat itself. */
  group?: "match-card" | "chat";
  /** Compact read-only summary of the current value, for the review list. */
  summary: (draft: MentorDraft) => string;
}

const EMPTY = "—";

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    step: "profile-photo", // slug stays — wizard route + persisted stepId anchor
    fieldKey: "matchCardPhoto",
    label: "Match card photo",
    tab: "profile",
    group: "match-card",
    summary: (d) => (d.matchCardPhoto ? "Photo added" : "No photo yet"),
  },
  {
    step: "nickname",
    fieldKey: "displayName",
    label: "Display name",
    tab: "profile",
    group: "match-card",
    summary: (d) => d.displayName || d.firstName || EMPTY,
  },
  {
    step: "languages",
    fieldKey: "languages",
    label: "Languages",
    tab: "profile",
    group: "match-card",
    summary: (d) => (d.languages.length ? d.languages.join(", ") : EMPTY),
  },
  {
    step: "bio",
    fieldKey: "bio",
    label: "Bio",
    tab: "profile",
    group: "match-card",
    summary: (d) => d.bio || EMPTY,
  },
  {
    step: "spotify",
    fieldKey: "spotifyUrl",
    label: "On repeat (Spotify)",
    tab: "profile",
    group: "match-card",
    summary: (d) => d.spotifyUrl || EMPTY,
  },
  {
    step: "media",
    fieldKey: "media",
    label: "Audio intro",
    tab: "profile",
    group: "match-card",
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
    tab: "profile",
    group: "match-card",
    summary: (d) =>
      d.vibe.length
        ? `${d.vibe.length} photo${d.vibe.length === 1 ? "" : "s"}`
        : EMPTY,
  },
  {
    step: "interests",
    fieldKey: "interests",
    label: "Interests",
    tab: "profile",
    group: "match-card",
    summary: (d) =>
      d.interests.length ? d.interests.map((i) => i.name).join(", ") : EMPTY,
  },
  // §4 Phase 9: pronouns move here from the Account tab (they render on the
  // teen-facing card header). The slug has no standalone wizard route — the
  // wizard confirms pronouns on the Quick-check screen (see steps.ts).
  {
    step: "pronouns",
    fieldKey: "pronouns",
    label: "Pronouns",
    tab: "profile",
    group: "match-card",
    summary: (d) => (d.pronouns.length ? d.pronouns.join(" · ") : EMPTY),
  },
  // §4 Phase 9: the Chat group — the avatar teens see in chats, a DISTINCT
  // asset from the match-card cutout. No wizard route (set from settings).
  {
    step: "chat-avatar",
    fieldKey: "accountPhoto",
    label: "Chat avatar",
    tab: "profile",
    group: "chat",
    summary: (d) => (d.accountPhoto ? "Photo added" : "No photo yet"),
  },
  // §4 Phase 3 extensions — chat-delivered content (no preview region). The
  // step slugs have no wizard route; they exist for change-request mapping.
  {
    step: "first-messages",
    fieldKey: "firstMessages",
    label: "First messages",
    tab: "first-moments",
    summary: (d) => {
      const on = d.firstMessages.online.length;
      const off = d.firstMessages.offline.length;
      return on || off ? `${on} online · ${off} offline` : EMPTY;
    },
  },
  {
    step: "first-moment-story", // slug stays — persisted stepId anchor
    fieldKey: "stories",
    label: "Story", // §4 rev: the First moments tab provides the context
    tab: "first-moments",
    summary: (d) => {
      const n = firstMomentStory(d.stories).slides.length;
      return n ? `${n} of 6 slides` : EMPTY;
    },
  },
];

/** Sections hosted by one settings tab — each tab's editor + CTA scope. */
export function sectionsForTab(
  tab: ProfileSection["tab"]
): ProfileSection[] {
  return PROFILE_SECTIONS.filter((s) => s.tab === tab);
}

// Media's in-memory blob `url` is volatile (dead after reload), so compare it on
// its stable fields only — otherwise the post-publish diff would false-positive.
// Exported for the profile-update changeset's enqueue equality checks.
export function normForCompare(key: keyof MentorDraft, value: unknown): unknown {
  if (key !== "media") return value;
  const m = value as MediaIntro | undefined;
  return { kind: m?.kind ?? null, name: m?.name ?? null, durationSec: m?.durationSec ?? null };
}

/** Section `step`s whose value differs between the live draft and a published
 *  snapshot — drives the mentor editor's "no changes / N changes" state and which
 *  panels are dirty. */
export function changedProfileSections(
  draft: MentorDraft,
  snapshot: MentorDraft
): string[] {
  return PROFILE_SECTIONS.filter(
    (s) =>
      JSON.stringify(normForCompare(s.fieldKey, draft[s.fieldKey])) !==
      JSON.stringify(normForCompare(s.fieldKey, snapshot[s.fieldKey]))
  ).map((s) => s.step);
}
