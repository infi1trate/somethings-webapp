"use client";

// The post-submit home. After a mentor submits, they land here and STAY here —
// no auto-push to the hub or dashboard. The page reflects the live review status
// in place, with a distinct, finished treatment for each state a submitted
// profile can be in:
//   • in_review → Pending: a calm "we've got it, sit tight" holding screen.
//   • rejected  → Changes requested: the team's actual notes + a way to fix them.
//   • published → Approved: the celebratory "you're live" moment → mentor home.
// Any non-submitted status (still building, or pre-invite) is bounced to the hub
// so this is never a dead-end for someone who hasn't submitted yet.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DoodleScatter, Moodie, type MoodieName } from "@/components/doodles";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { ChangeNoteCard } from "@/components/onboarding/change-note-card";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { HUB_PATH, PREVIEW_PATH } from "@/lib/onboarding/steps";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";
import {
  changeProgress,
  firstUnaddressed,
} from "@/lib/onboarding/change-requests";
import type { MentorDraft, ProfileStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// The three statuses a *submitted* profile moves through. Anything else means
// the mentor hasn't submitted, so this page isn't theirs yet.
const POST_SUBMIT: ProfileStatus[] = ["in_review", "rejected", "published"];

export default function SubmittedPage() {
  const mounted = useMounted();
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);

  useEffect(() => {
    if (mounted && !POST_SUBMIT.includes(status)) router.replace(HUB_PATH);
  }, [mounted, status, router]);

  if (!mounted || !POST_SUBMIT.includes(status)) {
    return <div className="min-h-dvh bg-background" />;
  }

  return (
    <StatusShell status={status} draft={draft}>
      {status === "in_review" && <PendingContent draft={draft} />}
      {status === "rejected" && <ChangesContent draft={draft} />}
      {status === "published" && <ApprovedContent draft={draft} />}
    </StatusShell>
  );
}

// Shared chrome for all three states: warm background, header (wordmark + the
// live status pill), and a desktop-only preview of the very profile under
// review. Mobile stays a clean single-column status screen.
function StatusShell({
  status,
  draft,
  children,
}: {
  status: ProfileStatus;
  draft: MentorDraft;
  children: React.ReactNode;
}) {
  const caption =
    status === "published"
      ? "Live · what teens see"
      : status === "rejected"
        ? "What teens will see"
        : "Under review · what teens see";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1]">
      <header className="relative z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <StatusBadge status={status} />
        </div>
      </header>

      <DoodleScatter className="opacity-60" />

      <main className="relative z-10 mx-auto grid w-full max-w-6xl items-start gap-10 px-5 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          {children}
        </div>

        {/* Their profile, for reassurance/context. Desktop-only so mobile stays
            a clean, single-column status screen. */}
        <div className="hidden lg:sticky lg:top-12 lg:flex lg:flex-col lg:items-center lg:gap-3">
          <PhoneFrame>
            <MentorProfilePreview draft={draft} />
          </PhoneFrame>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
      </main>
    </div>
  );
}

// ── Pending (in_review) ────────────────────────────────────────────────────
function PendingContent({ draft }: { draft: MentorDraft }) {
  const firstName = draft.firstName?.trim();
  const email = draft.email?.trim();

  return (
    <div>
      <IconTile tone="amber" face="face-love" />
      <h1 className="mt-5 font-display text-[34px] font-bold leading-[1.05] tracking-tight text-balance">
        {firstName ? `That's your profile in, ${firstName}` : "That's your profile in"}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">
        Our team reads every profile before it goes live — usually a day or two.{" "}
        {email ? (
          <>
            We&apos;ll email you at{" "}
            <span className="font-medium text-foreground">{email}</span>{" "}
            the moment there&apos;s an update.
          </>
        ) : (
          <>We&apos;ll email you the moment there&apos;s an update.</>
        )}{" "}
        Nothing else to do right now.
      </p>

      <WhatsNext />
    </div>
  );
}

const NEXT_STEPS = [
  { label: "Submitted", sub: "We've got your profile.", state: "done" },
  { label: "In review", sub: "A teammate is reading it over.", state: "current" },
  {
    label: "Approved & live",
    sub: "Teens can find and message you.",
    state: "upcoming",
  },
] as const;

function WhatsNext() {
  return (
    <section className="mt-8 rounded-2xl border bg-card/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        What happens next
      </p>
      <ol className="mt-4">
        {NEXT_STEPS.map((s, i) => {
          const last = i === NEXT_STEPS.length - 1;
          return (
            <li key={s.label} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <NextDot state={s.state} />
                {!last && (
                  <span
                    className={cn(
                      "w-px flex-1",
                      s.state === "done" ? "bg-emerald-300" : "bg-border"
                    )}
                  />
                )}
              </div>
              <div className={cn(last ? "pb-0" : "pb-5")}>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    s.state === "upcoming"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {s.label}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.sub}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NextDot({ state }: { state: "done" | "current" | "upcoming" }) {
  if (state === "done") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-amber-100 ring-2 ring-amber-500">
        <span className="size-2 rounded-full bg-amber-500 motion-safe:animate-pulse" />
      </span>
    );
  }
  return <span className="size-6 rounded-full border-2 border-border bg-card" />;
}

// ── Changes requested (rejected) ─────────────────────────────────────────────
function ChangesContent({ draft }: { draft: MentorDraft }) {
  const firstName = draft.firstName?.trim();
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const { addressed, total } = changeProgress(changeRequests, draft);

  // Drop them on the first note they haven't handled yet — that step shows the
  // dock + the full note inline. Once everything's addressed, send them to the
  // review screen to resubmit.
  const next = firstUnaddressed(changeRequests, draft);
  const ctaHref = next ? stepHref(next.stepId) : PREVIEW_PATH;
  const ctaLabel = next ? "Make your changes" : "Review & resubmit";

  // Built as one string (not inline JSX) so the conditional word swaps can't lose
  // their surrounding spaces to JSX whitespace collapsing.
  const blurb =
    total > 0
      ? `The team read your profile and sent back ${total} ${
          total === 1 ? "note" : "notes"
        } to handle before it goes live. Sort ${
          total === 1 ? "it" : "them"
        } out and send it back — you're close.`
      : "The team read your profile and sent it back with a few changes before it goes live. Take a look and resubmit — you're close.";

  return (
    <div>
      <IconTile tone="orange" face="face-pleased" />
      <h1 className="mt-5 font-display text-[34px] font-bold leading-[1.05] tracking-tight text-balance">
        {firstName ? `You're almost there, ${firstName}` : "You're almost there"}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">
        {blurb}
      </p>

      {total > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              The team&apos;s notes
            </p>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                total > 0 && addressed === total
                  ? "text-emerald-600"
                  : "text-muted-foreground"
              )}
            >
              {addressed} of {total} addressed
            </span>
          </div>
          {changeRequests.map((req) => (
            <div key={req.id}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {req.sectionLabel}
              </p>
              <ChangeNoteCard req={req} draft={draft} />
            </div>
          ))}
        </div>
      )}

      <Button asChild size="lg" className="mt-7">
        <Link href={ctaHref}>
          {ctaLabel}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

// ── Approved (published) ─────────────────────────────────────────────────────
function ApprovedContent({ draft }: { draft: MentorDraft }) {
  const firstName = draft.firstName?.trim();

  return (
    <div>
      <IconTile tone="emerald" face="face-excited" />
      <h1 className="mt-5 font-display text-[34px] font-bold leading-[1.05] tracking-tight text-balance">
        {firstName ? `You're approved, ${firstName}!` : "You're approved!"}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">
        Your profile passed review and is live. Teens can find you and reach out
        now — welcome to the team.
      </p>
      <Button asChild size="lg" className="mt-7">
        <Link href="/app">
          Go to your mentor home
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

// Soft, rounded mood tile — tone matches the state's status pill (amber → in
// review, orange → needs changes, emerald → published) so the whole page reads
// as one feedback system.
function IconTile({
  tone,
  face,
}: {
  tone: "amber" | "orange" | "emerald";
  face: MoodieName;
}) {
  const toneCls = {
    amber: "bg-amber-100",
    orange: "bg-orange-100",
    emerald: "bg-emerald-100",
  }[tone];
  return (
    <span
      className={cn(
        "flex size-20 items-center justify-center rounded-[1.75rem]",
        toneCls
      )}
    >
      <Moodie name={face} className="doodle-float size-14" />
    </span>
  );
}
