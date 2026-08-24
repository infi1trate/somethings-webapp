// Profile Update Review — field taxonomy + helpers (spec §2/§3).
// Rule of thumb: teen-visible ⇒ gated (hold-until-approved via the changeset),
// with ONE deliberate exception — see FIRST MOMENTS below.
// Interpretation notes (logged in design-system-gaps.md):
//  • BOTH teen-visible photos are gated: matchCardPhoto (renders in the phone
//    preview) and accountPhoto (the chat avatar — product-confirmed teen-facing).
//  • FIRST MOMENTS ARE NOT GATED (product decision). `firstMessages` and
//    `stories` used to sit in this list, which meant a mentor's opening messages
//    waited on a Lead Mentor's approval and the lead got a queue entry asking
//    for it. A mentor may now change their own first moments whenever they like
//    and it is live on save. Staff keep oversight two ways that don't block the
//    mentor: the change lands in the record's activity trail, and a lead or
//    supervisor can edit these fields directly on the record. Removing them from
//    here is the ENTIRE mechanism — `saveGatedFields` only enqueues gated keys,
//    and both review surfaces (the Profile-updates queue and the Team nav badge)
//    key off `profileUpdate !== null`.
//  • First/Last name are ACCOUNT IDENTITY (§9 v1.1) — locked post-approval,
//    never teen-visible; the teen-facing name is the gated displayName.

import type { MentorDraft, ProfileUpdate } from "@/lib/types";
import { firstMomentStory } from "@/lib/types";
import {
  PROFILE_SECTIONS,
  STAFF_MANAGED_FIELD_KEYS,
} from "@/lib/onboarding/profile-sections";

export interface GatedFieldMeta {
  fieldId: keyof MentorDraft & string;
  label: string; // "Bio", "Match card photo", …
  noun: string; // for helper copy: "Teens still see your current {noun}…"
  /** Where the mentor edits it (for admin diff grouping + deep links) —
   *  Phase 9 tab ids. No gated fields live on the Account tab. */
  surface: "profile" | "first-moments";
}

export const GATED_FIELDS: GatedFieldMeta[] = [
  // Profile tab › Chat group + Match card group (§4 Phase 9)
  // TODO(§9.4, product): one photo asset or two? v1.1 keeps TWO (avatar +
  // match-card cutout — crop/context differ, both teen-facing ⇒ both gated),
  // relabeled "Chat avatar" so the pair is self-evident. Unresolved in spec.
  { fieldId: "accountPhoto", label: "Chat avatar", noun: "photo", surface: "profile" },
  { fieldId: "pronouns", label: "Pronouns", noun: "pronouns", surface: "profile" },
  // Profile tab › Match card group (ex-"Matching profile" tab)
  { fieldId: "matchCardPhoto", label: "Match card photo", noun: "photo", surface: "profile" },
  { fieldId: "displayName", label: "Display name", noun: "name", surface: "profile" },
  { fieldId: "languages", label: "Languages", noun: "languages", surface: "profile" },
  { fieldId: "bio", label: "Bio", noun: "bio", surface: "profile" },
  { fieldId: "spotifyUrl", label: "On repeat (Spotify)", noun: "song", surface: "profile" },
  { fieldId: "media", label: "Audio intro", noun: "audio intro", surface: "profile" },
  { fieldId: "vibe", label: "My vibe", noun: "vibe photos", surface: "profile" },
  { fieldId: "interests", label: "Interests", noun: "interests", surface: "profile" },
  // NOTHING from the First moments tab — `firstMessages` and `stories` publish
  // immediately (see the FIRST MOMENTS note in the header). The "first-moments"
  // value stays on GatedFieldMeta["surface"] because it still names a real
  // surface in the taxonomy; it simply has no gated members.
];

/** Teen-facing fields that publish IMMEDIATELY — no changeset, but the snapshot
 *  the record and teens read from still has to move, or "immediate" is a lie on
 *  the one screen staff actually look at (`publishedSnapshot ?? draft`). Kept
 *  beside GATED_FIELDS so the two lists are read together and a field can't
 *  silently belong to neither. */
export const IMMEDIATE_TEEN_FACING_FIELDS: (keyof MentorDraft & string)[] = [
  "firstMessages",
  "stories",
];

const IMMEDIATE_IDS = new Set<string>(IMMEDIATE_TEEN_FACING_FIELDS);

/** True when a save to this field should write the published snapshot straight
 *  away (and log an activity entry) instead of enqueuing a review changeset. */
export function isImmediateTeenFacingField(fieldId: string): boolean {
  return IMMEDIATE_IDS.has(fieldId);
}

const GATED_IDS = new Set<string>(GATED_FIELDS.map((f) => f.fieldId));

export function isGatedField(fieldId: string): boolean {
  return GATED_IDS.has(fieldId);
}

export function gatedFieldMeta(fieldId: string): GatedFieldMeta | undefined {
  return GATED_FIELDS.find((f) => f.fieldId === fieldId);
}

/** Does this activity entry belong in the MENTOR'S feed?
 *
 *  `stories` publishes immediately, which logs a `profile_update_live` entry
 *  reading "Your profile changes are live." — but the story is curated by a lead
 *  or supervisor and the mentor cannot see it. Left alone, a lead swapping an
 *  image notifies the mentor of a change they didn't make, and deep-links them
 *  to a tab where nothing looks different.
 *
 *  The entry is NOT suppressed: the record's audit trail reads the same list,
 *  and a staff edit to teen-facing content has to stay on the record. It is
 *  filtered out of the mentor's two surfaces — the feed and the sidebar badge —
 *  and only when EVERY field it names is staff-managed, so a save that touched
 *  the messages too still reaches them. */
export function isMentorVisibleActivity(item: {
  type: string;
  fieldIds: string[];
}): boolean {
  if (item.type !== "profile_update_live") return true;
  return !item.fieldIds.every((f) => STAFF_MANAGED_FIELD_KEYS.has(f));
}

/** Compact human summary of a field VALUE (live or proposed) for diff cards
 *  and queue summaries. Reuses PROFILE_SECTIONS summaries where they exist. */
export function summarizeFieldValue(fieldId: string, value: unknown): string {
  const section = PROFILE_SECTIONS.find((s) => s.fieldKey === fieldId);
  if (section) {
    try {
      const probe = { [fieldId]: value } as unknown as MentorDraft;
      return section.summary(probe);
    } catch {
      /* fall through to generic */
    }
  }
  if (fieldId === "accountPhoto") return value ? "Photo added" : "No photo yet";
  if (fieldId === "pronouns")
    return Array.isArray(value) && value.length ? value.join(" · ") : "—";
  if (typeof value === "string") return value || "—";
  return value ? "Set" : "—";
}

/** "Updated bio + 2 more" (admin queue card). */
export function changesetSummary(update: ProfileUpdate): string {
  const first = gatedFieldMeta(update.fields[0]?.fieldId)?.noun ?? "profile";
  const rest = update.fields.length - 1;
  return rest > 0 ? `Updated ${first} + ${rest} more` : `Updated ${first}`;
}

/** Safe deep-clone for enqueue-time live snapshots (data-URL strings, arrays,
 *  plain objects only — same shapes the persisted draft already holds). */
export function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value ?? null));
}

/** Some summaries need whole-draft context; build a draft-shaped view of the
 *  LIVE profile: snapshot where enqueued, live draft elsewhere. */
export function liveDraftView(
  draft: MentorDraft,
  update: ProfileUpdate | null
): MentorDraft {
  if (!update) return draft;
  const view = { ...draft } as Record<string, unknown>;
  for (const f of update.fields) view[f.fieldId] = f.liveValue;
  return view as unknown as MentorDraft;
}

/** Compact relative time — queue cards + activity rows ("Just now", "3h ago"). */
export function relTime(at: number): string {
  const ms = Date.now() - at;
  if (!Number.isFinite(ms) || ms < 60_000) return "Just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

// Kept for the story field's summary context.
export { firstMomentStory };
