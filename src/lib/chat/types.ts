// MENTOR CHAT — the data model.
//
// ═══ A THREAD IS A PERSON ═══
//
// There is no thread entity, no participants array, no join. `ThreadId` IS a
// person id from `people-demo.ts` — "t18" for Caleb, "s-brandy" for the lead
// mentor. Every thread in this product is one mentor talking to one other human,
// and modelling that as a two-row participants table would buy nothing and cost
// a lookup at every call site.
//
// It also means the deep link already works: `chatHrefFor(personId)` in
// `lib/record/chat.ts` produces `/app/chat?with=t18`, every record table's Chat
// action already points there, and `?with=` resolves straight to a thread id with
// no mapping table in between.
//
// ═══ TEENS AND SUPPORT ARE THE SAME SHAPE, DELIBERATELY ═══
//
// A support thread (the mentor's lead, their supervisor) carries exactly the same
// fields as a teen thread. That sameness is the whole argument for putting them
// in one list behind a visible switch rather than hiding one of them behind a
// dropdown: they are the same kind of object, and a mentor who has a question for
// their lead is doing the same thing they do all day.
//
// What DIFFERS is what the rail offers — a support thread has no activities to
// send and no teen profile to read — and that difference is expressed by the rail
// reading `kind`, not by a second thread type.
//
// ═══ EVERY RECORD IS APPEND-ONLY EXCEPT `completion` ═══
//
// Messages are never edited. Events are never retracted — a rescinded activity
// gets a SECOND event, and the first one stays, because "this was sent and then
// pulled back" is the true history and "this was never sent" is not. The one
// mutable field in the model is a sent artifact's `completion`, which tracks what
// the teen has actually done with it.

import type { RaiseTarget, Tier } from "@/lib/tiering/tiers";

import type { LucideIcon } from "lucide-react";

/** A person id, doubling as the thread id. See the module note. */
export type ThreadId = string;

/** Which workspace a thread belongs to. The list's visible switch reads this. */
export type ThreadKind = "teen" | "support";

/** Who wrote a message. `them` rather than `teen` because a support thread's
 *  other party is a colleague — one word covering both is what lets one bubble
 *  component serve both kinds of thread. */
export type Sender = "mentor" | "them";

// ── Messages ────────────────────────────────────────────────────────────────

/** ═══ MEDIA CARRIES ITS OWN DIMENSIONS ═══
 *
 *  `w` and `h` are on the record, not measured from a loaded image, and that is
 *  the single decision that makes "media skeletons sized to content" true rather
 *  than aspirational. A frame that knows its aspect ratio before the bytes
 *  arrive occupies its final space immediately: nothing below it moves when the
 *  image resolves, and there is no spinner, because a spinner is what you show
 *  when you do not know how much room to leave.
 *
 *  `src` is optional and absent throughout the fixtures — see the Phase 0 note on
 *  there being no photography in this prototype. The frame renders correctly
 *  either way, which is the point of separating dimensions from bytes. */
export interface MessageMedia {
  w: number;
  h: number;
  /** Required, not optional. A photo a teen shared is the one kind of content on
   *  this surface a screen-reader user cannot get any other way. */
  alt: string;
  src?: string;
}

export interface MessageReaction {
  emoji: string;
  by: Sender;
}

export interface ChatMessage {
  id: string;
  threadId: ThreadId;
  at: number;
  sender: Sender;
  kind: "text" | "image" | "voice" | "gif";
  text?: string;
  media?: MessageMedia;
  /** Voice notes. Rendered as a duration, never as a live waveform — there is no
   *  audio in this prototype and a scrubber that cannot scrub is a lie. */
  durationSec?: number;
  reactions?: MessageReaction[];
  /** ═══ WHERE A SENT LINE CAME FROM (pack v4.0, F2) ═══ An assessment
   *  question the mentor put in the message box with "Ask in chat" and sent.
   *  Written once at send, append-only like the message. Ava's nudges carry
   *  NO origin — they are never recorded. */
  origin?: MessageOrigin;
}

export interface MessageOrigin {
  kind: "assessment";
  questionId: string;
}

// ── Events ──────────────────────────────────────────────────────────────────

/** ═══ ONE RECORD, TWO RENDERINGS ═══
 *
 *  An event renders as an `EventChip` inline in the thread AND as a row in the
 *  Timeline panel, from the same record and the same component. Two sources for
 *  "what happened in this mentorship" is how a thread and a timeline end up
 *  disagreeing about it. */
export type ChatEventKind =
  | "activity-sent"
  | "activity-rescinded"
  | "note-added"
  | "swap-started"
  | "escalation-opened"
  | "escalation-resolved";

export interface ChatEvent {
  id: string;
  threadId: ThreadId;
  at: number;
  kind: ChatEventKind;
  /** Who did it. The mentor for almost everything; a supervisor for an
   *  escalation acknowledgement. */
  actorId: string;
  /** What it concerns — a `SentArtifact` id, a `Note` id, an escalation id. */
  artifactId: string;
  /** Denormalised so a chip can render without resolving the artifact. The
   *  artifact may be rescinded; the event's account of what it WAS does not
   *  change when that happens. */
  artifactName: string;
}

// ── Activities ──────────────────────────────────────────────────────────────

export type ActivityId =
  | "hot-takes"
  | "connection-cards"
  | "deep-thoughts"
  | "swaps"
  | "moments";

/** Which Bloom band an activity's cover is washed in. Named rather than a raw
 *  token string so the set of legal washes is a closed list. */
export type ActivityWash = "sand" | "amber" | "sage" | "clay" | "rose";

/** ═══ META IS STRUCTURED, NOT A STRING ═══
 *
 *  The legacy build wrote each activity's metadata as prose per activity, and the
 *  five came out in five different formats — one said "3 cards", one said "about
 *  2 minutes", one said nothing. Holding count, unit and minutes as separate
 *  fields means the cover FORMATS them, once, and "identical format across all
 *  five" is true by construction instead of by proofreading. */
export interface ActivityMeta {
  count: number;
  /** Singular. The formatter pluralises — "1 question", "3 questions". */
  unit: string;
  minutes: number;
}

export interface ActivityDef {
  id: ActivityId;
  name: string;
  glyph: LucideIcon;
  wash: ActivityWash;
  /** One sentence on what this does for the mentorship. Not a feature
   *  description — the mentor's question is "why would I send this", and a cover
   *  that answers "what is it" leaves them to guess. */
  purpose: string;
  /** What the mentor does and what the teen receives, in that order. */
  mechanic: string;
  meta: ActivityMeta;
  /** ═══ LOCKED IS VISIBLE, NEVER HIDDEN ═══
   *  An activity that needs groundwork first stays on the shelf, legible, saying
   *  what unlocks it. Hiding it means a mentor never learns it exists; greying it
   *  out with no reason means they learn it exists and not how to get it. */
  locked?: {
    requires: ActivityId[];
    /** Plain language, naming the condition. */
    microcopy: string;
  };
}

// ── Sent artifacts ──────────────────────────────────────────────────────────

export interface SentArtifactItem {
  id: string;
  text: string;
}

export interface SentArtifact {
  id: string;
  threadId: ThreadId;
  activityId: ActivityId;
  sentAt: number;
  items: SentArtifactItem[];
  /** The only mutable part of the model. */
  completion: {
    /** Null until the teen opens it — which is also the rescind window. */
    openedAt: number | null;
    completedItemIds: string[];
  };
  /** RETRACTS FROM THE TEEN'S VIEW. The `activity-sent` event stays and an
   *  `activity-rescinded` event joins it, because the history is that this was
   *  sent and then pulled back. */
  rescindedAt: number | null;
}

// ── Documentation ───────────────────────────────────────────────────────────

/** A pointer back into the thread. Sender, time and first line — enough to
 *  recognise the message, short enough to sit inside a composer. */
export interface ContextRef {
  messageId: string;
  senderName: string;
  at: number;
  firstLine: string;
}

export interface Note {
  id: string;
  threadId: ThreadId;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  references: ContextRef[];
  reminderAt: number | null;
}

// ── Escalation ──────────────────────────────────────────────────────────────

export interface EscalationState {
  id: string;
  threadId: ThreadId;
  openedAt: number;
  /** Set when the escalation was raised FROM a specific message, so the thread
   *  can show which one it was about. Null when raised from the kebab. */
  anchorMessageId: string | null;
  /** A TIMESTAMPED FACT, not a toast. The mentor who raised this needs to be able
   *  to check, an hour later and after a navigation, that someone knows. */
  supervisorNotifiedAt: number;
  supervisorId: string;
  /* ═══ THE CHECKLIST FIELD IS GONE (Escalation Exchange, pack v2.0) ═══ The
     5-step `assessment` map was one of two question sets; the sequential
     six-question assessment in `safetyCheck` replaced both. */
  resolvedAt: number | null;
  resolutionNoteId: string | null;
  /* ═══ TIERING (pack v1.0) — optional, so a record written before tiering
     existed still reads. Go through `lib/tiering/escalation.ts` rather than
     reading these directly; it supplies the defaults. ═══ */
  /** What the mentor raised: Tier 1–3, or Platform safety. */
  requested?: RaiseTarget;
  /** "What's happening?" — the line the supervisor reads first. */
  contextNote?: string;
  /** The six-question assessment (pack v2.0), Tier 1–2 only — the same
   *  record the supervisor's view renders, so answers stream as given.
   *  `submittedAt` is the mentor's Submit to supervisor. */
  safetyCheck?: SafetyCheck;
  /** "In a sentence or two, what's going on" — the mentor's, after Q6. */
  mentorSummary?: string;
  /* ═══ THE EXCHANGE (pack v2.0) — the supervisor's half of the record ═══ */
  /** S1: the tier the supervisor confirmed (or adjusted to). */
  confirmedTier?: Tier;
  confirmedAt?: number;
  /** RECORD METADATA, NEVER RENDERED: how long the confirmation took. */
  meta?: { timeToConfirmMs?: number };
  /* ═══ NO GUIDANCE FIELD (pack v3.0, Supersession 2) ═══ v2 stored the
     supervisor's guidance here; coaching happens in the Support thread now,
     and the timeline links to it. */
  /** S2: the crisis note, section by section. Append-only once closed. */
  crisisNote?: CrisisNote;
  /** ═══ CHAT MOMENTS ADDED TO THE ESCALATION (pack v3.0, Workstream C) ═══
   *  APPEND-ONLY. A message the mentor attached from the thread, with an
   *  optional note, quote-framed on the timeline in both lenses. The quote is
   *  a SNAPSHOT, so the record stands on its own if the thread is rebuilt. */
  moments?: EscalationMoment[];
  /** S3: the outcome and debrief. */
  outcome?: EscalationOutcome;
  /** ═══ AMENDMENTS (pack v6.1, B6) ═══ APPEND-ONLY. A saved crisis-note row
   *  re-opened and saved again before the close: what it said BEFORE, and
   *  when it changed. The note's fields hold the current answer; this log is
   *  how a re-save never erases what was first recorded. */
  noteAmendments?: NoteAmendment[];
  /** S4: the follow-up filed when the escalation closed. */
  followUp?: { dueAt: number; status: string | null };
  /** M4: when the mentor read the wrap-up, after which Care is steady. */
  wrapSeenAt?: number;
}

export interface CrisisNote {
  /** When each section was first completed — its own node's time on the
   *  timeline (pack v3.0). `updatedAt` stays the note's last write. */
  sectionAt?: Partial<Record<"subtype" | "safety-plan" | "resources" | "referral" | "emergency", number>>;
  subtype?: string;
  tags?: string[];
  safetyPlan?: { status: string; usage: string };
  resources?: { shared: boolean | null; list: string };
  referral?: { made: boolean | null; list: string[] };
  contact?: { engaged: boolean | null; details: string };
  services?: { contacted: boolean | null; which: string[] };
  updatedAt?: number;
}

export interface EscalationOutcome {
  id: string;
  /** Whether `id` is still the auto-tag, or the supervisor changed it. */
  autoTagged: boolean;
  debrief: string;
  /** True while the debrief is the untouched AI draft. */
  debriefIsDraft: boolean;
  plan: string;
  additional: string;
  /** When the outcome was chosen — its own timeline node, before the debrief
   *  (pack v3.0). Absent on records written before the split. */
  chosenAt?: number | null;
  /** When the debrief was saved: the outcome step is done. */
  savedAt: number | null;
  /** ═══ THE REVIEW DOT'S BASIS (pack v6.1, B4) ═══ What the note suggested
   *  (`autoOutcome`) when this outcome was saved. If the note now suggests
   *  something else, the Outcome row is marked for review — never silently
   *  edited. Absent on records from before v6.1, which are never flagged. */
  basis?: string | null;
}

export interface NoteAmendment {
  /** The row: a crisis-note section, "outcome" or "debrief". */
  row: string;
  at: number;
  /** The row's fields as they were, before this save. */
  before: Partial<CrisisNote> | Partial<EscalationOutcome>;
}

export interface EscalationMoment {
  id: string;
  at: number;
  messageId: string;
  /** Optional — an empty string when the mentor added none. */
  note: string;
  actor: { id: string; name: string; role: "mentor" | "supervisor" };
  quote: { text: string; sender: Sender; senderName: string; at: number };
}

export interface SafetyCheck {
  /** Keyed by question id. `at` is when it was answered. */
  answers: Record<string, { value: "yes" | "no"; at: number }>;
  /** Null until Submit; then read-only, "Sent to supervisor". */
  submittedAt: number | null;
}

/** ═══ EVERY FIELD NULLABLE ON PURPOSE ═══
 *
 *  The crisis view has to work when the data is thin, because that is exactly
 *  when it gets opened. Making these nullable in the TYPE means the unavailable
 *  state is designed and exercised by a scenario rather than described in a
 *  comment and discovered in a demo. */
export interface EmergencyInfo {
  teenPhone: string | null;
  address: string | null;
  liveLocation: { label: string; at: number } | null;
  contact: { name: string; relation: string; phone: string } | null;
}

// ── The thread ──────────────────────────────────────────────────────────────

/** A badge on the thread header — a durable fact about the relationship, not a
 *  transient state. "Re-matched" is one; an escalation is NOT, because that is a
 *  `StatusBanner`, which is a different weight of thing. */
export type ThreadBadge = "re-matched" | "new-match" | "paused";

export interface ChatThread {
  id: ThreadId;
  kind: ThreadKind;
  /** Rendered name. Teens go through `teenDisplayName`; staff use their own. */
  displayName: string;
  /** Header subtitle — "16 · she/her" for a teen, "Lead mentor" for support. */
  subtitle: string;
  avatarInitial: string;
  badge?: ThreadBadge;
  /** Drives list order. The most recent of any message or event. */
  lastActivityAt: number;
  /** What the list row previews. Composed at seed time so the row does not have
   *  to know how to summarise an event. */
  preview: string;
  /** Whether the preview was the mentor's own message — the row prefixes
   *  "You: " when it was. */
  previewFromMentor: boolean;
  unreadCount: number;
  /** ═══ NOT "AT RISK", NOT "CHURN" ═══
   *  A teen nobody has spoken to in a while. The filter reads "Check-in", the
   *  field is `needsCheckIn`, and neither one describes the teen — it describes
   *  the gap, which is the thing a mentor can actually act on. */
  needsCheckIn: boolean;
}

/** Everything one scenario produces. Built together so the counts on the filters
 *  and the contents of the list cannot disagree. */
export interface ChatData {
  threads: ChatThread[];
  messages: Record<ThreadId, ChatMessage[]>;
  events: Record<ThreadId, ChatEvent[]>;
  artifacts: Record<string, SentArtifact>;
  emergency: Record<ThreadId, EmergencyInfo>;
  /** Keyed by thread id, like the store's own. Only the escalation scenario has
   *  one; every other thread's is absent, which is what an absent escalation is. */
  escalations: Record<ThreadId, EscalationState>;
  /** The thread the scenario is about — what opens when no `?with=` is given. */
  focusThreadId: ThreadId;
}
