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
// seen from the other side.

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { UserRecordShell } from "@/components/record/user-record-shell";
import { PillButton } from "@/components/settings/pill-button";
import { Supervision } from "@/components/record/supervision";
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
import { recordTabsFor } from "@/lib/record/tabs";
import { roleForPersona } from "@/components/settings/tabs-config";
import { resolveSubject, LIVE_ID } from "@/lib/record/subject";
import { relJoined, teensForMentor } from "@/lib/record/people-demo";
import { JOIN_DATE } from "@/components/record/organization";
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

  const subject = resolveSubject(id);
  // Resolved BEFORE the early return below — hooks can't sit after a
  // conditional exit. An empty id resolves to {} harmlessly.
  const profile = useResolvedProfile(subject?.id ?? "");
  const isLead = mounted && persona === "lead-mentor";

  // A mentor persona has no business on STAFF record surfaces — but their own
  // mentee's record is legitimately theirs to open. This guard used to bounce
  // every mentor to /app/profile, so pressing a teen row on Teens landed the
  // mentor on their OWN self-view (the reported bug): the row's href was always
  // right, this redirect overrode it.
  const mentorish = persona === "mentor" || persona === "new-mentor";
  const ownMentee =
    subject?.role === "teen" &&
    teensForMentor(LIVE_ID).some((t) => t.id === subject.id);
  // Scoped, not blanket: a mentor may open a teen they hold the match with, and
  // nobody else — not another mentor's teen, not a staff record.
  const bounceMentor = mentorish && !ownMentee;
  useEffect(() => {
    if (mounted && bounceMentor) router.replace("/app/profile");
  }, [mounted, bounceMentor, router]);

  // Mentor + lead both live in the app chrome; the supervisor has the console.
  const Shell = isLead || mentorish ? MentorShell : AdminShell;

  if (!subject || subject.kind === "live") {
    // "live" has its own deep record; anything unknown is a genuine 404.
    if (subject?.kind === "live") router.replace("/admin/mentor");
    return (
      <Shell active={mentorish ? "teens" : "mentors"}>
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
  const status = subject.person
    ? ((mentorStatuses[subject.id] as typeof subject.person.status) ??
      subject.person.status)
    : null;

  // Pronouns + start date only. Groups and the load moved out of the header —
  // they're owned by the tabs below and duplicating them here aged badly.
  const joined = subject.teen
    ? `Joined ${relJoined(subject.teen.joinedDaysAgo)}`
    : `Joined ${JOIN_DATE}`;
  // Pronouns follow the staff-editable override, so changing them on Profile
  // updates the header rather than leaving two disagreeing values on screen.
  const meta = [profile.pronouns ?? subject.pronouns, joined]
    .filter(Boolean)
    .join(" · ");

  const roleLabel = {
    mentor: "Mentor",
    "lead-mentor": "Lead mentor",
    supervisor: "Supervisor",
    admin: "Admin",
    teen: "Teen",
  }[subject.role];

  return (
    <Shell active={isTeen ? "teens" : "team"}>
      <UserRecordShell
        avatar={{ src: null, initial: subject.name.charAt(0).toUpperCase() }}
        name={subject.goesBy ?? subject.name}
        roleLabel={roleLabel}
        // Role only — the lifecycle state is read and changed on Organization.
        statusDot="none"
        statusAriaLabel={roleLabel}
        meta={meta}
        backLink={{
          href: isTeen ? "/app/teens" : "/app/team",
          // "Team" — the destination is the staff directory; "Mentors" was left
          // over from the roster it replaced.
          label: isTeen ? "Teens" : "Team",
        }}
        primaryAction={
          <PillButton
            onClick={() => toast("Messaging isn't part of this prototype yet.")}
          >
            <MessagesSquare className="size-4" aria-hidden />
            Message
          </PillButton>
        }
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={activeTab ?? "overview"}
        onTabChange={(t) =>
          router.push(`/admin/person/${subject.id}?tab=${t}`, { scroll: false })
        }
        sectionsLabel="Record sections"
      >
        {activeTab === "overview" && (
          <PersonOverview
            name={subject.goesBy ?? subject.name}
            roleLabel={roleLabel}
            statusBadge={status ? <MentorStatusBadge status={status} /> : null}
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
        {activeTab === "organization" && <PersonOrganization subject={subject} />}
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
    <section aria-label="Overview" data-record-section="overview">
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
  const rows: [string, string | undefined, "phone" | "email" | null][] = [
    ["Full name", subject.name, null],
    ["Goes by", subject.goesBy, null],
    ["Phone", subject.phone, "phone"],
    ["Email", subject.email, "email"],
  ];
  return (
    <section aria-label="Account" data-record-section="account">
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
                <ContactActions kind={kind} value={value} name={subject.name} />
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
