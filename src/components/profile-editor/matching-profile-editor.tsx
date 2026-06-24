"use client";

// The mentor's Matching-Profile editor: warm accordion section panels on the
// left, a sticky live phone preview on the right, and a sticky action bar that
// reflects the review state:
//   • published, no edits → "No changes made" (inert)
//   • published, edited   → "Submit N changes for review" → in_review
//   • in_review           → locked read-only ("In review" banner + inert bar)
//   • rejected (returned) → "Changes requested" banner + per-section notes +
//                           "Resubmit for review"
// Edits write straight to the draft so the preview updates instantly; expanding a
// panel focuses the matching region. Reuses the change-request model (notes +
// progress) — just formatted for settings rather than the wizard's floating dock.

import { useState } from "react";
import { AlertCircle, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import {
  MentorProfilePreview,
  type PreviewFocus,
} from "@/components/onboarding/mentor-profile-preview";
import { EditSectionPanel } from "@/components/profile-editor/edit-section-panel";
import { PhotoField } from "@/components/profile-editor/photo-field";
import { ChangeNoteCard } from "@/components/onboarding/change-note-card";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { InterestsDeckField } from "@/components/onboarding/interests-deck-field";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  PROFILE_SECTIONS,
  changedProfileSections,
} from "@/lib/onboarding/profile-sections";
import {
  changeProgress,
  requestsForStep,
} from "@/lib/onboarding/change-requests";
import { submitForReview } from "@/lib/mock-api";
import { LANGUAGE_OPTIONS } from "@/lib/options";

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

export function MatchingProfileEditor() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const status = useOnboardingStore((s) => s.status);
  const publishedSnapshot = useOnboardingStore((s) => s.publishedSnapshot);
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const setChangeRequests = useOnboardingStore((s) => s.setChangeRequests);
  const setRejection = useOnboardingStore((s) => s.setRejection);
  const [openId, setOpenId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const locked = status === "in_review";
  const isRejected = status === "rejected";
  const changed = publishedSnapshot
    ? changedProfileSections(draft, publishedSnapshot)
    : [];
  const dirty = changed.length > 0;
  const { addressed, total: reqTotal } = changeProgress(changeRequests, draft);

  // Expanding a section focuses its region on the phone; nothing open → full view.
  const focus: PreviewFocus | undefined =
    openId && !locked
      ? { region: REGION_BY_KEY[openId] ?? "all", zoom: 1.08 }
      : undefined;

  // Submit / resubmit both lock the profile into review (the onboarding flow).
  const submit = async () => {
    setSubmitting(true);
    const res = await submitForReview(draft);
    setSubmitting(false);
    if (!res.ok) {
      toast.error("That didn't go through. Try again.");
      return;
    }
    setRejection(null);
    setChangeRequests([]);
    setStatus("in_review");
    setOpenId(null);
  };

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
    <div className="pb-24">
      {/* Review-state banner (the change tracker / notification, settings-styled) */}
      {locked && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Your changes are in review — we&apos;ll email you as soon as the team
            responds. Editing is locked until then.
          </span>
        </div>
      )}
      {isRejected && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3.5 text-sm leading-relaxed text-orange-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">The team asked for a few changes.</span>{" "}
            {addressed} of {reqTotal} addressed — update the flagged sections below
            and resubmit.
          </span>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_392px]">
        <div className="min-w-0 space-y-3">
          {PROFILE_SECTIONS.map((section) => {
            const reqs = isRejected
              ? requestsForStep(changeRequests, section.step)
              : [];
            return (
              <EditSectionPanel
                key={section.step}
                title={section.label}
                helper={HELPER_BY_KEY[section.step] ?? ""}
                summary={section.summary(draft)}
                open={openId === section.step && !locked}
                onToggle={() =>
                  setOpenId((o) => (o === section.step ? null : section.step))
                }
                flagged={reqs.length > 0}
                disabled={locked}
              >
                {reqs.length > 0 && (
                  <div className="mb-4 space-y-3">
                    {reqs.map((r) => (
                      <ChangeNoteCard key={r.id} req={r} draft={draft} />
                    ))}
                  </div>
                )}
                {editorFor(section.step)}
              </EditSectionPanel>
            );
          })}
        </div>

        <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
          <PhoneFrame>
            <MentorProfilePreview draft={draft} focus={focus} />
          </PhoneFrame>
          <p className="text-xs text-muted-foreground">
            Live preview · what teens see
          </p>
        </div>
      </div>

      {/* Sticky action bar — reflects the review state. */}
      <div className="pointer-events-none sticky bottom-6 z-10 mt-8 flex justify-center">
        {locked ? (
          <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-[0_8px_28px_-14px_rgba(31,30,29,0.35)]">
            <Lock className="size-4" aria-hidden />
            In review — awaiting the team
          </span>
        ) : isRejected ? (
          <Button
            size="lg"
            onClick={submit}
            disabled={submitting}
            className="pointer-events-auto rounded-full shadow-[0_10px_30px_-12px_rgba(31,30,29,0.45)]"
          >
            {submitting ? "Sending…" : "Resubmit for review"}
          </Button>
        ) : dirty ? (
          <Button
            size="lg"
            onClick={submit}
            disabled={submitting}
            className="pointer-events-auto rounded-full shadow-[0_10px_30px_-12px_rgba(31,30,29,0.45)]"
          >
            {submitting
              ? "Sending…"
              : `Submit ${changed.length} change${
                  changed.length === 1 ? "" : "s"
                } for review`}
          </Button>
        ) : (
          <span className="pointer-events-auto inline-flex items-center rounded-full border border-dashed bg-card/90 px-5 py-2.5 text-sm font-medium text-muted-foreground">
            No changes made
          </span>
        )}
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
