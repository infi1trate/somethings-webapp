"use client";

// Account popover (settings-04) — the sidebar avatar's menu. Opens on
// CLICK / Enter / Space only (Radix Popover; never hover — hover just shows the
// "Account" tooltip on the trigger). Escape closes and returns focus to the
// avatar (Radix default). Contents:
//   • Identity: the persona's avatar with a pencil-overlay edit affordance
//     (hover + focus on pointer devices, always visible on touch), display
//     name, role chip. Editing the photo reuses settings-02's Account photo
//     picker by deep-linking to it (?section=account&open=photo) — so the
//     mentor's gated flow and staff's direct edit are inherited, not
//     duplicated.
//   • Profile → /app/profile for mentors; an inert coming-soon row for staff
//     (no staff profile route exists). Settings → /app/settings.
//   • Footer: a theme quick toggle sharing the settings-01 useAppearance state
//     (this resolves the deferred sidebar-moon sync, design-system-gaps.md #98)
//     and Sign out (the settings-02 stub + confirm).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, Moon, Pencil, Sun } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ComingSoonChip } from "@/components/settings/section-placeholders";
import {
  SignOutConfirmDialog,
  useSignOut,
} from "@/components/settings/sign-out";
import { roleForPersona } from "@/components/settings/tabs-config";
import { useAppearance } from "@/lib/use-appearance";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function AvatarFace({
  src,
  initial,
  className,
  textClass = "text-xl",
}: {
  src: string | null;
  initial: string;
  className: string;
  textClass?: string;
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn("rounded-full object-cover shadow-[var(--shadow-tile)]", className)}
    />
  ) : (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-white font-display font-bold text-[var(--text-primary)] shadow-[var(--shadow-tile)]",
        textClass,
        className
      )}
    >
      {initial}
    </span>
  );
}

export function AccountPopover({
  avatarSrc,
  avatarInitial,
}: {
  avatarSrc: string | null;
  avatarInitial: string;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const displayName = useOnboardingStore((s) => s.draft.displayName);
  const { theme, setTheme } = useAppearance();
  const signOut = useSignOut();

  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const role = mounted ? roleForPersona(persona) : "mentor";
  const isMentor = role === "mentor";
  const name = mounted
    ? displayName?.trim() || firstName?.trim() || "You"
    : "You";
  const roleLabel =
    role === "supervisor"
      ? "Supervisor"
      : role === "lead"
        ? "Lead mentor"
        : "Mentor";

  const isDark =
    mounted &&
    (theme === "dark" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  const nav = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const rowClass = cn(
    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[14px] leading-[20px] text-[var(--text-primary)] transition-colors hover:bg-black/[0.04]",
    RING
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Account"
            className={cn(
              "group relative shrink-0 rounded-full transition-shadow hover:ring-2 hover:ring-[var(--focus-ring)] hover:ring-offset-2 hover:ring-offset-[var(--surface-s2)] data-[state=open]:ring-2 data-[state=open]:ring-[var(--focus-ring)] data-[state=open]:ring-offset-2 data-[state=open]:ring-offset-[var(--surface-s2)]",
              RING
            )}
          >
            <AvatarFace
              src={avatarSrc}
              initial={avatarInitial}
              className="size-[var(--sidebar-avatar)]"
            />
            {/* Plain hover tooltip — NOT the menu (that's the click target). */}
            <span
              role="presentation"
              className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--text-primary)] px-2 py-1 text-[11px] font-medium leading-[14px] text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-data-[state=open]:opacity-0"
            >
              Account
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-64 gap-0 p-2"
        >
          {/* Identity */}
          <div className="flex items-center gap-3 px-1.5 pb-2.5 pt-1">
            <button
              type="button"
              onClick={() => nav("/app/settings?section=account&open=photo")}
              aria-label="Edit photo"
              className={cn("group/av relative shrink-0 rounded-full", RING)}
            >
              <AvatarFace
                src={avatarSrc}
                initial={avatarInitial}
                className="size-12"
                textClass="text-base"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover/av:opacity-100 group-focus-visible/av:opacity-100 [@media(hover:none)]:opacity-100">
                <Pencil className="size-4 text-white" aria-hidden />
              </span>
            </button>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium leading-[20px] text-[var(--text-primary)]">
                {name}
              </div>
              <span className="mt-0.5 inline-flex items-center rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium leading-none text-[var(--text-secondary)]">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* CTAs */}
          <div className="py-1">
            {isMentor ? (
              <button type="button" onClick={() => nav("/app/profile")} className={rowClass}>
                <span className="flex-1">Profile</span>
                <ChevronRight className="size-4 text-[var(--text-muted)]" aria-hidden />
              </button>
            ) : (
              // Staff have no teen-facing profile route yet.
              <div className="flex w-full items-center gap-3 px-2.5 py-2 text-[14px] leading-[20px] text-[var(--text-muted)]">
                <span className="flex-1">Profile</span>
                <ComingSoonChip />
              </div>
            )}
            <button type="button" onClick={() => nav("/app/settings")} className={rowClass}>
              <span className="flex-1">Settings</span>
              <ChevronRight className="size-4 text-[var(--text-muted)]" aria-hidden />
            </button>
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* Footer: theme quick toggle + sign out */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-[14px] leading-[20px] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              {isDark ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
              {isDark ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmSignOut(true);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-[14px] leading-[20px] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <SignOutConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        onConfirm={() => {
          setConfirmSignOut(false);
          signOut();
        }}
      />
    </>
  );
}
