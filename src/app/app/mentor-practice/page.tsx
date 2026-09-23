"use client";

// /app/mentor-practice — RETIRED, and nothing replaced it (addendum §2.1).
//
// Mentor Practice is not a real concept in this product. The five deterministic
// timing rules that produced its events, the second disposition vocabulary that
// closed them and the review subject that separated them from teen safety are
// all gone — see `lib/monitoring/event.ts` for what the removal cost the event
// primitive, which is nothing structural.
//
// IT LANDS ON RISK FLAGS, which is the other review queue and the nearest live
// surface. That is a guess, not a rename, and `RetiredRoute` names the
// destination out loud so a reader who followed a Mentor Practice link knows
// they are somewhere else rather than looking at an empty version of what they
// asked for.
//
// THE FILE IS NOT DELETED, per the strangler rule: the destination shipped, it
// was in the rail, and a bookmark to it is in somebody's history.

import { RetiredRoute } from "@/components/ia/retired-route";
import { retiredRouteTarget } from "@/lib/ia/retired-routes";

export default function MentorPracticeRoute() {
  return (
    <RetiredRoute
      target={retiredRouteTarget("mentor-practice")}
      destinationLabel="Risk Flags"
      fallbackTitle="Mentor Practice"
      fallbackActive="risk-flags"
    />
  );
}
