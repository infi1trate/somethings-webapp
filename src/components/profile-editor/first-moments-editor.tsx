"use client";

// The First moments tab (§3 rev, Phase 5b): what a teen gets the first time
// they open the mentor's chat. Hosts the sections MOVED from Matching profile
// — the same Phase-3 components (FirstMessagesEditor, StorySlidesEditor from
// matching-extensions.tsx), not rebuilds — plus the live chat-style preview.
// Shares the whole-profile review loop (same changeRequests model + submit);
// the Send-for-review CTA here is scoped to THIS tab's sections only.

import { useState } from "react";
import { AlertCircle, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/settings/section-card";
import { PillButton } from "@/components/settings/pill-button";
import { ChangeNoteCard } from "@/components/onboarding/change-note-card";
import {
  FirstMessagesEditor,
  StorySlidesEditor,
} from "@/components/profile-editor/matching-extensions";
import { FirstChatPreview } from "@/components/profile-editor/first-chat-preview";
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
import { firstMomentStory } from "@/lib/types";
import type { StorySlide } from "@/lib/types";

const HELPER_BY_KEY: Record<string, string> = {
  "first-messages":
    "Sent automatically when a teen opens your chat for the first time.",
  "first-moment-story": "Up to 6 images — no captions needed.",
};

const FM_SECTIONS = sectionsForTab("first-moments");
const FM_STEPS = new Set(FM_SECTIONS.map((s) => s.step));

export function FirstMomentsEditor() {
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
  // CTA scope: this tab's sections only (§3 rev) — matching-tab edits drive
  // that tab's CTA, not this one.
  const changed = (
    publishedSnapshot ? changedProfileSections(draft, publishedSnapshot) : []
  ).filter((step) => FM_STEPS.has(step));
  const dirty = changed.length > 0;
  const { addressed, total: reqTotal } = changeProgress(changeRequests, draft);

  // Same whole-profile submit as the Matching tab (one review loop). Snapshot
  // timing untouched — submit only transitions status.
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
    toast("Sent."); // see gaps.md #33 for the §4 copy conflict w/ the lock
  };

  // LIBRARY-READY write path: today exactly one 'first-moment' story exists;
  // writes update that entry inside stories[] so future types slot in.
  const setSlides = (slides: StorySlide[]) => {
    const story = firstMomentStory(draft.stories);
    const rest = draft.stories.filter((s) => s.type !== "first-moment");
    update({ stories: [...rest, { ...story, slides }] });
  };

  const editorFor = (key: string) => {
    switch (key) {
      case "first-messages":
        return (
          <FirstMessagesEditor
            value={draft.firstMessages}
            onChange={(v) => update({ firstMessages: v })}
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
    <div className="pb-24">
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
            <span className="font-semibold">
              The team asked for a few changes.
            </span>{" "}
            {addressed} of {reqTotal} addressed — flagged sections show the
            team&apos;s notes.
          </span>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_392px]">
        <div className="min-w-0 space-y-[var(--card-gap)]">
          {FM_SECTIONS.map((section) => {
            const reqs = isRejected
              ? requestsForStep(changeRequests, section.step)
              : [];
            return (
              <SectionCard
                key={section.step}
                title={section.label}
                status={section.summary(draft)}
                state={changed.includes(section.step) ? "dirty" : "default"}
                flagged={reqs.length > 0}
                disabled={locked}
                expanded={openId === section.step && !locked}
                onToggle={() =>
                  setOpenId((o) => (o === section.step ? null : section.step))
                }
              >
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

        {/* Live chat preview — passive output, never an editing surface. */}
        <div className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-center lg:gap-3">
          <FirstChatPreview draft={draft} />
          <p className="text-xs text-[var(--text-muted)]">
            Live preview · the first chat teens see
          </p>
        </div>
      </div>

      {/* Per-tab action bar — same states as Matching, scoped to this tab. */}
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
          <PillButton disabled className="pointer-events-auto">
            No changes made
          </PillButton>
        )}
      </div>
    </div>
  );
}
