"use client";

// Dev/demo scaffolding — not product UI. Lets you flip between the two sides of
// the review loop (the mentor's onboarding flow and the admin review console)
// without real auth. Mounted from the root layout in ALL environments (incl. the
// Vercel demo) so reviewers can switch sides — there's no auth gate behind it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DevRoleToggle() {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");

  const tab = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
      active ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
    );

  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-1 rounded-full border border-dashed border-foreground/40 bg-card/95 p-1 pl-2.5 text-xs shadow-md backdrop-blur">
      <span className="font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        Dev
      </span>
      <Link href="/onboarding" className={tab(!isAdmin)}>
        Mentor
      </Link>
      <Link href="/admin/users" className={tab(isAdmin)}>
        Admin
      </Link>
    </div>
  );
}
