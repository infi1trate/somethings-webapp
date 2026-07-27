"use client";

// The PROFILE tab editor (§4 Phase 9, decision #10 — formerly the "Matching
// profile" tab): everything a teen can see, in two labeled groups.
//   Match card — the card teens swipe: photo, display name, pronouns (moved
//     here from the old Profile tab — they render on the card header),
//     languages, bio, Spotify, audio, vibe, interests.
//   Chat — what teens see inside the chat itself: the Chat avatar (a DISTINCT
//     asset from the match-card cutout; plain photo, no background removal).
// Gated edits write the draft (the PROPOSED values) AND enqueue into the one
// open profileUpdate changeset — no submit step (PUR §1.6), no editing lock.
// Teens keep seeing the last approved profile until the supervisor approves.
// Preview column: the match-card phone by default; while a Chat-group section
// is open it crossfades to the first-chat mock (avatar in situ). Both are
// strictly passive. Flip CHAT_PREVIEW_SWAP to false to fall back to a static
// match-card preview (the avatar thumbnail inside the section carries the
// feedback instead).

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Upload } from "lucide-react";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import {
  MentorProfilePreview,
  type PreviewFocus,
} from "@/components/onboarding/mentor-profile-preview";
import { FirstChatPreview } from "@/components/profile-editor/first-chat-preview";
import { SectionCard } from "@/components/settings/section-card";
import { PhotoField } from "@/components/profile-editor/photo-field";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { InterestsDeckField } from "@/components/onboarding/interests-deck-field";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { Button } from "@/components/ui/button";
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
import { downscaleImageToWebP, readFileAsDataUrl } from "@/lib/files";
import { LANGUAGE_OPTIONS, PRONOUN_OPTIONS } from "@/lib/options";
import { cn } from "@/lib/utils";

// Preview-swap kill switch (§4 Phase 9): true = crossfade to the chat mock
// while a Chat-group section is open. If the swap tests poorly, set false —
// the preview stays on the match card and the avatar thumbnail inside the
// Chat avatar section is the only in-place feedback (the specced fallback).
const CHAT_PREVIEW_SWAP = true;

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
  "chat-avatar": "Your avatar in chats with teens — a plain photo, no cut-out.",
};

// The two labeled groups (§4 rev). Sections come from the §3 registry.
const PROFILE_TAB_SECTIONS = sectionsForTab("profile");
const MATCH_CARD_SECTIONS = PROFILE_TAB_SECTIONS.filter(
  (s) => s.group === "match-card"
);
const CHAT_SECTIONS = PROFILE_TAB_SECTIONS.filter((s) => s.group === "chat");
const CHAT_STEPS = new Set(CHAT_SECTIONS.map((s) => s.step));

export function MatchingProfileEditor({
  initialOpen = null,
}: {
  /** Section step id to open + scroll to on arrival (sidebar-avatar deep
   *  link, e.g. "chat-avatar"). Reapplies when the URL param changes. */
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

  // Expanding a Match-card section focuses its region on the phone; nothing
  // open → full view. Chat sections swap the preview entirely (below).
  const focus: PreviewFocus | undefined =
    openId && !CHAT_STEPS.has(openId)
      ? { region: REGION_BY_KEY[openId] ?? "all", zoom: 1.08 }
      : undefined;

  // The swap trigger: a Chat-group section is open (and the swap is enabled).
  const chatOpen = CHAT_PREVIEW_SWAP && openId !== null && CHAT_STEPS.has(openId);

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
      case "chat-avatar":
        return (
          <AvatarField
            value={draft.accountPhoto}
            onChange={(v) => save({ accountPhoto: v })}
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
      (section.step === "chat-avatar" && !!draft.accountPhoto) ||
      (section.step === "media" && !!draft.media.kind);
    // Teen-visibility notes on the two photo assets' status lines. The chat-
    // avatar line is interim §4 copy — revised spec unavailable (gaps.md #55).
    const visibilityNote =
      section.step === "profile-photo"
        ? "Teens see this photo"
        : section.step === "chat-avatar"
          ? "Teens see this in your chats"
          : null;
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

          {/* Chat — a SUBORDINATE subsection of Profile (IA restructure), no
              longer a co-equal "Chat" section: teen-facing presentation shown
              beside your messages, distinct from the match card. */}
          <section
            aria-label="Chat"
            className="border-t border-[color:var(--border-contour)] pt-6"
          >
            <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.4px] text-[var(--text-muted)]">
              Chat
            </h3>
            <p className="mb-3 text-[12px] leading-[16px] text-[var(--text-muted)]">
              What teens see beside your messages — distinct from your match card.
            </p>
            <div className="space-y-[var(--card-gap)]">
              {CHAT_SECTIONS.map(renderSection)}
            </div>
          </section>
        </div>

        {/* Preview column — match card by default; the chat mock while a
            Chat-group section is open. Grid-stacked crossfade (both mounted,
            opacity swap; motion-safe so reduced-motion gets a hard cut). */}
        <div className="hidden lg:sticky lg:top-6 lg:grid">
          <div
            aria-hidden={chatOpen}
            className={cn(
              "col-start-1 row-start-1 flex flex-col items-center gap-3 motion-safe:transition-opacity motion-safe:duration-300",
              chatOpen && "pointer-events-none opacity-0"
            )}
          >
            <PhonePreviewShell label="Live preview — what teens see on your match card">
              <MentorProfilePreview draft={draft} focus={focus} />
            </PhonePreviewShell>
            <p className="text-xs text-[var(--text-muted)]">
              Your edits, as teens would see them — live once approved
            </p>
          </div>
          <div
            aria-hidden={!chatOpen}
            className={cn(
              "col-start-1 row-start-1 flex flex-col items-center gap-3 motion-safe:transition-opacity motion-safe:duration-300",
              !chatOpen && "pointer-events-none opacity-0"
            )}
          >
            <FirstChatPreview draft={draft} />
            <p className="text-xs text-[var(--text-muted)]">
              Your avatar, where teens see it — live once approved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Chat-avatar editor — plain photo (downscale only; the cut-out treatment is
 *  the match-card photo's). Carried over from the old Account-tab row. The
 *  thumbnail doubles as the fallback feedback when CHAT_PREVIEW_SWAP is off. */
function AvatarField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    setProcessing(true);
    try {
      const url = await downscaleImageToWebP(file).catch(() =>
        readFileAsDataUrl(file)
      );
      onChange(url);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Chat avatar" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6 text-[var(--text-muted)]" aria-hidden />
        )}
        {processing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={processing}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          {value ? "Replace photo" : "Upload photo"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={processing}
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
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
