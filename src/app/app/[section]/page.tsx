"use client";

// Placeholder surfaces for the shell's not-yet-built nav sections (Phase 7).
// Shared §6 empty state only — no invented content. /app/profile is a real
// static route and takes precedence over this dynamic segment.
//
// CHAT is a special case. Every table row's Chat action deep-links here as
// /app/chat?with=<personId>, and this page used to drop that param on the floor —
// so pressing Chat on a named person landed on a generic "Nothing here yet",
// which reads as a broken link rather than an unbuilt feature. It now names the
// person, so the affordance is honest about what it will become and the deep
// link is already the shape the real thread view will inherit.

import { use } from "react";
import { AppChrome } from "@/components/app-shell/app-chrome";
import { notFound, useParams } from "next/navigation";
import { NAV } from "@/components/settings/nav-items";
import {
  resolveSubject,
  subjectDisplayName,
  LIVE_ID,
} from "@/lib/record/subject";
import { useOnboardingStore } from "@/lib/onboarding/store";

export default function AppSectionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // use(searchParams) prop pattern (invariant 5) — never useSearchParams, and no
  // page-root Suspense.
  const query = use(searchParams);
  const params = useParams<{ section: string }>();
  const draft = useOnboardingStore((s) => s.draft);

  // ═══ `home` IS NO LONGER EXCLUDED (Phase 2A) ═══
  //
  // It was excluded because `/app` IS the mentor's home, so `/app/home` would
  // have been a second URL for one place. Staff are a different case: `/app`
  // hardcodes `AppChrome`, so sending a supervisor there hands them a mentor's
  // home in a mentor's chrome. `nav-items.ts` routes staff Home to `/app/home`
  // instead, and this placeholder is what serves it — the honest "not built for
  // your role yet" view that decision 1 asked for. Mentors are never linked
  // here, so the duplicate-URL concern does not arise in practice.
  const item = Object.values(NAV).find((i) => i.id === params.section);
  if (!item) notFound();

  const withId = typeof query.with === "string" ? query.with : null;
  const subject = withId ? resolveSubject(withId) : null;
  // "live" is the store-backed mentor and has no fixture row, so its name comes
  // from the draft — same fallback the directories use.
  const withName =
    subject?.kind === "fixture"
      ? subjectDisplayName(subject)
      : withId === LIVE_ID
        ? [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
          "this mentor"
        : null;

  return (
    <AppChrome active={item.id}>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          {withName ? `Chat with ${withName}` : item.label}
        </h1>
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {withName
            ? "Messaging isn’t part of this prototype yet — this is where the conversation will open."
            : "Nothing here yet. When there’s something new, it’ll show up here."}
        </p>
      </div>
    </AppChrome>
  );
}
