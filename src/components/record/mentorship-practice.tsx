"use client";

// MentorshipPractice — the subject-conditional PRACTICE surface of the record
// (the tab split moved practice OUT of the universal Organization tab). Exists
// only when the record's SUBJECT is a mentor or lead mentor.
//
// Composition (recomposition pass): Caseload + Team as paired half-width
// cards on top — configuration and people-context, glanceable; Mentees
// full-width below with room to scale (search + sort chrome appears at
// MENTEE_CONTROLS_AT and stays hidden before it — no chrome the list doesn't
// need yet).
//
// Recency is DIRECTION-AWARE (see menteeRecency): who sent the last message
// decides the row copy and whether it flags — waiting-on-mentor and teen-quiet
// are WARNING states derived from the two per-party timestamps; critical stays
// reserved for genuine escalation records. Non-duplication rule: a row with an
// attention chip shows relationship length as its secondary — the chip and the
// line never state the same fact in two moods.
//
// Vocabulary law: "mentees" for the people, "caseload" for how many they can
// take; escalations name the observable cause, never a prediction.

import { useMemo, useState } from "react";
import { PersonRow } from "@/components/record/person-row";
import {
  CaseloadControls,
  useCaseload,
} from "@/components/record/caseload-controls";
import {
  AvailabilityCell,
  AvailabilityMenu,
} from "@/components/admin/mentor-status-badge";
import { availabilityFor, liveLifecycle } from "@/lib/record/mentor-status";
import { SegmentedControl } from "@/components/record/segmented-control";
import { Input } from "@/components/ui/input";
import {
  escalationVisible,
  expandMentees,
  getDemoOverview,
  lastExchangeAt,
  menteeRecency,
  recencyChip,
  recencyLine,
  relLength,
  type DemoMentee,
} from "@/lib/record/mentees-demo";
import { leadUmbrellaMentors } from "@/lib/record/people-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { SubjectRole } from "@/lib/record/tabs";

const H =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
// Matches the record's elevated card idiom (gaps.md #108).
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]";

/** Search + sort chrome appears at this many mentees — below it the list
 *  carries no controls (defaults whisper). */
const MENTEE_CONTROLS_AT = 9;

type MenteeSort = "recency" | "name" | "waiting";

export function MentorshipPractice({
  mode,
  menteeCount,
  subjectRole,
  now,
  published,
  redactMentees = false,
  demoCount,
}: {
  mode: "edit" | "read";
  /** Active mentees right now — the caseload floor + availability derivation. */
  menteeCount: number;
  subjectRole: SubjectRole;
  now: number;
  /** Mentees + Team appear once the mentor is published and matched. */
  published: boolean;
  /** No-names degraded variant for the read-mostly supervisor tier (dormant —
   *  no persona resolves to that tier yet). */
  redactMentees?: boolean;
  /** Dev-only (?demoMentees=N): preview the list at scale. TODO-DATA. */
  demoCount?: number;
}) {
  const status = useOnboardingStore((s) => s.status);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const mentorAccepting = useOnboardingStore((s) => s.mentorAccepting);
  const setMentorAccepting = useOnboardingStore((s) => s.setMentorAccepting);
  const slots = useOnboardingStore((s) => s.slots);
  const caseloads = useOnboardingStore((s) => s.caseloads);
  const draft = useOnboardingStore((s) => s.draft);
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";
  const mentorFirst = draft.firstName || "the mentor";

  const lifecycle =
    mentorStatuses["live"] ?? liveLifecycle(status, accountStatus, profileHidden);
  const cap = caseloads["live"]?.total ?? slots.total;
  const accepting = mentorAccepting["live"] ?? true;
  const availability = availabilityFor(lifecycle, menteeCount, cap, accepting);
  const atCap = menteeCount >= cap;
  const caseload = useCaseload("live", slots.total);

  const overview = getDemoOverview(now);
  const mentees = useMemo(
    () =>
      demoCount && demoCount > overview.mentees.length
        ? expandMentees(overview.mentees, demoCount, now)
        : overview.mentees,
    [overview.mentees, demoCount, now]
  );
  const leads = subjectRole === "lead-mentor" ? leadUmbrellaMentors() : [];

  // ── Mentees list state (chrome renders only at MENTEE_CONTROLS_AT+) ──────
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MenteeSort>("recency");
  const showControls = mentees.length >= MENTEE_CONTROLS_AT;

  /** Attention rank for the default sort: genuine escalation, then the
   *  derived warning states, then everyone else. */
  const attentionRank = (m: DemoMentee): number => {
    if (escalationVisible(m.escalation, now)) return 0;
    const k = menteeRecency(m, now).kind;
    if (k === "waiting-on-mentor") return 1;
    if (k === "teen-quiet") return 2;
    return 3;
  };

  const visibleMentees = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? mentees.filter((m) => m.name.toLowerCase().includes(q))
      : mentees;
    const list = [...filtered];
    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "waiting") {
      // Longest waiting — oldest exchange first.
      list.sort((a, b) => lastExchangeAt(a) - lastExchangeAt(b));
    } else {
      // Default: needs-attention first, then last-exchange recency desc.
      list.sort(
        (a, b) =>
          attentionRank(a) - attentionRank(b) ||
          lastExchangeAt(b) - lastExchangeAt(a)
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentees, query, sort, now]);

  const slotsOpen = Math.max(0, caseload.total - menteeCount);

  return (
    <div className="space-y-7">
      {/* ── Caseload + Team — paired half-width cards ─────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Caseload" data-record-section="caseload">
          <h2 className={H}>Caseload</h2>
          <div className={`mt-3 ${CARD} [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]`}>
            {/* Value row — the card title names it, so no label column. */}
            <div className="py-3.5">
              <p
                className="text-[var(--text-primary)]"
                style={{
                  font: "var(--type-row-value)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {menteeCount} of {caseload.total} mentees
                {mode === "read" && (
                  <span className="text-[var(--text-secondary)]">
                    {" "}
                    · {caseload.mode === "automatic" ? "Automatic" : "Custom"}
                  </span>
                )}
              </p>
              <p
                className="mt-0.5 text-[var(--text-muted)]"
                style={{ font: "var(--type-helper)" }}
              >
                How many teens can be matched at once
              </p>
              {mode === "edit" && (
                <CaseloadControls
                  mentorId="live"
                  currentCount={menteeCount}
                  defaultTotal={slots.total}
                  className="mt-2.5"
                />
              )}
            </div>
            {/* Availability — practice configuration, lives with caseload. */}
            <div className="flex min-h-13 items-center justify-between gap-4 py-3.5">
              <span
                className="text-[var(--text-muted)]"
                style={{
                  font: "var(--type-field-label)",
                  letterSpacing: "var(--type-field-label-tracking)",
                }}
              >
                Availability
              </span>
              {mode === "edit" ? (
                <AvailabilityMenu
                  value={availability}
                  accepting={accepting}
                  atCap={atCap}
                  name={mentorName}
                  onChange={(a) => setMentorAccepting("live", a)}
                />
              ) : (
                <AvailabilityCell value={availability} />
              )}
            </div>
          </div>
        </section>

        {/* Team — this mentor's supervisor + lead mentor. Their records don't
            exist in this prototype, so the rows are non-pressable (no dead
            chevrons — deviation from "pressable" noted in the report). */}
        <section aria-label="Team" data-record-section="team">
          <h2 className={H}>Team</h2>
          <div className={`mt-3 ${CARD}`}>
            {published ? (
              overview.team.map((t) => (
                <PersonRow key={t.id} name={t.name} secondary={t.roleLabel} />
              ))
            ) : (
              <p className="py-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                Team appears once this mentor is published and matched.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── Mentees — full-width, room to scale ───────────────────────── */}
      <section aria-label="Mentees" data-record-section="mentees">
        <div className={CARD}>
          {/* Card header: title + capacity caption; search/sort only at scale. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
            <h2 className={H}>Mentees</h2>
            <p
              className="text-[var(--text-secondary)] tabular-nums"
              style={{ font: "var(--type-row-label)" }}
            >
              {menteeCount} active · {slotsOpen} {slotsOpen === 1 ? "slot" : "slots"} open
            </p>
            {showControls && (
              <div className="flex w-full flex-wrap items-center gap-3 pt-1">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search mentees"
                  aria-label="Search mentees"
                  className="h-9 max-w-56"
                />
                <SegmentedControl
                  size="sm"
                  ariaLabel="Sort mentees"
                  options={[
                    { value: "recency" as const, label: "Recency" },
                    { value: "name" as const, label: "Name" },
                    { value: "waiting" as const, label: "Longest waiting" },
                  ]}
                  value={sort}
                  onChange={(v) => setSort(v)}
                />
              </div>
            )}
          </div>
          {published ? (
            visibleMentees.length > 0 ? (
              <div className="border-t border-[var(--border-subtle)] [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]">
                {visibleMentees.map((m) => {
                  const r = menteeRecency(m, now);
                  const esc = escalationVisible(m.escalation, now)
                    ? { text: m.escalation!.reason, tone: "critical" as const }
                    : null;
                  const chip = esc ?? recencyChip(r);
                  return (
                    <PersonRow
                      key={m.id}
                      name={m.name}
                      // Non-duplication: chip present → relationship length only.
                      secondary={
                        chip
                          ? `${relLength(m.matchedAt, now)} together`
                          : recencyLine(r, m.name, mentorFirst)
                      }
                      attention={chip}
                      videoCount={m.videoCount30d}
                      redactName={redactMentees}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="border-t border-[var(--border-subtle)] py-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                No mentees match &ldquo;{query}&rdquo;.
              </p>
            )
          ) : (
            <p className="border-t border-[var(--border-subtle)] py-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Nothing here yet — mentees appear once this mentor is published
              and matched.
            </p>
          )}
        </div>
      </section>

      {/* Lead-mentor subject only — the mentors under their umbrella. Reachable
          via leadUmbrellaMentors() (a single global constant, not a per-lead
          map — flagged in the report). */}
      {subjectRole === "lead-mentor" && (
        <section
          aria-label="Mentors they lead"
          data-record-section="mentors-led"
        >
          <h2 className={H}>Mentors they lead</h2>
          <div className={`mt-3 ${CARD}`}>
            {leads.map((m) => (
              <PersonRow key={m.id} name={m.name} secondary={m.group} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
