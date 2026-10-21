"use client";

// THE KEBAB — everything about this person that is not the conversation.
//
// ═══ WHY THESE FIVE AND NOT A DRAWER OF TWENTY ═══
//
// A kebab is where features go to be forgotten, so the test each item had to pass
// was: would a mentor look for this HERE, on a thread, rather than on the record?
// Five passed.
//
//   Open their record      the one link out. Everything the menu does not hold.
//   Call                   a real dialer link, because a mentor with a worried teen
//                          reaches for the phone and should not have to go via a
//                          record page to find the number.
//   Copy number            for the case where they are calling from something else.
//   Raise an escalation    the SECOND entry point. The primary is on the message,
//                          because that is how it actually happens — but a mentor
//                          who has just come off a phone call has no message to
//                          anchor to, and needs a way in that does not require one.
//   Report a problem       for the conversation itself: a teen sending something a
//                          mentor should not be receiving. NOT the same thing as an
//                          escalation, and conflating them would mean a mentor
//                          raising a safeguarding alert about a spam message.
//
// ═══ AND IT IS NEVER THE ONLY PATH TO ANYTHING ═══
//
// Escalation's primary route is the message menu; the record is linked from the
// list too. Nothing here is the sole way to reach anything, because a kebab is the
// least discoverable control on a screen and putting a unique capability behind one
// is how a feature ends up unused.

import { Copy, ExternalLink, Flag, MoreHorizontal, Phone, ShieldAlert } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { recordHrefFor } from "@/lib/record/subject";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function ThreadMenu({
  threadId,
  theirName,
  phone,
  /** Absent while one is already open, and on support threads — the same rule the
   *  message menu follows, for the same reason. */
  onEscalate,
}: {
  threadId: string;
  theirName: string;
  phone: string | null;
  onEscalate?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors",
          "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
          RING
        )}
        /* TODO-COPY. Names the person, so a screen-reader user tabbing a three-column
           surface knows which menu this is. */
        aria-label={`More options for ${theirName}`}
        title="More options"
      >
        <MoreHorizontal className="size-[18px]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href={recordHrefFor(threadId)}>
            <ExternalLink aria-hidden />
            {/* TODO-COPY */}
            Open their record
          </Link>
        </DropdownMenuItem>

        {phone && (
          <>
            <DropdownMenuItem asChild>
              {/* A REAL DIALER LINK. A mentor with a worried teen reaches for the
                  phone; making them go via a record page to find the number is a
                  detour at the worst moment. */}
              <a href={`tel:${phone}`}>
                <Phone aria-hidden />
                Call {theirName}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard?.writeText(phone);
                /* A TOAST IS RIGHT HERE, and it is the only place on this surface
                   where one is. Copying is instantaneous, invisible and has no
                   record worth keeping — which is exactly the shape a toast fits,
                   and exactly what the escalation notification was NOT. */
                toast.success(`${theirName}'s number copied`); // TODO-COPY
              }}
            >
              <Copy aria-hidden />
              Copy number
            </DropdownMenuItem>
          </>
        )}

        {onEscalate && (
          <>
            <DropdownMenuSeparator />
            {/* TINTED BY CLASS, because this `DropdownMenuItem` has no destructive
                variant — and "destructive" would be the wrong word anyway: raising an
                escalation destroys nothing, it tells somebody. The tint is the alert
                accent, so it reads as urgent rather than as dangerous.
                ═══ KEPT RED — A NAMED EXCEPTION TO THE CANON'S COLOUR RULE ═══
                The Tiering & Escalation pack spends red on Tier 1–2 contexts and
                the 911 call alone, and this opens the raise flow before a tier is
                chosen. Neutralised once, then reversed (Brandon, 2026-10-21:
                "keep the red on raise an escalation"): a mentor reaching for it
                in a hurry is looking for the red one. */}
            <DropdownMenuItem
              onSelect={onEscalate}
              className="text-[var(--alert-critical-accent)] focus:text-[var(--alert-critical-accent)]"
            >
              <ShieldAlert aria-hidden />
              {/* TODO-COPY. The SECOND entry point — the primary is on the message,
                  because that is how it happens. This one exists for the mentor who
                  has just come off a phone call and has no message to anchor to. */}
              Raise an escalation
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            /* TODO-DATA. There is no reporting flow in this prototype, and inventing
               one here would put a second, unreviewed moderation design into the
               product — the same reasoning that keeps `/app/escalation` a placeholder.
               An honest toast rather than a dead item or a fabricated dialog. */
            toast(`Reporting isn't part of this prototype yet.`); // TODO-COPY
          }}
        >
          <Flag aria-hidden />
          {/* TODO-COPY. NOT the same thing as an escalation — this is about the
              conversation (a teen sending something a mentor should not receive),
              and conflating them would mean safeguarding alerts raised about spam. */}
          Report a problem with this chat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
