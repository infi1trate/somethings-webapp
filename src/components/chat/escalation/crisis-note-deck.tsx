"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CRISIS NOTE DECK (pack v11.0 §6) — the supervisor's
//
// ═══ SUPERSEDES (Supersession 5) ═══ `CrisisNoteAccordion` (pack v6.1) is
// deleted, not orphaned. The note adopts `GuidedAssessment`'s shell, with one
// adaptation: a card holds a SECTION, not a single question. A supervisor who
// has read one deck can read the other.
//
//   SHELL      one active card at a time; recorded and pending sections are
//              collapsed, numbered rows above and below it, each showing its
//              recorded summary ("Suicidal ideation · Housing") or "—".
//   CARD       the section's full controls at once — single-select, optional
//              tag chips, free text where the section asks for it. Nothing
//              nested or revealed inside a card.
//   ADVANCE    EXPLICIT. "Record section" commits the section to the draft
//              and opens the next unrecorded one. Never on a selection: a
//              section has optional controls after its primary one, and
//              advancing on the radio would strand the tags.
//   EDIT       tap any collapsed row: it opens with its recorded values
//              intact and editable. Recorded values are never discarded.
//   PROGRESS   "{n} of {N} sections recorded", and "Draft saved {time}".
//   SUBMIT     ATOMIC — one "Submit crisis note", always enabled; pressed
//              with gaps it names them and opens the first. The draft
//              (`lib/tiering/crisis-draft.ts`) survives navigation, a tab
//              switch and a reload until then.
//
// ═══ BLOCKED CONSTANT (Dr. Nissan) ═══ Which sections are REQUIRED is not
// yet decided; until it is, every section is required (`noteRows`).

import { useId, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { CrisisNote, EscalationState } from "@/lib/chat/types";
import { REFERRAL_TYPE } from "@/lib/record/people-demo";
import {
  CLINICAL_SUBTYPES,
  CRISIS_TAGS,
  EMERGENCY_SERVICES,
  OUTCOMES,
  SAFETY_PLAN_STATUS,
  autoOutcome,
  draftDebrief,
  sectionDone,
  type CrisisSectionId,
} from "@/lib/tiering/escalation";
import { NOTE_ROW_LABEL, noteRows, rowDone, rowSummary, type NoteRowId } from "@/lib/tiering/note-rows";
import { clearCrisisDraft, recordCrisisRow, useCrisisDraft, type CrisisDraft } from "@/lib/tiering/crisis-draft";
import type { Tiering } from "@/lib/tiering/use-tiering";
import type { Tier } from "@/lib/tiering/tiers";
import { BODY, Chips, Choice, Field, LABEL, OVERLINE, Primary, RING, YesNo } from "@/components/chat/escalation/controls";
import { cn } from "@/lib/utils";

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const isSection = (id: NoteRowId): id is CrisisSectionId => id !== "outcome" && id !== "debrief";

/** A draft from what the store already holds — a record that predates the
 *  atomic submit (a fixture's section, a v6.1 save) counts as recorded, at
 *  its own time; nothing is discarded. */
function seedDraft(e: EscalationState, tier: Tier): CrisisDraft {
  const recorded: CrisisDraft["recorded"] = {};
  for (const id of noteRows(tier)) {
    if (!rowDone(e, id)) continue;
    recorded[id] = isSection(id) ? (e.crisisNote?.sectionAt?.[id] ?? e.crisisNote?.updatedAt ?? e.openedAt) : id === "outcome" ? (e.outcome?.chosenAt ?? e.outcome?.savedAt ?? e.openedAt) : (e.outcome?.savedAt ?? e.openedAt);
  }
  /* The stamps are the store's; the draft carries the answers alone. */
  const note: CrisisNote = { ...e.crisisNote };
  delete note.sectionAt;
  delete note.updatedAt;
  return {
    note,
    outcome: e.outcome?.id && recorded.outcome !== undefined ? { id: e.outcome.id, autoTagged: e.outcome.autoTagged, basis: e.outcome.basis ?? null, chosenAt: recorded.outcome } : null,
    debrief: recorded.debrief !== undefined && e.outcome ? { debrief: e.outcome.debrief, debriefIsDraft: e.outcome.debriefIsDraft, plan: e.outcome.plan, additional: e.outcome.additional } : null,
    recorded,
    savedAt: 0,
  };
}

/** The draft as an escalation, so the shared summaries read it. */
const asEscalation = (e: EscalationState, d: CrisisDraft): EscalationState => ({
  ...e,
  crisisNote: d.note,
  outcome: d.outcome ? { ...d.outcome, debrief: d.debrief?.debrief ?? "", debriefIsDraft: d.debrief?.debriefIsDraft ?? false, plan: d.debrief?.plan ?? "", additional: d.debrief?.additional ?? "", savedAt: d.recorded.debrief ?? null } : undefined,
});

export function CrisisNoteDeck({
  e,
  tier,
  name,
  tiering,
  teenId,
  teenLines,
  mentorLines,
  readOnly = false,
}: {
  e: EscalationState;
  tier: Tier;
  name: string;
  tiering: Tiering;
  teenId: string;
  teenLines: string[];
  mentorLines: string[];
  /** Submitted, or the escalation closed: the record, read-only. */
  readOnly?: boolean;
}) {
  const rows = noteRows(tier);
  const stored = useCrisisDraft(e.id);
  const draft = stored ?? seedDraft(e, tier);
  const v = asEscalation(e, draft);
  const done = (id: NoteRowId) => draft.recorded[id] !== undefined;
  const firstOpen = rows.find((r) => !done(r)) ?? null;
  const [picked, setPicked] = useState<NoteRowId | null>(null);
  const active = readOnly ? null : (picked ?? firstOpen);
  const [announce, setAnnounce] = useState("");
  const [missing, setMissing] = useState<NoteRowId[]>([]);
  const uid = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const recordedCount = rows.filter(done).length;

  const focusRow = (id: NoteRowId) =>
    window.requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-deck-card="${id}"] [role="radio"], [data-deck-card="${id}"] button, [data-deck-card="${id}"] textarea`)?.focus());

  const record = (id: NoteRowId, patch: Partial<Pick<CrisisDraft, "note" | "outcome" | "debrief">>) => {
    const next = recordCrisisRow(e.id, draft, id, patch);
    setMissing((m) => m.filter((x) => x !== id));
    setPicked(null);
    const after = rows.find((r) => next.recorded[r] === undefined) ?? null;
    /* TODO-COPY */
    setAnnounce(`${NOTE_ROW_LABEL[id]} recorded · ${rows.filter((r) => next.recorded[r] !== undefined).length} of ${rows.length} sections recorded`);
    if (after) focusRow(after);
  };

  const submit = () => {
    const gaps = rows.filter((r) => !done(r));
    if (gaps.length) {
      setMissing(gaps);
      setPicked(gaps[0]);
      focusRow(gaps[0]);
      return;
    }
    if (tiering.submitCrisisNote(teenId, draft)) {
      clearCrisisDraft(e.id);
      /* TODO-COPY */
      setAnnounce("Crisis note submitted. It is in the record.");
    }
  };

  return (
    <div data-crisis-deck data-deck-readonly={readOnly || undefined} className="space-y-3">
      <p data-deck-live role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {!readOnly && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p data-deck-progress className="m-0 tabular-nums text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            {recordedCount} of {rows.length} sections recorded
          </p>
          {stored && stored.savedAt > 0 && (
            <p data-deck-saved className="m-0 tabular-nums text-[var(--text-muted)]" style={LABEL}>
              {/* TODO-COPY */}
              Draft saved {TIME.format(stored.savedAt)}
            </p>
          )}
        </div>
      )}
      <ol ref={listRef} data-deck-rows className="space-y-1">
        {rows.map((id, i) => {
          const isActive = active === id;
          const summary = done(id) ? rowSummary(v, id) : "";
          if (isActive) {
            return (
              <li key={id} data-deck-row={id} data-deck-state="active">
                <section
                  data-deck-card={id}
                  aria-labelledby={`${uid}-${id}`}
                  /* The same emphasis as the assessment's focused card: a 2px
                     ink border, never a raised shadow (the timeline node stays
                     the only element raised AND ringed). */
                  className="q-swap space-y-3 rounded-[var(--radius-inset)] border-2 border-[color:var(--text-primary)] bg-[var(--surface-raised)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn(OVERLINE, "tabular-nums text-[var(--text-muted)]")}>
                      {/* TODO-COPY */}
                      Section {i + 1} of {rows.length}
                    </p>
                    {done(id) && (
                      <span className="rounded-full bg-[var(--surface-s2)] px-2 py-0.5 text-[var(--text-secondary)]" style={LABEL}>
                        {/* TODO-COPY */}
                        Recorded
                      </span>
                    )}
                  </div>
                  <h4 id={`${uid}-${id}`} className="m-0 text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
                    {NOTE_ROW_LABEL[id]}
                  </h4>
                  {isSection(id) ? (
                    <SectionForm key={`${id}:${draft.recorded[id] ?? 0}`} id={id} note={draft.note} onRecord={(p) => record(id, { note: { ...draft.note, ...p } })} />
                  ) : id === "outcome" ? (
                    <OutcomeForm note={draft.note} saved={draft.outcome?.id ?? null} onRecord={(oid, basis) => record("outcome", { outcome: { id: oid, autoTagged: oid === basis, basis, chosenAt: 0 } })} />
                  ) : (
                    <DebriefForm e={e} saved={draft.debrief} name={name} teenLines={teenLines} mentorLines={mentorLines} onRecord={(d) => record("debrief", { debrief: d })} />
                  )}
                </section>
              </li>
            );
          }
          const body = (
            <>
              <span aria-hidden className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--surface-s2)] font-mono text-[10px] leading-none text-[var(--text-secondary)]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[var(--text-primary)]" style={BODY}>
                  {NOTE_ROW_LABEL[id]}
                </span>
                <span data-deck-summary className={cn("block break-words", done(id) ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]")} style={LABEL}>
                  {done(id) ? (
                    summary
                  ) : (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">Not recorded yet</span>
                    </>
                  )}
                </span>
                {missing.includes(id) && (
                  <span role="alert" data-deck-missing className="block text-[var(--state-error)]" style={LABEL}>
                    {/* TODO-COPY */}
                    Record this section before submitting.
                  </span>
                )}
              </span>
            </>
          );
          const row = "flex w-full items-start gap-2.5 rounded-[var(--radius-inset)] px-2 py-2 text-left";
          return (
            <li key={id} data-deck-row={id} data-deck-state={done(id) ? "recorded" : "pending"}>
              {readOnly ? (
                <div className={row}>
                  {body}
                </div>
              ) : (
                <button type="button" data-deck-open={id} onClick={() => setPicked(id)} className={cn(row, "hover:bg-[var(--tint-hover)]", RING)}>
                  {body}
                </button>
              )}
              {readOnly && <ReadExtra e={e} id={id} />}
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <>
          {missing.length > 0 && (
            <p role="alert" data-deck-error className="text-[var(--state-error)]" style={LABEL}>
              {/* TODO-COPY */}
              {missing.length === 1 ? `Record ${NOTE_ROW_LABEL[missing[0]]} to submit.` : `Record ${missing.length} more sections to submit.`}
            </p>
          )}
          <Primary slot="submit-crisis-note" onClick={submit}>
            {/* TODO-COPY */}
            Submit crisis note
          </Primary>
        </>
      )}
    </div>
  );
}

/** "Record section" — OUTLINE: the one filled button in this state is
 *  Submit crisis note. */
function RecordButton({ slot, onClick }: { slot: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-record-section={slot}
      onClick={onClick}
      className={cn("inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-raised)] px-4 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
      style={{ font: "var(--type-button)" }}
    >
      {/* TODO-COPY */}
      Record section
    </button>
  );
}

/** A section's controls, all visible at once — v6.1's forms, unchanged in
 *  content, now committing to the draft. */
function SectionForm({ id, note, onRecord }: { id: CrisisSectionId; note: CrisisNote; onRecord: (patch: Partial<CrisisNote>) => void }) {
  const [local, setLocal] = useState<CrisisNote>({});
  const d = { ...note, ...local };
  const set = (patch: Partial<CrisisNote>) => setLocal((x) => ({ ...x, ...patch }));
  const [tried, setTried] = useState(false);
  return (
    <div data-crisis-section={id} className="space-y-3">
      {id === "subtype" && (
        <>
          <Choice label="Clinical subtype" slot="subtype" options={CLINICAL_SUBTYPES} value={d.subtype as never} onChange={(v) => set({ subtype: v })} />
          <div>
            <p className="mb-1.5 text-[var(--text-muted)]" style={LABEL}>Additional tags (optional)</p>
            <Chips label="Additional tags" options={CRISIS_TAGS} value={(d.tags ?? []) as never[]} onChange={(v) => set({ tags: v })} />
          </div>
        </>
      )}
      {id === "safety-plan" && (
        <>
          <Choice label="Safety plan" slot="safety-plan" options={SAFETY_PLAN_STATUS} value={d.safetyPlan?.status as never} onChange={(v) => set({ safetyPlan: { status: v, usage: d.safetyPlan?.usage ?? "" } })} />
          <Field slot="safety-usage" label="How they'll use it" value={d.safetyPlan?.usage ?? ""} onChange={(v) => set({ safetyPlan: { status: d.safetyPlan?.status ?? "", usage: v } })} />
        </>
      )}
      {id === "resources" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Resources shared?</span>
            <YesNo label="Resources shared" slot="resources" value={d.resources?.shared} onChange={(v) => set({ resources: { shared: v, list: d.resources?.list ?? "" } })} />
          </div>
          {d.resources?.shared && <Field slot="resources-list" label="Which resources" value={d.resources.list} onChange={(v) => set({ resources: { shared: true, list: v } })} invalid={tried && !d.resources.list.trim()} />}
        </>
      )}
      {id === "referral" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Referral made?</span>
            <YesNo label="Referral made" slot="referral" value={d.referral?.made} onChange={(v) => set({ referral: { made: v, list: d.referral?.list ?? [] } })} />
          </div>
          {d.referral?.made && <Chips label="Referred to" options={REFERRAL_TYPE} value={d.referral.list as never[]} onChange={(v) => set({ referral: { made: true, list: v } })} />}
        </>
      )}
      {id === "emergency" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Emergency contact engaged?</span>
            <YesNo label="Emergency contact engaged" slot="contact" value={d.contact?.engaged} onChange={(v) => set({ contact: { engaged: v, details: d.contact?.details ?? "" } })} />
          </div>
          {d.contact?.engaged && <Field slot="contact-details" label="Who, and how" value={d.contact.details} onChange={(v) => set({ contact: { engaged: true, details: v } })} invalid={tried && !d.contact.details.trim()} />}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Emergency services contacted?</span>
            <YesNo label="Emergency services contacted" slot="services" value={d.services?.contacted} onChange={(v) => set({ services: { contacted: v, which: d.services?.which ?? [] } })} />
          </div>
          {d.services?.contacted && <Chips label="Which services" options={EMERGENCY_SERVICES} value={d.services.which as never[]} onChange={(v) => set({ services: { contacted: true, which: v } })} />}
        </>
      )}
      {tried && !sectionDone(d, id) && (
        <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
          {/* TODO-COPY */}
          Answer this section to record it.
        </p>
      )}
      <RecordButton
        slot={id}
        onClick={() => {
          setTried(true);
          if (sectionDone(d, id)) onRecord(local);
        }}
      />
    </div>
  );
}

/** ═══ OUTCOME — its suggestion live ═══ `autoOutcome` reads the draft's
 *  note as it is NOW: change a Referral or Emergency-services answer and the
 *  suggestion follows. A recorded outcome is never rewritten by it. */
function OutcomeForm({ note, saved, onRecord }: { note: CrisisNote; saved: string | null; onRecord: (id: string, basis: string | null) => void }) {
  const auto = autoOutcome(note);
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked ?? saved ?? auto;
  const [tried, setTried] = useState(false);
  return (
    <div data-s3 className="space-y-3">
      {auto && id === auto && (
        <span data-auto-tagged className="inline-flex rounded-full bg-[var(--surface-s2)] px-2 py-0.5 text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          Suggested from the crisis note
        </span>
      )}
      <Choice label="Outcome" slot="outcome" options={OUTCOMES} value={id as never} onChange={(v) => setPicked(v)} />
      {tried && !id && (
        <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
          {/* TODO-COPY */}
          Choose an outcome to record it.
        </p>
      )}
      <RecordButton
        slot="outcome"
        onClick={() => {
          setTried(true);
          if (id) onRecord(id, auto);
        }}
      />
    </div>
  );
}

function DebriefForm({ e, saved, name, teenLines, mentorLines, onRecord }: { e: EscalationState; saved: CrisisDraft["debrief"]; name: string; teenLines: string[]; mentorLines: string[]; onRecord: (input: NonNullable<CrisisDraft["debrief"]>) => void }) {
  const ai = draftDebrief({ name, escalation: e, teenLines, mentorLines });
  const [debrief, setDebrief] = useState(saved?.debrief || ai);
  const [plan, setPlan] = useState(saved?.plan ?? "");
  const [additional, setAdditional] = useState(saved?.additional ?? "");
  const [tried, setTried] = useState(false);
  const isDraft = debrief === ai;
  return (
    <div data-s3 className="space-y-4">
      <div>
        {isDraft && (
          /* ═══ CLEARLY A DRAFT ═══ Fake AI (answered 2026-10-21) — see
             `draftDebrief`. It drafts the narrative only. */
          <span data-ai-draft className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border-default)] px-2 py-0.5 text-[var(--text-secondary)]" style={LABEL}>
            <Sparkles aria-hidden className="size-3" />
            {/* TODO-COPY */}
            AI draft · edit before saving
          </span>
        )}
        <Field slot="debrief" label="Debrief" value={debrief} onChange={setDebrief} rows={5} invalid={tried && !debrief.trim()} />
      </div>
      <Field slot="plan" label="Plan for continued support" value={plan} onChange={setPlan} invalid={tried && !plan.trim()} />
      <Field slot="additional" label="Additional information (optional)" value={additional} onChange={setAdditional} />
      {tried && (!debrief.trim() || !plan.trim()) && (
        <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
          {/* TODO-COPY */}
          Fill in the debrief and the plan.
        </p>
      )}
      <RecordButton
        slot="debrief"
        onClick={() => {
          setTried(true);
          if (debrief.trim() && plan.trim()) onRecord({ debrief: debrief.trim(), debriefIsDraft: isDraft, plan: plan.trim(), additional: additional.trim() });
        }}
      />
    </div>
  );
}

/** Read-only: a row's longer text under its summary — the safety plan's use,
 *  the contact's details, the debrief and plan. */
function ReadExtra({ e, id }: { e: EscalationState; id: NoteRowId }) {
  const n = e.crisisNote ?? {};
  const extra =
    id === "safety-plan" ? n.safetyPlan?.usage : id === "emergency" && n.contact?.engaged ? n.contact.details : id === "debrief" ? [e.outcome?.debrief, e.outcome?.plan && `Plan: ${e.outcome.plan}`, e.outcome?.additional].filter(Boolean).join("\n\n") : "";
  if (!extra) return null;
  return (
    <p data-note-read className="m-0 pr-2 pb-2 pl-[34px] whitespace-pre-line text-[var(--text-secondary)]" style={LABEL}>
      {extra}
    </p>
  );
}
