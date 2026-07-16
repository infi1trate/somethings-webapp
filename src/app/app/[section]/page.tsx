"use client";

// Placeholder surfaces for the shell's not-yet-built nav sections (Phase 7).
// Shared §6 empty state only — no invented content. /app/profile is a real
// static route and takes precedence over this dynamic segment.

import { notFound, useParams } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { SIDEBAR_ITEMS } from "@/components/settings/sidebar";

export default function AppSectionPage() {
  const params = useParams<{ section: string }>();
  const item = SIDEBAR_ITEMS.find(
    (i) => i.id === params.section && i.id !== "home"
  );
  if (!item) notFound();

  return (
    <MentorShell active={item.id}>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          {item.label}
        </h1>
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Nothing here yet. When there&apos;s something new, it&apos;ll show up
          here.
        </p>
      </div>
    </MentorShell>
  );
}
