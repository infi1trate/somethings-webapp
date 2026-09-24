"use client";

// PERSON RECORD — the record for anyone who ISN'T the store-backed mentor:
// lead mentors, supervisors, the fixture mentors, and teens.
//
// Why a second route rather than parameterising /admin/mentor: that page is
// ~1,500 lines wired directly to the store's one draft (profile lanes, review
// queues, activity, the teen-facing preview) with no subject seam. Those things
// genuinely don't exist for anyone else. This renders what a fixture person
// actually has — identity, org facts, relationships — on the shared
// UserRecordShell, which was written as exactly this drop-in. The SECTION
// components (Supervision, MenteeTable, OrganizationCard) are shared, so the
// two routes stay visually and behaviourally identical where they overlap.
//
// Tab set comes from the same registry and the same two gates as the mentor
// record: `subjectRoles` (does this tab exist for this person) and `roles`
// (may this viewer see it). A teen gets Mentorship — the same relationship
// seen from the other side — plus CARE, which exists only on a teen and is
// deliberately NOT viewer-gated: every tier that can open this record reads it.
// Who may ACT inside it is a separate question the tab answers itself.

import { use, useEffect, useState } from "react";
import { AppChrome } from "@/components/app-shell/app-chrome";
import { useRouter } from "next/navigation";
import { MessagesSquare, Sparkles } from "lucide-react";
import { UserRecordShell } from "@/components/record/user-record-shell";
import { PillButton } from "@/components/settings/pill-button";
import { Supervision } from "@/components/record/supervision";
import { CareTab } from "@/components/record/care-tab";
import { PersonMentorship } from "@/components/record/person-mentorship";
import { TeenMentors } from "@/components/record/teen-mentors";
import { PersonOrganization } from "@/components/record/person-organization";
import { ContactActions } from "@/components/record/contact-actions";
import {
  PersonFirstMomentsSection,
  PersonProfileSection,
  PersonScheduleSection,
  useResolvedProfile,
} from "@/components/record/person-profile";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import { ROLE_LABEL } from "@/components/record/role-label";
import { recordTabsFor } from "@/lib/record/tabs";
import { STATUS_LABELS } from "@/lib/record/mentor-status";
import { roleForPersona } from "@/components/settings/tabs-config";
import { resolveSubject, LIVE_ID } from "@/lib/record/subject";
import { currentMenteesOf } from "@/lib/record/relationships";
import { defaultMenteeStatus } from "@/lib/record/people-demo";
import { GuardianDetailsSection } from "@/components/record/guardian-details";
import { guardianFor } from "@/lib/record/guardian";
import { resolveMode } from "@/lib/record/permission-map";
import { RecordTaskRegions } from "@/components/record/record-task-regions";
import {
  alertsForTeen,
  alertRoleForStore,
  badgeCounts,
  severityOf,
} from "@/lib/record/record-alerts";
import { originFor } from "@/lib/record/origins";
import { chatHrefFor } from "@/lib/record/chat";
import { subjectDisplayName } from "@/lib/record/subject";

/** TODO-COPY — a teen's platform standing, sentence case. */
const TEEN_STATUS_LABEL: Record<"active" | "paused" | "deactivated", string> = {
  active: "Active",
  paused: "Paused",
  deactivated: "Deactivated",
};

import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { toast } from "sonner";

export default function PersonRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = use(params);
  const query = use(searchParams);
  const mounted = useMounted();
  const router = useRouter();
  const persona = useOnboardingStore((s) => s.persona);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const menteeStatus = useOnboardingStore((s) => s.menteeStatus);
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);

  const subject = resolveSubject(id);
  // Resolved BEFORE the early return below — hooks can't sit after a
  // conditional exit. An empty id resolves to {} harmlessly.
  const profile = useResolvedProfile(subject?.id ?? "");
  /** FIXED AT MOUNT. `Date.now()` in render scope is impure — react-hooks/purity
   *  rejects it, and rightly: a re-render would silently move every date and
   *  every elapsed-time figure on the page. Same pattern as the Care tab. */
  const [now] = useState(() => Date.now());
  /** The Care summary overlay, below 1100px. Owned here because the trigger
   *  lives in the shell's tab row and the panel lives in `CareTab` — one piece
   *  of shared state, passed rather than duplicated. */
  const [summaryOverlayOpen, setSummaryOverlayOpen] = useState(false);

  const isLead = mounted && persona === "lead-mentor";

  // A mentor persona has no business on STAFF record surfaces — but their own
  // mentee's record is legitimately theirs to open. This guard used to bounce
  // every mentor to /app/profile, so pressing a teen row on Teens landed the
  // mentor on their OWN self-view (the reported bug): the row's href was always
  // right, this redirect overrode it.
  const mentorish = persona === "mentor" || persona === "new-mentor";
  const ownMentee =
    subject?.role === "teen" &&
    currentMenteesOf(LIVE_ID, { events: relationshipEvents }).some(
      (t) => t.id === subject.id
    );
  // Scoped, not blanket: a mentor may open a teen they hold the match with, and
  // nobody else — not another mentor's teen, not a staff record.
  const bounceMentor = mentorish && !ownMentee;
  useEffect(() => {
    if (mounted && bounceMentor) router.replace("/app/profile");
  }, [mounted, bounceMentor, router]);

  // Mentor + lead both live in the app chrome; the supervisor has the console.
  const Shell = isLead || mentorish ? AppChrome : AppChrome;

  if (!subject || subject.kind === "live") {
    // "live" has its own deep record; anything unknown is a genuine 404.
    if (subject?.kind === "live") router.replace("/admin/mentor");
    return (
      <Shell active={mentorish ? "mentees" : "mentors"}>
        <div className="px-6 py-6 lg:px-10">
          <p className="text-[15px] text-[var(--text-secondary)]">
            {subject ? "Taking you to that record…" : "We couldn't find that person."}
          </p>
        </div>
      </Shell>
    );
  }

  const tabs = recordTabsFor({
    viewerRole: roleForPersona(persona),
    subjectRole: subject.role,
  });
  const tabParam = typeof query.tab === "string" ? query.tab : null;
  const activeTab =
    tabParam && tabs.some((t) => t.id === tabParam) ? tabParam : tabs[0]?.id;

  const isTeen = subject.role === "teen";
  // A teen's platform standing lives in `menteeStatus`, not the staff lifecycle.
  const teenStatus =
    (subject.teen
      ? (menteeStatus[subject.id] ?? defaultMenteeStatus(subject.teen))
      : "active") as "active" | "paused" | "deactivated";
  const status = subject.person
    ? ((mentorStatuses[subject.id] as typeof subject.person.status) ??
      subject.person.status)
    : null;

  // Meta: pronouns · location · caseload. The JOIN DATE left the header — it is
  // a reference fact and lives on Organization; the header carries who this
  // person is and what they hold. Pronouns follow the staff-editable override so
  // changing them on Profile updates the header rather than leaving two
  // disagreeing values on screen.
  const menteeLoad =
    subject.role === "mentor" && subject.person
      ? // CURRENT matches, so an unmatch frees the slot in the header too.
        `${currentMenteesOf(subject.id, { events: relationshipEvents }).length} of ${subject.person.capacity} mentees`
      : null;
  const meta = [
    profile.pronouns ?? subject.pronouns,
    subject.group,
    menteeLoad,
  ]
    .filter(Boolean)
    .join(" · ");

  const roleLabel = ROLE_LABEL[subject.role];

  // ── ALERTS, ONCE, for both the regions and the badges ─────────────────────
  // Derived here rather than inside each consumer so a badge and a section can
  // never disagree about what is open on this record. Teen subjects only: no
  // other subject has care flags, a presentation review or a mentorship to say
  // hello in.
  const alertRole = alertRoleForStore(persona);
  const instances = subject.teen ? alertsForTeen(subject.teen, now, {}) : [];
  const counts = badgeCounts(instances, alertRole);
  // WORST OPEN ITEM sets the tone, not the count — two routine reviews stay
  // muted, one open escalation goes critical.
  const worst = instances
    .map((i) => severityOf(i))
    .reduce<"routine" | "warning" | "critical">(
      (acc, sev) =>
        sev === "critical" || acc === "critical"
          ? "critical"
          : sev === "warning" || acc === "warning"
            ? "warning"
            : "routine",
      "routine"
    );

  // ── THE BACK LINK ─────────────────────────────────────────────────────────
  // Contextual when the origin was stamped on the inbound link, and falling back
  // to the subject's list type otherwise. See origins.ts for why a param rather
  // than router history (the App Router exposes no stack, so a history-derived
  // link could not be LABELLED) or document.referrer (empty on client-side
  // navigation, which is every navigation here).
  const back =
    originFor(query.from, (id) => {
      const s = resolveSubject(id);
      return s && s.kind === "fixture" ? subjectDisplayName(s) : null;
    }) ?? {
      href: isTeen ? "/app/mentees" : "/app/team",
      // "Team" — the destination is the staff directory; "Mentors" was left over
      // from the roster it replaced.
      label: isTeen ? "Mentees" : "Team",
    };

  return (
    <Shell active={isTeen ? "mentees" : "team"}>
      <UserRecordShell
        // ═══ THE CARE SUMMARY TRIGGER, BACK IN THE TAB ROW ═══
        //
        // Below 1100px the Care tab has no rail, so this is the only way to the
        // summary. It is NOT a toggle for a column that is already visible —
        // the earlier version of this control was exactly that, which is why it
        // was deleted — it opens an overlay that does not otherwise exist.
        //
        // THE STATE LIVES HERE rather than in `CareTab` because the tab row is
        // the shell's, and the shell is this page's. `CareTab` owns the overlay
        // and this owns the trigger, so the one piece of state they share is
        // passed rather than duplicated.
        //
        // ONLY ON THE CARE TAB, and only below 1100px: `min-[1100px]:hidden`
        // lives on the trigger so the page cannot mount it into a width where
        // the rail is already showing the same content.
        tabRowAction={
          activeTab === "care" && isTeen ? (
            <button
              type="button"
              onClick={() => setSummaryOverlayOpen(true)}
              /* FILLED DARK, per the MO-4.1 reference frame — measured off
                 node 2169:7058: a `#1f1e1d` pill with white text and a sparkle,
                 sitting at the tab row's right edge. The first version was an
                 outline pill, which read as a tertiary control; the reference
                 gives it the same weight as the record's own primary action,
                 which is right for the only route to the summary at this width.
                 `--text-primary` is this system's equivalent of that fill. */
              className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-3.5 text-[13px] font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)] min-[1100px]:hidden"
            >
              <Sparkles className="size-3.5 shrink-0" aria-hidden />
              {/* TODO-COPY */}
              Care summary
            </button>
          ) : undefined
        }
        avatar={{
          src: null,
          initial: subjectDisplayName(subject).charAt(0).toUpperCase(),
        }}
        name={subjectDisplayName(subject)}
        role={subject.role}
        // ONE status statement: the role badge carries its tint and the state
        // dot. No separate Active pill, no avatar dot.
        // PRESENCE, not standing — the dot sits on the avatar. Standing is the
        // word-chip below.
        // EXCEPTIONS GET A WORD — a second chip. Staff exceptions come from the
        // lifecycle; a TEEN's come from their mentee status, which is the only
        // place a teen's platform standing is recorded.
        statusText={
          status && status !== "active"
            ? STATUS_LABELS[status]
            : isTeen && teenStatus !== "active"
              ? TEEN_STATUS_LABEL[teenStatus]
              : undefined
        }
        statusAriaLabel={
          status
            ? `${roleLabel}, ${STATUS_LABELS[status].toLowerCase()}`
            : isTeen
              ? `${roleLabel}, ${TEEN_STATUS_LABEL[teenStatus].toLowerCase()}`
              : roleLabel
        }
        meta={meta}
        backLink={back}
        primaryAction={
          // ON A MENTEE RECORD THE VERB IS "OPEN CHAT", not "Message".
          //
          // A supervisor's job on a teen's record is to READ the discussion and
          // decide — they are not here to compose. "Message" promised a composer
          // that does not exist and, worse, described the wrong job. It also now
          // matches the flag cards' secondary button exactly, deliberately: one
          // verb for one destination, whether a reader reaches it from the header
          // or from a card.
          //
          // MENTOR AND STAFF RECORDS ARE UNCHANGED this run — staff genuinely do
          // message each other. `backLink`/`primaryAction` are passed from THIS
          // CALL SITE ONLY (audited: /app/profile and /admin/mentor pass neither),
          // so nothing else in the app shifts.
          isTeen ? (
            <PillButton onClick={() => router.push(chatHrefFor(subject.id))}>
              <MessagesSquare className="size-4" aria-hidden />
              {/* TODO-COPY */}
              Open chat
            </PillButton>
          ) : (
            <PillButton
              onClick={() => toast("Messaging isn't part of this prototype yet.")}
            >
              <MessagesSquare className="size-4" aria-hidden />
              Message
            </PillButton>
          )
        }
        tabs={tabs.map((t) => ({
          id: t.id,
          label: t.label,
          // THE OVERLAP IS DELIBERATE — see badgeCounts. Overview counts every
          // open action item on the person INCLUDING the Care-homed review,
          // because Overview is the profile-level index; Care counts only its
          // own. A reader never sums the two.
          badge:
            t.id === "overview"
              ? counts.overview
              : t.id === "care"
                ? counts.care
                : undefined,
          badgeTone:
            t.id === "overview" || t.id === "care" ? worst : undefined,
        }))}
        activeTab={activeTab ?? "overview"}
        onTabChange={(t) =>
          router.push(`/admin/person/${subject.id}?tab=${t}`, { scroll: false })
        }
        sectionsLabel="Record sections"
      >
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* ATTENTION REGIONS FIRST — see the ordering note in
                record-task-regions. Renders NOTHING when both are empty, so a
                quiet record shows no attention chrome at all. */}
            {subject.teen && (
              <RecordTaskRegions
                teen={subject.teen}
                now={now}
                onNavigate={(tab) =>
                  router.push(`/admin/person/${subject.id}?tab=${tab}`, {
                    scroll: false,
                  })
                }
              />
            )}
            <PersonOverview
              name={subjectDisplayName(subject)}
              roleLabel={roleLabel}
              statusBadge={status ? <MentorStatusBadge status={status} /> : null}
            />
          </div>
        )}
        {/* CARE — teen subjects only (registry-gated), read by every tier.
            `subject.teen` is the narrowing the resolver gives us; a teen
            subject always carries it. */}
        {activeTab === "care" && subject.teen && (
          <CareTab
            teen={subject.teen}
            summaryOverlayOpen={summaryOverlayOpen}
            onSummaryOverlayChange={setSummaryOverlayOpen}
          />
        )}
        {activeTab === "mentorship" &&
          (isTeen ? (
            <TeenMentors teenId={subject.id} />
          ) : (
            // Was a bare MenteeTable — no caseload, so capacity was readable on
            // the live record only. Same component set as that record now.
            <PersonMentorship subject={subject} />
          ))}
        {activeTab === "supervision" && <Supervision subjectId={subject.id} />}
        {/* The teen-facing trio. The registry already gated these to mentor
            subjects; they rendered NOTHING until now, so a lead opening
            Profile on one of their mentors got an empty page. */}
        {activeTab === "profile" && <PersonProfileSection subject={subject} />}
        {activeTab === "first-moments" && (
          <PersonFirstMomentsSection subject={subject} />
        )}
        {activeTab === "schedule" && <PersonScheduleSection subject={subject} />}
        {activeTab === "account" && <PersonAccount subject={subject} />}
      </UserRecordShell>
    </Shell>
  );
}

/** Overview for a fixture person. Deliberately light: the IMP-6 dashboard on
 *  the mentor record runs on store-backed data that no fixture person has, so
 *  inventing charts here would be dishonest. */
function PersonOverview({
  name,
  roleLabel,
  statusBadge,
}: {
  name: string;
  roleLabel: string;
  statusBadge: React.ReactNode;
}) {
  return (
    <section aria-label="Overview" data-record-section="overview" data-anno-ref="record-overview">
      <div className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-[var(--surface-pad-y)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
            {name}
          </h2>
          {statusBadge}
        </div>
        {/* One template string, not `{roleLabel} text` — that adjacency was
            rendering as "Teenon the platform" (two text nodes, no space between
            them). Interpolating the whole sentence can't lose the space. */}
        <p className="mt-2 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {`${roleLabel} on the platform. Performance history for this person isn’t connected yet — the tabs above carry what we hold today.`}
        </p>
      </div>
    </section>
  );
}

/** Contact facts. Account settings proper belong to the person themselves. */
function PersonAccount({
  subject,
}: {
  subject: NonNullable<ReturnType<typeof resolveSubject>> & { kind: "fixture" };
}) {
  // Phone + email carry ACTIONS here (call / email / copy). They used to live in
  // a Contact dropdown on every directory row, which handed out PII from a list;
  // the capability moved to the record you had to open for this one person.
  const persona = useOnboardingStore((s) => s.persona);
  const guardians = useOnboardingStore((s) => s.guardians);
  const setGuardian = useOnboardingStore((s) => s.setGuardian);
  // Store override wins; the fixture is the baseline. Same sparse-override
  // shape as mentorStatuses / menteeStatus / personProfiles.
  const guardian = guardians[subject.id] ?? guardianFor(subject.id);
  // Same tier that owns standing owns the consent record.
  const canEditAccount = resolveMode("accountOrg", persona) === "edit";

  // THE ONE PLACE A TEEN SURNAME RENDERS IN THE WHOLE APP (decided 2026-08-27;
  // design-system-gaps.md row 254). This row USED TO BE the single sanctioned
  // exception to standing rule 6 ("never render a teen surname") — staff-only
  // chrome, on the record OF that legal name, behind a click on one named person,
  // and the field staff verify against consent paperwork. Rule 6 was retired on
  // 2026-08-28 (row 284), so the exception is now simply consistent with
  // everywhere else and the row needs no special justification. Kept as written
  // because the reasons it was allowed are still the reasons it belongs here.
  // Everything else about a teen — every list, header,
  // avatar, toast, dialog and composed sentence — is first name only.
  //
  // DO NOT COPY THIS READ. `subject.name` anywhere else on a teen is the bug this
  // row is the exception to; use `subjectDisplayName(subject)`.
  const rows: [string, string | undefined, "phone" | "email" | null][] = [
    ["Full name", subject.name, null],
    ["Goes by", subject.goesBy, null],
    ["Phone", subject.phone, "phone"],
    ["Email", subject.email, "email"],
  ];
  return (
    <div className="space-y-7">
      {/* ORGANIZATION first (Figma 2162:5663) — its own tab is gone. */}
      <section aria-label="Organization group">
        <h2 className="mb-3 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
          Organization
        </h2>
        <PersonOrganization subject={subject} />
      </section>

      <section aria-label="Account" data-record-section="account" data-anno-ref="record-account">
        <h2 className="mb-3 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
          Account
        </h2>
        <div className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)] [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]">
        {rows.map(([label, value, kind]) => (
          <div
            key={label}
            className="grid min-h-13 grid-cols-[168px_minmax(0,1fr)] gap-x-6 py-3.5"
          >
            <span
              className="self-start pt-[3px] text-[var(--text-muted)]"
              style={{
                font: "var(--type-field-label)",
                letterSpacing: "var(--type-field-label-tracking)",
              }}
            >
              {label}
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <span
                className="min-w-0 truncate text-[var(--text-primary)]"
                style={{ font: "var(--type-row-value)" }}
              >
                {value ?? (
                  <span className="text-[var(--text-muted)]">Not recorded</span>
                )}
              </span>
              {kind && (
                <ContactActions
                  kind={kind}
                  value={value}
                  name={subjectDisplayName(subject)}
                />
              )}
            </span>
          </div>
        ))}
      </div>
      </section>

      {/* PARENT DETAILS — teens only. Below their own account facts, because it
          is about someone else and reads as context for the person above it. */}
      {subject.role === "teen" && (
        <GuardianDetailsSection
          teenName={subjectDisplayName(subject)}
          guardian={guardian}
          onChange={(patch) => setGuardian(subject.id, patch)}
          canEdit={canEditAccount}
        />
      )}
    </div>
  );
}
