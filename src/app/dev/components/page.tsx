"use client";

// Phase 0 component audit — build-spec §7 ("a /dev/components route renders all
// states"). Dev-only surface: every shared settings component in every state,
// on the real §2 surfaces, for visual + keyboard audit in one place.
// Hover / focus / active are LIVE states — mouse over and Tab through to audit.

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ACTIVITIES } from "@/lib/chat/activities";
import { ActivityCover } from "@/components/chat/activity/activity-cover";
import { PanelShell } from "@/components/chat/rail/rail-panel";
import { AssistPanel } from "@/components/chat/rail/assist";
import { ProfilePanel } from "@/components/chat/rail/profile";
import { ToolkitPanel } from "@/components/chat/rail/toolkit";
import { TimelinePanel } from "@/components/chat/rail/timeline";
import {
  BannerButton,
  StatusBanner,
} from "@/components/chat/thread/status-banner";
import { EventChip } from "@/components/chat/thread/event-chip";
import { MediaFrame } from "@/components/chat/thread/media-frame";
import { GALLERY_ASSIST, GALLERY_EVENTS, GALLERY_NOW, GALLERY_THREAD } from "@/lib/chat/gallery";

import { SettingsSidebar } from "@/components/settings/sidebar";
import { SettingsTabBar } from "@/components/settings/tab-bar";
import { SectionCard } from "@/components/settings/section-card";
import { EditRow } from "@/components/settings/edit-row";
import { PillButton } from "@/components/settings/pill-button";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { SETTINGS_TABS } from "@/components/settings/tabs-config";
import { Input } from "@/components/ui/input";
import { AttentionCard } from "@/components/record/attention-card";
import {
  MentorStatusBadge,
  AvailabilityCell,
} from "@/components/admin/mentor-status-badge";
import {
  AVAILABILITY_ORDER,
  canMentor,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/record/mentor-status";
import type { MentorAvailability } from "@/lib/types";
import {
  ChangeLog,
  DocumentPreview,
  MetadataList,
  PaneActions,
  PaneHeader,
  PaneSection,
  PaneShell,
  QuoteBlock,
  RelatedRecord,
  TrendStrip,
  OutcomePill,
  OUTCOME_TONE,
} from "@/components/activity/pane";
import { reviewDocumentFor, reviewerNoteFor } from "@/lib/activity/pane-fixtures";

const SWATCHES: { token: string; value: string; note?: string }[] = [
  { token: "surface/s2", value: "#e5e0d2" },
  { token: "surface/s1 · s0", value: "#f6f4ef" },
  { token: "border/border-subtle", value: "#dfddd8" },
  { token: "text/primary", value: "#1f1e1d" },
  { token: "text/secondary", value: "#58534b" },
  { token: "text/tertiary", value: "#716a60", note: "Bloom value since SUP-1; was #a0998d (2.57:1)" },
  { token: "muted (untokenized)", value: "#797774", note: "⚠ 4.06:1 on s1" },
  { token: "states/inactive", value: "#b8b2a9" },
  { token: "button/border/default", value: "#716a60", note: "focus ring" },
  { token: "preview accent", value: "#b164ff" },
  { token: "preview chip bg", value: "#f1ece3" },
];

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-panel)] bg-[var(--surface-s1)] px-[var(--panel-pad-x)] py-[var(--panel-pad-y)] shadow-[var(--shadow-panel)]">
      <h2 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
        {title}
      </h2>
      {note && (
        <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {note}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

// Single-row container matching the Profile tab's group treatment.
function RowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
      {children}
    </div>
  );
}

// Live EditRow machine: two rows, one edits at a time, fake 700ms save.
function EditRowDemo() {
  const [values, setValues] = useState({ name: "Brandon", coffee: "Oat flat white" });
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState({ name: "", coffee: "" });
  const [phase, setPhase] = useState<"edit" | "saving" | "saved">("edit");
  const [savedId, setSavedId] = useState<string | null>(null);

  const start = (id: "name" | "coffee") => {
    setDrafts((d) => ({ ...d, [id]: values[id] }));
    setEditing(id);
    setPhase("edit");
    setSavedId(null);
  };
  const save = (id: "name" | "coffee") => {
    setPhase("saving");
    setTimeout(() => {
      setValues((v) => ({ ...v, [id]: drafts[id] }));
      setEditing(null);
      setSavedId(id);
      setPhase("edit");
    }, 700);
  };
  const stateFor = (id: "name" | "coffee") =>
    editing === id ? (phase === "saving" ? "saving" : "edit") : savedId === id ? "saved" : "read";

  return (
    <RowFrame>
      <EditRow
        label="Display name"
        value={values.name}
        state={stateFor("name")}
        onEditStart={() => start("name")}
        onCancel={() => setEditing(null)}
        onSave={() => save("name")}
        saveDisabled={!drafts.name.trim()}
      >
        <Input
          aria-label="Display name"
          className="max-w-sm"
          value={drafts.name}
          onChange={(e) => setDrafts((d) => ({ ...d, name: e.target.value }))}
        />
      </EditRow>
      <EditRow
        label="Favorite coffee"
        value={values.coffee}
        state={stateFor("coffee")}
        onEditStart={() => start("coffee")}
        onCancel={() => setEditing(null)}
        onSave={() => save("coffee")}
        saveDisabled={!drafts.coffee.trim()}
      >
        <Input
          aria-label="Favorite coffee"
          className="max-w-sm"
          value={drafts.coffee}
          onChange={(e) => setDrafts((d) => ({ ...d, coffee: e.target.value }))}
        />
      </EditRow>
    </RowFrame>
  );
}

function StateLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-medium uppercase leading-[16px] tracking-[0.3px] text-[var(--text-secondary)]">
      {children}
    </p>
  );
}

export default function ComponentsAuditPage() {
  const [navActive, setNavActive] = useState("home");
  const [mentorTab, setMentorTab] = useState("profile");
  const [supervisorTab, setSupervisorTab] = useState("permissions");
  const [playCard, setPlayCard] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--surface-s2)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-24">
        <header>
          <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
            Phase 0 — Settings component audit
          </h1>
          <p className="mt-1 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
            Every shared component and state from the build spec, on the real §2
            surfaces. Hover, click, and Tab through — hover/focus/active states
            are live, not simulated. Conflicts and interims are logged in
            design-system-gaps.md.
          </p>
        </header>

        <Panel
          title="Mentor status & availability"
          note="Lifecycle status (primary, filled tint + icon + label) × the separate availability axis (secondary, dot + label). Availability is n/a for In Training / Paused / Deactivated. Color is never the sole signal (WCAG 1.4.1)."
        >
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-secondary)]">
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Availability</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ORDER.flatMap((status) => {
                  // Guided/Active get one row per availability value; the rest
                  // get a single n/a row (availability = null → "—").
                  const availValues: (MentorAvailability | null)[] = canMentor(
                    status
                  )
                    ? AVAILABILITY_ORDER
                    : [null];
                  return availValues.map((avail, i) => (
                    <tr
                      key={`${status}-${avail ?? "na"}`}
                      className="border-t border-[var(--border-subtle)] first:border-t-0"
                    >
                      <td className="px-4 py-2.5">
                        {/* Repeat the badge on every sub-row so each
                            combination reads standalone. */}
                        <MentorStatusBadge status={status} />
                        {i > 0 && (
                          <span className="sr-only">
                            {STATUS_LABELS[status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <AvailabilityCell value={avail} />
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Attention strip (families)"
          note="The record's attention band, all three severity families. Critical is RESERVED for genuine escalations; warning carries the derived recency states (waiting-on-mentor, teen-quiet); warm is review-waiting. Action is a plain text link — never a filled button (the record's one filled button is the header Message). All copy TODO-COPY."
        >
          <div className="space-y-3">
            <AttentionCard
              variant="band"
              severity="critical"
              line="1 mentee needs attention · Escalated by mentor"
              action={{ label: "View mentee", onClick: () => {} }}
            />
            <AttentionCard
              variant="band"
              severity="warning"
              line="1 mentee waiting on a reply · No reply in 5 days"
              action={{ label: "View mentee", onClick: () => {} }}
            />
            <AttentionCard
              variant="band"
              severity="warm"
              line="Submitted for review — waiting on the team."
              action={{ label: "Open review console", onClick: () => {} }}
            />
          </div>
        </Panel>

        <Panel title="Tokens" note="settings-tokens.css — spec §2, Figma 388:1586.">
          <ul className="flex flex-wrap gap-3">
            {SWATCHES.map((s) => (
              <li
                key={s.token}
                className="flex items-center gap-2.5 rounded-full border border-[var(--border-subtle)] bg-white py-1.5 pl-2 pr-3.5"
              >
                <span
                  className="size-6 rounded-full border border-black/10"
                  style={{ backgroundColor: s.value }}
                />
                <span className="text-[12px] leading-[16px] text-[var(--text-primary)]">
                  <span className="font-medium">{s.token}</span>{" "}
                  <span className="text-[var(--text-secondary)]">{s.value}</span>
                  {s.note && (
                    <span className="text-[var(--state-error)]"> {s.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Sidebar"
          note="§5 six-item nav (Figma five + Training). Click to move active; hover/focus live. Active = white tile + shadow + bold label."
        >
          <div className="flex items-start gap-8">
            {/* A DEMO FRAME THAT CLIPS ON PURPOSE (gap row 297) — it shows the
                app shell at a fixed 640px so the showcase page stays scannable.
                Declared so the RC-6 reflow check does not report the rail being
                cut off by the frame as lost content; it was 3 of the remaining
                hits, all on this page. */}
            <div
              data-clip-viewport=""
              className="h-[640px] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)]"
            >
              <SettingsSidebar activeId={navActive} onSelect={setNavActive} avatarInitial="B" />
            </div>
            <div className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
              <StateLabel>States</StateLabel>
              <ul className="list-disc space-y-1 pl-4">
                <li>Active — white 48px tile, tile shadow, bold black label</li>
                <li>Inactive — bare icon, medium #58534b label</li>
                <li>Hover — white/60 tile tint (interim, gaps #5)</li>
                <li>Focus — 2px #716a60 ring, 2px offset (gaps #4)</li>
                <li>Bottom cluster — 40px white utility circles</li>
              </ul>
              <p className="mt-3">
                Currently active: <span className="font-medium text-[var(--text-primary)]">{navActive}</span>
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          title="TabBar"
          note="Config-driven from the §3 registry (never hardcoded). ←/→/Home/End are keyboard-operable; active = 1.5px #716a60 underline + bold."
        >
          <div className="space-y-8">
            <div>
              <StateLabel>role = mentor ({SETTINGS_TABS.filter((t) => t.roles.includes("mentor")).length} tabs)</StateLabel>
              <SettingsTabBar role="mentor" activeId={mentorTab} onChange={setMentorTab} />
            </div>
            <div>
              <StateLabel>role = supervisor ({SETTINGS_TABS.length} tabs — record owns Roles &amp; permissions now)</StateLabel>
              <SettingsTabBar role="supervisor" activeId={supervisorTab} onChange={setSupervisorTab} />
            </div>
          </div>
        </Panel>

        <Panel
          title="SectionCard"
          note="Accordion card: radius 21.6, 1px border-subtle, padding 17, 44px chevron target. Top row is interactive; the grid pins each state."
        >
          <div className="mb-6">
            <StateLabel>Interactive (uncontrolled)</StateLabel>
            <SectionCard
              title="Languages"
              status="English, Spanish, Mandarin"
              defaultExpanded={playCard}
              onToggle={setPlayCard}
            />
          </div>
          <div className="grid grid-cols-1 gap-[var(--card-gap)] lg:grid-cols-2 lg:gap-x-6">
            <div>
              <StateLabel>Collapsed (default)</StateLabel>
              <SectionCard title="Display name" status="Brandon" />
            </div>
            <div>
              <StateLabel>Expanded</StateLabel>
              <SectionCard title="Bio" status="I'm a 40 year old mentor that wants to help…" expanded onToggle={() => {}} />
            </div>
            <div>
              <StateLabel>Dirty (unsaved changes)</StateLabel>
              <SectionCard title="Match card photo" status="Photo added" state="dirty" />
            </div>
            <div>
              <StateLabel>Error</StateLabel>
              <SectionCard
                title="Audio intro"
                status="Audio added"
                state="error"
                onRetry={() => {}}
              />
            </div>
          </div>
        </Panel>

        <Panel
          title="EditRow"
          note="Revised-§4 dense row (Phase 2.5): label / current value / right-aligned Edit; editing swaps the row inline. Tab reaches Edit, Enter opens, Esc cancels. Top group is live; the grid pins each state."
        >
          <div className="mb-6">
            <StateLabel>Interactive (grouped, hairline-divided)</StateLabel>
            <EditRowDemo />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <StateLabel>Read</StateLabel>
              <RowFrame>
                <EditRow
                  label="Display name"
                  value="Brandon"
                  state="read"
                  onEditStart={() => {}}
                  onCancel={() => {}}
                />
              </RowFrame>
            </div>
            <div>
              <StateLabel>Saved</StateLabel>
              <RowFrame>
                <EditRow
                  label="Display name"
                  value="Brandon"
                  state="saved"
                  onEditStart={() => {}}
                  onCancel={() => {}}
                />
              </RowFrame>
            </div>
            <div>
              <StateLabel>Edit</StateLabel>
              <RowFrame>
                <EditRow
                  label="Display name"
                  value="Brandon"
                  state="edit"
                  onEditStart={() => {}}
                  onCancel={() => {}}
                  onSave={() => {}}
                >
                  <Input aria-label="Display name" className="max-w-sm" defaultValue="Brandon" />
                </EditRow>
              </RowFrame>
            </div>
            <div>
              <StateLabel>Saving</StateLabel>
              <RowFrame>
                <EditRow
                  label="Display name"
                  value="Brandon"
                  state="saving"
                  onEditStart={() => {}}
                  onCancel={() => {}}
                  onSave={() => {}}
                >
                  <Input aria-label="Display name" className="max-w-sm" defaultValue="Brandon B" />
                </EditRow>
              </RowFrame>
            </div>
            <div>
              <StateLabel>Error</StateLabel>
              <RowFrame>
                <EditRow
                  label="Display name"
                  value="Brandon"
                  state="error"
                  onEditStart={() => {}}
                  onCancel={() => {}}
                  onSave={() => {}}
                >
                  <Input aria-label="Display name" className="max-w-sm" defaultValue="Brandon__fail" />
                </EditRow>
              </RowFrame>
            </div>
          </div>
        </Panel>

        <Panel
          title="PillButton"
          note="Pill radius, height 53, px-24, Avantt Bold 16/1.1 −0.16px. Hover/focus/active live on the first instance."
        >
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <StateLabel>Default (+ hover/focus/active live)</StateLabel>
              <PillButton>Send for review</PillButton>
            </div>
            <div>
              <StateLabel>Disabled</StateLabel>
              <PillButton disabled>No changes made</PillButton>
            </div>
            <div>
              <StateLabel>Loading</StateLabel>
              <PillButton loading>Sending…</PillButton>
            </div>
          </div>
        </Panel>

        <Panel
          title="PhonePreview shell"
          note="Frame only — no content binding until Phase 1. The preview is passive output, never an editing surface."
        >
          <div className="flex flex-wrap items-start gap-10">
            <div>
              <StateLabel>Empty shell</StateLabel>
              <PhonePreviewShell />
            </div>
            <div>
              <StateLabel>Children slot proof</StateLabel>
              <PhonePreviewShell>
                <div className="flex h-full items-center justify-center bg-[var(--preview-chip-bg)] px-8 text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
                  Slot renders children verbatim (Phase 1 binds the live teen
                  preview here).
                </div>
              </PhonePreviewShell>
            </div>
          </div>
        </Panel>

        {/* ═══ ACTIVITY PANE PRIMITIVES (C2) ═══
            Every primitive in every state, on the real surfaces. The pane's
            defect was having ONE content shape and using it for everything, so
            seeing the eight together — and seeing that they are visibly
            different KINDS of thing — is the audit. */}
        <Panel
          title="Activity pane primitives"
          note="C2. The pane's content vocabulary, in the states the pane can put them in. Prototype fixtures — see lib/activity/pane-fixtures.ts."
        >
          <div className="space-y-10">
            <div>
              <StateLabel>PaneHeader — every outcome word and tone</StateLabel>
              <div className="flex flex-wrap items-center gap-2">
                {Object.keys(OUTCOME_TONE).map((w) => (
                  <OutcomePill key={w} word={w} />
                ))}
                {/* An UNMAPPED word still renders, neutral. A missing tint is a
                    smaller failure than a missing outcome. */}
                <OutcomePill word="Withdrawn" />
              </div>
              <div className="mt-4 max-w-[560px] rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4">
                <PaneHeader
                  eventName="Billing review"
                  outcome="Active"
                  subjectName="Caleb"
                />
              </div>
            </div>

            <div>
              <StateLabel>MetadataList — one and two columns</StateLabel>
              <div className="max-w-[560px] rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4">
                <MetadataList
                  items={[
                    { label: "Code", value: <span className="font-mono text-[13.5px]">F41.9 → F33.0</span> },
                    { label: "Approved by", value: "Lydia · Supervisor" },
                    { label: "When", value: "Aug 26, 2026 at 4:12 PM" },
                  ]}
                />
              </div>
            </div>

            <div>
              <StateLabel>DocumentPreview — collapsed, with its expand control</StateLabel>
              <div className="max-w-[560px]">
                <DocumentPreview
                  title={reviewDocumentFor(0).title}
                  date="Aug 26, 2026"
                  paragraphs={reviewDocumentFor(0).paragraphs}
                  href="#"
                />
              </div>
              <StateLabel>Single short paragraph — no control, nothing to expand</StateLabel>
              <div className="max-w-[560px]">
                <DocumentPreview
                  title="Presentation review"
                  date="Aug 12, 2026"
                  paragraphs={["Confirming the existing code. No change."]}
                />
              </div>
            </div>

            <div>
              <StateLabel>QuoteBlock — with and without attribution</StateLabel>
              <div className="max-w-[560px] space-y-5 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4">
                <QuoteBlock attribution="Lydia" meta="Supervisor · Aug 26">
                  {reviewerNoteFor(0)}
                </QuoteBlock>
                <QuoteBlock>{reviewerNoteFor(3)}</QuoteBlock>
              </div>
            </div>

            <div>
              <StateLabel>RelatedRecord — replaces the dead chip</StateLabel>
              <div className="max-w-[560px] space-y-2.5">
                <RelatedRecord
                  kind="Primary presentation"
                  title={<span className="font-mono text-[13.5px]">F33.1</span>}
                  summary="Major depressive disorder, recurrent, moderate"
                  detail="Assigned Feb 6, 2026 from the intake mapping. Reviewed Jun 4, 2026 on cadence."
                  href="#"
                />
                <RelatedRecord
                  kind="Survey"
                  title="GAD-7"
                  summary="Score 11 of 21 — moderate."
                />
              </div>
            </div>

            <div>
              <StateLabel>TrendStrip — improving, worsening, and WHO-5 (higher is better)</StateLabel>
              <div className="flex max-w-[720px] flex-wrap gap-8 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4">
                <TrendStrip
                  instrument="PHQ-9"
                  readings={[
                    { at: "2026-05-02T12:00:00.000Z", score: 17 },
                    { at: "2026-06-01T12:00:00.000Z", score: 15 },
                    { at: "2026-07-04T12:00:00.000Z", score: 13 },
                    { at: "2026-08-02T12:00:00.000Z", score: 14 },
                    { at: "2026-08-26T12:00:00.000Z", score: 11 },
                  ]}
                />
                <TrendStrip
                  instrument="WHO-5"
                  readings={[
                    { at: "2026-07-04T12:00:00.000Z", score: 8 },
                    { at: "2026-08-26T12:00:00.000Z", score: 15 },
                  ]}
                />
              </div>
            </div>

            <div>
              <StateLabel>ChangeLog — populated, and the empty case</StateLabel>
              <div className="max-w-[560px] space-y-5 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4">
                <ChangeLog
                  actorName={(id) => id}
                  changes={[
                    { at: "2026-06-04T12:00:00.000Z", from: "F32.9", to: "F33.1", actorId: "Lydia" },
                    { at: "2026-02-06T12:00:00.000Z", from: null, to: "F32.9", actorId: "Amara" },
                  ]}
                />
                <ChangeLog actorName={(id) => id} changes={[]} />
              </div>
            </div>

            <div>
              <StateLabel>PaneShell + PaneActions — short content, footer pinned to the bottom edge</StateLabel>
              <div className="h-[420px] max-w-[560px] overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
                <PaneShell
                  header={<PaneHeader eventName="Survey" outcome="Closed" subjectName="Maya" />}
                  footer={
                    <PaneActions
                      primary={{ href: "#", label: "Open the survey history" }}
                      secondary={[{ label: "Copy link", onClick: () => {} }]}
                    />
                  }
                >
                  <PaneSection>
                    <MetadataList
                      items={[
                        { label: "Instrument", value: "GAD-7" },
                        { label: "Completed", value: "Aug 26, 2026" },
                      ]}
                    />
                  </PaneSection>
                </PaneShell>
              </div>
            </div>
          </div>
        </Panel>

        {/* ═══ THE MENTOR CHAT'S PRIMITIVES ═══
            Here rather than only in the app, because this is where the SQUINT TEST
            actually happens: five activity covers side by side is the only way to
            see whether they are genuinely one format, and four rail panels in a row
            is the only way to see whether their section rhythm matches. Both are
            claims the components make about themselves, and both are invisible one
            at a time inside a 320px rail. */}
        <Panel
          title="Chat · activity covers"
          note="All five, side by side. The claim these make is that they are COMPARABLE — same anatomy, same glyph disc, one metadata format — and five in a row is the only way to check it. The locked one renders in full at reduced emphasis, which is the whole argument against hiding it."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ACTIVITIES.map((def) => (
              <div key={def.id} className="w-full max-w-[320px]">
                <ActivityCover def={def} onSelect={() => {}} />
              </div>
            ))}
            <div className="w-full max-w-[320px]">
              <ActivityCover
                def={ACTIVITIES.find((a) => a.locked)!}
                locked
                progress="1 of 2 answered"
              />
            </div>
            <div className="w-full max-w-[320px]">
              <ActivityCover
                def={ACTIVITIES[0]}
                variant="detail"
                onSelect={() => {}}
              />
            </div>
          </div>
        </Panel>

        <Panel
          title="Chat · rail panels"
          note="Four panels at their real 320px width. They hold genuinely different content — a suggestion, a canvas, a shelf, a log — and the reason they share one shell is that built separately they would end up with four paddings and four ideas of how a heading relates to what is under it."
        >
          <div className="flex flex-wrap gap-4">
            {[
              {
                label: "Assist",
                body: (
                  <AssistPanel
                    input={GALLERY_ASSIST}
                    onOpenToolkit={() => {}}
                  />
                ),
              },
              {
                label: "Profile",
                body: (
                  <ProfilePanel thread={GALLERY_THREAD} />
                ),
              },
              {
                label: "Toolkit",
                body: <ToolkitPanel artifacts={[]} onSendActivity={() => {}} />,
              },
              {
                label: "Timeline · empty",
                body: (
                  <TimelinePanel
                    events={[]}
                    notes={[]}
                    now={GALLERY_NOW}
                    theirName="Caleb"
                    onNewNote={() => {}}
                    onOpenNote={() => {}}
                    rescindedArtifactIds={new Set()}
                  />
                ),
              },
            ].map((p) => (
              <div key={p.label} className="w-[320px]">
                <p className="mb-2 text-[12px] leading-[16px] text-[var(--text-muted)]">
                  {p.label}
                </p>
                <div className="h-[440px] overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
                  <PanelShell>{p.body}</PanelShell>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Chat · status banner"
          note="Three tones from one component. Escalation is its first tenant and not its shape — the next thread-level state should not need a second banner that starts identical. The primary's fill is a per-tone token pair, because `bg-current` beside a `text-*` on the same element resolves to the button's own colour and renders it invisible."
        >
          <div className="space-y-3">
            {(["critical", "attention", "neutral"] as const).map((tone) => (
              <div
                key={tone}
                className="overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)]"
              >
                <StatusBanner
                  tone={tone}
                  glyph={ShieldAlert}
                  title={
                    tone === "critical"
                      ? "Escalation open"
                      : tone === "attention"
                        ? "Mentorship paused"
                        : "Re-match in progress"
                  }
                  meta="Supervisor notified 4:12 PM · opened 4:08 PM"
                >
                  <BannerButton tone={tone} primary>
                    Emergency info
                  </BannerButton>
                  <BannerButton tone={tone}>Checklist</BannerButton>
                  <BannerButton tone={tone}>Resolve</BannerButton>
                </StatusBanner>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Chat · event chips"
          note="All six kinds, inline and as Timeline rows, from one component reading one record. Only escalation is tinted; a retracted send is struck through rather than dimmed, because every untinted chip is already muted ink."
        >
          <div className="flex flex-wrap gap-8">
            <div className="w-[420px] rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-3">
              <p className="mb-2 text-[12px] leading-[16px] text-[var(--text-muted)]">
                Inline, in a transcript
              </p>
              <ul>
                {GALLERY_EVENTS.map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    actorName={e.actorId === "live" ? "You" : "Caleb"}
                    retracted={e.kind === "activity-sent" && e.id === "g2"}
                    onOpen={() => {}}
                  />
                ))}
              </ul>
            </div>
            <div className="w-[320px] rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3 py-3">
              <p className="mb-2 text-[12px] leading-[16px] text-[var(--text-muted)]">
                As Timeline rows
              </p>
              <div className="space-y-1.5">
                {GALLERY_EVENTS.map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    variant="row"
                    actorName={e.actorId === "live" ? "You" : "Caleb"}
                    retracted={e.kind === "activity-sent" && e.id === "g2"}
                    onOpen={() => {}}
                  />
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Chat · media frames"
          note="Each frame is sized from the record's own dimensions before any bytes arrive — which is why there is no spinner. The three below are a phone portrait, a GIF and a square; nothing about them moves when an image resolves, because nothing was ever the wrong size."
        >
          <div className="flex flex-wrap items-end gap-4">
            {[
              { w: 1200, h: 1600, alt: "A cat asleep on a stack of textbooks" },
              { w: 480, h: 270, alt: "An animated thumbs up" },
              { w: 900, h: 900, alt: "Tomatoes on a windowsill" },
            ].map((media) => (
              <MediaFrame key={media.alt} media={media} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
