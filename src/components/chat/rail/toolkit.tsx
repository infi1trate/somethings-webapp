"use client";

// THE TOOLKIT PANEL — a shelf of five, and the builder that replaces it.
//
// ═══ THE BUILDER TAKES OVER THE PANEL RATHER THAN OPENING A DIALOG ═══
//
// A dialog was the obvious choice and is the wrong one here. Building a set is a
// decision about a person, and the evidence for it — what they said this week, what
// they answered last time — is the conversation sitting immediately to the left. A
// modal covers the thing a mentor needs to look at while deciding, and it takes the
// focus trap with it, so glancing at the thread means dismissing the builder and
// losing the deck.
//
// Staying in the rail keeps the conversation on screen the whole time, which is the
// point of a rail.
//
// ═══ SO THE PANEL HAS TWO MODES, AND ONE WAY BACK ═══
//
// Shelf, or one activity's builder. The way back is inside the builder (its Back
// button on the first card) rather than a persistent breadcrumb, because a rail 320
// pixels wide cannot afford a row of chrome that does nothing four fifths of the
// time.

import { useState } from "react";
import { ACTIVITIES, activityById, isUnlocked, unlockProgress } from "@/lib/chat/activities";
import { ActivityCover } from "@/components/chat/activity/activity-cover";
import { ActivityBuilder } from "@/components/chat/activity/activity-builder";
import { PanelEmpty, PanelSection } from "@/components/chat/rail/rail-panel";
import type { ActivityId, SentArtifact, SentArtifactItem } from "@/lib/chat/types";

export function ToolkitPanel({
  /** Every artifact ever sent on this thread — what the lock reads. */
  artifacts,
  /** A support thread has nothing to send. Rendered rather than hidden, because a
   *  reader who switched to Toolkit deserves to know why it is empty. */
  disabled,
  onSendActivity,
}: {
  artifacts: SentArtifact[];
  disabled?: boolean;
  onSendActivity: (activityId: ActivityId, items: SentArtifactItem[]) => void;
}) {
  const [building, setBuilding] = useState<ActivityId | null>(null);

  if (disabled) {
    return (
      <PanelEmpty title="Nothing to send here">
        {/* TODO-COPY. Says WHY, not just that. */}
        Activities are for conversations with a teen. This is a colleague.
      </PanelEmpty>
    );
  }

  if (building) {
    return (
      <ActivityBuilder
        def={activityById(building)}
        onCancel={() => setBuilding(null)}
        onSend={(items) => {
          onSendActivity(building, items);
          setBuilding(null);
        }}
      />
    );
  }

  /* ═══ OPEN FIRST, LOCKED LAST ═══
     Not alphabetical and not by the order they were designed. A shelf a mentor
     scans should put what they can use at the top; a locked cover at position two
     is a gap in the middle of the list. The locked one still renders, in full, at
     the bottom — see `ActivityCover` on why hiding it would be worse. */
  const open = ACTIVITIES.filter((a) => isUnlocked(a, artifacts));
  const locked = ACTIVITIES.filter((a) => !isUnlocked(a, artifacts));

  return (
    <div className="space-y-4">
      <PanelSection>
        <p
          className="text-[var(--text-secondary)]"
          style={{ font: "var(--type-body)" }}
        >
          {/* TODO-COPY. One sentence on what the shelf is for. Not a heading — the
              tab already says "Toolkit", and repeating it here would be the word
              twice. */}
          Each one says what it is for before you send it.
        </p>
      </PanelSection>

      <div className="space-y-2.5">
        {open.map((def) => (
          <ActivityCover key={def.id} def={def} onSelect={() => setBuilding(def.id)} />
        ))}
      </div>

      {locked.length > 0 && (
        <PanelSection label="Not yet" divided>
          <div className="space-y-2.5">
            {locked.map((def) => (
              <ActivityCover
                key={def.id}
                def={def}
                locked
                progress={unlockProgress(def, artifacts)}
              />
            ))}
          </div>
        </PanelSection>
      )}
    </div>
  );
}
