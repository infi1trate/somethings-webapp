"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CRISIS NOTE ACCORDION (pack v6.1, Component B) — the supervisor's
//
// ═══ WHY ═══ Crisis information arrives non-linearly — teens volunteer
// answers out of order, and supervisors learn facts before the form asks for
// them. Both documentation surfaces must support guided sequential use and
// random-access capture with equal grace.
//
// ═══ SUPERSEDES (Supersession 2) — A NAMED REVERSAL ═══ v3.0 decided the
// note "assembles as timeline events", one current node per section, then an
// Outcome node and a Debrief node. That is reversed here: the timeline carries
// ONE Crisis note node ("Crisis note · 4 of 7") holding this accordion, and
// it collapses to "Crisis note complete" when every row is done. Traded for
// random access and a quieter timeline.
//
//   ROWS        lib/tiering/note-rows.ts — the chart's sections in order
//               (Emergency for Tier 1 only, never rendered at Tier 2), then
//               Outcome, then Debrief. Close & follow-up stays the timeline's
//               own node: it is the action, not documentation.
//   COMPACT     the label over its one-line summary, or "—" while untouched.
//               A fixed 52px, every state.
//   EXPANDED    the section's existing form, unchanged, with "Save section":
//               it records, collapses (the summary lands in the row a breath
//               before the next opens), and opens the next untouched row
//               top-down. Any row, any order.
//   OUTCOME     its suggestion recomputes live from Referral and Emergency
//               services; a later upstream change marks the saved outcome
//               with a quiet review dot — never a silent edit.
//   AMENDING    any saved row re-opens and saves again, before the close —
//               append-only underneath (`noteAmendments`). After it, read-only.

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
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
import { NOTE_ROW_LABEL, firstUntouched, noteProgress, noteRows, outcomeNeedsReview, rowDone, rowSummary, type NoteRowId } from "@/lib/tiering/note-rows";
import type { Tiering } from "@/lib/tiering/use-tiering";
import type { Tier } from "@/lib/tiering/tiers";
import { BODY, Chips, Choice, Field, LABEL, Primary, RING, YesNo } from "@/components/chat/escalation/controls";
import { cn } from "@/lib/utils";

const BREATH_MS = 180;
const reducedMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce");

const isSection = (id: NoteRowId): id is CrisisSectionId => id !== "outcome" && id !== "debrief";

export function CrisisNoteAccordion({
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
  /** After the close. */
  readOnly?: boolean;
}) {
  const rows = noteRows(tier);
  const [openId, setOpenId] = useState<NoteRowId | null>(readOnly ? null : firstUntouched(e, tier));
  const [announce, setAnnounce] = useState("");
  const uid = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const advanced = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);

  /* ═══ BOUNDED MOVEMENT ═══ — as the assessment: what opens scrolls fully
     into view ("nearest"); an auto-advance moves focus to its first control. */
  useEffect(() => {
    if (!openId) return;
    const panel = listRef.current?.querySelector<HTMLElement>(`[data-note-panel="${openId}"]`);
    panel?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    if (advanced.current) {
      advanced.current = false;
      panel?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], button, textarea')?.focus({ preventScroll: true });
    }
  }, [openId]);

  /** After a save: the record as it now is, so the next row is chosen from
   *  what was recorded, not from the render before it. */
  const saved = (id: NoteRowId, next: EscalationState) => {
    const p = noteProgress(next, tier);
    /* TODO-COPY */
    setAnnounce(`${NOTE_ROW_LABEL[id]} saved · ${p.done} of ${p.total} sections`);
    const target = firstUntouched(next, tier);
    setOpenId(null);
    advanced.current = target !== null;
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (reducedMotion()) setOpenId(target);
    else timer.current = window.setTimeout(() => setOpenId(target), BREATH_MS);
  };

  const saveSection = (id: CrisisSectionId, patch: Partial<CrisisNote>) => {
    tiering.saveCrisisNote(teenId, patch, id);
    saved(id, { ...e, crisisNote: { ...e.crisisNote, ...patch } });
  };
  const saveOutcome = (id: string, basis: ReturnType<typeof autoOutcome>) => {
    tiering.chooseOutcome(teenId, { id, autoTagged: id === basis, basis });
    saved("outcome", { ...e, outcome: { debrief: "", debriefIsDraft: true, plan: "", additional: "", savedAt: null, ...e.outcome, id, autoTagged: id === basis, basis } });
  };
  const saveDebrief = (input: { debrief: string; debriefIsDraft: boolean; plan: string; additional: string }) => {
    tiering.saveDebrief(teenId, input);
    saved("debrief", { ...e, outcome: { id: "", autoTagged: false, ...e.outcome, ...input, savedAt: 1 } });
  };

  return (
    <div data-note-accordion data-note-readonly={readOnly || undefined} className="space-y-2">
      <p data-note-live role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <ol ref={listRef} data-note-rows className="divide-y divide-[color:var(--border-subtle)] overflow-hidden rounded-[var(--radius-inset)] bg-[var(--surface-s1)]">
        {rows.map((id) => {
          const open = openId === id;
          const done = rowDone(e, id);
          const review = id === "outcome" && outcomeNeedsReview(e);
          const head = `${uid}-${id}-h`;
          const panel = `${uid}-${id}-p`;
          /* Read-only, an untouched row has nothing to show. */
          const expandable = !readOnly || done;
          const summary = rowSummary(e, id);
          return (
            <li key={id} data-note-row={id} data-note-state={done ? "complete" : "untouched"} data-note-review={review || undefined} data-note-open={open || undefined}>
              <button
                type="button"
                id={head}
                aria-expanded={expandable ? open : undefined}
                aria-controls={expandable ? panel : undefined}
                disabled={!expandable}
                onClick={() => setOpenId((o) => (o === id ? null : id))}
                className={cn("flex h-[52px] w-full items-center gap-2 px-3 text-left disabled:cursor-default", expandable && "hover:bg-[var(--tint-hover)]", RING)}
              >
                <span className="min-w-0 flex-1">
                  <span data-note-label className="flex items-center gap-1.5 text-[var(--text-primary)]" style={BODY}>
                    <span className="truncate">{NOTE_ROW_LABEL[id]}</span>
                    {review && (
                      /* ═══ THE REVIEW DOT ═══ Quiet and neutral — the note
                         changed under a saved outcome. Not alert colour. */
                      <span data-review-dot className="inline-flex shrink-0 items-center">
                        <span aria-hidden className="size-1.5 rounded-full bg-[var(--text-secondary)]" />
                        <span className="sr-only">, review — the note changed since this was saved</span>
                      </span>
                    )}
                  </span>
                  {/* ═══ ONE LINE, FIXED HEIGHT (the pack's compact row) ═══ A long
                      free-text summary is cut at the row's edge — the one
                      place on this surface that may be: the full text is the
                      title, the row's accessible name, and the open row. */}
                  <span data-note-summary title={done ? summary : undefined} className={cn("block truncate", done ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]")} style={LABEL}>
                    {done ? (
                      summary
                    ) : (
                      <>
                        <span aria-hidden>—</span>
                        <span className="sr-only">, not started</span>
                      </>
                    )}
                  </span>
                </span>
                {expandable && <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 text-[var(--icon-secondary)] transition-transform motion-reduce:transition-none", open && "rotate-180")} />}
              </button>
              {open && expandable && (
                <div id={panel} role="region" aria-labelledby={head} data-note-panel={id} className="scroll-mt-16 scroll-mb-3 bg-[var(--surface-raised)] px-3 pt-1 pb-3">
                  {readOnly ? (
                    <ReadRow e={e} id={id} />
                  ) : isSection(id) ? (
                    <SectionForm key={`${id}:${e.crisisNote?.updatedAt ?? 0}`} id={id} note={e.crisisNote} onSave={(p) => saveSection(id, p)} />
                  ) : id === "outcome" ? (
                    <OutcomeForm e={e} review={review} onSave={saveOutcome} />
                  ) : (
                    <DebriefForm e={e} name={name} teenLines={teenLines} mentorLines={mentorLines} onSave={saveDebrief} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "Save section" — the one filled button while a row is open. */
function SaveSection({ slot, onClick }: { slot: string; onClick: () => void }) {
  return (
    <Primary slot={slot} onClick={onClick}>
      {/* TODO-COPY */}
      Save section
    </Primary>
  );
}

/** ═══ A SECTION'S FORM — unchanged from the per-section cards ═══ */
function SectionForm({ id, note, onSave }: { id: CrisisSectionId; note: CrisisNote | undefined; onSave: (patch: Partial<CrisisNote>) => void }) {
  const [draft, setDraft] = useState<CrisisNote>({});
  const d = { ...note, ...draft };
  const set = (patch: Partial<CrisisNote>) => setDraft((x) => ({ ...x, ...patch }));
  const [tried, setTried] = useState(false);
  return (
    <div data-crisis-section={id} className="space-y-3 pt-2">
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
          Answer this section to save it.
        </p>
      )}
      <SaveSection
        slot={`save-section:${id}`}
        onClick={() => {
          setTried(true);
          if (sectionDone(d, id)) onSave(d);
        }}
      />
    </div>
  );
}

/** ═══ OUTCOME — its suggestion live ═══ `autoOutcome` reads the note as it
 *  is NOW, every render: change a Referral or Emergency-services answer and
 *  the suggestion follows. A saved outcome is never rewritten by it. */
function OutcomeForm({ e, review, onSave }: { e: EscalationState; review: boolean; onSave: (id: string, basis: ReturnType<typeof autoOutcome>) => void }) {
  const auto = autoOutcome(e.crisisNote);
  const saved = e.outcome?.id && OUTCOMES.some((o) => o.id === e.outcome!.id) ? e.outcome.id : null;
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked ?? saved ?? auto;
  const [tried, setTried] = useState(false);
  const autoLabel = OUTCOMES.find((o) => o.id === auto)?.label;
  return (
    <div data-s3 className="space-y-3 pt-2">
      {review && (
        <p data-outcome-review className="text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          The note changed since you saved this.{autoLabel ? ` It now suggests: ${autoLabel}.` : " It no longer suggests an outcome."}
        </p>
      )}
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
          Choose an outcome to save it.
        </p>
      )}
      <SaveSection
        slot="save-section:outcome"
        onClick={() => {
          setTried(true);
          if (id) onSave(id, auto);
        }}
      />
    </div>
  );
}

function DebriefForm({ e, name, teenLines, mentorLines, onSave }: { e: EscalationState; name: string; teenLines: string[]; mentorLines: string[]; onSave: (input: { debrief: string; debriefIsDraft: boolean; plan: string; additional: string }) => void }) {
  const draft = draftDebrief({ name, escalation: e, teenLines, mentorLines });
  const [debrief, setDebrief] = useState(e.outcome?.debrief || draft);
  const [plan, setPlan] = useState(e.outcome?.plan ?? "");
  const [additional, setAdditional] = useState(e.outcome?.additional ?? "");
  const [tried, setTried] = useState(false);
  const isDraft = debrief === draft;
  return (
    <div data-s3 className="space-y-4 pt-2">
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
      <SaveSection
        slot="save-section:debrief"
        onClick={() => {
          setTried(true);
          if (debrief.trim() && plan.trim()) onSave({ debrief: debrief.trim(), debriefIsDraft: isDraft, plan: plan.trim(), additional: additional.trim() });
        }}
      />
    </div>
  );
}

/** Read-only, after the close: the row's record in full. */
function ReadRow({ e, id }: { e: EscalationState; id: NoteRowId }) {
  const n = e.crisisNote ?? {};
  const extra =
    id === "safety-plan" ? n.safetyPlan?.usage : id === "emergency" && n.contact?.engaged ? n.contact.details : id === "debrief" ? [e.outcome?.debrief, e.outcome?.plan && `Plan: ${e.outcome.plan}`, e.outcome?.additional].filter(Boolean).join("\n\n") : "";
  return (
    <div data-note-read className="space-y-1 pt-2" style={LABEL}>
      <p className="text-[var(--text-primary)]">{rowSummary(e, id)}</p>
      {extra && <p className="whitespace-pre-line text-[var(--text-secondary)]">{extra}</p>}
    </div>
  );
}
