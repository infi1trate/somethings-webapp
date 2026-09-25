"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PIN A MENTEE — LABELLED, NEVER DISABLED (Today Phase E)
//
// ═══ THE ACCESSIBLE NAME AND THE VISIBLE LABEL AGREE, WHICH IS NOT FREE ═══
//
// E.3 asks the accessible name to change with state and to describe the action
// or state unambiguously. The obvious way — visible "Pinned", name "Unpin Ava
// M." — BREAKS SC 2.5.3 (Label in Name): the name must contain the visible
// text, and "Unpin Ava M. from your list" does not contain "Pinned". A speech
// user saying "click Pinned" would hit nothing.
//
// So each state's name is built to CONTAIN its own label:
//
//   unpressed  label "Pin"     name "Pin {name} to your list"
//   pressed    label "Pinned"  name "Pinned. Activate to unpin {name}."
//
// Both name the action unambiguously, both contain their label, and
// `aria-pressed` carries the state a third time.
//
// ═══ GLYPH AND LABEL BOTH CHANGE (E.2, SC 1.4.1) ═══
//
// `Pin` + "Pin" against `Check` + "Pinned". Not a fill change, not a colour
// change — remove all colour and the two states are still two states. `Check`
// rather than a struck-through pin because the glyph describes the STATE here,
// matching the label beside it; a slashed pin next to the word "Pinned" says
// two opposite things at once.
//
// ═══ AT THE CAP IT EXPLAINS (E.8, standing constraint) ═══
//
// No `disabled`, ever. Pressing at the cap does not pin and does not fail
// silently: it reveals a message saying what the cap is and what to do. The
// message is the live region, so it is one element that is both seen and
// announced rather than two that can disagree.
//
// ═══ FOCUS DOES NOT MOVE (E.4, SC 4.1.3) ═══
//
// Nothing here calls `focus()`, nothing re-keys the button, and the button is
// never unmounted or replaced across a toggle — the same element persists and
// only its label, glyph and `aria-pressed` change. The announcement reaches the
// reader through the live region instead.

import { useState } from "react";
import { Check, Pin } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { atPinCap, isPinned, PIN_CAP } from "@/lib/record/pinned";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function PinMenteeToggle({
  menteeId,
  menteeName,
}: {
  menteeId: string;
  /** For the accessible name. The visible label never carries it — the name is
   *  three inches from the person's own heading. */
  menteeName: string;
}) {
  const mounted = useMounted();
  const pinned = useOnboardingStore((s) => s.pinnedMentees);
  const pinMentee = useOnboardingStore((s) => s.pinMentee);
  const unpinMentee = useOnboardingStore((s) => s.unpinMentee);
  /** ═══ ONE MESSAGE, TWO AUDIENCES ═══
   *  `text` is announced in every case; `visible` says whether it is also
   *  drawn. A pin or unpin is announced and NOT drawn — the button's own label
   *  has already changed to say the new state, and printing it beside the
   *  button would be the clock told twice. The cap message IS drawn, because
   *  nothing else on screen explains why pressing did nothing.
   *  ONE STATE, NOT TWO, so the text and its visibility cannot drift. */
  const [said, setSaid] = useState<{ text: string; visible: boolean }>({
    text: "",
    visible: false,
  });

  /* UNPINNED UNTIL MOUNTED. The set is persisted, so reading it during the
     server render would hydrate wrong; `useMounted` flips in an effect, which
     is a controlled update rather than a mismatch. */
  const on = mounted && isPinned(pinned, menteeId);
  const capped = mounted && atPinCap(pinned, menteeId);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-anno-ref="pin-mentee"
        aria-pressed={on}
        aria-label={
          on
            ? /* NEEDS-COPY-NICOLE. CONTAINS "Pinned", its visible label (2.5.3). */
              `Pinned. Activate to unpin ${menteeName}.`
            : /* NEEDS-COPY-NICOLE. CONTAINS "Pin". */
              `Pin ${menteeName} to your list`
        }
        onClick={() => {
          if (on) {
            unpinMentee(menteeId);
            /* NEEDS-COPY-NICOLE */
            setSaid({ text: `${menteeName} unpinned.`, visible: false });
            return;
          }
          if (capped) {
            /* NO WRITE, NO DISABLED ATTRIBUTE, AND A REASON. */
            setSaid({
              /* NEEDS-COPY-NICOLE */
              text: `You can pin ${PIN_CAP} mentees. Unpin someone before pinning ${menteeName}.`,
              visible: true,
            });
            return;
          }
          pinMentee(menteeId, Date.now());
          /* NEEDS-COPY-NICOLE */
          setSaid({ text: `${menteeName} pinned.`, visible: false });
        }}
        className={cn(
          /* 44×44 (E.5 / SC 2.5.8 / HIG). `min-h-11` plus the padding; measured
             in the report rather than asserted here. */
          "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3",
          "text-[13px] leading-[18px] font-semibold transition-colors",
          on
            ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)] text-[var(--text-primary)]"
            : "border-[color:var(--border-contour)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
          RING
        )}
      >
        {on ? (
          <Check aria-hidden className="size-4 shrink-0" />
        ) : (
          <Pin aria-hidden className="size-4 shrink-0" />
        )}
        {/* NEEDS-COPY-NICOLE ×2. Single line, and the glyph beside it changes
            too — neither is the sole carrier. */}
        {on ? "Pinned" : "Pin"}
      </button>

      {/* ═══ ONE ELEMENT: THE ANNOUNCEMENT AND THE MESSAGE ═══
          `role="status"` is an implicit `aria-live="polite"`, so this is read
          without taking focus. It is also the visible explanation at the cap —
          one element rather than a live region plus a separate message that
          could drift apart.
          ABSOLUTELY POSITIONED so revealing it does not reflow the record
          header, which is a fixed row of chrome. */}
      <span
        role="status"
        data-anno-ref="pin-mentee-status"
        data-visible={said.visible ? "true" : "false"}
        className={cn(
          said.visible
            ? cn(
                /* ABSOLUTE so revealing it does not reflow the record header,
                   which is a fixed row of chrome. */
                "pointer-events-none absolute right-0 top-full z-10 mt-1.5 w-max max-w-[18rem]",
                /* ═══ IT CARRIES A SURFACE, NOT JUST TEXT ═══
                   MEASURED: unstyled, the message fell outside the header
                   card's rounded edge and read as stray text on the page
                   ground rather than as this control's explanation. The card's
                   own three tokens attach it to the button it belongs to —
                   and they put `--text-secondary` on `--surface-card` (7.63:1)
                   instead of on the page. */
                "rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-2.5 py-1.5 shadow-sm",
                "text-left text-[12px] leading-[16px] text-[var(--text-secondary)]"
              )
            : "sr-only"
        )}
      >
        {said.text}
      </span>
    </span>
  );
}
