"use client";

// THE MENTOR CHAT — list · thread · rail.
//
// ═══ THREE COLUMNS, AND WHICH ONES MOUNT ═══
//
//   ≥ 1280px   list (320) · thread (flexible) · rail (320)
//   ≥ 900px    list (300) · thread (flexible)              — rail behind a toggle
//   < 900px    one of them, whichever the reader chose      — a takeover
//
// SWITCHING, NOT SHRINKING. A 220px conversation list is a list of truncated
// names, and a 240px thread is a column of two-word lines — so below each
// breakpoint a column is REMOVED rather than compressed. The same decision the
// Tasks page makes at `xl`, and for the same reason: a pane squeezed into a width
// it cannot use is worse than a pane you navigated away from.
//
// The takeover is why `view` exists. Below 900px the list and the thread are
// mutually exclusive, so selecting a row has to hand the screen over — a select
// that only moved the selection left a reader tapping names and watching nothing
// happen, which is a bug the Tasks page shipped once and had to be measured to
// find (its pane was `display:none` at the time).
//
// ═══ STORE READS ARE MOUNT-GATED ═══
//
// `chatScenarioId` is persisted, so reading it during SSR or the first client
// paint disagrees with what hydration produces. Standing Next-16 rule, and the
// reason `useMounted` gates the seed rather than the render: the shell and the
// three columns paint immediately; only the DATA waits a frame.

import { useEffect, useMemo, useState } from "react";
import { PanelRight, PanelRightClose, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chatThreadHref } from "@/lib/record/chat";
import { ConversationList } from "@/components/chat/list/conversation-list";
import { Rail, tabsFor, type RailMode, type RailTab } from "@/components/chat/rail/rail";
import { RailStrip } from "@/components/chat/rail/rail-strip";
import { setSupportOpen, setSupportThread, useSupportOpen } from "@/lib/support/panel";
import { markSupportRead } from "@/lib/support/outbox";
import { supportThread } from "@/lib/support/threads";
import { Thread } from "@/components/chat/thread/thread";
import { DetailSheet } from "@/components/chat/thread/detail-sheet";
import { CrisisView } from "@/components/chat/escalation/crisis-view";
import { ResolveDialog } from "@/components/chat/escalation/resolve-dialog";
import { RESOLUTION_OUTCOMES } from "@/components/chat/escalation/resolve-dialog";
import { chatScenario } from "@/lib/chat/seed";
import { activityById } from "@/lib/chat/activities";
import { relLength, teenAsMentee } from "@/lib/record/mentees-demo";
import { teensForMentor } from "@/lib/record/people-demo";
import type { AssistInput } from "@/lib/chat/assist";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { LIVE_ID } from "@/lib/record/subject";
import { firstLineOf } from "@/components/chat/documentation/context-reference";
import type {
  ActivityId,
  ChatEvent,
  ChatMessage,
  ContextRef,
  EscalationState,
  Note,
  SentArtifact,
  SentArtifactItem,
} from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Open a support contact's thread in the panel, read (SUP-5). */
function openInSupport(id: string): void {
  markSupportRead(id);
  setSupportThread(id);
  setSupportOpen(true);
}

export function ChatPage({
  /** ═══ THE OPEN THREAD IS A ROUTE SEGMENT NOW, NOT A QUERY OR A STATE ═══
   *
   *  This was `withId` from `?with=` plus a `useState<"list" | "thread">` toggle,
   *  and the toggle is what this replaces. A thread held in state has no URL, so
   *  it had no browser back, no scroll restoration, nothing to deep-link to, and
   *  no signal the app shell could read to hide the bottom bar — the bar
   *  appeared and disappeared with no navigation to explain it.
   *
   *  `null` on `/app/chat`, a person id on `/app/chat/[personId]`. Below `md`
   *  that is what decides which pane is on screen; at `md` and up both render
   *  and this only decides which conversation the thread shows. */
  personId,
}: {
  personId: string | null;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const scenarioId = useOnboardingStore((s) => s.chatScenarioId);
  const persona = useOnboardingStore((s) => s.persona);

  /** FIXED AT MOUNT, which is the house pattern (`tasks-page.tsx` carries the
   *  same line and the same reason): `Date.now()` in render scope is impure and
   *  `react-hooks/purity` is right to reject it.
   *
   *  It also has to be fixed for a second reason here. Every thread's messages
   *  are positioned relative to this instant, so a ticking clock would rebuild
   *  fifteen threads a second and throw away the transcript's scroll position on
   *  every tick. Chat timestamps are minutes-and-hours coarse; a clock that
   *  advances while a mentor reads buys nothing. */
  const [now] = useState(() => Date.now());

  /** ═══ MOUNT-GATED, LIKE EVERY OTHER SEEDED SURFACE ═══
   *
   *  Two reasons, and both would produce a hydration mismatch on their own.
   *  `scenarioId` comes from a localStorage-backed store, so SSR sees the default
   *  and the client may see something else. And `now` is `Date.now()` in a
   *  `useState` initialiser, which RUNS ON THE SERVER TOO — so the server would
   *  render one set of timestamps and the client another, and React would replace
   *  the whole transcript on hydration.
   *
   *  Gating the DATA rather than the render is what keeps the shell, the three
   *  columns and the empty states painting immediately. Same shape as
   *  `tasks-page.tsx`'s `items` memo. */
  const data = useMemo(
    () => (mounted ? chatScenario(scenarioId, now) : null),
    [mounted, scenarioId, now]
  );

  /** ═══ THE TAKEOVER'S STARTING SIDE IS DERIVED FROM THE LINK, NOT SET BY ONE ═══
   *
   *  Below 900px only one column mounts, so arriving with no conversation chosen
   *  should show the choices — and arriving from a record's Chat action should show
   *  the conversation, because that is the one thing the link carried.
   *
   *  The first version did this in an effect, and `react-hooks/set-state-in-effect`
   *  was right to reject it: an effect runs AFTER the first paint, so a mentor
   *  following a deep link on a phone would have seen the list for a frame and then
   *  been moved. A `useState` initialiser reads the prop before the first render
   *  instead, which is both correct and one fewer render. */
  /** DERIVED, NEVER STORED. The route is the single source of which pane is up,
   *  so there is no second copy to fall out of step with the URL — and a browser
   *  back is a route change, which means it just works rather than needing a
   *  popstate listener. */
  const view: "list" | "thread" = personId ? "thread" : "list";
  /** ═══ CLOSED BY DEFAULT, WHICH ONLY MATTERS BELOW `xl` ═══
   *  At `xl` the rail is a grid track and this flag does nothing — the class that
   *  reads it is `!railOpen && "hidden xl:@min-[1000px]/canvas:block"`, so `xl`
   *  always shows it (with Support closed; open, the rail is a strip).
   *  Below `xl` it is a 320px overlay ON the conversation, and an overlay that
   *  starts open covers the thread a mentor came here to read. */
  const [railOpen, setRailOpen] = useState(false);

  /** ═══ REACTIONS ADDED THIS SESSION, KEYED BY MESSAGE ID ═══
   *  Not persisted, and `MessageActions` carries the reasoning: the four things
   *  this surface persists are the ones that have to survive a navigation to mean
   *  anything, and a reaction on a fixture message is not one of them. Held at the
   *  PAGE rather than in the thread so switching conversations and coming back
   *  does not lose them. */
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const react = (messageId: string, emoji: string) =>
    setReactions((r) => {
      const had = r[messageId] ?? [];
      // Pressing the same one again removes it — a reaction is a toggle, and a
      // menu that can only ever add is a menu that accumulates mistakes.
      return {
        ...r,
        [messageId]: had.includes(emoji)
          ? had.filter((e) => e !== emoji)
          : [...had, emoji],
      };
    });

  /* ═══ THE SCENARIO'S FIXTURES AND WHAT THIS SESSION HAS WRITTEN ═══
     The seed supplies the history; the store carries what the mentor has done
     since. They are merged at READ time rather than the store being pre-loaded
     with the fixtures — a store seeded from a scenario would have to be cleared
     and re-seeded on every scenario switch, and anything the mentor wrote in
     between would be indistinguishable from fixture data. */
  const writtenEvents = useOnboardingStore((s) => s.chatEvents);
  const writtenArtifacts = useOnboardingStore((s) => s.chatArtifacts);
  const writtenNotes = useOnboardingStore((s) => s.chatNotes);
  const writtenEscalations = useOnboardingStore((s) => s.escalations);
  const putEscalation = useOnboardingStore((s) => s.putEscalation);
  const appendChatEvent = useOnboardingStore((s) => s.appendChatEvent);
  const putChatArtifact = useOnboardingStore((s) => s.putChatArtifact);
  const putChatNote = useOnboardingStore((s) => s.putChatNote);

  const threads = data?.threads ?? [];
  /* ═══ THE ROUTE FIRST, THEN THE SCENARIO'S OWN FOCUS ═══
     `picked` is gone with the toggle: choosing a row navigates, so the route
     already carries the answer and a state copy could only disagree with it.
     The scenario's focus thread is still the fallback at `md` and up, where the
     thread pane needs something to show before anyone has chosen. */
  const selectedId = personId ?? data?.focusThreadId ?? null;
  /* ═══ TEENS ONLY (SUP-5) ═══ Support conversations live in the Support
     panel now; this page never selects one. */
  const teenThreads = useMemo(() => (data?.threads ?? []).filter((t) => t.kind === "teen"), [data]);
  const thread = teenThreads.find((t) => t.id === selectedId) ?? teenThreads[0];

  /* ═══ OPEN A SUPPORT THREAD IN THE PANEL (SUP-5) ═══ The one door into
     Support from outside it: a deep link to a support thread (anything that
     still links `/app/chat/s-…`) and the escalation banner's "Supervisor
     notified". Opening reads it, as a row does. Null when this persona cannot
     reach that contact, so the caller renders plain text rather than a link
     that opens the wrong place. */
  const canOpenInSupport = (id: string) => !!supportThread(id, persona, scenarioId, now);
  const supportLink = !!personId && threads.some((t) => t.id === personId && t.kind === "support");
  /* An effect because the route is the input: the handoff happens once the
     threads have loaded, then the URL goes back to the list, which is what
     this page shows. Module stores, so no setState runs here. */
  useEffect(() => {
    if (!supportLink || !personId) return;
    if (supportThread(personId, persona, scenarioId, now)) openInSupport(personId);
    router.replace("/app/chat");
  }, [supportLink, personId, persona, scenarioId, now, router]);
  /* MEMOISED for the same reason `events` and `artifacts` are: it feeds the Assist
     memo, and a fresh array every render makes that memo useless. */
  const messages = useMemo<ChatMessage[]>(
    () => (thread ? (data?.messages[thread.id] ?? []) : []),
    [thread, data]
  );

  /** Which artifact the DetailSheet is showing. Held by ID rather than by object,
   *  so the sheet re-reads the live record — a rescind that wrote to the store
   *  while a stale object sat in state would show the old completion. */
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);

  /* ═══ MEMOISED, BECAUSE THESE ARE THE INPUTS TO OTHER MEMOS ═══
     Both merge the scenario's fixtures with what this session has written, so both
     allocate a fresh array on every render — and a downstream memo keyed on an
     always-new array is a memo that never memoises. The first version worked around
     that with a hand-written dep list and an eslint-disable, which is the shape of
     a bug rather than a fix: `artifacts.length` does not change when a rescind
     mutates one entry in place.
     Memoising the SOURCE instead means the derived map's dep list is just
     `[artifacts]`, and it is correct by inspection. */
  const events = useMemo<ChatEvent[]>(() => {
    if (!thread) return [];
    return [
      ...(data?.events[thread.id] ?? []),
      ...(mounted ? (writtenEvents[thread.id] ?? []) : []),
    ];
  }, [thread, data, mounted, writtenEvents]);

  const artifacts = useMemo<SentArtifact[]>(() => {
    if (!thread) return [];
    return [
      ...Object.values(data?.artifacts ?? {}).filter((a) => a.threadId === thread.id),
      ...(mounted
        ? Object.values(writtenArtifacts).filter((a) => a.threadId === thread.id)
        : []),
    ];
  }, [thread, data, mounted, writtenArtifacts]);

  const artifactById = useMemo(
    () => Object.fromEntries(artifacts.map((a) => [a.id, a])),
    [artifacts]
  );

  /** Notes for this thread. There are no fixture notes — a note is something the
   *  mentor wrote, and seeding one would put words in their mouth. So Timeline's
   *  empty state is the first thing every scenario shows, which is the right thing
   *  for it to be good at. */
  const notes = useMemo<Note[]>(() => {
    if (!thread || !mounted) return [];
    return Object.values(writtenNotes).filter((n) => n.threadId === thread.id);
  }, [thread, mounted, writtenNotes]);

  /** ═══ THE STORE'S ESCALATION WINS OVER THE FIXTURE'S ═══
   *
   *  Both are keyed by thread id, and the store's is the one a mentor has touched —
   *  so a checked assessment step or a resolution has to beat the seed. The fixture
   *  exists so the escalation scenario OPENS mid-crisis rather than requiring
   *  somebody to perform one first; once the mentor acts, their record is the record.
   *
   *  A RESOLVED ESCALATION IS NOT AN ESCALATION. Resolving writes `resolvedAt`
   *  rather than deleting the row, because the history is that this happened — so
   *  the read filters it out here, once, and every consumer downstream sees
   *  `undefined` and renders the no-escalation state. */
  const escalation = useMemo<EscalationState | undefined>(() => {
    if (!thread) return undefined;
    const live =
      (mounted ? writtenEscalations[thread.id] : undefined) ??
      data?.escalations[thread.id];
    return live && live.resolvedAt === null ? live : undefined;
  }, [thread, mounted, writtenEscalations, data]);

  /** ═══ THE ASSIST LADDER'S INPUTS, AND THE TEEN BEHIND THE THREAD ═══
   *
   *  A thread id IS a person id (see `lib/chat/types.ts`), so the roster record is a
   *  lookup rather than a join — which is what lets the Assist rules read the same
   *  `mentorLastSentDaysAgo` stamps the list's Check-in filter reads, instead of a
   *  second copy that would drift. Null for a support thread: every rule in the
   *  ladder is about a mentorship. */
  const teen = useMemo(
    () => (thread?.kind === "teen" ? teensForMentor(LIVE_ID).find((t) => t.id === thread.id) : undefined),
    [thread]
  );
  const assist = useMemo<AssistInput | null>(
    () => (teen ? { teen, messages, artifacts, noteCount: notes.length, now } : null),
    [teen, messages, artifacts, notes.length, now]
  );
  /** `relLength` from `mentees-demo` rather than arithmetic here — the mentee table
   *  already phrases this, and two phrasings of one fact is how "5 months" and
   *  "171 days" end up on two surfaces. */
  const matchedFor = useMemo(
    () => (teen ? relLength(teenAsMentee(teen, now).matchedAt, now) : null),
    [teen, now]
  );

  /* ═══ THE RAIL IS CONTROLLED FROM HERE ═══
     Because tagging a message in the THREAD has to be able to open the note
     composer in the RAIL. A tab and a mode owned by the rail could only ever be set
     from inside it, so the two panels could not talk — and the primary way a note
     starts is exactly that conversation between them. */
  /** ═══ THE RAIL OPENS ON THE ESCALATION, WITHOUT AN EFFECT ═══
   *
   *  A screenshot caught it opening on Assist while a banner read "Escalation
   *  open" two inches away — the rail's job is "what to do next", and it was
   *  answering with a suggestion panel.
   *
   *  DERIVED, not synced. Storing the chosen tab WITH the thread it was chosen on
   *  means the default re-applies when the thread changes and when an escalation
   *  appears, with no effect to run one render late — and no `setState` in an
   *  effect, which `react-hooks/set-state-in-effect` would reject anyway. */
  const [pickedTab, setPickedTab] = useState<{ threadId: string; tab: RailTab } | null>(
    null
  );
  const railTab: RailTab =
    pickedTab && pickedTab.threadId === thread?.id
      ? pickedTab.tab
      : escalation
        ? "escalation"
        : "assist";
  /* ═══ ONE RIGHT-HAND SURFACE (SUP standing rule 6) ═══
     Every call here is a reader asking for the rail — raising an escalation,
     opening a note, tagging a message — so it closes Support, which is the
     other half of the mutual exclusion. A no-op when Support is closed. */
  const setRailTab = (tab: RailTab) => {
    if (!thread) return;
    setPickedTab({ threadId: thread.id, tab });
    setSupportOpen(false);
  };
  /** Support open on this screen collapses the rail to `RailStrip` (SUP-2). */
  const supportOpen = useSupportOpen();
  const stripped = supportOpen && !!thread;
  const [railMode, setRailMode] = useState<RailMode>({ kind: "list" });
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  /** Text the assessment wants put in the composer. A one-shot value the composer
   *  consumes — see the Composer's `insert` prop. */
  const [insert, setInsert] = useState<{ text: string; nonce: number } | null>(null);

  /** ═══ SENDING WRITES TWO RECORDS, AND NEITHER IS THE OTHER ═══
   *
   *  An `activity-sent` EVENT (append-only, the history) and a `SentArtifact` (the
   *  contents and, later, the completion). They are separate because their
   *  lifetimes differ: the artifact's `completion` changes as the teen works
   *  through it and its `rescindedAt` can be set, while the event that it was sent
   *  is a fact that never changes. Collapsing them would mean a rescind editing
   *  history.
   *
   *  The ids are derived from the thread and the instant, not from a counter, so
   *  two sends in one session cannot collide and nothing has to be persisted to
   *  keep a sequence. */
  const sendActivity = (activityId: ActivityId, items: SentArtifactItem[]) => {
    if (!thread) return;
    const at = Date.now();
    const artifactId = `art-${thread.id}-${at}`;
    putChatArtifact({
      id: artifactId,
      threadId: thread.id,
      activityId,
      sentAt: at,
      items,
      // UNOPENED, which is also what makes a rescind eligible (Phase 4).
      completion: { openedAt: null, completedItemIds: [] },
      rescindedAt: null,
    });
    appendChatEvent({
      id: `ev-${thread.id}-${at}`,
      threadId: thread.id,
      at,
      kind: "activity-sent",
      actorId: LIVE_ID,
      artifactId,
      artifactName: activityById(activityId).name,
    });
  };

  /** ═══ TAGGING A MESSAGE OPENS THE COMPOSER, PRE-LOADED ═══
   *
   *  Three things at once, and all three are the point: switch the rail to the panel
   *  that owns notes, put it into its composing mode, and hand it the reference
   *  built from the message. A mentor who tags a message should be typing one press
   *  later — anything that makes them then find the panel and press New has turned
   *  the primary path into the long one. */
  const tagMessage = (message: ChatMessage) => {
    if (!thread) return;
    const reference: ContextRef = {
      messageId: message.id,
      senderName:
        message.sender === "mentor" ? "You" : thread.displayName.split(" ")[0],
      at: message.at,
      // The FIRST LINE, not the whole message — see `ContextReference` on why the
      // note points at the transcript rather than copying it.
      firstLine: firstLineOf(
        message.text ?? message.media?.alt ?? "(no text)"
      ),
    };
    setRailTab("timeline");
    setRailMode({ kind: "composing", references: [reference] });
  };

  /** Saving writes the note AND appends a `note-added` event, so the thread and the
   *  timeline both show that documentation happened. The note is the record; the
   *  event is the history — the same separation sending an activity makes. */
  const saveNote = (draft: {
    title: string;
    body: string;
    references: ContextRef[];
    reminderAt: number | null;
  }) => {
    if (!thread) return;
    const at = Date.now();
    const id = `note-${thread.id}-${at}`;
    putChatNote({
      id,
      threadId: thread.id,
      title: draft.title,
      body: draft.body,
      createdAt: at,
      updatedAt: at,
      references: draft.references,
      reminderAt: draft.reminderAt,
    });
    appendChatEvent({
      id: `ev-${thread.id}-${at}`,
      threadId: thread.id,
      at,
      kind: "note-added",
      actorId: LIVE_ID,
      artifactId: id,
      artifactName: draft.title,
    });
  };

  /** ═══ RAISING AN ESCALATION NOTIFIES FIRST, THEN OPENS THE CHECKLIST ═══
   *
   *  The order matters and it is the whole design: the supervisor is notified at the
   *  moment the escalation is created, BEFORE the mentor has assessed anything. A
   *  flow that made notification the last step of a checklist would mean a
   *  frightened twenty-three-year-old deciding whether the situation qualifies —
   *  which is exactly the judgement this surface exists to take off them.
   *
   *  `supervisorNotifiedAt` is set here, in the same write, so the banner can state
   *  it as a fact from the first render. There is no pending state and no "sending"
   *  spinner: in this prototype the notification IS the record, and a spinner would
   *  be theatre over a write that already happened. */
  const raiseEscalation = (from: ChatMessage | null) => {
    if (!thread) return;
    const at = Date.now();
    putEscalation({
      id: `esc-${thread.id}-${at}`,
      threadId: thread.id,
      openedAt: at,
      anchorMessageId: from?.id ?? null,
      supervisorNotifiedAt: at,
      // TODO-DATA. The lead is the mentor's own, from the supervision edges in
      // people-demo — not a constant, so it is right when the roster changes.
      supervisorId: "s-brandy",
      assessment: {},
      resolvedAt: null,
      resolutionNoteId: null,
    });
    appendChatEvent({
      id: `ev-${thread.id}-${at}`,
      threadId: thread.id,
      at,
      kind: "escalation-opened",
      actorId: LIVE_ID,
      artifactId: `esc-${thread.id}-${at}`,
      artifactName: "an escalation",
    });
    // AND PUT THE CHECKLIST IN FRONT OF THEM. Raising it and then leaving a mentor
    // to find the panel is the moment they most need not to be looking for things.
    setRailTab("escalation");
    setRailMode({ kind: "list" });
  };

  /** Checking a step records WHEN. Steps do not un-check — see `AssessmentPanel`. */
  const checkStep = (stepId: string) => {
    if (!escalation || escalation.assessment[stepId]?.checked) return;
    putEscalation({
      ...escalation,
      assessment: {
        ...escalation.assessment,
        [stepId]: { checked: true, at: Date.now() },
      },
    });
  };

  /** ═══ RESOLVING WRITES THREE THINGS ═══
   *
   *  `resolvedAt` on the escalation, a NOTE holding the account of how it ended, and
   *  an `escalation-resolved` event. Three because they answer three different
   *  questions — is it live, what happened, and when did what happen — and one
   *  record answering all three would be a record that has to be edited to stay
   *  true.
   *
   *  The note is why the dialog demands prose: an escalation whose only trace is two
   *  timestamps tells a supervisor nothing about whether a teenager is all right. */
  const resolveEscalation = (resolution: { outcomeId: string; note: string }) => {
    if (!thread || !escalation) return;
    const at = Date.now();
    const noteId = `note-${thread.id}-${at}`;
    const outcome =
      RESOLUTION_OUTCOMES.find((o) => o.id === resolution.outcomeId)?.label ??
      resolution.outcomeId;
    putChatNote({
      id: noteId,
      threadId: thread.id,
      // TODO-COPY. The title is the OUTCOME, so a lead scanning Timeline sees how
      // it ended without opening it.
      title: `Escalation resolved — ${outcome.toLowerCase()}`,
      body: resolution.note,
      createdAt: at,
      updatedAt: at,
      /* THE ANCHOR TRAVELS INTO THE NOTE. The message that caused the escalation is
         the single most useful thing a supervisor reading back can be handed, and
         without this it would only exist on a record that is no longer live. */
      references: escalation.anchorMessageId
        ? (() => {
            const m = messages.find((x) => x.id === escalation.anchorMessageId);
            return m
              ? [
                  {
                    messageId: m.id,
                    senderName:
                      m.sender === "mentor" ? "You" : thread.displayName.split(" ")[0],
                    at: m.at,
                    firstLine: firstLineOf(m.text ?? m.media?.alt ?? "(no text)"),
                  },
                ]
              : [];
          })()
        : [],
      reminderAt: null,
    });
    putEscalation({ ...escalation, resolvedAt: at, resolutionNoteId: noteId });
    appendChatEvent({
      id: `ev-${thread.id}-${at}`,
      threadId: thread.id,
      at,
      kind: "escalation-resolved",
      actorId: LIVE_ID,
      artifactId: escalation.id,
      artifactName: "the escalation",
    });
    // BACK TO THE TIMELINE, where the resolution note now is — rather than to a tab
    // that has just vanished from under the reader.
    setRailTab("timeline");
    setRailMode({ kind: "list" });
  };

  /** ═══ RESCINDING WRITES, AND NEVER UNWRITES ═══
   *
   *  It sets `rescindedAt` on the artifact — which is what removes it from the
   *  teen's side — and APPENDS a second event. The original `activity-sent` is
   *  untouched, because the history is that this was sent and then taken back, and
   *  "never sent" is a different and untrue history.
   *
   *  The event log has no remove for exactly this reason: making the retraction a
   *  deletion would put the store one line of code away from being able to erase
   *  what a mentor did. */
  const rescind = (artifact: SentArtifact) => {
    const at = Date.now();
    putChatArtifact({ ...artifact, rescindedAt: at });
    appendChatEvent({
      id: `ev-${artifact.threadId}-${at}`,
      threadId: artifact.threadId,
      at,
      kind: "activity-rescinded",
      actorId: LIVE_ID,
      artifactId: artifact.id,
      artifactName: activityById(artifact.activityId).name,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ═══ THE GRID IS THE MECHANISM ═══
          Explicit column tracks rather than flex-basis, so the two fixed columns
          cannot be compressed by a long name in the middle one. `minmax(0,1fr)`
          on the thread is what lets it shrink below its content — without it a
          wide message would push the rail off the right edge. */}
      {/* ═══ THE CANVAS DECIDES, NOT THE VIEWPORT (SUP-2) ═══
          Support always pushes, so the same viewport can hand this page two
          widths. Each tier is its viewport breakpoint AND a canvas floor
          (`@container/canvas`, `AppShell`). The floors sit at or below the
          canvas each breakpoint gives with Support closed — measured: `md`
          (960) leaves staff 696 and mentors 852; `xl` (1280) leaves 1016 and
          1172 — so with it closed every width resolves exactly as before, and
          with it open (424 narrower) a tier drops when its floor is not met.
            640  = list 300 + a 340 conversation
            1000 = list 320 + rail 320 + a 360 conversation */}
      <div
        className={cn(
          // `relative` because the rail is ABSOLUTE below `xl` — see its note.
          "relative grid h-full min-h-0",
          // < 960: ONE column, and `view` decides which.
          "grid-cols-[minmax(0,1fr)]",
          // ≥ 960: list + thread. No third track: 300 + 320 leaves 280px for the
          // conversation at this width, which is a column of two-word lines.
          "md:@min-[640px]/canvas:grid-cols-[300px_minmax(0,1fr)]",
          // ≥ 1280: all three, always. The toggle is gone at this width.
          "xl:@min-[1000px]/canvas:grid-cols-[320px_minmax(0,1fr)_320px]",
          /* ═══ SUPPORT OPEN: THE RAIL IS A 56px STRIP, at every tier ═══
             Same track count as the three-column layout, so at `xl` the third
             track ANIMATES 320 → 56 alongside the push instead of swapping.
             Reduced motion: instant. One column shows the strip only beside a
             thread; the list has no rail to return to. */
          stripped && [
            view === "thread"
              ? "min-[768px]:grid-cols-[minmax(0,1fr)_56px]"
              : "md:grid-cols-[minmax(0,1fr)_56px]",
            "md:@min-[640px]/canvas:grid-cols-[300px_minmax(0,1fr)_56px]",
            "xl:@min-[1000px]/canvas:grid-cols-[320px_minmax(0,1fr)_56px]",
          ],
          "transition-[grid-template-columns] duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        )}
      >
        {/* ── LIST ──────────────────────────────────────────────────────── */}
        <ConversationList
          threads={threads}
          now={now}
          selectedId={thread?.id ?? null}
          onSelect={(id) => {
            /* A NAVIGATION, NOT A SETSTATE. Below `md` this hands over the
               screen exactly as the toggle did; the difference is that it also
               produces a URL, a history entry and a back gesture, and lets the
               shell see that a detail view is open. */
            router.push(chatThreadHref(id));
          }}
          className={cn(
            view === "thread" && "hidden md:flex",
            /* ═══ SUPPORT TOOK THE SECOND COLUMN ═══ At `md` with the canvas
               under the two-column floor (only reachable with Support open),
               the conversation stays and the LIST goes, whichever the route
               says: a mentor who opened Support mid-conversation asked about
               that conversation. Closing Support brings the list back. */
            "md:@max-[639px]/canvas:hidden"
          )}
        />

        {/* ── THREAD ────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex min-h-0 flex-col",
            view === "list" && "hidden md:flex"
          )}
        >
          {/* THE WAY BACK, below `md` only. Above it the list is on screen and a
              Back button would point at something already visible — or, with
              Support open below the two-column floor, at `/app/chat`, which at
              this width renders this same conversation. Closing Support is the
              way back to the list there. */}
          {view === "thread" && (
            /* ═══ A LINK, BECAUSE THREE GESTURES HAVE TO LAND ON THE LIST ═══
               Browser back, the Android system back gesture and iOS swipe-back
               all navigate — none of them fire an onClick. A button could only
               ever serve the fourth case, the tap, which is why this is an
               anchor with a real href.
               DEEP-LINK ENTRY GOES TO THE LIST, not the referrer: arriving from
               a record's Chat action and pressing "All conversations" should
               land somewhere that explains itself, and `router.back()` from that
               entry would return to the record — which is not what the label
               says. The browser's own back still returns to the referrer. */
            <Link
              href="/app/chat"
              data-slot="chat-back"
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-1.5 border-b border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 text-[var(--text-secondary)] md:hidden",
                "hover:text-[var(--text-primary)]",
                RING
              )}
              style={{ font: "var(--type-body)" }}
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              {/* TODO-COPY */}
              All conversations
            </Link>
          )}

          {thread ? (
            <div className="relative min-h-0 flex-1">
              <Thread
                /* ═══ "SUPERVISOR NOTIFIED" OPENS THEIR THREAD (SUP-5) ═══ The
                   moment a mentor most needs the person who was told. */
                onOpenSupervisor={
                  escalation && canOpenInSupport(escalation.supervisorId)
                    ? () => openInSupport(escalation.supervisorId)
                    : undefined
                }
                thread={thread}
                messages={messages}
                events={events}
                now={now}
                artifacts={artifactById}
                escalation={escalation}
                reactions={reactions}
                onReact={react}
                /* Teen threads only — a colleague's conversation has no teen to
                   document, and the menu then holds reactions alone rather than a
                   disabled row. */
                onTagMessage={thread.kind === "teen" ? tagMessage : undefined}
                onEscalateFrom={
                  thread.kind === "teen" ? (m) => raiseEscalation(m) : undefined
                }
                onOpenAssessment={() => {
                  setRailTab("escalation");
                  setRailMode({ kind: "list" });
                }}
                onOpenCrisis={() => setCrisisOpen(true)}
                onResolveEscalation={() => setResolveOpen(true)}
                insert={insert}
                phone={teen?.phone ?? null}
                onOpenEvent={(e) => {
                  /* ═══ A NOTE EVENT OPENS THE NOTE, NOT THE SHEET ═══
                     The DetailSheet reads artifacts; a `note-added` event's
                     `artifactId` is a note id. Routing both through the sheet would
                     have opened an empty dialog on every note chip. */
                  if (e.kind === "note-added") {
                    setRailTab("timeline");
                    setRailMode({ kind: "reading", noteId: e.artifactId });
                    return;
                  }
                  setOpenArtifactId(e.artifactId);
                }}
              />

              {/* ═══ ONE SHEET, NOT ONE PER CHIP ═══
                  A dialog per event would mount fifteen focus traps in a long
                  thread. The open artifact is an id in page state and the sheet
                  reads the live record, so a rescind performed inside it is
                  reflected the moment it closes. */}
              <DetailSheet
                artifact={
                  openArtifactId ? (artifactById[openArtifactId] ?? null) : null
                }
                theirName={thread.displayName.split(" ")[0]}
                open={!!openArtifactId && !!artifactById[openArtifactId]}
                onOpenChange={(o) => {
                  if (!o) setOpenArtifactId(null);
                }}
                onRescind={rescind}
              />

              <CrisisView
                info={
                  data?.emergency[thread.id] ?? {
                    // A thread with no fixture emergency record gets the same
                    // all-absent shape rather than a missing dialog — every
                    // scenario has to be able to open this.
                    teenPhone: null,
                    address: null,
                    liveLocation: null,
                    contact: null,
                  }
                }
                theirName={thread.displayName.split(" ")[0]}
                open={crisisOpen}
                onOpenChange={setCrisisOpen}
              />

              {escalation && (
                <ResolveDialog
                  escalation={escalation}
                  theirName={thread.displayName.split(" ")[0]}
                  open={resolveOpen}
                  onOpenChange={setResolveOpen}
                  onResolve={resolveEscalation}
                />
              )}

              {/* ═══ THE RAIL TOGGLE LIVES ON THE THREAD, NOT IN THE RAIL ═══
                  A control that hides a panel cannot live inside the panel it
                  hides, or closing it takes the control with it. Between `md` and
                  `xl` there is no room for three columns, so the rail is a toggle;
                  at `xl` it is always open and the toggle is gone. */}
              <button
                type="button"
                onClick={() => setRailOpen((o) => !o)}
                aria-pressed={railOpen}
                /* TODO-COPY */
                aria-label={railOpen ? "Hide conversation tools" : "Show conversation tools"}
                title={railOpen ? "Hide conversation tools" : "Show conversation tools"}
                className={cn(
                  "absolute right-3 top-2.5 hidden size-9 items-center justify-center rounded-full text-[var(--text-secondary)] md:@min-[640px]/canvas:flex xl:@min-[1000px]/canvas:hidden",
                  // The strip is the way back while Support is open.
                  stripped && "md:@min-[640px]/canvas:hidden",
                  "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                {railOpen ? (
                  <PanelRightClose className="size-[18px]" aria-hidden />
                ) : (
                  <PanelRight className="size-[18px]" aria-hidden />
                )}
              </button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <p
                className="text-[var(--text-secondary)]"
                style={{ font: "var(--type-body)" }}
              >
                {/* TODO-COPY. Only reachable with an empty roster. */}
                Choose a conversation to open it.
              </p>
            </div>
          )}
        </div>

        {/* ── RAIL ──────────────────────────────────────────────────────── */}
        {/* ═══ A GRID TRACK AT `xl`, AN OVERLAY BELOW IT ═══
            At `xl` there is room for three columns and the rail is simply the
            third one — `static`, always open, no toggle.
            Between `md` and `xl` there is not: the arithmetic above shows the
            thread would get 280px. So the rail becomes a 320px overlay on the
            thread's right edge, which a mentor opens when they want it and closes
            when they want the conversation back. An OVERLAY rather than a fourth
            layout, because the alternative — hiding the list to make room — would
            mean one control silently doing two different things.
            `absolute` also keeps it out of the grid's flow below `xl`, so it
            cannot create an implicit third track at `md`. */}
        {/* ═══ COLLAPSED, NOT CLOSED (SUP-2) ═══
            While Support is open the rail's tabs persist as a strip in the
            third track, and one click on a tab brings the rail back on it and
            closes Support. Focus follows to the rail's selected tab, since the
            strip button it was on is gone. */}
        {thread && stripped && (
          <div className={cn("min-w-0 overflow-hidden", view === "list" && "hidden md:block")}>
            <RailStrip
              tabs={tabsFor(thread.kind, !!escalation)}
              active={railTab}
              onOpen={(t) => {
                setRailTab(t);
                setRailOpen(true);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>('[data-slot="chat-rail"] [role="tab"][aria-selected="true"]')
                    ?.focus()
                );
              }}
            />
          </div>
        )}
        {thread && !stripped && (
          <div
            className={cn(
              "absolute inset-y-0 right-0 z-20 w-[320px] border-l border-[color:var(--border-subtle)] shadow-[var(--shadow-panel)]",
              "xl:@min-[1000px]/canvas:static xl:@min-[1000px]/canvas:z-auto xl:@min-[1000px]/canvas:w-auto xl:@min-[1000px]/canvas:shadow-none",
              // Hidden below `xl` until toggled; always present at `xl`.
              !railOpen && "hidden xl:@min-[1000px]/canvas:block"
            )}
          >
            <Rail
              thread={thread}
              artifacts={artifacts}
              events={events}
              notes={notes}
              escalation={escalation}
              assist={assist}
              matchedFor={matchedFor}
              now={now}
              tab={railTab}
              onTabChange={setRailTab}
              mode={railMode}
              onModeChange={setRailMode}
              onSendActivity={sendActivity}
              onSaveNote={saveNote}
              onOpenEvent={(e) => {
                if (e.kind === "note-added") {
                  setRailMode({ kind: "reading", noteId: e.artifactId });
                  return;
                }
                setOpenArtifactId(e.artifactId);
              }}
              /* ═══ A REFERENCE GOES BACK TO THE MESSAGE ═══
                 Which on a desktop means scrolling the transcript to it — the
                 thread is already on screen beside the note, so nothing needs to
                 navigate. Implemented as a DOM scroll rather than as state,
                 because the target is a rendered list item and the transcript's
                 own scroller is the thing that has to move. */
              onCheckStep={checkStep}
              /* PUTS THE SUGGESTED WORDING IN THE COMPOSER, unsent. The mentor still
                 presses Send — nothing reaches a teen that a mentor did not send. */
              onUseWording={(text) =>
                setInsert((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }))
              }
              onOpenCrisis={() => setCrisisOpen(true)}
              onResolveEscalation={() => setResolveOpen(true)}
              onOpenReference={(r) => {
                const el = document.getElementById(`msg-${r.messageId}`);
                el?.scrollIntoView({ block: "center", behavior: "smooth" });
                el?.classList.add("chat-ref-flash");
                window.setTimeout(() => el?.classList.remove("chat-ref-flash"), 1200);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
