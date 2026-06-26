"use client";

// The post-submit home. After a mentor submits, they land here and STAY here —
// no auto-push to the hub or dashboard. The page reflects the live review status
// in place, with a distinct, finished treatment for each state a submitted
// profile can be in:
//   • in_review → Pending: a calm "we've got it, sit tight" holding screen.
//   • rejected  → Changes requested: an encouraging "a few things to update"
//     card whose rows jump straight to each field to fix (per Figma 323-1764).
//   • published → Approved: the celebratory "you're live" moment → mentor home.
// Any non-submitted status (still building, or pre-invite) is bounced to the hub
// so this is never a dead-end for someone who hasn't submitted yet.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DoodleScatter, Moodie, type MoodieName } from "@/components/doodles";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { HUB_PATH, PREVIEW_PATH } from "@/lib/onboarding/steps";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";
import {
  addressedStateOf,
  changeProgress,
} from "@/lib/onboarding/change-requests";
import type { ChangeRequest, MentorDraft, ProfileStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// The three statuses a *submitted* profile moves through. Anything else means
// the mentor hasn't submitted, so this page isn't theirs yet.
const POST_SUBMIT: ProfileStatus[] = ["in_review", "rejected", "published"];

export default function SubmittedPage() {
  const mounted = useMounted();
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);
  // A published mentor's in_review/rejected is a post-publish edit cycle — that
  // lives in Settings, not this first-time screen. Only the published "approved"
  // card still belongs here (the moment of first approval).
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);
  const postPublishEdit = everPublished && status !== "published";

  useEffect(() => {
    if (!mounted) return;
    if (postPublishEdit) router.replace("/app");
    else if (!POST_SUBMIT.includes(status)) router.replace(HUB_PATH);
  }, [mounted, status, postPublishEdit, router]);

  if (!mounted || postPublishEdit || !POST_SUBMIT.includes(status)) {
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
        {firstName ? `Thanks for submitting, ${firstName}` : "Thanks for submitting"}
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
            <li key={s.label} className="relative flex gap-3.5">
              {/* One clean 2px rail behind the dots, from this dot's center to the
                  next (top-3 + h-full) — even regardless of text height. A faint
                  emerald once done, faint neutral ahead. */}
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute left-[11px] top-3 h-full w-0.5 rounded-full",
                    s.state === "done" ? "bg-emerald-300" : "bg-border"
                  )}
                />
              )}
              <div className="flex w-6 flex-col items-center">
                <NextDot state={s.state} />
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
  // Minimal, uniform dots (z-[1] keeps them above the rail). Only "done" carries
  // colour — the completion check; current vs upcoming differ by weight, with the
  // text label carrying the meaning (not colour alone).
  if (state === "done") {
    return (
      <span className="relative z-[1] flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative z-[1] flex size-6 items-center justify-center rounded-full border-2 border-foreground/40 bg-card">
        <span className="size-2 rounded-full bg-foreground/80" />
      </span>
    );
  }
  // upcoming — same shape, lighter weight
  return (
    <span className="relative z-[1] flex size-6 items-center justify-center rounded-full border-2 border-foreground/15 bg-card">
      <span className="size-2 rounded-full bg-foreground/20" />
    </span>
  );
}

// ── Changes requested (rejected) ─────────────────────────────────────────────
// Modeled on Figma 323-1764: a warm "a few things to update" card (green header,
// not a rejection) whose rows are the action — each jumps straight to the field.
function ChangesContent({ draft }: { draft: MentorDraft }) {
  const firstName = draft.firstName?.trim();
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const { addressed, total } = changeProgress(changeRequests, draft);
  const allDone = total > 0 && addressed === total;

  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_8px_48px_-12px_rgba(31,30,29,0.18)]">
      {/* Encouraging green header — frames this as polish, not a rejection. Text
          is darkened from the mock's #797774 so it clears AA on the green tint. */}
      <div className="bg-[#dfeddb] px-6 py-6 sm:px-7">
        <h1 className="font-display text-[24px] font-bold leading-[1.2] tracking-tight text-foreground text-balance">
          {firstName
            ? `${firstName}, a few things to update`
            : "A few things to update"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground/80 text-pretty">
          Thanks for all your work so far! Your profile&apos;s in review, and
          there are a few things to tweak before you can start mentoring. Take
          them one at a time, whenever you&apos;re ready.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        {total > 0 ? (
          <ul className="space-y-3">
            {changeRequests.map((req) => (
              <li key={req.id}>
                <ChangeRow req={req} draft={draft} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            The team sent your profile back with a few changes. Open it to take a
            look and resubmit.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <span
            className={cn(
              "text-sm tabular-nums",
              allDone ? "font-medium text-emerald-700" : "text-muted-foreground"
            )}
          >
            {total > 0 ? `${addressed} of ${total} done` : "Ready when you are"}
          </span>
          <Button
            asChild
            size="sm"
            variant={allDone || total === 0 ? "default" : "outline"}
          >
            <Link href={PREVIEW_PATH}>
              Review &amp; resubmit
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// One reviewer note as a tappable row → jumps to that field's step (where the
// dock + full note live). Shows a check once the field's been addressed.
function ChangeRow({ req, draft }: { req: ChangeRequest; draft: MentorDraft }) {
  const done = addressedStateOf(req, draft) !== "none";
  return (
    <Link
      href={stepHref(req.stepId)}
      className="flex items-center gap-3 rounded-xl border border-foreground/12 py-3 pl-[18px] pr-3 transition-colors hover:border-foreground/25 hover:bg-accent/50"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{req.sectionLabel}</p>
        <p className="text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
          {req.note}
        </p>
      </div>
      {done ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </span>
      ) : (
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </Link>
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
// review, emerald → published) so the whole page reads as one feedback system.
function IconTile({
  tone,
  face,
}: {
  tone: "amber" | "emerald";
  face: MoodieName;
}) {
  const toneCls = {
    amber: "bg-amber-100",
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
