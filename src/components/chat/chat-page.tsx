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
import { Rail, type RailMode, type RailTab } from "@/components/chat/rail/rail";
import { setSupportOpen, setSupportPinned, setSupportThread, useSupportOpen, useSupportThread } from "@/lib/support/panel";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useLiveMentorRow } from "@/lib/record/use-live-mentor";
import { DEMO_PEOPLE } from "@/lib/record/people-demo";
import { markSupportRead } from "@/lib/support/outbox";
import { supportThread } from "@/lib/support/threads";
import { EscalationBanner, Thread } from "@/components/chat/thread/thread";
import { DetailSheet } from "@/components/chat/thread/detail-sheet";
import { CrisisView } from "@/components/chat/escalation/crisis-view";
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
  Note,
  SentArtifact,
  SentArtifactItem,
} from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { CarePanel, type CareBrief } from "@/components/chat/rail/care";
import { StepDownRequestDialog, TierUpdateDialog } from "@/components/tiering/tier-update-module";
import { useTiering } from "@/lib/tiering/use-tiering";
import { workingTier } from "@/lib/tiering/escalation";
import { isAlertTier, type RaiseTarget } from "@/lib/tiering/tiers";
import { recordHrefFor } from "@/lib/record/subject";
import { presentationFor } from "@/lib/record/care-demo";
import { careSummaryFor } from "@/lib/record/care-summary-doc";

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
  const appendChatEvent = useOnboardingStore((s) => s.appendChatEvent);
  const writtenMessages = useOnboardingStore((s) => s.chatMessages);
  const appendChatMessage = useOnboardingStore((s) => s.appendChatMessage);
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
  /* ═══ FIXTURES + WHAT WAS SENT, MERGED AT READ TIME ═══ The same rule as
     `events`: the scenario supplies the history, the store carries what the
     mentor sent since, and neither is copied into the other. */
  const messages = useMemo<ChatMessage[]>(() => {
    if (!thread) return [];
    const fixture = data?.messages[thread.id] ?? [];
    const sent = mounted ? (writtenMessages[thread.id] ?? []) : [];
    return sent.length === 0 ? fixture : [...fixture, ...sent].sort((a, b) => a.at - b.at);
  }, [thread, data, mounted, writtenMessages]);

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
  /* ═══ MOVED (Tiering & Escalation pack): THE ONE STORE ═══ The merge
     above now lives in `useTiering`, which the user record and Monitoring
     read too — so the escalation a mentor sees here is the one in the
     Tier 1 lane. Same rule: the store's record wins, resolved is history. */
  const tiering = useTiering(now);
  const escalation = thread ? tiering.openEscalationFor(thread.id) : undefined;
  /** ═══ THE MENTOR'S WRAP-UP (M4) ═══ A closed escalation the mentor has
   *  not read yet keeps Care in the exchange until they do. Up here because
   *  the rail's default tab reads it — a wrap the rail opened past is a wrap
   *  nobody reads (measured: the rail landed on Assist). */
  const latest = thread ? tiering.escalationFor(thread.id) : undefined;
  const careEscalation =
    escalation ?? (!isSupervisorTier(persona) && latest && latest.resolvedAt !== null && !latest.wrapSeenAt ? latest : undefined);

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
      : careEscalation
        ? "care"
        : "assist";
  /* ═══ SUPERSEDED (support-beside-hub): THE HUB AND SUPPORT COEXIST ═══
     SUP standing rule 6 was "one right-hand surface at a time", so a reader
     asking for the rail closed Support. The pack replaces it on this screen:
     opening Support must not close the hub — the LIST collapses instead — so
     a tab change is only a tab change now. */
  const setRailTab = (tab: RailTab) => {
    if (!thread) return;
    setPickedTab({ threadId: thread.id, tab });
  };
  /** ═══ SUPPORT BESIDE THE HUB ═══ Open, the list collapses and the
   *  conversation and the hub split the canvas card 50/50; closed, the list
   *  returns (300 · flex · 360). The hub never unmounts either way. */
  const supportOpen = useSupportOpen();
  const supportThreadId = useSupportThread();
  const beside = supportOpen && !!thread;
  /** ═══ A SUPERVISOR WATCHES (support-beside-hub) ═══ The conversation is
   *  the observed mentor's, read-only. */
  const liveMentor = useLiveMentorRow();
  const observer = isSupervisorTier(persona)
    ? { mentorName: liveMentor?.name || "The mentor" }
    : undefined;
  /* THE OTHER PARTY TO THIS ESCALATION, when Support is open on them: the
     notified supervisor for a mentor, the mentor for a supervisor. */
  const otherParty = escalation ? (observer ? LIVE_ID : escalation.supervisorId) : null;
  const otherName = otherParty === LIVE_ID
    ? (observer?.mentorName ?? "")
    : (DEMO_PEOPLE.find((x) => x.id === otherParty)?.name ?? "");
  /* A first name when there is a name; the whole fallback when there is not
     (measured: an unnamed mentor read "The is in this chat"). */
  const otherFirst = otherParty === LIVE_ID && !liveMentor?.name ? "The mentor" : otherName.split(" ")[0];
  const presence =
    supportOpen && otherParty && supportThreadId === otherParty && otherName
      ? /* TODO-COPY */ `${otherFirst} is in this chat`
      : undefined;
  /* ═══ PINNED FOR A SUPERVISOR ═══ While an escalation is open on what a
     supervisor is watching, the observed mentor is pinned at the top of their
     Support list. Published to the panel's store; cleared on the way out. */
  const pinMentor = !!observer && !!escalation;
  const pinnedName = observer?.mentorName ?? "";
  /* TODO-COPY. An unnamed mentor is addressed as "the mentor". */
  const pinnedShort = liveMentor?.name ? liveMentor.name.split(" ")[0] : "the mentor";
  useEffect(() => {
    if (!pinMentor) return;
    setSupportPinned({ id: LIVE_ID, name: pinnedName, shortName: pinnedShort });
    return () => setSupportPinned(null);
  }, [pinMentor, pinnedName, pinnedShort]);
  const [railMode, setRailMode] = useState<RailMode>({ kind: "list" });
  const [crisisOpen, setCrisisOpen] = useState(false);
  /** Text the assessment wants put in the composer. A one-shot value the composer
   *  consumes — see the Composer's `insert` prop. */
  const [insert, setInsert] = useState<{ text: string; nonce: number } | null>(null);

  /** Which tier dialog is up: a supervisor's update, a mentor's request. */
  const [tierDialog, setTierDialog] = useState<"update" | "step-down" | null>(null);

  /* ═══ WHAT THE CARE TAB READS ═══ */
  const emergencyInfo = (thread && data?.emergency[thread.id]) || {
    teenPhone: null,
    address: null,
    liveLocation: null,
    contact: null,
  };
  const supervisorFirst =
    (escalation && DEMO_PEOPLE.find((x) => x.id === escalation.supervisorId)?.name.split(" ")[0]) || "Your supervisor";
  /* GUIDANCE LIVES ON THE RECORD NOW (pack v2.0) — `escalation.guidance`,
     written by the supervisor's S2 composer, read by the mentor's M3. */
  /** The conversation's own lines, for the supervisor's debrief draft. */
  const teenLines = useMemo(() => messages.filter((m) => m.sender === "them" && m.text).map((m) => m.text!), [messages]);
  const mentorLines = useMemo(() => messages.filter((m) => m.sender === "mentor" && m.text).map((m) => m.text!), [messages]);
  const careReviews = useOnboardingStore((s) => s.careReviews);
  const careUpdates = useOnboardingStore((s) => s.careUpdates);
  const careFlagClosures = useOnboardingStore((s) => s.careFlagClosures);
  /** ═══ THE CARE BRIEF — A MINIMISED READ OF THE CARE RECORD ═══ The same
   *  derivations the record's Care tab uses (`presentationFor`,
   *  `careSummaryFor`), read-only here. */
  const careBrief: CareBrief = useMemo(() => {
    const id = thread?.id ?? "";
    if (!mounted || !thread || thread.kind !== "teen")
      return { presentation: null, code: null, summary: null, freshAt: null, href: recordHrefFor(id) };
    const store = { decisions: Object.values(careReviews), updates: Object.values(careUpdates), closures: Object.values(careFlagClosures) };
    const p = presentationFor(id, now, store);
    const doc = careSummaryFor(id, now, store);
    const latest = Object.values(careUpdates).filter((u) => u.teenId === id).sort((a, b) => b.createdAt - a.createdAt)[0];
    return {
      presentation: p?.statement ?? null,
      code: p?.code ?? null,
      summary: doc?.conversationSummary ?? null,
      freshAt: latest?.createdAt ?? p?.reviewedAt ?? p?.assignedAt ?? null,
      href: `${recordHrefFor(id)}?tab=care`,
    };
  }, [mounted, thread, careReviews, careUpdates, careFlagClosures, now]);

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
  /* ═══ SUPERSEDED (Tiering & Escalation pack): THREE DOORS, ONE FLOW ═══
     Raising used to write the escalation in one press. Now every entry —
     Care's Escalate, the conversation menu, a message's action — opens the
     raise flow in the Care tab (pick a tier, say what is happening,
     confirm), carrying the message it came from. The notification still
     happens in the same write as the record, on Confirm (`confirmRaise`):
     the order the old note argued for is unchanged. */
  const [raise, setRaise] = useState<{ threadId: string; anchorMessageId: string | null } | null>(null);
  const raising = !!raise && raise.threadId === thread?.id;
  const raiseEscalation = (from: ChatMessage | null) => {
    if (!thread) return;
    setRaise({ threadId: thread.id, anchorMessageId: from?.id ?? null });
    setRailTab("care");
    setRailMode({ kind: "list" });
    /* Below `xl` the hub is a drawer — open it, or the flow is invisible
       (the audit's gap: raising selected the tab and left it closed). */
    setRailOpen(true);
  };
  const confirmRaise = ({ target, note }: { target: RaiseTarget; note: string }) => {
    if (!thread || !raise) return;
    const e = tiering.raise({ teenId: thread.id, target, note, anchorMessageId: raise.anchorMessageId });
    appendChatEvent({
      id: `ev-${thread.id}-${e.openedAt}`,
      threadId: thread.id,
      at: e.openedAt,
      kind: "escalation-opened",
      actorId: LIVE_ID,
      artifactId: e.id,
      artifactName: "an escalation",
    });
    setRaise(null);
  };

  /* ═══ RETIRED (pack v2.0): the checklist's `checkStep`, the safety check's
     handlers and the mentor's `resolveEscalation`. The assessment, the
     supervisor's confirmation, guidance, crisis note, outcome and close are
     all `useTiering` moves now, on the one record. */

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
      {/* ═══ NAMED AREAS (support-beside-hub) ═══ list · banner · thread ·
          rail. The banner has its own row over the conversation AND the hub,
          so an escalation spans the canvas card rather than one pane of it.
          CLOSED: < 960 one column; ≥ 960 list + thread (the hub an overlay);
          ≥ 1280 list 300 · thread · hub 360 (300 + 360 + a 340 conversation =
          the 1000 floor). OPEN: the list is gone; ≥ 680 of canvas the thread
          and hub split 50/50, below it the hub is a drawer over the
          conversation. Track counts differ between the two, so the change is a
          swap, not an animation. */}
      <div
        data-chat-layout={beside ? "beside" : "list"}
        className={cn(
          // `relative` because the rail is ABSOLUTE wherever it is a drawer.
          "relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]",
          "grid-cols-[minmax(0,1fr)] [grid-template-areas:'banner'_'thread']",
          beside
            ? /* Two panes from a 1120 VIEWPORT, the pack's rule (it was a
                 680 canvas floor, which turned the hub into a drawer at 1280
                 for staff: their nav is 248, not the Figma's 232). The 600
                 canvas guard keeps 300 a pane. */
              "min-[1120px]:@min-[600px]/canvas:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[1120px]:@min-[600px]/canvas:[grid-template-areas:'banner_banner'_'thread_rail']"
            : [
                "md:@min-[640px]/canvas:grid-cols-[300px_minmax(0,1fr)] md:@min-[640px]/canvas:[grid-template-areas:'list_banner'_'list_thread']",
                "xl:@min-[1000px]/canvas:grid-cols-[300px_minmax(0,1fr)_360px] xl:@min-[1000px]/canvas:[grid-template-areas:'list_banner_banner'_'list_thread_rail']",
              ]
        )}
      >
        {/* ── THE ACTION BAR SLOT: the banner spans thread + hub ─────────── */}
        {thread && escalation && (
          <div data-chat-banner className={cn("[grid-area:banner]", view === "list" && "hidden md:block")}>
            <EscalationBanner
              escalation={escalation}
              onOpenSupervisor={
                !observer && canOpenInSupport(escalation.supervisorId)
                  ? () => openInSupport(escalation.supervisorId)
                  : undefined
              }
              /* The WORKING tier — a supervisor's adjustment recolours it. */
              tone={isAlertTier(workingTier(escalation, tiering.stateFor(thread.id))) ? "critical" : "neutral"}
              onOpenAssessment={() => {
                setRailTab("care");
                setRailMode({ kind: "list" });
                setRailOpen(true);
              }}
              onOpenCrisis={() => setCrisisOpen(true)}
            />
          </div>
        )}

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
            /* One area with the thread below `md` (the route picks which
               shows); its own column above it. */
            "[grid-area:thread] md:@min-[640px]/canvas:[grid-area:list] row-span-2",
            view === "thread" && "hidden md:flex",
            /* ═══ SUPPORT OPEN: THE LIST COLLAPSES ═══ Not narrowed — gone.
               Back to chats, in the conversation header, brings it back. */
            beside && "!hidden"
          )}
        />

        {/* ── THREAD ────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex min-h-0 flex-col [grid-area:thread]",
            view === "list" && "hidden md:flex"
          )}
        >
          {/* THE WAY BACK, below `md` only. Above it the list is on screen and a
              Back button would point at something already visible — or, with
              Support open below the two-column floor, at `/app/chat`, which at
              this width renders this same conversation. Closing Support is the
              way back to the list there. */}
          {view === "thread" && !beside && (
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
                /* The way back to the list while Support has it collapsed:
                   closing Support is what restores it (the pack's rule 4). */
                onBackToChats={beside ? () => setSupportOpen(false) : undefined}
                observer={observer}
                thread={thread}
                messages={messages}
                events={events}
                now={now}
                artifacts={artifactById}
                escalation={escalation}
                reactions={reactions}
                /* READ-ONLY for an observer: no reactions, notes or escalate
                   from a conversation they are invisible in. */
                onReact={observer ? undefined : react}
                /* Teen threads only — a colleague's conversation has no teen to
                   document, and the menu then holds reactions alone rather than a
                   disabled row. */
                onTagMessage={!observer && thread.kind === "teen" ? tagMessage : undefined}
                onEscalateFrom={
                  !observer && thread.kind === "teen" ? (m) => raiseEscalation(m) : undefined
                }
                insert={observer ? null : insert}
                /* ═══ SEND GOES SOMEWHERE (pack v3.0, Phase 0's confirmed bug) ═══
                   An observer has no composer, so no sender. */
                onSend={
                  observer
                    ? undefined
                    : (text) => {
                        const at = Date.now();
                        appendChatMessage({ id: `sent-${thread.id}-${at}`, threadId: thread.id, at, sender: "mentor", kind: "text", text });
                      }
                }
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
                /* A thread with no fixture emergency record gets the all-absent
                   shape rather than a missing dialog — every scenario has to be
                   able to open this. */
                info={emergencyInfo}
                theirName={thread.displayName.split(" ")[0]}
                open={crisisOpen}
                onOpenChange={setCrisisOpen}
              />

              {tierDialog === "update" && observer && (
                <TierUpdateDialog
                  open
                  onOpenChange={(o) => !o && setTierDialog(null)}
                  state={tiering.stateFor(thread.id)}
                  name={thread.displayName.split(" ")[0]}
                  nameOf={tiering.nameOf}
                  onSetTier={({ tier, reason }) => tiering.setTier({ teenId: thread.id, tier, reason })}
                  onDecline={(reason) => tiering.decline({ teenId: thread.id, reason })}
                />
              )}
              {tierDialog === "step-down" && !observer && (() => {
                const from = tiering.stateFor(thread.id).tier;
                return from === 2 || from === 3 ? (
                  <StepDownRequestDialog
                    open
                    onOpenChange={(o) => !o && setTierDialog(null)}
                    name={thread.displayName.split(" ")[0]}
                    from={from}
                    onRequest={({ tier, reason }) => tiering.requestStepDown({ teenId: thread.id, tier, reason })}
                  />
                ) : null;
              })()}


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
                  "absolute right-3 top-2.5 hidden size-9 items-center justify-center rounded-full text-[var(--text-secondary)]",
                  /* Shown wherever the hub is a drawer: closed between `md`
                     and `xl`; open, below the 680 two-pane floor. */
                  beside
                    ? "flex min-[1120px]:@min-[600px]/canvas:hidden"
                    : "md:@min-[640px]/canvas:flex xl:@min-[1000px]/canvas:hidden",
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
        {/* ═══ SUPERSEDED (support-beside-hub): NO STRIP ═══ SUP-2 collapsed
            the hub to a 56px strip of its tabs while Support was open. The
            pack reverses it: the hub stays and the list collapses, so the
            strip has nothing left to stand in for. */}
        {/* ═══ ONE HUB, ALWAYS MOUNTED ═══ The same element whichever layout
            is up — a track, or a drawer — so its tab and mode never reset when
            Support opens or closes. */}
        {thread && (
          <div
            data-chat-hub
            className={cn(
              "absolute inset-y-0 right-0 z-20 w-[360px] max-w-full border-l border-[color:var(--border-subtle)] shadow-[var(--shadow-panel)]",
              beside
                ? [
                    "min-[1120px]:@min-[600px]/canvas:static min-[1120px]:@min-[600px]/canvas:z-auto min-[1120px]:@min-[600px]/canvas:w-auto min-[1120px]:@min-[600px]/canvas:max-w-none min-[1120px]:@min-[600px]/canvas:shadow-none min-[1120px]:@min-[600px]/canvas:[grid-area:rail]",
                    !railOpen && "hidden min-[1120px]:@min-[600px]/canvas:block",
                  ]
                : [
                    "xl:@min-[1000px]/canvas:static xl:@min-[1000px]/canvas:z-auto xl:@min-[1000px]/canvas:w-auto xl:@min-[1000px]/canvas:max-w-none xl:@min-[1000px]/canvas:shadow-none xl:@min-[1000px]/canvas:[grid-area:rail]",
                    // Hidden below `xl` until toggled; always present at `xl`.
                    !railOpen && "hidden xl:@min-[1000px]/canvas:block",
                  ]
            )}
          >
            <Rail
              thread={thread}
              artifacts={artifacts}
              events={events}
              notes={notes}
              careDot={escalation ? (isAlertTier(workingTier(escalation, tiering.stateFor(thread.id))) ? "alert" : "neutral") : null}
              care={
                <CarePanel
                  teenId={thread.id}
                  name={thread.displayName.split(" ")[0]}
                  now={now}
                  tiering={tiering}
                  escalation={careEscalation}
                  observer={!!observer}
                  raising={raising}
                  onStartRaise={() => raiseEscalation(null)}
                  onCancelRaise={() => setRaise(null)}
                  onConfirmRaise={confirmRaise}
                  onUseWording={(text) => setInsert((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }))}
                  onOpenCrisis={() => setCrisisOpen(true)}
                  onUpdateTier={() => setTierDialog("update")}
                  onRequestStepDown={() => setTierDialog("step-down")}
                  supervisorName={supervisorFirst}
                  onReplyInSupport={
                    !observer && escalation && canOpenInSupport(escalation.supervisorId)
                      ? () => openInSupport(escalation.supervisorId)
                      : undefined
                  }
                  presence={presence}
                  emergency={emergencyInfo}
                  brief={careBrief}
                  teenLines={teenLines}
                  mentorLines={mentorLines}
                  /* Closing (or leaving the wrap) ends the escalation the
                     default tab was following — pin Care so the person who
                     just acted sees the steady state and its history. */
                  onSettled={() => setRailTab("care")}
                />
              }
              assist={assist}
              matchedFor={matchedFor}
              now={now}
              tab={railTab}
              onTabChange={setRailTab}
              presence={presence}
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
              /* THE SUGGESTED WORDING goes in the composer, unsent — through the
                 Care panel's `onUseWording` above. Nothing reaches a teen that a
                 mentor did not press Send on. */
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
