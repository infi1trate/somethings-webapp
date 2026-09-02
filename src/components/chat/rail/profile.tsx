"use client";

// THE TEEN'S OWN CANVAS.
//
// ═══ THEIR WORDS RENDER VERBATIM ═══
//
// The casing rule governs product chrome — headings, labels, buttons. It does not
// govern a fifteen-year-old writing about themselves, so nothing here is tidied.
// See `lib/chat/teen-profile.ts` for the whole argument; the short version is that
// correcting a person's self-description to match a style guide is an edit nobody
// asked for.
//
// The section headings ARE ours, and they are sentence case like every other heading
// in this product. The line between the two is the whole design of this panel.
//
// ═══ AND IT IS SET AS SOMEONE ELSE'S VOICE ═══
//
// Their answers sit in a quoted block, in the same treatment the Tasks pane uses for
// a flagged message and a note uses for its references: this is the one place in the
// rail where a teen speaks, and it must never be mistakable for the product talking.
//
// ═══ WHAT IT IS NOT ═══
//
// Not a dashboard. No engagement figures, no last-active timestamp, no counts — a
// mentor opening Profile is trying to remember who this person is, not audit them.
// The relationship's own facts (matched when, last exchange) live on the list row and
// in Timeline, where they are about the mentorship rather than about the teen.

import { profileFor } from "@/lib/chat/teen-profile";
import { PanelCard, PanelEmpty, PanelRow, PanelSection } from "@/components/chat/rail/rail-panel";
import type { ChatThread } from "@/lib/chat/types";

export function ProfilePanel({
  thread,
  /** Relationship length, phrased by the caller — the panel does not compute it,
   *  because `mentees-demo` already owns that arithmetic. */
  matchedFor,
}: {
  thread: ChatThread;
  matchedFor: string | null;
}) {
  const first = thread.displayName.split(" ")[0];
  const profile = profileFor(thread.id);

  if (!profile) {
    return (
      <PanelEmpty title={`About ${first}`}>
        {/* TODO-COPY. "Has not filled this in" — a fact about the teen's own choice,
            not a failure of the product and not a prompt to chase them. */}
        {first} hasn&apos;t filled this in yet. It fills up as they answer things in
        their own app.
      </PanelEmpty>
    );
  }

  return (
    <div data-slot="profile" data-anno-ref="chat-rail-profile" className="space-y-5">
      {/* ═══ THE BASICS: SHORT, AND ONLY WHAT CANNOT BE INFERRED ═══ */}
      <PanelSection label="The basics">
        <PanelCard>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {profile.basics.map((b) => (
              <PanelRow key={b.label} label={b.label}>
                {b.value}
              </PanelRow>
            ))}
            {matchedFor && (
              /* THE ONE RELATIONSHIP FACT that belongs here rather than on the row:
                 how long they have known each other is context for reading
                 everything else on this panel. */
              <PanelRow label="Matched">{matchedFor}</PanelRow>
            )}
          </div>
        </PanelCard>
      </PanelSection>

      {/* ═══ A FEW THINGS LATELY ═══ */}
      <PanelSection label="A few things lately" divided>
        {profile.lately.length === 0 ? (
          <p
            className="text-[var(--text-muted)]"
            style={{ font: "var(--type-body)" }}
          >
            {/* TODO-COPY */}
            Nothing shared yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {profile.lately.map((item) => (
              <li
                key={item}
                /* THE CAPTION IS THE CONTENT. There are no photo assets in this
                   prototype (Phase 0, conflict 8), and a grid of grey rectangles
                   with the captions underneath would be worse than the captions
                   alone — it would spend a third of the panel on placeholders. */
                className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2 text-[var(--text-primary)]"
                style={{ font: "var(--type-body)" }}
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      {/* ═══ IN THEIR OWN WORDS ═══ */}
      {profile.ownWords.length > 0 && (
        <PanelSection label="In their own words" divided>
          <div className="space-y-3">
            {profile.ownWords.map((w) => (
              <div key={w.prompt}>
                {/* THE PROMPT IS OURS — the product asked it, so it is sentence
                    case like every other piece of chrome. */}
                <p
                  className="text-[var(--text-muted)]"
                  style={{
                    font: "var(--type-field-label)",
                    letterSpacing: "var(--type-field-label-tracking)",
                  }}
                >
                  {w.prompt}
                </p>
                {/* THE ANSWER IS THEIRS — verbatim, quoted, italic on a rule. Not
                    corrected, not capitalised, not trimmed. */}
                <blockquote className="mt-1 border-l-2 border-[color:var(--border-contour)] pl-3">
                  <p
                    className="italic text-[var(--text-primary)]"
                    style={{
                      font: "var(--type-message)",
                      letterSpacing: "var(--type-message-tracking)",
                    }}
                  >
                    {w.answer}
                  </p>
                </blockquote>
              </div>
            ))}
          </div>
        </PanelSection>
      )}
    </div>
  );
}
