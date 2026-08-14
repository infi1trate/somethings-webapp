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
import { MenteeTable } from "@/components/record/mentee-table";
import { TeenMentors } from "@/components/record/teen-mentors";
import { PersonOrganization } from "@/components/record/person-organization";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import { recordTabsFor } from "@/lib/record/tabs";
import { roleForPersona } from "@/components/settings/tabs-config";
import { resolveSubject } from "@/lib/record/subject";
import { relJoined } from "@/lib/record/people-demo";
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
  const isLead = mounted && persona === "lead-mentor";

  // Mentor personas have no business on staff record surfaces (same rule as
  // /admin/mentor).
  const mentorish = persona === "mentor" || persona === "new-mentor";
  useEffect(() => {
    if (mounted && mentorish) router.replace("/app/profile");
  }, [mounted, mentorish, router]);

  const Shell = isLead ? MentorShell : AdminShell;

  if (!subject || subject.kind === "live") {
    // "live" has its own deep record; anything unknown is a genuine 404.
    if (subject?.kind === "live") router.replace("/admin/mentor");
    return (
      <Shell active="mentors">
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
  const meta = [subject.pronouns, joined].filter(Boolean).join(" · ");

  const roleLabel = {
    mentor: "Mentor",
    "lead-mentor": "Lead mentor",
    supervisor: "Supervisor",
    admin: "Admin",
    teen: "Teen",
  }[subject.role];

  return (
    <Shell active={isTeen ? "teens" : "mentors"}>
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
          label: isTeen ? "Teens" : "Mentors",
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
            <MenteeTable mentorId={subject.id} mentorName={subject.name} />
          ))}
        {activeTab === "supervision" && <Supervision subjectId={subject.id} />}
        {activeTab === "organization" && <PersonOrganization subject={subject} />}
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
        <p className="mt-2 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {roleLabel} on the platform. Performance history for this person
          isn&rsquo;t connected yet &mdash; the tabs above carry what we hold
          today.
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
  const rows: [string, string | undefined][] = [
    ["Full name", subject.name],
    ["Goes by", subject.goesBy],
    ["Phone", subject.phone],
    ["Email", subject.email],
  ];
  return (
    <section aria-label="Account" data-record-section="account">
      <div className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)] [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]">
        {rows.map(([label, value]) => (
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
            <span
              className="text-[var(--text-primary)]"
              style={{ font: "var(--type-row-value)" }}
            >
              {value ?? (
                <span className="text-[var(--text-muted)]">Not recorded</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
