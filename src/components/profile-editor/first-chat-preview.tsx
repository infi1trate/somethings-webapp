// FIXED IDENTITY — DO NOT THEME. This renders the TEEN-facing mobile app, not
// staff chrome. Its palette must stay put in dark mode: the preview shows what
// teens actually see, and teens do not share a staff member's appearance
// setting. Hard-coded whites/purples here are deliberate; on a dark staff page
// it reads as a real device screen. (Dark-mode pass, gaps.md.)
// Chat-style FIRST MOMENTS preview (§4 rev, Phase 5b) — a NEW preview variant:
// the first-chat thread a teen gets when they open the mentor's chat. Online
// first messages render as chat bubbles in list order, then the story as an
// attachment card. Strictly passive, live-updating from the draft. The
// match-card preview (mentor-profile-preview.tsx) is a separate variant —
// do not merge or modify it.

import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { firstMomentStory } from "@/lib/types";
import type { MentorDraft } from "@/lib/types";

export function FirstChatPreview({
  draft,
  showStory = true,
}: {
  draft: MentorDraft;
  /** The story attachment is part of the real first chat, so it shows by
   *  default. The MENTOR'S OWN view passes false: a lead or supervisor curates
   *  their story and the mentor doesn't see it — including reflected in a
   *  preview of their own chat. */
  showStory?: boolean;
}) {
  const messages = draft.firstMessages.online;
  const story = showStory
    ? firstMomentStory(draft.stories)
    : { slides: [] as never[] };
  const name = draft.displayName || draft.firstName || "Your mentor";
  // Emptiness is measured against what this preview SHOWS. Measured against the
  // draft, a mentor with a story and no messages would drop out of the skeleton
  // branch into a thread with nothing in it.
  const empty = messages.length === 0 && story.slides.length === 0;

  return (
    <PhonePreviewShell label="Live preview — the first chat teens see">
      <div className="flex h-full flex-col bg-white">
        {/* Chat header — the avatar renders in situ (§4 Phase 9): the Chat
            avatar asset when set, otherwise the initial tile. */}
        <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 pb-3 pt-14">
          {draft.accountPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.accountPhoto}
              alt=""
              aria-hidden
              className="size-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-[var(--preview-accent)] font-display text-sm font-bold text-white"
            >
              {name.trim().charAt(0).toUpperCase() || "M"}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium leading-[18px] text-[var(--text-primary)]">
              {name}
            </span>
            <span className="block text-[11px] leading-[14px] text-[var(--text-muted)]">
              Mentor
            </span>
          </span>
        </div>

        {/* Thread */}
        <div className="flex-1 space-y-3 overflow-hidden px-4 py-4">
          {empty ? (
            // Skeleton empty state — placeholder bubbles, no invented content.
            <div className="space-y-3" aria-hidden>
              <div className="h-9 w-40 rounded-2xl rounded-bl-md bg-black/[0.05]" />
              <div className="h-14 w-56 rounded-2xl rounded-bl-md bg-black/[0.05]" />
              <div className="h-9 w-32 rounded-2xl rounded-bl-md bg-black/[0.05]" />
              <p className="pt-2 text-center text-[12px] leading-[16px] text-[var(--text-muted)]">
                Your first messages will show up here.
              </p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="max-w-[85%] rounded-2xl rounded-bl-md bg-[var(--preview-chip-bg)] px-3.5 py-2 text-[14px] leading-snug text-[var(--text-primary)]"
                >
                  {m.text}
                </div>
              ))}
              {story.slides.length > 0 && (
                <div className="w-56 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-tile)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.slides[0].photo}
                    alt=""
                    className="h-40 w-full object-cover"
                  />
                  <div className="px-3 py-2">
                    <p className="truncate text-[13px] font-medium leading-[18px] text-[var(--text-primary)]">
                      {name}&apos;s first moment
                    </p>
                    <p className="text-[11px] leading-[14px] text-[var(--text-muted)]">
                      Story · {story.slides.length} slide
                      {story.slides.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PhonePreviewShell>
  );
}
