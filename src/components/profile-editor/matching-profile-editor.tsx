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
import { AlertCircle, Check, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import {
  MentorProfilePreview,
  type PreviewFocus,
} from "@/components/onboarding/mentor-profile-preview";
import { SectionCard } from "@/components/settings/section-card";
import { PillButton } from "@/components/settings/pill-button";
import { PhotoField } from "@/components/profile-editor/photo-field";
import { ChangeNoteCard } from "@/components/onboarding/change-note-card";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { InterestsDeckField } from "@/components/onboarding/interests-deck-field";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  sectionsForTab,
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

// This tab hosts ONLY the match-card sections (§3 rev) — the first-chat
// content lives on the First moments tab (first-moments-editor.tsx).
const MATCHING_SECTIONS = sectionsForTab("matching");
const MATCHING_STEPS = new Set(MATCHING_SECTIONS.map((s) => s.step));

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
  // CTA scope: THIS tab's sections only — the moved first-moments sections
  // drive their own tab's CTA, not this one (§3 rev).
  const changed = (
    publishedSnapshot ? changedProfileSections(draft, publishedSnapshot) : []
  ).filter((step) => MATCHING_STEPS.has(step));
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
    // §4 asks for "Sent. You can keep editing while it's in review." — but the
    // prototype's review loop LOCKS editing during in_review (Phase B). Spec
    // said to verify against that logic; verified → conflict → truthful calm
    // confirmation instead (design-system-gaps.md #33). The locked banner
    // explains the rest.
    toast("Sent.");
  };

  const editorFor = (key: string) => {
    switch (key) {
      case "profile-photo":
        return (
          <PhotoField
            value={draft.matchCardPhoto}
            onChange={(v) => update({ matchCardPhoto: v })}
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
        <div className="min-w-0 space-y-[var(--card-gap)]">
          {MATCHING_SECTIONS.map((section) => {
            const reqs = isRejected
              ? requestsForStep(changeRequests, section.step)
              : [];
            const summary = section.summary(draft);
            // Figma 388:1586 shows a ✓ on set-state summaries ("Photo added",
            // "Audio added") — mirror that for the two asset sections.
            const added =
              (section.step === "profile-photo" && !!draft.matchCardPhoto) ||
              (section.step === "media" && !!draft.media.kind);
            // §4: the match card photo is the teen-facing asset — say so on its
            // status line (mirrors the Profile tab's internal-photo note).
            const isMatchCard = section.step === "profile-photo";
            const status =
              added || isMatchCard ? (
                <>
                  {added && (
                    <Check className="size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">
                    {summary}
                    {isMatchCard && (
                      <span className="text-[12px] text-[var(--text-muted)]">
                        {" "}
                        · Teens see this photo
                      </span>
                    )}
                  </span>
                </>
              ) : (
                summary
              );
            return (
              <SectionCard
                key={section.step}
                title={section.label}
                status={status}
                state={changed.includes(section.step) ? "dirty" : "default"}
                flagged={reqs.length > 0}
                disabled={locked}
                expanded={openId === section.step && !locked}
                onToggle={() =>
                  setOpenId((o) => (o === section.step ? null : section.step))
                }
              >
                {/* "Where this shows" helper — prototype behavior, kept (diff D10) */}
                <p className="mb-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {HELPER_BY_KEY[section.step] ?? ""}
                </p>
                {reqs.length > 0 && (
                  <div className="mb-4 space-y-3">
                    {reqs.map((r) => (
                      <ChangeNoteCard key={r.id} req={r} draft={draft} />
                    ))}
                  </div>
                )}
                {editorFor(section.step)}
              </SectionCard>
            );
          })}
        </div>

        <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
          <PhonePreviewShell label="Live preview — what teens see on your match card">
            <MentorProfilePreview draft={draft} focus={focus} />
          </PhonePreviewShell>
          <p className="text-xs text-[var(--text-muted)]">
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
          <PillButton
            onClick={submit}
            loading={submitting}
            className="pointer-events-auto shadow-[0_10px_30px_-12px_rgba(31,30,29,0.45)]"
          >
            {submitting ? "Sending…" : "Resubmit for review"}
          </PillButton>
        ) : dirty ? (
          // §4 CTA: dirty → "Send for review" + one-line reviewer helper.
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            <PillButton
              onClick={submit}
              loading={submitting}
              className="shadow-[0_10px_30px_-12px_rgba(31,30,29,0.45)]"
            >
              {submitting ? "Sending…" : "Send for review"}
            </PillButton>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-s1)]/95 px-3 py-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
              Stephen reviews changes before they go live to teens.
            </span>
          </div>
        ) : (
          // Figma disabled CTA: #b8b2a9 pill, white text, h53 ("No changes made").
          // Label swap to "Send for review" + helper is Phase 3 (diff E3).
          <PillButton disabled className="pointer-events-auto">
            No changes made
          </PillButton>
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
