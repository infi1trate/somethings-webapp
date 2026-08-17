"use client";

// MENTEE TABLE — the mentor record's list of the teens they work with.
// Structure from Figma MO-4.1 node 2004:27273: four columns (Name · Status ·
// Joined · Contact), sortable headers on the first three, 32px initials
// avatars, a binary Active/Inactive pill, and a ghost Contact dropdown.
//
// TWO DEPARTURES FROM THE DESIGN, both deliberate:
//  1. A flagged row keeps its ATTENTION CHIP beside the name. The design has no
//     chip, but the record's attention strip deep-links here with "View mentee"
//     — landing on a list with no indication of WHICH mentee needs attention
//     would break that thread. The chip is the care signal the whole attention
//     system hangs on.
//  2. Rows are pressable (→ the teen's own record). The design shows no row
//     affordance, but every other person list in the product navigates.
//
// Status is a real toggle: deactivating CONFIRMS (it ends an active mentoring
// relationship), reactivating is one click. It persists to the store's
// menteeActive override map, so the roster and this table agree.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown, Plus } from "lucide-react";
import { ContactCell } from "@/components/admin/contact-cell";
import { AttentionChipInline } from "@/components/record/person-row";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DEMO_TEENS,
  relJoined,
  teensForMentor,
  type DemoTeen,
} from "@/lib/record/people-demo";
import {
  menteeRecency,
  recencyChip,
  teenAsMentee,
  escalationVisible,
} from "@/lib/record/mentees-demo";
import { recordHrefFor } from "@/lib/record/subject";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const H =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";

type SortKey = "name" | "status" | "joined";

export function MenteeTable({
  mentorId,
  mentorName,
  capacitySlot,
  availabilitySlot,
}: {
  mentorId: string;
  mentorName: string;
  /** Caseload readout ("4 of 5 mentees") beside the heading, so the number
   *  reads as a property of THIS list. A CaseloadPopover when the viewer may
   *  adjust it, plain text when not — the controls used to occupy a permanent
   *  second row here. */
  capacitySlot?: React.ReactNode;
  /** Availability readout or menu, on the same line. */
  availabilitySlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [sort, setSort] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);
  const [confirming, setConfirming] = useState<DemoTeen | null>(null);
  const [picking, setPicking] = useState(false);

  const menteeActive = useOnboardingStore((s) => s.menteeActive);
  const setMenteeActive = useOnboardingStore((s) => s.setMenteeActive);
  const isActive = (t: DemoTeen) => menteeActive[t.id] ?? t.active;

  const mentees = teensForMentor(mentorId);
  const rows = useMemo(() => {
    const list = [...mentees];
    const dir = asc ? 1 : -1;
    list.sort((a, b) => {
      if (sort === "name") return dir * a.name.localeCompare(b.name);
      if (sort === "joined") return dir * (a.joinedDaysAgo - b.joinedDaysAgo);
      // status: active first when ascending
      return dir * (Number(isActive(b)) - Number(isActive(a)));
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentees, sort, asc, menteeActive]);

  const toggleSort = (k: SortKey) => {
    if (k === sort) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(true);
    }
  };

  return (
    <section aria-label="Mentees" data-record-section="mentees">
      {/* ONE header line: heading · caseload · availability · Add mentee. The
          caseload controls used to sit in a second row below this one; they now
          live inside the readout's popover. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className={H}>Mentees</h2>
        {capacitySlot}
        {availabilitySlot}
        <span className="ml-auto" />
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex h-8 min-w-30 items-center justify-center gap-2 rounded-full border border-[color:var(--button-border-default)] px-4 font-display text-[12px] font-bold leading-[16px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
        >
          <Plus className="size-3.5" aria-hidden />
          Add mentee
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)]">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[color:var(--surface-s2)]">
              <SortHead
                label="Name"
                k="name"
                sort={sort}
                asc={asc}
                onSort={toggleSort}
              />
              <SortHead
                label="Status"
                k="status"
                sort={sort}
                asc={asc}
                onSort={toggleSort}
              />
              <SortHead
                label="Joined"
                k="joined"
                sort={sort}
                asc={asc}
                onSort={toggleSort}
              />
              <th
                scope="col"
                className="px-5 py-3 text-[14px] font-medium leading-[20px] text-[var(--text-secondary)]"
              >
                Contact
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-6 text-[14px] leading-[20px] text-[var(--text-secondary)]"
                >
                  No mentees matched yet.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const active = isActive(t);
              const mentee = teenAsMentee(t, now);
              const r = menteeRecency(mentee, now);
              const chip = escalationVisible(mentee.escalation, now)
                ? { text: mentee.escalation!.reason, tone: "critical" as const }
                : recencyChip(r);
              return (
                <tr
                  key={t.id}
                  onClick={() => router.push(recordHrefFor(t.id))}
                  className="cursor-pointer border-b border-[color:var(--surface-s2)] transition-colors last:border-0 hover:bg-[var(--tint-faint)]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--status-neutral-bg)] text-[12px] font-medium leading-4 text-[var(--text-primary)]"
                      >
                        {t.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                            {t.name}
                          </span>
                          {/* Departure 1 — keeps the attention thread alive. */}
                          {active && chip && <AttentionChipInline {...chip} />}
                        </span>
                        {t.goesBy && (
                          <span className="block truncate text-[12px] leading-4 text-[var(--text-secondary)]">
                            goes by &ldquo;{t.goesBy}&rdquo;
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-5 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        active ? setConfirming(t) : setMenteeActive(t.id, true)
                      }
                      aria-label={`${t.name} — ${active ? "Active" : "Inactive"}. Change status`}
                      className={cn(
                        "inline-flex min-h-6 items-center rounded-full px-2.5 text-[12px] font-medium leading-4 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
                        active
                          ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                          : "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]"
                      )}
                    >
                      {active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-[14px] leading-[20px] text-[var(--text-secondary)] tabular-nums">
                    {relJoined(t.joinedDaysAgo)}
                  </td>
                  <td
                    className="px-5 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ContactCell
                      person={{
                        id: t.id,
                        name: t.name,
                        phone: t.phone,
                        email: t.email,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Deactivating ends an active mentoring relationship — it confirms.
          Reactivating is one click. */}
      <Dialog
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set {confirming?.name} to inactive?</DialogTitle>
            <DialogDescription>
              They stay matched with {mentorName} and nothing is deleted, but
              they&rsquo;ll be treated as an inactive mentorship in counts and
              attention. You can set them back to active any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => {
                if (confirming) {
                  setMenteeActive(confirming.id, false);
                  toast(`${confirming.name} set to inactive.`);
                }
                setConfirming(null);
              }}
            >
              Set inactive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMenteeDialog
        open={picking}
        onOpenChange={setPicking}
        mentorName={mentorName}
      />
    </section>
  );
}

function SortHead({
  label,
  k,
  sort,
  asc,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const on = sort === k;
  const Icon = !on ? ChevronsUpDown : asc ? ChevronUp : ChevronDown;
  return (
    <th scope="col" className="px-5 py-3">
      <button
        type="button"
        onClick={() => onSort(k)}
        aria-label={`Sort by ${label}`}
        className="inline-flex items-center gap-1 rounded-sm text-[14px] font-medium leading-[20px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      >
        {label}
        <Icon
          className={cn("size-3.5", !on && "opacity-40")}
          aria-hidden
        />
      </button>
    </th>
  );
}

/** Assignment picker. STUB by decision: the prototype has no relationship
 *  mutation, so choosing a teen toasts rather than writing. The list is real
 *  (unmatched teens), so the flow reads honestly. */
function AddMenteeDialog({
  open,
  onOpenChange,
  mentorName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mentorName: string;
}) {
  const matched = new Set(DEMO_TEENS.map((t) => t.mentorId));
  // "Unmatched" in this demo = teens whose mentor is inactive/paused. There is
  // no genuinely unmatched teen in the fixtures, so we offer the ones whose
  // mentorship is dormant.
  const candidates = DEMO_TEENS.filter((t) => !t.active).slice(0, 6);
  void matched;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a mentee to {mentorName}</DialogTitle>
          <DialogDescription>
            Teens waiting to be matched. Assignment isn&rsquo;t wired up in this
            prototype yet — choosing one shows what would happen.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {candidates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  toast(`${t.name} would be matched with ${mentorName}.`);
                  onOpenChange(false);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-[var(--tint-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--status-neutral-bg)] text-xs font-medium text-[var(--text-primary)]"
                >
                  {t.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text-primary)]">
                  {t.name}
                </span>
                <span
                  className="shrink-0 text-[var(--text-secondary)]"
                  style={{ font: "var(--type-helper)" }}
                >
                  {t.group}
                </span>
              </button>
            </li>
          ))}
          {candidates.length === 0 && (
            <li className="py-2 text-sm text-[var(--text-secondary)]">
              No teens are waiting to be matched right now.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
