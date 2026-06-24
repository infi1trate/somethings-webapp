"use client";

// Admin profile editor — the review screen's layout (section panels + live phone
// preview) turned EDITABLE and warmer. Every edit writes straight to the draft,
// so the preview updates instantly; expanding a panel focuses the matching region
// on the phone. Phase 1 covers the eight teen-facing sections (the ones that map
// 1:1 to a preview region). Reads the single in-flight draft, like /admin/review.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import {
  MentorProfilePreview,
  type PreviewFocus,
} from "@/components/onboarding/mentor-profile-preview";
import { EditSectionPanel } from "@/components/admin/edit/edit-section-panel";
import { PhotoField } from "@/components/admin/edit/photo-field";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { InterestsDeckField } from "@/components/onboarding/interests-deck-field";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { PROFILE_SECTIONS } from "@/lib/onboarding/profile-sections";
import { LANGUAGE_OPTIONS } from "@/lib/options";

// Which preview region each section maps to (mirrors REGION_BY_STEP in the
// onboarding wizard). Expanding a panel zooms the preview here.
const REGION_BY_KEY: Record<string, string> = {
  "profile-photo": "identity",
  nickname: "identity",
  languages: "languages",
  bio: "bio",
  spotify: "spotify",
  media: "media",
  vibe: "vibe",
  interests: "interests",
};

// One line per section: where it shows up on the teen-facing profile.
const HELPER_BY_KEY: Record<string, string> = {
  "profile-photo": "The cut-out photo at the top of the profile.",
  nickname: "The name teens see at the top of the profile.",
  languages: "Shown as quick-scan chips on the profile.",
  bio: "The short intro under the name.",
  spotify: "The “On repeat” song embed.",
  media: "The audio intro teens can play.",
  vibe: "The vibe board — a few mood photos.",
  interests: "The interests deck + the photo behind each one.",
};

export default function AdminEditPage() {
  const mounted = useMounted();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const [openId, setOpenId] = useState<string | null>(null);

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";

  // Expanding a section focuses its region on the phone; nothing open → full view.
  const focus: PreviewFocus | undefined = openId
    ? { region: REGION_BY_KEY[openId] ?? "all", zoom: 1.08 }
    : undefined;

  const editorFor = (key: string) => {
    switch (key) {
      case "profile-photo":
        return (
          <PhotoField
            value={draft.profilePhoto}
            onChange={(v) => update({ profilePhoto: v })}
          />
        );
      case "nickname":
        return (
          <LabeledField id="ed-nickname" label="Display name">
            <Input
              id="ed-nickname"
              value={draft.nickname}
              placeholder={draft.firstName || "e.g. Jordan"}
              onChange={(e) => update({ nickname: e.target.value })}
            />
          </LabeledField>
        );
      case "languages":
        return (
          <MultiSelectChips
            options={LANGUAGE_OPTIONS}
            value={draft.languages}
            onChange={(v) => update({ languages: v })}
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
              onChange={(e) => update({ bio: e.target.value })}
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
              onChange={(e) => update({ spotifyUrl: e.target.value })}
            />
          </LabeledField>
        );
      case "media":
        return (
          <MediaIntroField
            value={draft.media}
            onChange={(v) => update({ media: v })}
          />
        );
      case "vibe":
        return (
          <VibeBoardField value={draft.vibe} onChange={(v) => update({ vibe: v })} />
        );
      case "interests":
        return (
          <InterestsDeckField
            value={draft.interests}
            onChange={(v) => update({ interests: v })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AdminShell active="users">
      <div className="grid items-start gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_392px] lg:px-10">
        {/* LEFT — the editable workspace */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.push("/admin/users")}
            className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeft className="size-4" />
            Back to users
          </button>

          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Edit profile
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
            {mounted ? `Editing ${mentorName}'s profile` : "Editing profile"}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Open a section to edit it — every change updates the live preview on
            the right, exactly what teens see.
          </p>

          <div className="mt-6 space-y-3">
            {PROFILE_SECTIONS.map((section) => (
              <EditSectionPanel
                key={section.step}
                title={section.label}
                helper={HELPER_BY_KEY[section.step] ?? ""}
                summary={mounted ? section.summary(draft) : "—"}
                open={openId === section.step}
                onToggle={() =>
                  setOpenId((o) => (o === section.step ? null : section.step))
                }
              >
                {editorFor(section.step)}
              </EditSectionPanel>
            ))}
          </div>
        </div>

        {/* RIGHT — live phone preview */}
        <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
          {mounted ? (
            <PhoneFrame>
              <MentorProfilePreview draft={draft} focus={focus} />
            </PhoneFrame>
          ) : (
            <div className="h-[740px] w-[368px] max-w-full animate-pulse rounded-[46px] bg-muted/40" />
          )}
          <p className="text-xs text-muted-foreground">
            Live preview · what teens see
          </p>
        </div>
      </div>
    </AdminShell>
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
