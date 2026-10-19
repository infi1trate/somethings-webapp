"use client";

// /app/coverage — RETIRED. Coverage IS Chat (addendum §2.2).
//
// The destination's unit was a supervised conversation, and a conversation is
// read in the chat view — a surface that already existed and that this route
// briefly duplicated the entry point to. So this is a rename with a redirect
// behind it rather than a removal: a reader who bookmarked Coverage wanted the
// conversations, and the conversations are at `/app/chat`.
//
// THE FILE IS NOT DELETED, per the strangler rule this codebase follows: a
// retired route stays until every link to it is gone, and a 404 under a bookmark
// is worse than a hop.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams.

import { RetiredRoute } from "@/components/ia/retired-route";
import { retiredRouteTarget } from "@/lib/ia/retired-routes";

export default function CoverageRoute() {
  return (
    <RetiredRoute
      target={retiredRouteTarget("coverage")}
      destinationLabel="Chats"
      fallbackTitle="Coverage"
      fallbackActive="chat"
    />
  );
}
