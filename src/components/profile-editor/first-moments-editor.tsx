"use client";

// The First moments tab (§3 rev, Phase 5b): what a teen gets the first time they
// open the mentor's chat. Hosts the sections MOVED from Matching profile — the
// Phase-3 FirstMessagesEditor from matching-extensions.tsx — plus the live chat
// preview.
//
// FIRST MESSAGES ONLY. This tab used to carry the story editor as well; the
// story is now staff-curated and invisible to the mentor (see FM_SECTIONS
// below), so this is the mentor's messages and nothing else.
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
import { FirstMessagesEditor } from "@/components/profile-editor/matching-extensions";
import { FirstChatPreview } from "@/components/profile-editor/first-chat-preview";
import { PreviewDisclosure } from "@/components/settings/preview-disclosure";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { mentorSectionsForTab } from "@/lib/onboarding/profile-sections";
import type { MentorDraft } from "@/lib/types";

const HELPER_BY_KEY: Record<string, string> = {
  "first-messages":
    "Sent automatically when a teen opens your chat for the first time. Changes go live right away.",
};

// THE STORY IS NOT HERE (user decision). A lead mentor or supervisor picks the
// three images on the mentor's record, and the mentor does not see their own —
// so the section is ABSENT from this tab rather than read-only, and the chat
// preview beside it hides the story attachment too. No note stands in for it:
// naming content the reader can't open is worse than not mentioning it, and
// this tab still has a job of its own.
const FM_SECTIONS = mentorSectionsForTab("first-moments");

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

  const editorFor = (key: string) => {
    switch (key) {
      case "first-messages":
        return (
          <FirstMessagesEditor
            value={draft.firstMessages}
            onChange={(v) => publishNow({ firstMessages: v })}
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

        {/* Live chat preview — passive output, never an editing surface.
            RC-2: was `hidden lg:…`. */}
        <PreviewDisclosure
          /* TODO-COPY */
          triggerLabel="Preview the first chat"
          title="The first chat teens see"
          caption={
            <p className="text-xs text-[var(--text-muted)]">
              Live preview · the first chat teens see
            </p>
          }
        >
          {/* showStory={false}: the story is staff-curated and the mentor
              doesn't see it, so it can't leak back in through a preview of
              their own chat. */}
          <FirstChatPreview draft={draft} showStory={false} />
        </PreviewDisclosure>
      </div>
    </div>
  );
}
