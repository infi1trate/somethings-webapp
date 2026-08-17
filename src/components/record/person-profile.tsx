"use client";

// PERSON PROFILE / FIRST MOMENTS / SCHEDULE — the teen-facing content tabs for a
// FIXTURE mentor's record.
//
// WHY THIS EXISTS: the tab registry hands a mentor subject eight tabs, but
// /admin/person/[id] only ever rendered five — so Profile, First moments and
// Schedule opened COMPLETELY BLANK on every fixture mentor. A lead looking at
// one of their own mentors saw a tab bar promising content and an empty page.
//
// WHERE THE DATA COMES FROM: the people-demo fixture underneath, with the
// store's `personProfiles` / `personSchedules` overrides on top — so a staff
// edit persists without pretending these people have a full MentorDraft.
//
// TEXT ONLY, on purpose. MentorDraft's photo / audio intro / vibe board / story
// slides hold real uploaded assets (data URLs). Demo people have none, and
// inventing them would make the record claim things that aren't on file. Those
// slots render as one honest, unpressable row rather than four fake ones.
//
// WHO MAY EDIT: the permission map, same as the live record — `matchingProfile`
// for Profile, `firstMoments` for First moments, `schedule` for Schedule. All
// three are "edit" for a lead mentor AND a supervisor.

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RecordRow,
  displayOrEmpty,
  type RecordRowState,
} from "@/components/record/row";
import { ActiveHoursForm } from "@/components/record/active-hours";
import { profileFor, scheduleFor, type PersonProfile } from "@/lib/record/people-demo";
import { resolveMode } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import type { FixtureSubject } from "@/lib/record/subject";
import { toast } from "sonner";

const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)] [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]";
const H =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";

// ── list / line helpers ─────────────────────────────────────────────────────
// Comma-separated for sets (languages, interests) and one-per-line for message
// lists. The live record has chip pickers for these; a demo person's record
// takes the plain-text route deliberately — it's keyboard-native, needs no new
// primitive, and the hint says the separator out loud.
const formatList = (v?: string[]) => (v ?? []).join(", ");
const parseList = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);
const formatLines = (v?: string[]) => (v ?? []).join("\n");
const parseLines = (s: string) =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);

/** Fixture merged with the staff override — the one place that resolution
 *  happens, so the header and every row agree. */
export function useResolvedProfile(id: string): PersonProfile {
  const override = useOnboardingStore((s) => s.personProfiles[id]);
  return useMemo(() => ({ ...profileFor(id), ...override }), [id, override]);
}

/** One editable text row with the read → edit → saved lifecycle RecordRow
 *  already speaks. Writes are optimistic (no failure path exists in a
 *  fixture-backed prototype), so there is no "saving" or "error" state to fake.
 */
function TextRow({
  label,
  display,
  hint,
  editable,
  initial,
  multiline,
  placeholder,
  onCommit,
}: {
  label: string;
  /** Read-state rendering (may differ from the edit-buffer text). */
  display: React.ReactNode;
  hint?: string;
  editable: boolean;
  /** Edit-buffer seed. */
  initial: string;
  multiline?: boolean;
  placeholder?: string;
  onCommit: (raw: string) => void;
}) {
  const [state, setState] = useState<RecordRowState>("read");
  const [buffer, setBuffer] = useState(initial);

  const start = () => {
    setBuffer(initial); // always reseed — the store may have moved underneath
    setState("edit");
  };
  const save = () => {
    onCommit(buffer);
    setState("saved");
    toast(`${label} updated.`);
  };

  return (
    <RecordRow
      label={label}
      value={displayOrEmpty(display)}
      hint={hint}
      state={state}
      locked={!editable}
      onEditStart={start}
      onCancel={() => setState("read")}
      onSave={save}
    >
      {multiline ? (
        <Textarea
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
          placeholder={placeholder}
          rows={5}
          aria-label={label}
        />
      ) : (
        <Input
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      )}
    </RecordRow>
  );
}

/** The asset-backed fields, collapsed into ONE unpressable row. Four separate
 *  "Not recorded" rows would be four times the noise for the same fact. */
function AssetsRow({ label, items }: { label: string; items: string }) {
  return (
    <RecordRow
      label={label}
      value={displayOrEmpty("")}
      hint={`${items} are uploads. None are on file for this profile.`}
      state="read"
      locked
      onEditStart={() => {}}
      onCancel={() => {}}
    />
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────

export function PersonProfileSection({
  subject,
}: {
  subject: FixtureSubject;
}) {
  const persona = useOnboardingStore((s) => s.persona);
  const setPersonProfile = useOnboardingStore((s) => s.setPersonProfile);
  const profile = useResolvedProfile(subject.id);
  const editable = resolveMode("matchingProfile", persona) === "edit";

  const set = (patch: PersonProfile) => setPersonProfile(subject.id, patch);

  return (
    <section aria-label="Profile" data-record-section="profile">
      <h2 className={H}>Match card</h2>
      <p className="mt-1 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
        What teens see when {subject.goesBy ?? subject.name} comes up as a
        match.
      </p>
      <div className={`mt-3 ${CARD}`}>
        <TextRow
          label="Display name"
          display={profile.displayName}
          hint="The name teens see — not the legal name on the account."
          editable={editable}
          initial={profile.displayName ?? ""}
          onCommit={(raw) => set({ displayName: raw.trim() })}
        />
        <TextRow
          label="Pronouns"
          display={profile.pronouns ?? subject.pronouns}
          editable={editable}
          initial={profile.pronouns ?? subject.pronouns ?? ""}
          placeholder="she/her"
          onCommit={(raw) => set({ pronouns: raw.trim() })}
        />
        <TextRow
          label="Languages"
          display={formatList(profile.languages)}
          hint="Separate with commas."
          editable={editable}
          initial={formatList(profile.languages)}
          placeholder="English, Spanish"
          onCommit={(raw) => set({ languages: parseList(raw) })}
        />
        <TextRow
          label="Bio"
          display={profile.bio}
          editable={editable}
          initial={profile.bio ?? ""}
          multiline
          placeholder="A few sentences in their own voice."
          onCommit={(raw) => set({ bio: raw.trim() })}
        />
        <TextRow
          label="On repeat"
          display={profile.spotifyTrack}
          hint="Title · Artist."
          editable={editable}
          initial={profile.spotifyTrack ?? ""}
          placeholder="Essence · Wizkid"
          onCommit={(raw) => set({ spotifyTrack: raw.trim() })}
        />
        <TextRow
          label="Interests"
          display={formatList(profile.interests)}
          hint="Separate with commas."
          editable={editable}
          initial={formatList(profile.interests)}
          placeholder="Cooking, Running"
          onCommit={(raw) => set({ interests: parseList(raw) })}
        />
        <AssetsRow
          label="Photos & media"
          items="Match card photo, chat avatar, audio intro and vibe board"
        />
      </div>
    </section>
  );
}

// ── First moments ───────────────────────────────────────────────────────────

export function PersonFirstMomentsSection({
  subject,
}: {
  subject: FixtureSubject;
}) {
  const persona = useOnboardingStore((s) => s.persona);
  const setPersonProfile = useOnboardingStore((s) => s.setPersonProfile);
  const profile = useResolvedProfile(subject.id);
  const editable = resolveMode("firstMoments", persona) === "edit";

  const fm = profile.firstMessages ?? {};
  // Write the WHOLE firstMessages object — the store merges at the top level
  // only, so a partial would drop the other lane.
  const setLane = (lane: "online" | "offline", lines: string[]) =>
    setPersonProfile(subject.id, {
      firstMessages: { ...fm, [lane]: lines },
    });

  return (
    <section aria-label="First moments" data-record-section="first-moments">
      <h2 className={H}>First messages</h2>
      <p className="mt-1 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
        Sent in chat the first time a teen opens the conversation. One message
        per line.
      </p>
      <div className={`mt-3 ${CARD}`}>
        <TextRow
          label="When they're around"
          display={
            fm.online?.length ? `${fm.online.length} message${fm.online.length > 1 ? "s" : ""}` : ""
          }
          hint={fm.online?.[0]}
          editable={editable}
          initial={formatLines(fm.online)}
          multiline
          placeholder="Hey! I'm glad you're here."
          onCommit={(raw) => setLane("online", parseLines(raw))}
        />
        <TextRow
          label="When they're away"
          display={
            fm.offline?.length
              ? `${fm.offline.length} message${fm.offline.length > 1 ? "s" : ""}`
              : ""
          }
          hint={fm.offline?.[0]}
          editable={editable}
          initial={formatLines(fm.offline)}
          multiline
          placeholder="I'm offline right now — back tomorrow."
          onCommit={(raw) => setLane("offline", parseLines(raw))}
        />
        <AssetsRow label="Story" items="Story slides" />
      </div>
    </section>
  );
}

// ── Schedule ────────────────────────────────────────────────────────────────

export function PersonScheduleSection({
  subject,
}: {
  subject: FixtureSubject;
}) {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const stored = useOnboardingStore((s) => s.personSchedules[subject.id]);
  const setPersonSchedule = useOnboardingStore((s) => s.setPersonSchedule);
  const editable = resolveMode("schedule", persona) === "edit";

  const fixture = scheduleFor(subject.id);
  const schedule = stored ?? fixture;

  // Mount-gate for the same reason ActiveHoursEditor does: seed the form from
  // the hydrated override, not the SSR fixture.
  if (!mounted) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-elevated)] bg-[var(--surface-s1)]" />
    );
  }

  if (!schedule) {
    return (
      <section aria-label="Schedule" data-record-section="schedule">
        <div className={CARD}>
          <p className="py-4 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            No active hours on file for this person.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Schedule" data-record-section="schedule">
      <ActiveHoursForm
        // Remount when the stored identity changes so the form reseeds.
        key={stored ? "override" : "fixture"}
        initial={schedule}
        editable={editable}
        onSave={(s) => setPersonSchedule(subject.id, s)}
      />
    </section>
  );
}
