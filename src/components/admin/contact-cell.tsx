"use client";

// ContactCell — the shared Contact action for data-table rows. Replaces the raw
// Phone column: contact details are gated behind a deliberate click/tap (no
// hover-reveal), so PII isn't exposed until the reviewer asks for it, and it
// works identically on touch and pointer.
//
// One trigger per row opens a menu (built on the DropdownMenu primitive, which
// carries the full WAI-ARIA menu-button pattern — see dropdown-menu.tsx):
//   Chat (primary) · Call (tel:) · Email (mailto:) · Copy number · Copy email
// Only actions whose data exists are rendered (skip Email when no email is on
// file). Drop it into any table that has a person with contact info.

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Copy, Mail, MessageSquare, Phone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ContactPerson {
  /** Stable id — carried to chat as ?with=<id>. */
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label.toLowerCase()}`);
  }
}

export function ContactCell({ person }: { person: ContactPerson }) {
  const router = useRouter();
  const { id, name, phone, email } = person;
  const hasCopyGroup = !!phone || !!email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* One target per row. Radix sets aria-haspopup="menu" + aria-expanded
            on this button; the pseudo-element extends the touch target to 44px
            without changing the compact visual. */}
        <button
          type="button"
          aria-label={`Contact ${name}`}
          className="group/ct relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)] data-[state=open]:bg-[var(--tint-press)] data-[state=open]:text-[var(--text-primary)]"
        >
          <MessageSquare className="size-4" aria-hidden />
          Contact
          <ChevronDown
            className="size-3.5 opacity-60 transition-transform group-data-[state=open]/ct:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>

        {/* Primary. Routes to in-app chat with this person (matches the app's
            existing /app/chat entry point; ?with carries the person). */}
        <DropdownMenuItem
          onSelect={() => router.push(`/app/chat?with=${encodeURIComponent(id)}`)}
          aria-label={`Chat with ${name}`}
          className="font-medium text-[var(--text-primary)]"
        >
          <MessageSquare />
          Chat
        </DropdownMenuItem>

        {phone && (
          <DropdownMenuItem asChild aria-label={`Call ${name}`}>
            <a href={`tel:${phone}`}>
              <Phone />
              Call
            </a>
          </DropdownMenuItem>
        )}

        {email && (
          <DropdownMenuItem asChild aria-label={`Email ${name}`}>
            <a href={`mailto:${email}`}>
              <Mail />
              Email
            </a>
          </DropdownMenuItem>
        )}

        {hasCopyGroup && <DropdownMenuSeparator />}

        {phone && (
          <DropdownMenuItem
            onSelect={() => copyToClipboard(phone, "Number")}
            aria-label={`Copy ${name}'s number`}
          >
            <Copy />
            Copy number
          </DropdownMenuItem>
        )}

        {email && (
          <DropdownMenuItem
            onSelect={() => copyToClipboard(email, "Email")}
            aria-label={`Copy ${name}'s email`}
          >
            <Copy />
            Copy email
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
