// ═══════════════════════════════════════════════════════════════════════════
// /app/activity — RETIRED (2026-10-16)
//
// "Move the Activity tab's contents into this bell. We don't need both."
// Activity lives in the top bar's bell now (`components/app-shell/activity-bell.tsx`):
// the supervisor ledger as `ActivityLedger variant="popover"`, a mentor's
// notices as `MentorActivityList`. The links that pointed here with filters
// (Today, the roster's billing code, the dev bar) were removed, as answered.
//
// A REDIRECT RATHER THAN A 404, so a bookmark or an old comment's deep link
// lands somewhere usable; the bell is on every console page it can land on.

import { redirect } from "next/navigation";

export default function ActivityRetired() {
  redirect("/app");
}
