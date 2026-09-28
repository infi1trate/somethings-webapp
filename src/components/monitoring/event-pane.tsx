"use client";

// ═══ THE REVIEW PANE ═══
//
// ═══ THE CONTROL THIS REPLACES WAS THE DEFECT ═══
//
// "Was this flagged correctly?  No | Yes", with Yes styled primary. One question
// standing in for two unrelated judgments — whether the classifier was right,
// and what should happen to the teen — and on a self-harm-language flag it was a
// one-tap path to closure that recorded no clinical judgment at all.
//
// Two axes now. The clinical disposition is required and is the only thing that
// can close an event. Classifier accuracy is optional, never primary, never
// pre-selected, and resolves nothing.
//
// NEITHER AXIS USES A DISABLED BUTTON. A disabled control announces nothing,
// gives no reason, and in this codebase is already recorded as unreliably
// reachable for keyboard users. Resolving without a disposition surfaces inline
// guidance AT the control instead — not a toast, which would be gone before a
// reader looked back at the thing it was about.

import { riskCategoryLabel } from "@/lib/record/risk-taxonomy";
import { playbookMatchFor } from "@/lib/monitoring/surfacing";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";
import { ConversationExcerpt } from "@/components/tasks/conversation-excerpt";
import { CONTEXT_BEFORE, OLDER_PAGE } from "@/lib/tasks/conversation";
import { EscalationNoteModule } from "@/components/record/escalation-note-module";
import {
  EscalationTimeline,
  type ConversationSource,
} from "@/components/monitoring/escalation-timeline";
import { assembleTimeline, type TimelineEntry } from "@/lib/monitoring/timeline";
import { manualFixturesFor, timelineSourcesFor } from "@/lib/monitoring/timeline-fixtures";
import { BreachChip } from "@/components/tasks/chips";
import { elapsedLabel } from "@/components/tasks/strips";

/* `RECORD_CTA` WENT WITH THE LINK-OUTS (Phase 10) — see the pane's own note on
   why they could not land. It was lifted verbatim from the retired
   `EscalationCtas` so the geometry would not change with the move; nothing needs
   it now, and the moment a reachable destination exists the treatment comes back
   with the link rather than being remembered. */
import { PANE_LABEL, PaneChip, SystemBlock } from "@/components/ui/evidence-primitives";
import { buildConversation, conversationHref, firstNameOf } from "@/lib/tasks/conversation";
import type { RiskFlagPayload } from "@/lib/tasks/types";
import {
  ACCURACY_VALUES,
  DISPOSITION_REQUIRED_HINT,
  DISPOSITION_VALUES,
  asksAboutClassifier,
  dispositionById,
  type DispositionValue,
} from "@/lib/monitoring/disposition";
import {
  type MonitoringEvent,
} from "@/lib/monitoring/event";
import {
  ackDeadline,
  ackStateFor,
  closeOutOf,
  isActive,
  type EscalationRecord,
  RECORD_LIFECYCLE_LABEL,
  recordLifecycleOf,
} from "@/lib/monitoring/escalation";
import type { CompliancePath } from "@/lib/monitoring/scenarios";
import { ageLabel } from "@/components/monitoring/event-list";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL = PANE_LABEL;

/** ═══ ROLE LABELLING, EVERYWHERE THE TWO NAMES MEET ═══
 *  "Naomi R. to Maria Lopez" is ambiguous about which name is the teen, and the
 *  state where identifying the teen instantly matters most is exactly the state
 *  where the pattern was least clear. NEEDS-COPY-NICOLE on both labels. */
export function RolePair({
  teenName,
  mentorName,
  tone = "default",
}: {
  teenName: string | null;
  mentorName: string;
  tone?: "default" | "onFill";
}) {
  /* ═══ NO OPACITY ON THE FILL ═══
     `opacity-80` on white over the escalation red measured 4.2:1 and axe caught
     it. The role label is already distinguished by size, case and tracking, so
     it does not need to be dimmer — and on the one saturated treatment on the
     page, dimmer was the wrong direction anyway. */
  const muted = tone === "onFill" ? "" : "text-[var(--text-secondary)]";
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      {teenName && (
        <span className="inline-flex items-baseline gap-1">
          <span className={cn("text-[11px] uppercase tracking-wide", muted)}>Teen</span>
          <span className="text-[14px] font-semibold leading-[20px]">{teenName}</span>
        </span>
      )}
      <span className="inline-flex items-baseline gap-1">
        <span className={cn("text-[11px] uppercase tracking-wide", muted)}>Mentor</span>
        <span className="text-[14px] leading-[20px]">{mentorName}</span>
      </span>
    </span>
  );
}

// ── Compliance paths ────────────────────────────────────────────────────────
// SPECIFIED ONLY AS FIXTURE LINES, so what ships is the posture each line names
// and nothing more. Both are reported as under-specified.

function ExplicitMedia() {
  const [revealed, setRevealed] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);
  return (
    <div>
      <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Attached media</p>
      <div className="mt-2 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3">
        {revealed ? (
          <>
            {/* NO DOWNLOAD AFFORDANCE, AND NO <img>. There is no media in this
                prototype; a placeholder that could be saved would be a saveable
                copy of evidence on a compliance path that exists to prevent
                exactly that. */}
            <div
              aria-label="Revealed media placeholder"
              role="img"
              className="flex h-28 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-s2)] text-[12px] text-[var(--text-secondary)]"
            >
              {/* NEEDS-COPY-NICOLE */}
              Media shown here. Do not download, screenshot or forward.
            </div>
            <p className="mt-2 text-[11.5px] leading-[16px] text-[var(--text-secondary)]">
              {/* NEEDS-COPY-NICOLE. THE LOG ENTRY IS SHOWN BACK, because "this is
                  logged" is only a deterrent if the reader sees the entry. */}
              Logged: you opened this at {logged}.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-primary)]">
              <EyeOff className="size-4 shrink-0" aria-hidden />
              {/* NEEDS-COPY-NICOLE */}
              Explicit media withheld
            </span>
            <button
              type="button"
              onClick={() => {
                setLogged(
                  new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                );
                setRevealed(true);
              }}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] font-semibold text-[var(--text-primary)]",
                "hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {/* NEEDS-COPY-NICOLE. The button says the consequence, so the
                  reveal is a decision rather than a click. */}
              Reveal — this is logged
            </button>
          </div>
        )}
      </div>
      <ul className="mt-2 space-y-1 text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {/* NEEDS-COPY-NICOLE, all four. The checklist is SURFACED, not
            interactive: nothing here can record a filing, and a tickbox that
            recorded nothing would be worse than a list that states the steps. */}
        <li>· Preserve the conversation — do not delete or edit</li>
        <li>· Report to Clinical Ops within the shift</li>
        <li>· Note the disclosure in the teen&apos;s record</li>
        <li>· Do not forward the media outside this system</li>
      </ul>
    </div>
  );
}

function SuspectedDeath() {
  return (
    <div>
      <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Suspected death — required sequence</p>
      <ol className="mt-2 space-y-2 text-[13px] leading-[19px] text-[var(--text-primary)]">
        {/* NEEDS-COPY-NICOLE, all four. Ordered and un-tickable for the same
            reason as above: this surface cannot record any of these, and the
            sequence is the thing a supervisor needs on screen. */}
        <li>1 · Attempt verification — caregiver contact, then emergency services</li>
        <li>2 · Alert Clinical Ops immediately, whatever verification returns</li>
        <li>3 · Document the attempt, the time and who was reached</li>
        <li>4 · Deactivation is Clinical Ops&apos; call, not this surface&apos;s</li>
      </ol>
      <p className="mt-2 text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {/* NEEDS-COPY-NICOLE */}
        Nothing here closes the record. The mentor should not be asked to verify.
      </p>
    </div>
  );
}

// ── Bodies ──────────────────────────────────────────────────────────────────

function FlagBody({
  event: e,
  now,
  compliance,
  scrollHostRef,
}: {
  event: MonitoringEvent;
  now: number;
  compliance: CompliancePath;
  /** ═══ THE PANE'S OWN SCROLLER (addendum §2.7) ═══
   *  Present when this body IS the pane's contents, which is where the
   *  transcript scrolls continuously. Absent inside a linked-flag disclosure,
   *  where the flag is evidence attached to a record rather than the thing
   *  being reviewed — there it renders as the window it has always been, and
   *  a second continuous transcript inside an escalation would be a third
   *  scroll region wearing a different hat. */
  scrollHostRef?: React.RefObject<HTMLElement | null>;
}) {
  const item = e.flag;
  /** ═══ HOW FAR BACK THE TRANSCRIPT HAS LOADED ═══
   *  Page-local and reset by the pane's key on every change of subject, which
   *  is what stops a reader who scrolled sixty messages into one teen's
   *  history from opening the next flag mid-thread. */
  const [before, setBefore] = useState(CONTEXT_BEFORE);
  if (!item) return null;
  const payload = item.payload as RiskFlagPayload;
  const conversation = buildConversation(item, payload.flaggedExcerpt, now, before);
  const match = playbookMatchFor(payload);
  const byClassifier = asksAboutClassifier(payload.reportedBy);
  return (
    <div className="space-y-4">
      {/* ═══ ONE BLOCK, ABOVE THE CONVERSATION (Phase 5, from arch-H H7) ═══
          `Category` and `Why this was flagged` were two blocks with a
          ninety-message transcript between them. They are the same statement in
          two registers — the chips are WHAT matched, the paragraph is WHY — and
          read apart the chips are a label with no argument and the paragraph is
          an argument whose subject scrolled off the top.
          THE CLAIM COMES BEFORE THE EVIDENCE, which is not a reversal of the
          escalation pane's rule that a judgment pane leads with its evidence:
          there the alternative was a timeline, a second body of comparable
          length answering its own question. This is two chips and a paragraph
          stating what the transcript is being read AGAINST, and a supervisor who
          scrolls ninety messages before learning what was matched is reading
          without a question. */}
      <div data-anno-ref="flag-playbook-match">
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Playbook match</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {/* KEYED ON THE ID, LABELLED FROM THE PLAYBOOK. The key has to stay
              the id — two categories can share neither an id nor a label, but a
              label is the one a copy change could collide. */}
          {match.categories.map((c) => (
            <PaneChip key={c}>{riskCategoryLabel(c)}</PaneChip>
          ))}
          {/* ═══ THE SOURCE ONLY WHEN IT SAYS SOMETHING ═══
              `sourceType` is "Message" on every flag in the system, so
              `playbookMatchFor` nulls it out. As a chip beside the categories it
              appears the day a flag arrives from a video note or a journal
              entry — where a reader is already looking for what makes this flag
              different — and costs nothing until then. */}
          {match.sourceType && <PaneChip>{match.sourceType}</PaneChip>}
        </div>
        <div className="mt-2">
          {/* ═══ TWO ATTRIBUTIONS, AND NOT THE SAME ONE TWICE ═══
              The eyebrow above says `Playbook match` and this badge says
              `Classifier rationale`. The categories are a published clinical
              taxonomy; the paragraph is machine-written. Collapsing it either
              way loses something real — "Playbook match" over the prose would
              dress generated text as clinical authorship, and "AI rationale"
              over the chips would hand the taxonomy to the model. */}
          {/* ═══ THE LABEL NAMES THE AUTHOR, AND SOMETIMES IT IS A PERSON ═══
              NEEDS-COPY-NICOLE. A user-reported flag's prose was written by a
              mentor, and `SystemBlock`'s whole job is marking text as
              machine-written. Putting a human's report under "Classifier
              rationale" — inside a block that says "generated" — is the
              provenance error this surface exists to prevent, told backwards.
              THE PLAYBOOK MATCH ABOVE IS UNCHANGED: the categories are a
              published clinical taxonomy either way, and who noticed the
              message does not change which category it falls under. */}
          {byClassifier ? (
            <SystemBlock label="Classifier rationale">{match.rationale}</SystemBlock>
          ) : (
            <div className="rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                {/* NEEDS-COPY-NICOLE */}
                Reported by a person
              </p>
              <p className="mt-1 text-[13px] leading-[19px] text-[var(--text-primary)]">
                {match.rationale}
              </p>
            </div>
          )}
        </div>
        {/* NO CONFIDENCE INDICATOR AND NO EVIDENCE CHIPS. `match.confidence` is
            null and `match.features` is empty, and both are declared absences
            rather than missing fields — see `FLAG_CONFIDENCE_PUBLISHED` and
            `FLAG_EVIDENCE_FEATURES_PUBLISHED`. Nothing is parsed out of the
            prose, which would be a claim about what the model weighed. */}
      </div>

      {compliance === "explicit-media" && <ExplicitMedia />}
      {compliance === "suspected-death" && <SuspectedDeath />}

      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Conversation</p>
        <div className="mt-2">
          {/* ═══ THE TRANSCRIPT IS THE PANE'S SCROLL REGION (§2.7) ═══
              `scroll={false}` so the excerpt adds no overflow of its own, and
              `hostRef` so it anchors, observes and loads against the pane's
              scroller instead. That is the reconciliation locked decision 4
              needs: two regions on the page — the list and the pane — with
              the pane's being the transcript itself, and nothing nested. */}
          <ConversationExcerpt
            conversation={conversation}
            teenName={firstNameOf(item.teenDisplayName)}
            href={conversationHref(item.teenId, conversation.anchorId)}
            scroll={false}
            hostRef={scrollHostRef}
            onNeedOlder={
              scrollHostRef && conversation.truncatedStart
                ? () => setBefore((n) => n + OLDER_PAGE)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

/** ═══ THE ESCALATION BODY — ONE OBJECT, TWO CLOCKS, FOUR OBLIGATIONS ═══
 *  Read-only (locked decision 3): nothing here mutates the escalation, and the
 *  close-out items link to where the work actually happens rather than offering
 *  a tickbox that would let a supervisor mark paperwork done from a list. */
function EscalationBody({
  rec,
  now,
  events,
  compliance,
  onLinkFlag,
}: {
  rec: EscalationRecord;
  now: number;
  /** The surface's own events, for the timeline's flag join — a real join here,
   *  because this page is where those events live. */
  events: MonitoringEvent[];
  compliance: CompliancePath;
  /** Attach an existing flag by hand (addendum §2.8). */
  onLinkFlag: (flagId: string) => void;
}) {
  const ack = ackStateFor(rec, now);
  const items = closeOutOf(rec, now);
  const lifecycle = recordLifecycleOf(rec, now);
  /** ═══ KEYED BY RECORD, DERIVED ═══
   *  An initialiser would run once for the first record this pane ever showed,
   *  and every later record would inherit its entries. This pane does not
   *  unmount between selections either. */
  const [added, setAdded] = useState<Record<string, TimelineEntry[]>>({});
  /** ═══ THE JOIN STAYS HERE; THE SOURCE MOVED TO THE TIMELINE (Phase 6) ═══
   *  Handed down as a function of the source, because WHAT the timeline contains
   *  is this page's data — a join over the record, its flags and the manual log —
   *  while WHICH source a reader is looking at is a view preference the component
   *  owns. Two panes used to keep a copy of that preference each. */
  const entriesFor = (source: ConversationSource) =>
    assembleTimeline(
      timelineSourcesFor(
        rec,
        events,
        [...manualFixturesFor(rec), ...(added[rec.id] ?? [])],
        now
      ),
      source
    );
  return (
    <div className="space-y-4">
      {/* ═══ THE STATE, FIRST AND ONCE (arch-G, G6) ═══
          The pane opened with the acknowledgement clock, which answers a
          question only an ACTIVE record has. A reader arriving from a link has
          to be told what this record IS before being told what is owed — and on
          a terminal record the answer is "nothing", which no clock can say. */}
      <p
        data-record-lifecycle={lifecycle}
        className="text-[13px] leading-[18px] text-[var(--text-secondary)]"
      >
        {RECORD_LIFECYCLE_LABEL[lifecycle]}
        {lifecycle === "closedDocumented" && (
          <span className="ml-1.5 text-[var(--text-muted)]">
            {/* NEEDS-COPY-NICOLE. THE TERMINAL STATE SAYS IT IS TERMINAL, because
                "Closed · documented" alone still reads like a status that might
                change. */}
            — nothing further is owed on this escalation.
          </span>
        )}
      </p>
      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Acknowledgement</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] leading-[20px] text-[var(--text-primary)]">
          {ack === "acknowledged" ? (
            <>
              {/* NEEDS-COPY-NICOLE */}
              Acknowledged {ageLabel(rec.acknowledgedAt ?? now, now)}
            </>
          ) : (
            <>
              <span>Not acknowledged</span>
              {/* THE ONLY PUBLISHED RESPONSE SLA, AND THE ONE THING BREACH
                  TREATMENT IS FOR ON THIS PAGE NOW. */}
              {ack === "breached" ? (
                /* NEEDS-COPY-NICOLE. The chip NAMES THE CLOCK — "Overdue" alone
                   on a page that now has only escalation clocks would leave a
                   reader asking which one. */
                <BreachChip label={`Ack past ${elapsedLabel(ackDeadline(rec), now)}`} />
              ) : (
                <span
                  className="text-[13px] tabular-nums text-[var(--text-secondary)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {elapsedLabel(now, ackDeadline(rec))} left
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Close-out</p>
        <ul className="mt-2 space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              data-closeout={i.id}
              data-closeout-state={i.done ? "done" : i.overdue ? "overdue" : "open"}
              className="flex flex-wrap items-center gap-2 text-[13.5px] leading-[19px]"
            >
              <span className={cn(i.done ? "text-[var(--text-secondary)] line-through" : "text-[var(--text-primary)]")}>
                {i.label}
              </span>
              {i.done ? (
                <span className="text-[11.5px] text-[var(--text-secondary)]">{/* NEEDS-COPY-NICOLE */}done</span>
              ) : i.condition && !i.condition.applies ? (
                /* ═══ NO CLOCK ON AN ITEM THAT IS NOT OWED (arch-G, G6) ═══
                   MEASURED on the record: "Teen follow-up · 40m left · not
                   required — caregiver involved in treatment". Two statements
                   that contradict each other, and the countdown is the one a
                   reader acts on. `closeOutOf` computes `dueAt` for every item
                   regardless of its condition — correctly, because the
                   condition can change — so the suppression belongs here, at
                   the render, where the reason is already being stated.
                   The waiver line renders below either way. */
                null
              ) : i.overdue ? (
                <BreachChip label={`Overdue by ${elapsedLabel(i.dueAt ?? now, now)}`} />
              ) : i.dueAt != null ? (
                <span
                  className="text-[12px] tabular-nums text-[var(--text-secondary)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {elapsedLabel(now, i.dueAt)} left
                </span>
              ) : (
                /* NO PUBLISHED CLOCK — said plainly rather than borrowing the
                   note's 24h, which would invent a deadline. */
                <span className="text-[11.5px] text-[var(--text-secondary)]">{/* NEEDS-COPY-NICOLE */}no stated deadline</span>
              )}
              {i.condition && !i.condition.applies && (
                <span className="text-[11.5px] text-[var(--text-secondary)]">
                  {/* WHY IT IS NOT BEING ASKED FOR. */}
                  not required — {i.condition.note}
                </span>
              )}
              {i.condition?.applies && i.condition.note === "caregiver involvement unknown" && (
                <span className="text-[11.5px] text-[var(--text-secondary)]">
                  {/* THE BLOCKER, ON SCREEN. The field does not exist upstream,
                      so the obligation stands and says why. */}
                  required — caregiver involvement not recorded
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ═══ WHO RAISED IT AND WHO TO CALL (Phase 6) ═══
          Brought onto this pane from `escalation-task-pane.tsx`, which Phase 2
          left with no route — so the only escalation surface in the product
          could not state the emergency contact. On a live escalation that is the
          most operationally important fact here.
          NULL IS STATED, NOT DASHED. A record assembled from a documentation
          task, or raised from a flag's disposition, genuinely does not know
          either value; printing "—" would assert there is nobody to call. Same
          rule `is911` has under gap row 213 — and the coercion that row was
          opened about dies with `recordFromTask`, because the records this pane
          renders come from the scenario builders where the value is real. */}
      <dl
        data-slot="escalation-facts"
        className="grid gap-3 rounded-[var(--radius-inset)] border border-[color:var(--border-contour)] px-3.5 py-3 sm:grid-cols-3"
      >
        {(
          [
            /* NEEDS-COPY-NICOLE, all three labels. */
            ["Opened by", rec.flaggedBy],
            ["911", rec.is911 ? "Dispatched" : "Not dispatched"],
            ["Emergency contact", rec.emergencyContact],
          ] as Array<[string, string | null]>
        ).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className={LABEL}>{label}</dt>
            <dd
              className={cn(
                "mt-1 text-[13.5px] leading-[19px]",
                value == null
                  ? "text-[var(--text-secondary)]"
                  : "text-[var(--text-primary)]"
              )}
            >
              {/* NEEDS-COPY-NICOLE on the absence. It names what is missing
                  rather than leaving the value blank. */}
              {value ?? "Not on file"}
            </dd>
          </div>
        ))}
      </dl>

      {/* ═══ THE LINK-OUTS ARE GONE, AND THEY WERE DEAD (Phase 10) ═══
          Phase 6 moved `View care profile` and `View conversation` onto this
          pane from the retired `EscalationCtas`, and Phase 7 then measured why
          neither can land: the records here carry `tk-*` ids from the tasks
          roster, while the record and chat surfaces know `t*` ids from the demo
          people. MEASURED on a rendered record —
          `/admin/person/tk-simone?tab=care` shows "We couldn't find that
          person", and `/app/chat/tk-simone` lands on a mentor's thread list in
          mentor chrome.
          SAME CALL PHASE 7 MADE FOR COVERAGE: do not offer a door that cannot
          open. On an incident surface a link that costs a click and produces
          "couldn't find that person" is worse than no link, because it spends
          the one thing a supervisor has least of.
          THE PANE IS NOT A DEAD END WITHOUT THEM — it carries the record, the
          facts row, the acknowledgement clock, the close-out set, the timeline
          with its manual log, the note module and the disposition footer. What
          it cannot do is send a reader to the teen, and gap row 432 now has that
          cost attached to it: two link-outs here and one control on Coverage. */}

      {/* ═══ THE MITIGATION MODULE, HOSTED (arch-G, G3) ═══
          The record is the escalation note's durable home, so the module renders
          HERE — inline, with its action row in the flow, which is the layout a
          record wants. The Tasks documentation pane hosts the same component and
          portals the action row into its sticky bar. One implementation, two
          hosts: the principle billing established with `ReviewBody`.
          ONLY ONCE THE CRISIS IS OVER. An active escalation has nothing to
          document yet and a form on screen during an incident invites a
          supervisor to write instead of act — the response task is what exists
          during the live phase. */}
      {/* ═══ THE TIMELINE — THE SAME COMPONENT THE TASK PANE HOSTS (G5/G6) ═══
          Assembled from the record, the support thread, the teen's conversation,
          this page's own flags and hand-logged actions. Not summarised, and
          every entry names its source. The record is the timeline's durable
          home; the task pane borrows it for the window it is working in. */}
      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Timeline</p>
        <div className="mt-2">
          <EscalationTimeline
            entriesFor={entriesFor}
            teenName={rec.teenName}
            onLog={({ actionType, detail }) =>
              setAdded((prev) => ({
                ...prev,
                [rec.id]: [
                  ...(prev[rec.id] ?? []),
                  {
                    id: `manual-${Date.now()}`,
                    at: Date.now(),
                    source: "manual",
                    text: detail.trim() || "No detail recorded",
                    author: "You",
                    actionType,
                  },
                ],
              }))
            }
          />
        </div>
      </div>

      {!isActive(rec) &&
        (lifecycle === "closedDocumented" ? (
          /* ═══ A TERMINAL RECORD DOES NOT OFFER A FORM ═══
             The note is recorded, so a live module here would invite a second
             one — and the prototype holds no note BODY, so rendering the fields
             read-only would show nine empty rows on a documented escalation and
             assert that nothing was written. Saying what is true and what cannot
             be shown is the honest third option. Gap row: the note body is not
             stored anywhere, so it cannot be read back. */
          <SystemBlock label="Escalation note">
            {/* NEEDS-COPY-NICOLE */}
            The escalation note is recorded. This prototype stores no note body,
            so its fields cannot be read back here.
          </SystemBlock>
        ) : (
          <div>
            <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Escalation note</p>
            <div className="mt-2">
              <EscalationNoteModule idPrefix={`rec-${rec.id}`} />
            </div>
          </div>
        ))}

      <LinkedFlags
        rec={rec}
        events={events}
        now={now}
        compliance={compliance}
        onLinkFlag={onLinkFlag}
      />

      {/* ═══ "Open the escalation record" IS GONE — IT LINKED TO THIS PAGE ═══
          It pointed at `escalationHref(rec.id)`, which redirects to
          `/app/escalations?escalation={id}`: the route the reader is standing on,
          showing the record they are looking at. It made sense while this pane
          lived on Monitoring and the record was somewhere else; Phase 6 made
          this pane the record, and a link to itself is the kind of chrome that
          survives a move because nobody re-reads it.
          `escalationHref` IS STILL RIGHT ELSEWHERE — the region's rows and
          Today's escalation strip both use it, and they are not on this route. */}
    </div>
  );
}

/** ═══ THE FLAGS ATTACHED TO THIS ESCALATION (addendum §2.8) ═══
 *
 *  ═══ WHY THE WHOLE FLAG AND NOT A LINE PER FLAG ═══
 *
 *  §2.8 asks for the playbook match, the classifier rationale and the flagged
 *  message to be intact INSIDE the record. A list of "Passive suicidal
 *  ideation · 2h ago" rows would be a second index into evidence that is one
 *  click away — and the click leaves the escalation a supervisor is working.
 *  The whole flag renders here, through `FlagBody`, which is the same
 *  component Risk Flags uses: one rendering of a flag's evidence, wherever a
 *  reader meets it.
 *
 *  COLLAPSED BY DEFAULT ABOVE ONE. A live escalation's pane already holds two
 *  clocks, four close-out obligations, a timeline and a note module; three
 *  expanded flags below that would bury the thing the pane is for. The first
 *  is open because a record with exactly one attached flag is the common case
 *  and the flag is why the record exists.
 *
 *  ═══ A FLAG THAT IS LINKED HAS LEFT THE QUEUE ═══
 *
 *  Every path in — escalating from it, attaching it by hand, the interim
 *  auto-link rule — marks it reviewed in the same action. So this section
 *  reads from the UNFILTERED event set: the flags it shows are precisely the
 *  ones the queue no longer has.
 */
function LinkedFlags({
  rec,
  events,
  now,
  compliance,
  onLinkFlag,
}: {
  rec: EscalationRecord;
  events: MonitoringEvent[];
  now: number;
  compliance: CompliancePath;
  onLinkFlag: (flagId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const linked = rec.linkedFlagIds
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is MonitoringEvent => !!e);

  /** ═══ THE PICKER IS SCOPED TO THIS TEEN (addendum §2.8) ═══
   *  Not to the conversation: a supervisor attaching by hand is making a
   *  judgment the auto-rule could not, and the case that judgment exists for
   *  is a flag on the teen's OTHER thread that turns out to be the same
   *  incident. Anything already attached is excluded, so the list cannot
   *  offer a link that would do nothing. */
  const attachable = events.filter(
    (e) => e.teenId === rec.teenId && !rec.linkedFlagIds.includes(e.id)
  );

  const shown = open ?? (linked.length === 1 ? linked[0]?.id : null);

  return (
    <div data-anno-ref="escalation-linked-flags">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={LABEL}>
          {/* NEEDS-COPY-NICOLE. The count is in the heading because an empty
              section and a one-flag section are different facts, and the
              heading is where a reader looks for which they have. */}
          Linked flags{linked.length > 0 ? ` · ${linked.length}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          data-action="attach-flag"
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 text-[12.5px] font-semibold text-[var(--text-primary)]",
            "hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          <PlusCircle className="size-3.5 shrink-0" aria-hidden />
          {/* NEEDS-COPY-NICOLE */}
          Attach a flag
        </button>
      </div>

      {picking && (
        <div className="mt-2 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3">
          {attachable.length === 0 ? (
            <p className="text-[12.5px] leading-[18px] text-[var(--text-secondary)]">
              {/* ═══ IT NAMES THE SCOPE, BECAUSE THE SCOPE IS THE ANSWER ═══
                  NEEDS-COPY-NICOLE. "Nothing to attach" would leave a reader
                  wondering whether the list is empty or broken; this says what
                  was searched. */}
              {/* NO TRAILING PERIOD. The teen's display name already ends in
                  one ("Jordan P."), and the first render read "…on Jordan P..".
                  Measured in the probe's own detail string. */}
              No other open flags on {rec.teenName}
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-1.5">
              {attachable.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    data-attach={e.id}
                    onClick={() => {
                      onLinkFlag(e.id);
                      setPicking(false);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-left text-[13px] leading-[18px]",
                      "text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
                      RING
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {e.category ? riskCategoryLabel(e.category) : "Uncategorised"}
                    </span>
                    <span
                      className="shrink-0 tabular-nums text-[12px] text-[var(--text-secondary)]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {ageLabel(e.at, now)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {linked.length === 0 ? (
        <p className="mt-2 text-[12.5px] leading-[18px] text-[var(--text-secondary)]">
          {/* ═══ AN EMPTY SECTION IS A REAL STATE, NOT A MISSING ONE ═══
              NEEDS-COPY-NICOLE. An escalation raised from the region or from a
              fixture has no flag behind it, and saying so is different from
              rendering nothing — which on a record reads as a load that failed. */}
          No risk flags are attached to this escalation.
        </p>
      ) : (
        <ul role="list" className="mt-2 flex flex-col gap-2">
          {linked.map((e) => {
            const expanded = shown === e.id;
            return (
              <li
                key={e.id}
                data-linked-flag={e.id}
                className="rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)]"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? "" : e.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 px-3 text-left",
                    RING
                  )}
                >
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-150",
                      "motion-reduce:transition-none",
                      expanded ? "" : "-rotate-90"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-[var(--text-primary)]">
                    {e.category ? riskCategoryLabel(e.category) : "Uncategorised"}
                  </span>
                  <span
                    className="shrink-0 tabular-nums text-[12px] text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {ageLabel(e.at, now)}
                  </span>
                </button>
                {expanded && (
                  <div className="border-t border-[color:var(--border-subtle)] px-3 py-3">
                    {/* THE SAME COMPONENT RISK FLAGS RENDERS. One rendering of
                        a flag's evidence, wherever a reader meets it. */}
                    <FlagBody event={e} now={now} compliance={compliance} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── The two axes ────────────────────────────────────────────────────────────

/** ═══ ONE CONTROL, ONE VOCABULARY AGAIN (addendum §2.1) ═══
 *
 *  Phase 8 gave this a second vocabulary because gap row 421 caught it
 *  rendering the CLINICAL values on a mentor practice event — a mentor's missed
 *  video note asking for "No clinical concern". The fix was right and the
 *  subject it served is gone, so the branch goes with it rather than staying as
 *  a `subject` parameter with one possible value.
 *
 *  WHAT THE PHASE-8 WORK LEAVES BEHIND, and the reason it was not wasted: the
 *  anatomy it settled — a required radiogroup, a consequence line AT the
 *  control, an inline hint on a refused submit rather than a disabled button —
 *  is the anatomy this keeps. If a second review subject ever returns, the shape
 *  to copy is here, and the lesson is that it brings its own words with it. */
function DispositionAxis({
  value,
  onChange,
  hint,
  hintRef,
}: {
  value: string | null;
  onChange: (id: string) => void;
  hint: boolean;
  hintRef: React.Ref<HTMLParagraphElement>;
}) {
  const values = DISPOSITION_VALUES;
  const chosen = dispositionById(value);
  return (
    <div
      role="radiogroup"
      /* NEEDS-COPY-NICOLE. THE AXIS NAMES ITS SUBJECT: this is a statement
         about a teen, and the label says so rather than saying "disposition"
         and leaving the reader to infer whose. */
      aria-label="Clinical disposition"
      aria-describedby={hint ? "disposition-hint" : undefined}
      className="min-w-0"
    >
      <p className={LABEL}>
        {/* NEEDS-COPY-NICOLE. Required, and it says so in words rather than with
            an asterisk. */}
        Clinical disposition · required
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={value === d.id}
            onClick={() => onChange(d.id)}
            data-disposition={d.id}
            data-effect={d.effect}
            className={cn(
              /* 44px. This is the control that closes a record on a safety
                 surface; it was 36. */
              "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-semibold",
              value === d.id
                ? "border-transparent bg-[var(--text-primary)] text-[var(--surface-card)]"
                : "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      {/* THE CONSEQUENCE, AT THE CONTROL. Which value is destructive is not
          guessable from the labels, and one value does not close the event at all.
          A reader should know that before pressing it. */}
      <p
        className="mt-1.5 min-h-[17px] text-[12px] leading-[17px] text-[var(--text-secondary)]"
        aria-live="polite"
      >
        {chosen?.consequence ?? ""}
      </p>
      {hint && (
        <p
          id="disposition-hint"
          ref={hintRef}
          role="alert"
          tabIndex={-1}
          className="mt-1 text-[12.5px] font-semibold leading-[17px] text-[var(--state-error)]"
        >
          {DISPOSITION_REQUIRED_HINT}
        </p>
      )}
    </div>
  );
}

function AccuracyAxis({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const values = ACCURACY_VALUES;
  /* NEEDS-COPY-NICOLE. The axis names ITS PRODUCER. It briefly branched — a
     classifier for a flag, a threshold for a practice rule — because "accuracy"
     over a deterministic comparison is a category error. One producer now. */
  const name = "Classifier accuracy";
  return (
    <div
      role="radiogroup"
      aria-label={`${name} — optional`}
      className="min-w-0"
    >
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
        {/* Optional in the label, because it is optional. */}
        {name} · optional
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={value === a.id}
            data-accuracy={a.id}
            /* TOGGLE-OFF, because it is never pre-selected and a reader who
               picked one by accident has no other way back to "no answer". */
            onClick={() => onChange(value === a.id ? null : a.id)}
            className={cn(
              // NEVER PRIMARY-STYLED. A quiet outline against the disposition's
              // filled chips — the visual weight says which axis resolves the
              // event. 44px all the same: quiet is a treatment, not a size.
              "inline-flex min-h-11 items-center rounded-full border px-3 text-[12.5px]",
              value === a.id
                ? "border-[color:var(--border-contour)] bg-[var(--surface-s2)] text-[var(--text-primary)]"
                : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── The pane ────────────────────────────────────────────────────────────────

export interface PaneHandle {
  /** The keyboard's `y`/`n`. ON THIS SURFACE THEY ANSWER AXIS 2 AND RESOLVE
   *  NOTHING — the old binding resolved the event, which is the defect. */
  accuracy?: (accurate: boolean) => void;
  /** ═══ `1`/`2`/`3` — SELECT AND COMMIT, IN ONE KEYSTROKE (addendum §3.3) ═══
   *
   *  §2.8 split one control into two: a disposition, then `Mark reviewed`.
   *  That is one more tap on the highest-volume surface in the product — 123
   *  items on a heavy shift — and at that volume one extra tap is real.
   *
   *  THE MITIGATION IS THIS, and it is not a shortcut for the same two steps:
   *  the key selects the value AND commits it, so the keyboard path is one
   *  keystroke where the mouse path is two. The commit still runs the same
   *  gate — a digit outside the array does nothing rather than committing
   *  whatever is selected.
   *
   *  DIGITS RATHER THAN INITIALS because the labels collide: "No clinical
   *  concern" and "Watching — not resolved" both want `n`, and `n` already
   *  answers axis 2. */
  commitDisposition?: (index: number) => void;
}

export function EventPane({
  event,
  escalation,
  events,
  now,
  compliance,
  deactivated,
  onResolve,
  onEscalate,
  onLinkFlag,
  within = null,
  handleRef,
}: {
  event: MonitoringEvent | null;
  escalation: EscalationRecord | null;
  /** THE WHOLE EVENT SET, not the selected one. The escalation record's timeline
   *  joins flags on the same teen inside the escalation's window, so it needs the
   *  set rather than the selection. Required, not defaulted: `[]` would make the
   *  timeline state "no flags" on a record that had them. */
  events: MonitoringEvent[];
  now: number;
  compliance: CompliancePath;
  /** The record changed under the reader. */
  deactivated: boolean;
  onResolve: (e: MonitoringEvent, detail: { disposition: DispositionValue; accuracy: string | null }) => void;
  onEscalate: (e: MonitoringEvent) => void;
  /** Attach an existing flag to the record on screen (addendum §2.8). */
  onLinkFlag: (flagId: string) => void;
  /** ═══ WHERE THIS FLAG SITS IN ITS CONVERSATION (addendum §3.1) ═══
   *  The list's unit is a conversation now, so a row can stand for three
   *  flags and the pane is where a supervisor moves between them. Null on an
   *  escalation, and `total: 1` renders nothing — a stepper offering no step
   *  is the same dead chrome as a one-value filter. */
  within?: {
    index: number;
    total: number;
    onStep: (delta: number) => void;
  } | null;
  handleRef?: React.MutableRefObject<PaneHandle>;
}) {
  const [disposition, setDisposition] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const hintRef = useRef<HTMLParagraphElement | null>(null);
  /** The pane's scroll region — handed to the transcript, which is what
   *  scrolls inside it. See §2.7's reconciliation with locked decision 4. */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  /** ═══ DOES A CLASSIFIER'S ACCURACY MEAN ANYTHING HERE (addendum §2.8) ═══
   *  Read off the payload's own `reportedBy` rather than off the absence of a
   *  rationale: a classifier flag with an empty rationale is a pipeline
   *  defect, and treating it as user-reported would hide that behind a missing
   *  control. */
  const showAccuracy = asksAboutClassifier(
    event?.flag?.payload.kind === "riskFlag"
      ? event.flag.payload.reportedBy
      : null
  );

  /** ═══ THE HANDLE IS PUBLISHED IN AN EFFECT, NOT DURING RENDER ═══
   *  A ref write in render scope is impure and the React Compiler rejects it —
   *  caught by lint, not by reasoning, and the third time this rule has bitten in
   *  this codebase. The keyboard's `y`/`n` reach the handle after mount, which is
   *  the only time a keystroke can arrive. */
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      /** ═══ THE KEY ANSWERS AXIS 2, AND AXIS 2 IS ALWAYS ON SCREEN ═══
       *  Phase 5 made this a no-op on a practice event, because the accuracy
       *  axis was not rendered there and a keystroke must not record state with
       *  no control on screen. Phase 8 gave practice its own axis 2 and the key
       *  branched on subject. With one subject the branch is gone and the
       *  invariant it protected is structural now: there is one axis 2, it is
       *  always rendered beside the disposition, and the key sets it. */
      accuracy: (accurate: boolean) => {
        setAccuracy(accurate ? "accurate" : "inaccurate");
      },
      commitDisposition: (index: number) => {
        const d = DISPOSITION_VALUES[index];
        /* OUT OF RANGE DOES NOTHING. `4` is bound by the hook and there are
           three values; committing "whatever is selected" on an unbound digit
           would be a clinical record written by a mis-key. */
        if (!d || !event) return;
        setDisposition(d.id);
        setHint(false);
        if (d.effect === "watch") return;
        onResolve(event, { disposition: d, accuracy });
      },
    };
  }, [handleRef, event, accuracy, onResolve]);

  /* NEEDS-COPY-NICOLE. It read `EVENT_KIND_LABEL[event.kind]`, which over one
     event kind is the constant "Flag" — so the table went and the word stayed. */
  const title = escalation ? "Escalation" : event ? "Risk flag" : "";

  if (!event && !escalation) {
    return (
      <div className="flex h-full items-center justify-center rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-6">
        <p className="text-[13.5px] text-[var(--text-secondary)]">
          {/* NEEDS-COPY-NICOLE */}
          Choose an event to review it.
        </p>
      </div>
    );
  }

  const submit = () => {
    if (!event) return;
    const d = dispositionById(disposition);
    if (!d) {
      /* INLINE, AND FOCUS MOVES TO IT. Not a toast and not a disabled button:
         the reader asked to resolve, and the answer to "why didn't that work" has
         to be where they were looking. */
      setHint(true);
      requestAnimationFrame(() => hintRef.current?.focus());
      return;
    }
    setHint(false);
    /* ═══ ESCALATING IS NO LONGER REACHABLE FROM HERE (addendum §2.8) ═══
       `Escalate now` was a disposition with `effect: "escalate"`, so committing
       it went through this function. It is a secondary BUTTON now, calling
       `onEscalate` directly and never gated on the radiogroup — under-
       escalation is the expensive error on this surface and it should not cost
       two interactions. */
    if (d.effect === "watch") {
      /* WATCHING IS NOT A RESOLUTION. It records that the event was seen and
         leaves it in the queue — which is the state whose clinical existence is
         the open question on `DISPOSITION_VALUES`. */
      return;
    }
    onResolve(event, { disposition: d, accuracy });
  };

  return (
    <div
      data-slot="event-pane"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-5 py-4">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
          {escalation && isActive(escalation) && <AlertTriangle className="size-3.5" aria-hidden />}
          {title}
        </p>
        <div className="mt-1.5">
          <RolePair
            teenName={escalation ? escalation.teenName : (event?.teenName ?? null)}
            mentorName={escalation ? escalation.mentorName : (event?.mentorName ?? "")}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] leading-[17px] text-[var(--text-secondary)]">
            {escalation
              ? `${/* NEEDS-COPY-NICOLE */ "Triggered"} ${ageLabel(escalation.triggeredAt, now)}`
              : event
                ? ageLabel(event.at, now)
                : ""}
          </p>
          {within && within.total > 1 && (
            /* ═══ THE STEPPER — POSITION, THEN THE TWO MOVES ═══
               NEEDS-COPY-NICOLE. It states WHERE the reader is before offering
               to move them, because "‹ ›" alone on a pane that just changed
               subject is two arrows with no referent. The figures are mono and
               tabular so the label does not reflow as the index passes 9.
               DISABLED AT THE ENDS rather than wrapping: a queue a supervisor
               is working through top to bottom should not silently return them
               to the first flag they already dispositioned. */
            <span
              data-within-conversation={`${within.index + 1}/${within.total}`}
              className="flex shrink-0 items-center gap-1"
            >
              <span
                className="text-[12px] leading-[17px] tabular-nums text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {within.index + 1} of {within.total} in this conversation
              </span>
              {([
                [-1, "Previous flag in this conversation", ChevronLeft],
                [1, "Next flag in this conversation", ChevronRight],
              ] as const).map(([d, label, Icon]) => {
                const at = within.index + d;
                const off = at < 0 || at >= within.total;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={off}
                    onClick={() => within.onStep(d)}
                    aria-label={label}
                    data-within-step={d}
                    className={cn(
                      /* 44px: this is the escalation-tier floor the whole
                         surface holds, and a 28px chevron beside a 44px row
                         is the control a reader misses under pressure. */
                      "inline-flex size-11 items-center justify-center rounded-full",
                      off
                        ? "text-[var(--text-muted)] opacity-40"
                        : "text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
                      RING
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                );
              })}
            </span>
          )}
        </div>
      </div>

      {/* ═══ THE PANE'S OWN SCROLL — one of the surface's two regions ═══
          AND THE TRANSCRIPT'S, since §2.7: `bodyRef` is handed to the excerpt
          so it scrolls, anchors and loads against this element rather than
          opening one of its own. */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {deactivated && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3 text-[13px] leading-[19px] text-[var(--text-primary)]"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="size-4 shrink-0" aria-hidden />
              {/* NEEDS-COPY-NICOLE */}
              This teen&apos;s record was deactivated while you were reviewing it.
            </span>
            <span className="mt-1 block text-[var(--text-secondary)]">
              {/* NO DISPOSITION IS OFFERED BELOW. Recording a clinical judgment
                  against a record that no longer exists would file a decision
                  nobody can act on. */}
              Nothing recorded here would reach the record. Clinical Ops owns what
              happens next.
            </span>
          </div>
        )}
        {escalation ? (
          <EscalationBody
            rec={escalation}
            now={now}
            events={events}
            compliance={compliance}
            onLinkFlag={onLinkFlag}
          />
        ) : event ? (
          <FlagBody
            event={event}
            now={now}
            compliance={compliance}
            scrollHostRef={bodyRef}
          />
        ) : null}
      </div>

      {/* ═══ THE FOOTER — PINNED, AND NOT A SCROLL REGION ═══
          `shrink-0` in a flex column, so the body scrolls behind it and the
          footer is never over content: nothing focusable can end up underneath
          it (WCAG 2.4.11). */}
      <div
        data-slot="event-pane-footer"
        className={cn(
          "shrink-0 bg-[var(--surface-card)]",
          /* NO RULE AND NO PADDING WHEN THERE IS NOTHING IN IT — a hairline
             across an empty strip is the visual version of the sentence this
             removed. */
          escalation
            ? "hidden"
            : "border-t border-[color:var(--border-subtle)] px-5 py-4"
        )}
      >
        {escalation ? (
          /* ═══ THE FOOTER IS EMPTY ON A RECORD, WHICH IS THE FIX (§3.6) ═══
           *
           *  It held one sentence: "The escalation's own state is not changed
           *  from a queue. What is owed is above, and the note is filed here."
           *  §3.6's reading is right — that sentence existed because the
           *  LAYOUT did not make the relationship legible. A footer on this
           *  pane looks like it should hold the commit, so a reader who found
           *  nothing in it had to be told why.
           *
           *  A FOOTER WITH NOTHING IN IT SHOULD NOT BE A FOOTER. Rendering
           *  nothing makes the same point without a sentence: what is owed is
           *  above, in the close-out list, and the note module is above too.
           *  The terminal variant went the same way — "Nothing further is owed
           *  on this escalation" restated a lifecycle the body already carries
           *  on `data-record-lifecycle` and states in words.
           *
           *  LOCKED DECISION 3 IS UNCHANGED and is now structural rather than
           *  narrated: nothing in this pane mutates the escalation, and there
           *  is no longer a control-shaped space suggesting otherwise. */
          null
        ) : deactivated ? (
          <p className="text-[12.5px] leading-[17px] text-[var(--text-secondary)]">
            {/* NEEDS-COPY-NICOLE */}
            No disposition can be recorded against a deactivated record.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <DispositionAxis
              value={disposition}
              onChange={(id) => {
                setDisposition(id);
                setHint(false);
              }}
              hint={hint}
              hintRef={hintRef}
            />
            <div className="flex flex-wrap items-end justify-between gap-4">
              {/* ═══ AXIS 2 ASKS ABOUT A CLASSIFIER, SO IT RENDERS WHERE ONE RAN ═══
                  Phase 5 removed it from practice events, where the producer
                  was a deterministic rule and the question was unanswerable.
                  §2.8 removes it from USER-REPORTED flags for the same reason
                  one layer along: a person put this in the queue, and asking
                  whether the classifier was right about it is a question about
                  a producer that did not produce it.
                  AN EMPTY SLOT RATHER THAN A DISABLED CONTROL: a greyed axis
                  announces itself to a screen reader and gives no reason. */}
              {showAccuracy ? (
                <AccuracyAxis value={accuracy} onChange={setAccuracy} />
              ) : (
                <span />
              )}
              {/* ═══ TWO CONTROLS, AND ONLY ONE OF THEM IS GATED (§2.8) ═══
                  `Mark reviewed` is the COMMIT: it requires a disposition and
                  says so inline when it does not have one. `Escalate now` is an
                  ACTION and is always enabled — it was a fourth radio value,
                  which meant the required clinical question could be answered
                  with a verb and escalating cost two interactions.
                  ORDER: the commit last, in the primary position at the end of
                  the row, with the action to its left. A reader scanning right
                  to left off the transcript meets the escalation first, which
                  is the one that must not be missed under pressure. */}
              <span className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => event && onEscalate(event)}
                  data-action="escalate"
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold",
                    /* ═══ TONAL, NOT A SATURATED RED FILL (§3.2) ═══
                       Red means two things on this surface already — an active
                       escalation, and a breached clock — and both are states
                       the SYSTEM is reporting. Putting saturated red on a
                       button a supervisor presses from any of 123 flag details
                       changes red from "something is wrong" to "something is
                       here", and the state meaning dilutes.
                       MORE IMPORTANTLY, escalating is the correct conservative
                       action. Red reads as destructive across every convention
                       a supervisor brings with them (Jakob's Law), and a
                       danger-styled button gets pressed less — the wrong thumb
                       on the scale where under-escalation is the expensive
                       error.
                       THE TRADE, STATED: less visual separation from the
                       commit, so the tonal fill has to do real work. It carries
                       a border AND a fill AND an icon, against the commit's
                       solid ink. */
                    /* ═══ THE CLAY PAIR, NOT A SELF-TINTED `--state-error` ═══
                       IT WAS `text-[var(--state-error)]` on
                       `bg-[var(--state-error)]/10` — the label in the same hue
                       as its own ground, which is the whole defect. MEASURED,
                       compositing the 10% fill over the pane:
                         light  #cc3300 on rgb(250,235,230) = 4.48:1
                         dark   #ff6f2f on rgb(71,53,44)    = 4.17:1
                       Both under 4.5, and 14px at weight 600 is not large text
                       — large needs 18.66px, or 14px at 700. `monitoring-axe`
                       reported it as two serious `color-contrast` violations at
                       xl, in both themes, and it predates this pack.
                       REDUCING THE TINT WAS THE OBVIOUS FIX AND IS THE WRONG
                       ONE: measured, it takes 4% opacity to clear the floor in
                       both themes (light 4.90, dark 4.52), and a 4% fill is
                       invisible — it would buy the ratio by deleting the
                       channel the note above says has to do real work.
                       BLOOM ALREADY HAS THE PAIR. `--band-clay-bg` /
                       `--band-clay-fg` exist in both themes and the token
                       file's own comment says what they are for: "escalation;
                       earthy, not pink". Verified rather than trusted:
                         light  #75301f on #f6d3c6 = 6.84:1
                         dark   #f2ac92 on #673928 = 5.06:1
                       EVERY STATED INTENT SURVIVES — tonal rather than a
                       saturated red fill, not red-as-destructive, and still
                       three channels. The BORDER is now full-strength clay ink
                       rather than 35% `--state-error`, which also makes it a
                       real boundary: measured 6.84:1 against the fill and
                       9.55:1 against the pane in light, 5.06 and 7.03 in dark,
                       where the old 35% border was 1.77:1 and carried nothing.
                       HOVER MATCHES ITS SIBLING — `opacity-90`, the same
                       treatment the commit beside it uses, so neither button
                       introduces a colour value for a hover state. */
                    "border border-[color:var(--band-clay-fg)] bg-[var(--band-clay-bg)] text-[var(--band-clay-fg)]",
                    "transition-opacity hover:opacity-90",
                    RING
                  )}
                >
                  <ShieldAlert className="size-4 shrink-0" aria-hidden />
                  {/* NEEDS-COPY-NICOLE */}
                  Escalate now
                </button>
                <button
                  type="button"
                  onClick={submit}
                  data-action="record"
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full bg-[var(--text-primary)] px-5 text-[14px] font-semibold text-[var(--surface-card)]",
                    "transition-opacity hover:opacity-90",
                    RING
                  )}
                >
                  {/* ═══ "Mark reviewed", NOT "Record disposition" ═══
                      NEEDS-COPY-NICOLE. The disposition is the WHAT and this is
                      the COMMIT — two steps, which is one more tap than the
                      single control it replaces on the highest-volume surface
                      in the product. The mitigation is the keyboard: `1`/`2`/`3`
                      select AND commit in one keystroke, so the mouse path is
                      two steps and the keyboard path stays one. */}
                  Mark reviewed
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
