"use client";

// Staff-editable teen-facing Profile + First-moments fields on the Mentor
// Record. When a section resolves to "edit" (a Lead Mentor), the record's
// read rows become directly editable — same inline edit → Save lifecycle as
// the Account tab (StaffFieldRow / PhotoRowCore + the staff write path,
// invariant 2), reusing the mentor's own pure value/onChange field controls.
// The write goes through the passed `staffSave` seam (saveAccountField mock +
// staffEditAccountField audit); nothing here calls the mentor's gated review
// save. Read viewers (supervisor) keep the existing read rows in page.tsx.

import { useState } from "react";
import { StaffFieldRow } from "@/components/account/field-rows";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { PhotoField } from "@/components/profile-editor/photo-field";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { InterestsDeckField } from "@/components/onboarding/interests-deck-field";
import { FirstMessagesEditor } from "@/components/profile-editor/matching-extensions";
import { SpotifyChip } from "@/components/record/spotify-chip";
import { InterestTags, PlainTags } from "@/components/record/interest-tags";
import { auditLineFor } from "@/lib/record/account-fields";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { saveAccountField } from "@/lib/mock-api";
import { LANGUAGE_OPTIONS, PRONOUN_OPTIONS } from "@/lib/options";
import type { ActivityItem, MentorDraft } from "@/lib/types";
import type { ProfileSection } from "@/lib/onboarding/profile-sections";

/** Persistence seam — mirrors the Account tab's staffSave, but writes the
 *  profile (draft + published snapshot) via staffEditProfileField. */
type StaffSave = (fieldId: string) => (value: unknown) => Promise<boolean>;

export function StaffProfileFields({
  sections,
  live,
  activity,
  staffActor,
}: {
  sections: ProfileSection[];
  live: MentorDraft;
  activity: ActivityItem[];
  /** "Lead mentor" / "Supervisor" — attributed on the audit entry. */
  staffActor: string;
}) {
  const staffEditProfileField = useOnboardingStore(
    (s) => s.staffEditProfileField
  );
  // Mirror the Account tab's staffSave: run the mock save, then the direct
  // profile write (draft + snapshot) on success.
  const staffSave: StaffSave = (fieldId) => async (value) => {
    const res = await saveAccountField(fieldId, value);
    if (!res.ok) return false;
    staffEditProfileField(fieldId, value, staffActor);
    return true;
  };
  // Single open row across this card (matches the Account tab's one-at-a-time).
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      {sections.map((s) => (
        <FieldRow
          key={s.step}
          section={s}
          live={live}
          hint={auditLineFor(activity, s.fieldKey) ?? undefined}
          editing={editing === s.fieldKey}
          onEditStart={() => setEditing(s.fieldKey)}
          onClose={() => setEditing(null)}
          staffSave={staffSave}
        />
      ))}
    </>
  );
}

function FieldRow({
  section: s,
  live,
  hint,
  editing,
  onEditStart,
  onClose,
  staffSave,
}: {
  section: ProfileSection;
  live: MentorDraft;
  hint?: string;
  editing: boolean;
  onEditStart: () => void;
  onClose: () => void;
  staffSave: StaffSave;
}) {
  const key = s.fieldKey;

  const common = {
    label: s.label,
    hint,
    mode: "edit" as const,
    editing,
    onEditStart,
    onClose,
  };

  switch (key) {
    case "matchCardPhoto":
      // PhotoField preserves the teen-facing cutout treatment.
      return (
        <StaffFieldRow<string | null>
          {...common}
          value={live.matchCardPhoto}
          display={(v) => (v ? "Photo added" : "No photo yet")}
          editor={(p, set) => <PhotoField value={p} onChange={set} />}
          onSave={staffSave("matchCardPhoto")}
        />
      );
    case "displayName":
      return (
        <StaffFieldRow<string>
          {...common}
          value={live.displayName}
          display={(v) => v || live.firstName || "—"}
          editor={(p, set) => (
            <Input
              value={p}
              placeholder={live.firstName || "e.g. Jordan"}
              onChange={(e) => set(e.target.value)}
              aria-label="Display name"
            />
          )}
          onSave={staffSave("displayName")}
        />
      );
    case "bio":
      return (
        <StaffFieldRow<string>
          {...common}
          value={live.bio}
          display={(v) => v || "—"}
          editor={(p, set) => (
            <Textarea
              rows={5}
              value={p}
              placeholder="What they're about, what they like talking about…"
              onChange={(e) => set(e.target.value)}
              aria-label="Bio"
            />
          )}
          onSave={staffSave("bio")}
        />
      );
    case "spotifyUrl":
      return (
        <StaffFieldRow<string>
          {...common}
          value={live.spotifyUrl}
          display={(v) =>
            v ? <SpotifyChip key={v} url={v} /> : "—"
          }
          editor={(p, set) => (
            <Input
              value={p}
              placeholder="https://open.spotify.com/track/…"
              onChange={(e) => set(e.target.value)}
              aria-label="Spotify link"
            />
          )}
          onSave={staffSave("spotifyUrl")}
        />
      );
    case "languages":
      return (
        <StaffFieldRow<string[]>
          {...common}
          value={live.languages}
          display={(v) => (v.length ? <PlainTags items={v} /> : "—")}
          editor={(p, set) => (
            <MultiSelectChips
              options={LANGUAGE_OPTIONS}
              value={p}
              onChange={set}
            />
          )}
          onSave={staffSave("languages")}
        />
      );
    case "pronouns":
      return (
        <StaffFieldRow<string[]>
          {...common}
          value={live.pronouns}
          display={(v) => (v.length ? v.join(" · ") : "—")}
          editor={(p, set) => (
            <MultiSelectChips
              options={PRONOUN_OPTIONS}
              value={p}
              onChange={set}
            />
          )}
          onSave={staffSave("pronouns")}
        />
      );
    case "interests":
      return (
        <StaffFieldRow<MentorDraft["interests"]>
          {...common}
          value={live.interests}
          display={(v) =>
            v.length ? <InterestTags items={v.map((i) => i.name)} /> : "—"
          }
          editor={(p, set) => (
            <InterestsDeckField value={p} onChange={set} />
          )}
          onSave={staffSave("interests")}
        />
      );
    case "media":
      return (
        <StaffFieldRow<MentorDraft["media"]>
          {...common}
          value={live.media}
          display={() => s.summary(live)}
          editor={(p, set) => <MediaIntroField value={p} onChange={set} />}
          onSave={staffSave("media")}
        />
      );
    case "vibe":
      return (
        <StaffFieldRow<MentorDraft["vibe"]>
          {...common}
          value={live.vibe}
          display={() => s.summary(live)}
          editor={(p, set) => <VibeBoardField value={p} onChange={set} />}
          onSave={staffSave("vibe")}
        />
      );
    case "firstMessages":
      return (
        <StaffFieldRow<MentorDraft["firstMessages"]>
          {...common}
          value={live.firstMessages}
          display={() => s.summary(live)}
          editor={(p, set) => <FirstMessagesEditor value={p} onChange={set} />}
          onSave={staffSave("firstMessages")}
        />
      );
    // NO `case "stories"`. It was unreachable: this component only ever renders
    // sectionsForTab("profile"), and the story lives on the first-moments tab —
    // whose rows come from FirstMomentsRows, which owns the one story editor.
    default:
      return (
        <StaffFieldRow<string>
          {...common}
          value={String(s.summary(live))}
          display={(v) => v}
          editor={(p) => <span>{p}</span>}
          onSave={async () => true}
        />
      );
  }
}
