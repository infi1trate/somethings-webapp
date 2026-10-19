"use client";

// The Mentors roster MERGED INTO Team — a lead's mentors and their peers were
// two destinations describing the same people. This route stays as a redirect
// so existing links (the review console's return path, bookmarks) don't break.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MentorsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/team");
  }, [router]);
  return null;
}
