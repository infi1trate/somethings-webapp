"use client";

// Phase 0 component audit — build-spec §7 ("a /dev/components route renders all
// states"). Dev-only surface: every shared settings component in every state,
// on the real §2 surfaces, for visual + keyboard audit in one place.
// Hover / focus / active are LIVE states — mouse over and Tab through to audit.

import { useState } from "react";
import { SettingsSidebar } from "@/components/settings/sidebar";
import { SettingsTabBar } from "@/components/settings/tab-bar";
import { SectionCard } from "@/components/settings/section-card";
import { EditRow } from "@/components/settings/edit-row";
import { PillButton } from "@/components/settings/pill-button";
import { PhonePreviewShell } from "@/components/settings/phone-preview";
import { SETTINGS_TABS } from "@/components/settings/tabs-config";
import { Input } from "@/components/ui/input";

const SWATCHES: { token: string; value: string; note?: string }[] = [
  { token: "surface/s2", value: "#e5e0d2" },
  { token: "surface/s1 · s0", value: "#f6f4ef" },
  { token: "border/border-subtle", value: "#dfddd8" },
  { token: "text/primary", value: "#1f1e1d" },
  { token: "text/secondary", value: "#58534b" },
  { token: "text/tertiary", value: "#a0998d", note: "⚠ 2.57:1 — decorative only" },
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
  const [mentorTab, setMentorTab] = useState("matching");
  const [adminTab, setAdminTab] = useState("permissions");
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
            <div className="h-[640px] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)]">
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
              <StateLabel>role = admin ({SETTINGS_TABS.length} tabs — adds Roles &amp; permissions)</StateLabel>
              <SettingsTabBar role="admin" activeId={adminTab} onChange={setAdminTab} />
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
      </div>
    </div>
  );
}
