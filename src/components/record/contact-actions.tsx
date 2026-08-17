"use client";

// ContactActions — what you can DO with a stored phone number or email, shown
// beside the value on a record's Account tab.
//
// These used to sit in a "Contact" dropdown on every table row, which put PII one
// click from a directory listing. The capability didn't go away when that menu
// did — it moved HERE, to the record you already had to open for this specific
// person. Same actions, far narrower blast radius.
//
// Used by both the fixture-person record and the live mentor's record so the two
// can't drift.

import { toast } from "sonner";
import { Copy, Mail, Phone } from "lucide-react";

const BTN =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label.toLowerCase()}`);
  }
}

export function ContactActions({
  kind,
  value,
  name,
}: {
  kind: "phone" | "email";
  /** Absent / empty renders nothing — never an action that can't act. */
  value?: string;
  /** For accessible names — "Copy Omar Haddad's number". */
  name: string;
}) {
  if (!value) return null;
  const isPhone = kind === "phone";
  const noun = isPhone ? "number" : "email";

  return (
    // stopPropagation because these live inside record rows. Only place them in
    // rows that are NOT themselves pressable — a RecordRow with a press surface
    // wraps its whole content in a <button>, which makes a nested button/anchor
    // invalid HTML (see the note on the live mentor's Account rows). This guard
    // covers the click-bubbling half if a host row ever gains a press surface.
    <span
      className="inline-flex items-center gap-0.5 align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      <a
        href={isPhone ? `tel:${value}` : `mailto:${value}`}
        aria-label={`${isPhone ? "Call" : "Email"} ${name}`}
        title={isPhone ? "Call" : "Email"}
        className={BTN}
      >
        {isPhone ? (
          <Phone className="size-4" aria-hidden />
        ) : (
          <Mail className="size-4" aria-hidden />
        )}
      </a>
      <button
        type="button"
        onClick={() => copyToClipboard(value, isPhone ? "Number" : "Email")}
        aria-label={`Copy ${name}'s ${noun}`}
        title={`Copy ${noun}`}
        className={BTN}
      >
        <Copy className="size-4" aria-hidden />
      </button>
    </span>
  );
}
