"use client";

// The First moments tab (§3 rev, Phase 5b) under PROFILE UPDATE REVIEW: what
// a teen gets the first time they open the mentor's chat. Hosts the sections
// MOVED from Matching profile — the same Phase-3 components (FirstMessagesEditor,
// StorySlidesEditor from matching-extensions.tsx) — plus the live chat preview.
// Gated edits enqueue into the one open profileUpdate changeset on save — no
// submit CTA, no editing lock (§1.6). Section chips + notes mirror Matching.

import { useState } from "react";
import { SectionCard } from "@/components/settings/section-card";
import {
  FirstMessagesEditor,
  StorySlidesEditor,
} from "@/components/profile-editor/matching-extensions";
import { FirstChatPreview } from "@/components/profile-editor/first-chat-preview";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { sectionsForTab } from "@/lib/onboarding/profile-sections";
import {
  ChangesBanner,
  ChangesRequestedChip,
  DiscardChange,
  InReviewChip,
  ReviewNoteCallout,
  pendingHelper,
  saveGatedWithToasts,
} from "@/components/profile-editor/update-review-bits";
import { firstMomentStory } from "@/lib/types";
import type { StorySlide } from "@/lib/types";

const HELPER_BY_KEY: Record<string, string> = {
  "first-messages":
    "Sent automatically when a teen opens your chat for the first time.",
  "first-moment-story": "Up to 6 images — no captions needed.",
};

const FM_SECTIONS = sectionsForTab("first-moments");

export function FirstMomentsEditor() {
  const draft = useOnboardingStore((s) => s.draft);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const [openId, setOpenId] = useState<string | null>(null);

  // LIBRARY-READY write path: today exactly one 'first-moment' story exists;
  // writes update that entry inside stories[] so future types slot in.
  const setSlides = (slides: StorySlide[]) => {
    const story = firstMomentStory(draft.stories);
    const rest = draft.stories.filter((s) => s.type !== "first-moment");
    saveGatedWithToasts({ stories: [...rest, { ...story, slides }] });
  };

  const editorFor = (key: string) => {
    switch (key) {
      case "first-messages":
        return (
          <FirstMessagesEditor
            value={draft.firstMessages}
            onChange={(v) => saveGatedWithToasts({ firstMessages: v })}
          />
        );
      case "first-moment-story":
        return (
          <StorySlidesEditor
            value={firstMomentStory(draft.stories).slides}
            onChange={setSlides}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-16">
      {/* Notes-left banner (§4.2) — scrolls to the first flagged section. */}
      <ChangesBanner />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_392px]">
        <div className="min-w-0 space-y-[var(--card-gap)]">
          {FM_SECTIONS.map((section) => {
            const pu = profileUpdate?.fields.find(
              (f) => f.fieldId === section.fieldKey
            );
            const puFlagged = pu?.fieldStatus === "changes-requested";
            return (
              <div
                key={section.step}
                {...(puFlagged
                  ? { "data-flagged-field": section.fieldKey }
                  : {})}
              >
                <SectionCard
                  title={section.label}
                  status={section.summary(draft)}
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
          })}
        </div>

        {/* Live chat preview — passive output, never an editing surface. */}
        <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
          <FirstChatPreview draft={draft} />
          <p className="text-xs text-[var(--text-muted)]">
            Live preview · the first chat teens see
          </p>
        </div>
      </div>
    </div>
  );
}
