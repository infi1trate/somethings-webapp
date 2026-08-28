"use client";

// The PROFILE tab editor (§4 Phase 9, decision #10 — formerly the "Matching
// profile" tab): everything a teen can see on the match card teens swipe —
// photo, display name, pronouns (moved here from the old Profile tab — they
// render on the card header), languages, bio, Spotify, audio, vibe, interests.
// (The retired "Chat" group / Chat avatar duplicated the Account-tab account
// photo, so it no longer lives here.)
// Gated edits write the draft (the PROPOSED values) AND enqueue into the one
// open profileUpdate changeset — no submit step (PUR §1.6), no editing lock.
// Teens keep seeing the last approved profile until the supervisor approves.
// Preview column: the teen-facing match-card phone, strictly passive — it
// tracks the section being edited via the shared PreviewFocus zoom.

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { PreviewDisclosure } from "@/components/settings/preview-disclosure";
import {
  MentorProfilePreview,
  type PreviewFocus,
} from "@/components/onboarding/mentor-profile-preview";
import { SectionCard } from "@/components/settings/section-card";
import { PhotoField } from "@/components/profile-editor/photo-field";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { InterestsDeckField } from "@/components/onboarding/interests-deck-field";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  sectionsForTab,
  type ProfileSection,
} from "@/lib/onboarding/profile-sections";
import {
  ChangesBanner,
  ChangesRequestedChip,
  DiscardChange,
  InReviewChip,
  ReviewNoteCallout,
  pendingHelper,
  saveGatedWithToasts,
} from "@/components/profile-editor/update-review-bits";
import { LANGUAGE_OPTIONS, PRONOUN_OPTIONS } from "@/lib/options";

const REGION_BY_KEY: Record<string, string> = {
  "profile-photo": "identity",
  nickname: "identity",
  pronouns: "identity", // renders beside the name on the card header
  languages: "languages",
  bio: "bio",
  spotify: "spotify",
  media: "media",
  vibe: "vibe",
  interests: "interests",
};

const HELPER_BY_KEY: Record<string, string> = {
  "profile-photo": "The cut-out photo at the top of the profile.",
  // §9.2: keep the onboarding framing on the display-name section.
  nickname: "This is the name on your profile. Most mentors go by a first name or a nickname.",
  pronouns: "Shown under your name on your teen-facing profile.",
  languages: "Shown as quick-scan chips on the profile.",
  bio: "The short intro under the name.",
  spotify: "The “On repeat” song embed.",
  media: "The audio intro teens can play.",
  vibe: "The vibe board — a few mood photos.",
  interests: "The interests deck + the photo behind each one.",
};

// Profile-tab sections come from the §3 registry (the "chat" group / Chat
// avatar was retired — it duplicated the Account-tab account photo).
const PROFILE_TAB_SECTIONS = sectionsForTab("profile");
const MATCH_CARD_SECTIONS = PROFILE_TAB_SECTIONS.filter(
  (s) => s.group === "match-card"
);

export function MatchingProfileEditor({
  initialOpen = null,
}: {
  /** Section step id to open + scroll to on arrival (deep link, e.g.
   *  "bio"). Reapplies when the URL param changes. */
  initialOpen?: string | null;
}) {
  const draft = useOnboardingStore((s) => s.draft);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const validInitial =
    initialOpen && PROFILE_TAB_SECTIONS.some((s) => s.step === initialOpen)
      ? initialOpen
      : null;
  const [openId, setOpenId] = useState<string | null>(validInitial);
  // Deep-link scroll — target set via the render-adjust pattern; the effect
  // marks handled targets in a ref (never written during render).
  const [scrollTarget, setScrollTarget] = useState<string | null>(validInitial);
  const [prevInitialOpen, setPrevInitialOpen] = useState(initialOpen);
  if (initialOpen !== prevInitialOpen) {
    setPrevInitialOpen(initialOpen);
    if (validInitial) {
      setOpenId(validInitial);
      setScrollTarget(validInitial);
    }
  }
  const scrolledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scrollTarget || scrolledRef.current === scrollTarget) return;
    scrolledRef.current = scrollTarget;
    document
      .querySelector(`[data-section="${scrollTarget}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollTarget]);

  // Expanding a section focuses its region on the phone; nothing open → full view.
  const focus: PreviewFocus | undefined = openId
    ? { region: REGION_BY_KEY[openId] ?? "all", zoom: 1.08 }
    : undefined;

  // Gated save (PUR §1.6): draft write + changeset enqueue + §6 toasts.
  const save = (patch: Parameters<typeof saveGatedWithToasts>[0]) =>
    saveGatedWithToasts(patch);

  const editorFor = (key: string) => {
    switch (key) {
      case "profile-photo":
        return (
          <PhotoField
            value={draft.matchCardPhoto}
            onChange={(v) => save({ matchCardPhoto: v })}
          />
        );
      case "nickname":
        return (
          <LabeledField id="ed-nickname" label="Display name">
            <Input
              id="ed-nickname"
              value={draft.displayName}
              placeholder={draft.firstName || "e.g. Jordan"}
              onChange={(e) => save({ displayName: e.target.value })}
            />
          </LabeledField>
        );
      case "pronouns":
        // ASSUMPTION(product): pronouns are gated in v1 because teen-visible;
        // dignity argument for instant publish — product call, not design
        // call. (PUR spec §8; revised build-spec wording pending, gaps.md #53.)
        return (
          <MultiSelectChips
            options={PRONOUN_OPTIONS}
            value={draft.pronouns}
            onChange={(v) => save({ pronouns: v })}
          />
        );
      case "languages":
        return (
          <MultiSelectChips
            options={LANGUAGE_OPTIONS}
            value={draft.languages}
            onChange={(v) => save({ languages: v })}
          />
        );
      case "bio":
        return (
          <LabeledField id="ed-bio" label="Short bio">
            <Textarea
              id="ed-bio"
              rows={5}
              value={draft.bio}
              placeholder="What you're about, what you like talking about…"
              onChange={(e) => save({ bio: e.target.value })}
            />
          </LabeledField>
        );
      case "spotify":
        return (
          <LabeledField id="ed-spotify" label="Spotify link">
            <Input
              id="ed-spotify"
              value={draft.spotifyUrl}
              placeholder="https://open.spotify.com/track/…"
              onChange={(e) => save({ spotifyUrl: e.target.value })}
            />
          </LabeledField>
        );
      case "media":
        return (
          <MediaIntroField
            value={draft.media}
            onChange={(v) => save({ media: v })}
          />
        );
      case "vibe":
        return (
          <VibeBoardField value={draft.vibe} onChange={(v) => save({ vibe: v })} />
        );
      case "interests":
        return (
          <InterestsDeckField
            value={draft.interests}
            onChange={(v) => save({ interests: v })}
          />
        );
      default:
        return null;
    }
  };

  const renderSection = (section: ProfileSection) => {
    const summary = section.summary(draft);
    const pu = profileUpdate?.fields.find(
      (f) => f.fieldId === section.fieldKey
    );
    const puFlagged = pu?.fieldStatus === "changes-requested";
    const added =
      (section.step === "profile-photo" && !!draft.matchCardPhoto) ||
      (section.step === "media" && !!draft.media.kind);
    const visibilityNote =
      section.step === "profile-photo" ? "Teens see this photo" : null;
    const statusNode =
      added || visibilityNote ? (
        <>
          {added && <Check className="size-3.5 shrink-0" aria-hidden />}
          <span className="truncate">
            {summary}
            {visibilityNote && (
              <span className="text-[12px] text-[var(--text-muted)]">
                {" "}
                · {visibilityNote}
              </span>
            )}
          </span>
        </>
      ) : (
        summary
      );
    return (
      <div
        key={section.step}
        data-section={section.step}
        {...(puFlagged ? { "data-flagged-field": section.fieldKey } : {})}
      >
        <SectionCard
          title={section.label}
          status={statusNode}
          flagged={puFlagged}
          chip={
            pu ? (
              puFlagged ? (
                <ChangesRequestedChip />
              ) : (
                <InReviewChip />
              )
            ) : undefined
          }
          notice={
            pu ? (
              puFlagged && pu.adminNote ? (
                <ReviewNoteCallout note={pu.adminNote} />
              ) : (
                <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
                  {pendingHelper(section.fieldKey)}
                </p>
              )
            ) : undefined
          }
          expanded={openId === section.step}
          onToggle={() =>
            setOpenId((o) => (o === section.step ? null : section.step))
          }
        >
          <p className="mb-4 text-xs leading-relaxed text-[var(--text-secondary)]">
            {HELPER_BY_KEY[section.step] ?? ""}
          </p>
          {editorFor(section.step)}
          {pu && (
            <div className="mt-4">
              <DiscardChange fieldId={section.fieldKey} />
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  return (
    <div className="pb-16">
      {/* Notes-left banner (PUR §4.2) — scrolls to the first flagged section. */}
      <ChangesBanner />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_392px]">
        <div className="min-w-0 space-y-7">
          <section aria-label="Match card">
            <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
              Match card
            </h2>
            <div className="space-y-[var(--card-gap)]">
              {MATCH_CARD_SECTIONS.map(renderSection)}
            </div>
          </section>
        </div>

        {/* Preview column — the teen-facing match card.
            RC-2: was `hidden lg:…`, which deleted the mentor's own match card
            below 1024px while they were editing it. */}
        <PreviewDisclosure
          /* TODO-COPY */
          triggerLabel="Preview your match card"
          title="What teens see on your match card"
          caption={
            <p className="text-xs text-[var(--text-muted)]">
              Your edits, as teens would see them — live once approved
            </p>
          }
        >
          <PhonePreviewShell label="Live preview — what teens see on your match card">
            <MentorProfilePreview draft={draft} focus={focus} />
          </PhonePreviewShell>
        </PreviewDisclosure>
      </div>
    </div>
  );
}

function LabeledField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
