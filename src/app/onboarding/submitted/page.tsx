"use client";

// The onboarding hub (/hub) is now the post-submit landing. This legacy route
// just forwards there — which also removes the old "View what you submitted" →
// editable-preview path that let an in_review profile be re-submitted.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HUB_PATH } from "@/lib/onboarding/steps";

export default function SubmittedRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(HUB_PATH);
  }, [router]);
  return <div className="min-h-dvh bg-background" />;
}
