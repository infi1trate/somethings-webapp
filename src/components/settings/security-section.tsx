"use client";

// Security (settings-02) — one live control and the roadmap. Sign out is real
// (a stub action, but a real, confirmed flow); Change password / Two-step
// verification / Active sessions are honest coming-soon rows (no fake toggles).
// The card groups mirror the Account section's hairline-divided anatomy so the
// two sections read as one surface.

import { useState } from "react";
import { LogOut } from "lucide-react";
import { ComingSoonRow } from "@/components/settings/section-placeholders";
import { SignOutConfirmDialog, useSignOut } from "@/components/settings/sign-out";
import { cn } from "@/lib/utils";

const GROUP =
  "divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function SecuritySection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const signOut = useSignOut();

  return (
    <div className="space-y-5">
      <section aria-label="Session">
        <div className={GROUP}>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={cn(
              "flex w-full items-center gap-4 rounded-[var(--radius-card)] px-[var(--card-pad)] py-2.5 text-left transition-colors hover:bg-black/[0.03]",
              RING
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-[20px] text-[var(--text-primary)]">
                Sign out
              </span>
              <span className="block text-[12px] leading-[16px] text-[var(--text-muted)]">
                Sign out of Somethings on this device.
              </span>
            </span>
            <LogOut
              className="size-4 shrink-0 text-[var(--text-secondary)]"
              aria-hidden
            />
          </button>
        </div>
      </section>

      <section aria-label="Sign-in security">
        <h3 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
          Sign-in security
        </h3>
        <div className={GROUP}>
          <ComingSoonRow
            label="Change password"
            description="Update the password you use to sign in."
          />
          <ComingSoonRow
            label="Two-step verification"
            description="Add a second step when you sign in."
          />
          <ComingSoonRow
            label="Active sessions"
            description="See where you're signed in, and sign out everywhere."
          />
        </div>
      </section>

      <SignOutConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          signOut();
        }}
      />
    </div>
  );
}
