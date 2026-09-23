"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A DESTINATION BEFORE ITS CONTENTS ARRIVE
//
// Phase 1 creates the routes and the rail; the bodies land in Phases 2 and
// 5-8. Six destinations therefore need a body that is honest for one commit.
//
// ═══ IT NAMES WHAT WILL BE HERE, WHICH THE GENERIC PLACEHOLDER CANNOT ═══
//
// `/app/[section]` already renders an unbuilt-section view — "Nothing here yet.
// When there's something new, it'll show up here." Two reasons it is not reused:
//
//  · IT WEARS THE WRONG CHROME. That route renders `MentorShell`, so a
//    supervisor landing on it gets a mentor's rail. It is the same trap
//    `/app/home` hit in Phase 2A, recorded there.
//  · "NOTHING HERE YET" IS FALSE. There IS something here — it is on Home,
//    one route away, and it is being moved. A reader who follows a rail item to
//    "nothing here yet" concludes the feature does not exist; one who reads
//    "the risk-flag queue moves here in the next commit" knows what they are
//    looking at. The distinction matters most for the two destinations that are
//    genuinely unbuilt (`coverage`, `mentor-practice`), because only an honest
//    placeholder on the other four makes those two legible as different.
//
// EVERY STRING HERE IS TEMPORARY and none of it is `NEEDS-COPY-NICOLE`: copy
// that exists for one phase is not copy anybody should be asked to write.
// ═══════════════════════════════════════════════════════════════════════════

export function DestinationPlaceholder({
  title,
  status,
}: {
  title: string;
  /** One sentence: what arrives here, and when. Written for a reader inside
   *  this restructure, not for a user. */
  status: string;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[860px] flex-col justify-center gap-2 px-6 py-6 lg:px-8">
      <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
        {title}
      </h1>
      <p className="max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {status}
      </p>
    </div>
  );
}
