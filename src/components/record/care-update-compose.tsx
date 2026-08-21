"use client";

// CARE UPDATE COMPOSE (MO-9.1 Prompt C, Phase 3) — supervisor tier only.
//
// THE FIGMA'S PROSE SCAFFOLDING, VERBATIM: "Where things stand / Direction of
// care / What I am watching". Three labelled fields rather than one free
// textarea, because the structure makes a supervisor say where they are, where
// they are going, and what would change their mind — that is good clinical
// writing structure and it is worth preserving in the tool.
//
// APPEND-ONLY. There is no edit mode. Amending an existing update opens this
// same surface PRE-FILLED with the original's prose, and saving appends a NEW
// update whose `amends` names the original; both keep rendering afterwards. The
// dialog says which of the two things it is doing.
//
// Radix Dialog carries the focus trap and Escape.

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/settings/pill-button";
import { clinicalDate } from "@/components/record/care-presentation";
import {
  CARE_UPDATE_SECTIONS,
  emptyCareUpdateBody,
  type CareUpdateBody,
  type CareUpdateRecord,
} from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** TODO-COPY — one hint per section, naming what belongs there without writing
 *  the supervisor's sentence for them. */
const PLACEHOLDER: Record<string, string> = {
  standing: "The current picture, in your words.",
  direction: "Where this is heading, and what you are doing about it.",
  watching: "What would change your read.",
};

export function CareUpdateCompose({
  open,
  onOpenChange,
  /** Set when amending — the update being corrected. */
  amending,
  onSave,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amending?: CareUpdateRecord | null;
  onSave: (body: CareUpdateBody, amends?: string) => void;
  /** The control that opened this, captured by the owner at click time. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  // The ref lives OUT here so it survives the form's remounts.
  const firstRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent is rendered UNCONDITIONALLY so Radix's Presence owns the
          mount lifecycle — and therefore returns focus to the trigger on close.
          The stateful form sits INSIDE, so each open still initialises from the
          right place: an amendment pre-filled with the original's prose, a new
          update empty, with no reset-in-an-effect and no stale text leaking from
          a cancelled compose. */}
      <DialogContent
        className="sm:max-w-lg"
        // FOCUS RESTORE, EXPLICIT AND CAPTURED AT CLICK TIME. Radix's default
        // close-autofocus did not return focus to the trigger in this app
        // (measured: focus landed on <body> with the trigger still mounted), and
        // capturing activeElement in onOpenAutoFocus is too late — focus has
        // already moved by then. The owner captures the trigger in its click
        // handler and hands it down. Without this, a keyboard user is dropped at
        // the top of a long clinical page every time they escape this dialog.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo?.current?.focus();
        }}
      >
        <ComposeForm
          amending={amending}
          onSave={onSave}
          onOpenChange={onOpenChange}
          firstRef={firstRef}
        />
      </DialogContent>
    </Dialog>
  );
}

function ComposeForm({
  amending,
  onSave,
  onOpenChange,
  firstRef,
}: {
  amending?: CareUpdateRecord | null;
  onSave: (body: CareUpdateBody, amends?: string) => void;
  onOpenChange: (open: boolean) => void;
  firstRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  // An amendment is a CORRECTION, not a retype: it starts from what was written.
  const [body, setBody] = useState<CareUpdateBody>(() =>
    amending ? { ...amending.body } : emptyCareUpdateBody()
  );

  // At least one section has to say something. Not all three: a supervisor with
  // nothing to add under "what I am watching" should not be made to invent it.
  const ready = CARE_UPDATE_SECTIONS.some((s) => body[s.id].trim().length > 0);

  return (
      <>
        <DialogHeader>
          <DialogTitle>
            {/* TODO-COPY — never "Edit update": the original survives. */}
            {amending ? "Amend the care update" : "Write a care update"}
          </DialogTitle>
          <DialogDescription>
            {/* TODO-COPY */}
            {amending
              ? `This appends a new update that references the ${clinicalDate(amending.createdAt)} one. The original stays on the record.`
              : "This appends to the record and cannot be edited afterwards."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] space-y-4 overflow-y-auto">
          {CARE_UPDATE_SECTIONS.map((s, i) => (
            <div key={s.id}>
              <label
                htmlFor={`cu-${s.id}`}
                className="block text-[var(--text-muted)]"
                style={LABEL_STYLE}
              >
                {s.label}
              </label>
              <textarea
                id={`cu-${s.id}`}
                ref={i === 0 ? firstRef : undefined}
                value={body[s.id]}
                onChange={(e) =>
                  setBody((b) => ({ ...b, [s.id]: e.target.value }))
                }
                rows={3}
                placeholder={PLACEHOLDER[s.id]}
                className={cn(
                  "mt-1.5 block w-full resize-y rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5",
                  "text-[14px] leading-[20px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  RING
                )}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <p className="mr-auto text-[13px] leading-[18px] text-[var(--text-muted)]">
            {/* TODO-COPY — the requirement stated before the reach, not after. */}
            {ready
              ? "Saving appends this to the record."
              : "Fill at least one section to save."}
          </p>
          <PillButton
            disabled={!ready}
            onClick={() => {
              onSave(body, amending?.id);
              onOpenChange(false);
            }}
          >
            {/* TODO-COPY */}
            {amending ? "Append amendment" : "Save update"}
          </PillButton>
        </DialogFooter>
      </>
  );
}
