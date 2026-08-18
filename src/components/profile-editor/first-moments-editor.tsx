"use client";

// The First moments tab (§3 rev, Phase 5b): what a teen gets the first time they
// open the mentor's chat. Hosts the sections MOVED from Matching profile — the
// same Phase-3 components (FirstMessagesEditor, StorySlidesEditor from
// matching-extensions.tsx) — plus the live chat preview.
//
// NO REVIEW CYCLE (product decision). These two fields are no longer in
// GATED_FIELDS, so a save is LIVE IMMEDIATELY: nothing enqueues into the
// changeset, no lead is asked to approve it, and no queue item or nav badge
// appears. All the review chrome this tab used to carry — the notes banner,
// In review / Changes requested chips, the reviewer's note callout, the pending
// helper line and Discard change — is GONE rather than left unreachable: with
// the fields ungated none of it can ever fire, and dead affordances read as
// bugs. The gated Profile tab keeps all of it.
//
// Staff oversight didn't disappear, it moved off the mentor's critical path: the
// save logs a `profile_update_live` activity entry (the record's audit trail),
// and a lead or supervisor can edit these fields directly on the record.

import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/settings/section-card";
import {
  FirstMessagesEditor,
  StorySlidesEditor,
} from "@/components/profile-editor/matching-extensions";
import { FirstChatPreview } from "@/components/profile-editor/first-chat-preview";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { sectionsForTab } from "@/lib/onboarding/profile-sections";
import { firstMomentStory } from "@/lib/types";
import type { MentorDraft, StorySlide } from "@/lib/types";

const HELPER_BY_KEY: Record<string, string> = {
  "first-messages":
    "Sent automatically when a teen opens your chat for the first time. Changes go live right away.",
  "first-moment-story": "Up to 6 images — no captions needed. Changes go live right away.",
};

const FM_SECTIONS = sectionsForTab("first-moments");

export function FirstMomentsEditor() {
  const draft = useOnboardingStore((s) => s.draft);
  const publishedSnapshot = useOnboardingStore((s) => s.publishedSnapshot);
  const saveGatedFields = useOnboardingStore((s) => s.saveGatedFields);
  const [openId, setOpenId] = useState<string | null>(null);

  // One save path for this tab. `saveGatedFields` still owns the write (it also
  // moves the published snapshot for these fields, so the record and teens see
  // the change at once) — this only adds the confirmation the review toasts used
  // to give. Pre-publish there is nothing live yet, so the copy stays neutral.
  const publishNow = (patch: Partial<MentorDraft>) => {
    saveGatedFields(patch);
    toast(publishedSnapshot ? "Saved — teens see this now." : "Saved.");
  };

  // LIBRARY-READY write path: today exactly one 'first-moment' story exists;
  // writes update that entry inside stories[] so future types slot in.
  const setSlides = (slides: StorySlide[]) => {
    const story = firstMomentStory(draft.stories);
    const rest = draft.stories.filter((s) => s.type !== "first-moment");
    publishNow({ stories: [...rest, { ...story, slides }] });
  };

  const editorFor = (key: string) => {
    switch (key) {
      case "first-messages":
        return (
          <FirstMessagesEditor
            value={draft.firstMessages}
            onChange={(v) => publishNow({ firstMessages: v })}
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
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_392px]">
        <div className="min-w-0 space-y-[var(--card-gap)]">
          {FM_SECTIONS.map((section) => (
            <SectionCard
              key={section.step}
              title={section.label}
              // Empty value renders NOTHING, not an orphan em dash. The
              // section registry returns "—" as its empty marker (EMPTY in
              // profile-sections.ts) and SectionCard renders `status`
              // unconditionally, so an untouched card showed a bare dash under
              // its title. Filtered here rather than in the shared registry:
              // the Profile tab's cards are out of scope for this pass.
              status={
                section.summary(draft) === "—"
                  ? undefined
                  : section.summary(draft)
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
            </SectionCard>
          ))}
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
