"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE BELL IS ACTIVITY (2026-10-16)
//
// "Move the Activity tab's contents into this bell. We don't need both." The
// Activity tab is gone from the rail and the bottom bar, and `/app/activity`
// redirects; this is where activity lives now. Answered alongside it:
//
//   · A DROPDOWN UNDER THE BELL — a notification popover anchored to the bell
//     (desktop bar), a bottom sheet on the mobile tier. Transient by design:
//     Esc and an outside click close it, so it never competes with the support
//     panel for the right edge (SUP standing rule 6).
//   · NO DETAIL. "Activity events no longer need a detail; the event list item
//     is good enough." Rows are links to their object and the popover closes as
//     one is followed (`ActivityRow`'s link mode).
//   · SUPERVISORS AND ADMINS keep Mine/Team and the filters
//     (`ActivityLedger variant="popover"`); mentors and lead mentors get their
//     profile notices (`MentorActivityList`), as the page gave them.
//
// THE BADGE is the rail's Activity badge, moved: same count (unread notices the
// mentor can see), same pill. Opening the bell marks a mentor's notices read,
// exactly as visiting the page did.

import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogBody, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActivityLedger } from "@/components/activity/activity-ledger";
import { MentorActivityList } from "@/components/activity/mentor-activity-list";
import { EscalationNotices } from "@/components/tiering/escalation-notices";
import { useEscalationNotices } from "@/lib/tiering/use-notices";
import type { EscalationNotice } from "@/lib/tiering/notifications";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The rail's badge, verbatim — "a count the reader already learned in one
 *  place must not change shape in another" (`top-bar.tsx`). */
function Badge({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--state-error)] px-1 text-[10px] font-semibold leading-none text-[var(--text-inverse)]"
    >
      {n}
    </span>
  );
}

function useActivityContent() {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const markActivityRead = useOnboardingStore((s) => s.markActivityRead);
  const ledger = mounted && isSupervisorTier(persona);
  /* ═══ ESCALATION NOTICES (pack v5.0, Workstream C) ═══ Derived from the
     tiering store; their unread count joins the badge, and opening the bell
     is the read — as it is for the mentor's notices. The last look is held
     from the moment of opening, so the rows still say which were new. */
  const esc = useEscalationNotices();
  const [lookedAt, setLookedAt] = useState(0);
  const onOpened = () => {
    if (!ledger) markActivityRead();
    setLookedAt(esc.seenAt);
    esc.markSeen();
  };
  return { ledger, onOpened, notices: esc.notices, lookedAt, escUnread: esc.unread };
}

function Content({ ledger, close, notices, lookedAt }: { ledger: boolean; close: () => void; notices: EscalationNotice[]; lookedAt: number }) {
  return (
    <>
      <EscalationNotices notices={notices} seenAt={lookedAt} onNavigate={close} />
      {ledger ? <ActivityLedger variant="popover" onRowNavigate={close} /> : <MentorActivityList onNavigate={close} quietWhenEmpty={notices.length > 0} />}
    </>
  );
}

/** The desktop bar's bell: 40×40, radius-lrg, the bar's outline. */
export function ActivityBell({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const { ledger, onOpened, notices, lookedAt, escUnread } = useActivityContent();
  const total = unread + escUnread;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpened();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-activity-bell
          /* TODO-COPY */
          aria-label={total > 0 ? `Activity, ${total} unread` : "Activity"}
          className={cn(
            "relative flex size-10 items-center justify-center rounded-[var(--radius-lrg)] border border-[color:var(--border-default)] transition-colors",
            open ? "bg-[var(--surface-raised)]" : "bg-transparent hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          <Bell aria-hidden className="size-6 text-[var(--icon-secondary)]" strokeWidth={1.75} />
          {total > 0 && <Badge n={total} />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label="Activity"
        /* 420 WIDE, AND THE POPOVER IS THE CONTAINER: one raised surface with
           Elevation-style separation, the feed scrolling inside it. The cap is
           the smaller of 70% of the viewport and Radix's available height, so
           it never runs off the bottom. Reduced motion: no zoom or slide. */
        className="w-[420px] max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-[var(--radius-lrg)] bg-[var(--surface-raised)] p-0 motion-reduce:animate-none"
        data-activity-popover
      >
        <div className="flex h-14 shrink-0 items-center border-b border-[color:var(--border-subtle)] px-4">
          <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
            {/* TODO-COPY */}
            Activity
          </h2>
        </div>
        <div className="max-h-[min(70vh,calc(var(--radix-popover-content-available-height)-56px))] min-h-0 overflow-y-auto px-3 pt-3 pb-2">
          <Content ledger={ledger} close={() => setOpen(false)} notices={notices} lookedAt={lookedAt} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The mobile bar's bell: the bar's 44px circle, opening a bottom sheet. */
export function ActivityBellMobile({
  unread,
  circleClass,
  ringClass,
}: {
  unread: number;
  circleClass: string;
  ringClass: string;
}) {
  const [open, setOpen] = useState(false);
  const { ledger, onOpened, notices, lookedAt, escUnread } = useActivityContent();
  const total = unread + escUnread;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpened();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          data-activity-bell
          aria-label={total > 0 ? `Activity, ${total} unread` : "Activity"}
          className={cn(circleClass, "relative", ringClass)}
        >
          <Bell className="size-6 text-[var(--text-primary)]" aria-hidden />
          {total > 0 && <Badge n={total} />}
        </button>
      </DialogTrigger>
      <DialogContent variant="sheet" className="max-h-[85dvh]">
        <DialogTitle className="px-4 pt-4 font-display text-[16px] font-bold leading-[24px]">
          {/* TODO-COPY */}
          Activity
        </DialogTitle>
        <DialogBody className="px-3 pb-2">
          <Content ledger={ledger} close={() => setOpen(false)} notices={notices} lookedAt={lookedAt} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
