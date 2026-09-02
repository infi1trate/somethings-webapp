"use client";

// WHO AM I, IN THIS REVIEW — R9's visible half.
//
// ═══ A NAME CONFLICT IS NOT AN ERROR ═══
//
// Two reviewers choosing "Amber Otter" is a coincidence, not a mistake, and the
// person typing it second did nothing wrong. So the save is NEVER blocked. What
// happens instead:
//
//   • it is stated plainly, before the save, so nobody is surprised later;
//   • the UI disambiguates by showing the colour chip beside every name, which
//     is what `Reviewer.colorChip` is for;
//   • and the comment record is unaffected either way, because authorship is
//     `authorClientId` and the name is only ever resolved for display (R9).
//
// The alternative — refusing the save, or silently appending "2" — either blocks
// a legitimate choice or renames someone without asking.

import { useEffect, useState } from "react";
import { annotationStore } from "@/lib/anno";
import { isAnnoError } from "@/lib/anno/errors";
import {
  chipFor,
  getClientId,
  identityIsPersistent,
  setStoredDisplayName,
  uniqueDisplayName,
} from "@/lib/anno/identity";
import type { Reviewer } from "@/lib/anno/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

type Phase = "idle" | "editing" | "saving" | "saved";

export function IdentityPopover({
  reviewers,
  onSaved,
}: {
  reviewers: readonly Reviewer[];
  onSaved: () => void;
}) {
  const clientId = getClientId();
  const me = reviewers.find((r) => r.clientId === clientId);
  const generated = uniqueDisplayName(clientId, reviewers);
  const current = me?.displayName ?? generated;

  const [phase, setPhase] = useState<Phase>("idle");
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);

  /* The saved confirmation is transient — it reports an outcome, not a state, so
     it should not sit there permanently claiming something just happened. */
  useEffect(() => {
    if (phase !== "saved") return;
    const t = window.setTimeout(() => setPhase("idle"), 2200);
    return () => window.clearTimeout(t);
  }, [phase]);

  /** Someone ELSE already using this exact name. Checked live as they type, so
   *  the notice arrives before the decision rather than after it. */
  const conflictWith = reviewers.find(
    (r) => r.clientId !== clientId && r.displayName.trim() === value.trim()
  );

  const save = async () => {
    const name = value.trim();
    if (name.length === 0) {
      setError("A name can't be empty. Clear it and we'll use the generated one.");
      return;
    }
    setPhase("saving");
    setError(null);
    try {
      await annotationStore().upsertReviewer({
        clientId,
        displayName: name,
        colorChip: chipFor(clientId),
        lastSeenAt: new Date().toISOString(),
      });
      setStoredDisplayName(name);
      setPhase("saved");
      onSaved();
    } catch (e) {
      setPhase("editing");
      setError(
        isAnnoError(e)
          ? e.userMessage
          : "Couldn't save that name. Your comments still have your other name on them."
      );
    }
  };

  return (
    <div data-anno-identity={phase} className="border-t border-[color:var(--border-subtle)] p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ background: chipFor(clientId), boxShadow: "0 0 0 1px #6e6b67" }}
        />
        {phase === "editing" || phase === "saving" ? (
          <label className="min-w-0 flex-1">
            <span className="sr-only">Your display name</span>
            <input
              autoFocus
              value={value}
              maxLength={48}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
              className={cn(
                "w-full rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-2 py-1",
                "text-[12px] text-[var(--text-primary)]",
                RING
              )}
            />
          </label>
        ) : (
          <p className="min-w-0 flex-1 truncate text-[12px] leading-[16px] text-[var(--text-primary)]">
            <span className="font-semibold">{current}</span>
            {!me && (
              /* NOT YET REGISTERED. Says the name is generated rather than
                 letting a reviewer assume they chose it. */
              <span className="text-[var(--text-muted)]"> · generated for you</span>
            )}
          </p>
        )}

        {phase === "idle" && (
          <button
            type="button"
            onClick={() => {
              setValue(current);
              setPhase("editing");
            }}
            className={cn(
              // 22px measured → fails SC 2.5.8's 24×24. `py-1` takes it to 26.
              "shrink-0 rounded-full px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            Change name
          </button>
        )}
        {phase === "saved" && (
          <span className="shrink-0 text-[12px] text-[var(--text-secondary)]">Saved</span>
        )}
        {(phase === "editing" || phase === "saving") && (
          <button
            type="button"
            disabled={phase === "saving"}
            onClick={() => void save()}
            className={cn(
              "shrink-0 rounded-full bg-[var(--text-primary)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--text-inverse)] disabled:opacity-50",
              RING
            )}
          >
            {phase === "saving" ? "Saving…" : "Save name"}
          </button>
        )}
      </div>

      {/* ── NAME CONFLICT: STATED, NOT BLOCKED ──────────────────────────── */}
      {conflictWith && (phase === "editing" || phase === "saving") && (
        <p
          data-anno-name-conflict
          className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-[15px] text-[var(--band-sand-fg)]"
        >
          <span
            aria-hidden
            className="mt-0.5 size-2.5 shrink-0 rounded-full"
            style={{ background: conflictWith.colorChip, boxShadow: "0 0 0 1px #6e6b67" }}
          />
          <span>
            Another reviewer is already called {conflictWith.displayName}. You can still
            use it — your comments are told apart by the colour dot, not the name.
          </span>
        </p>
      )}

      {error && (
        <p className="mt-1.5 text-[11px] leading-[15px] text-[var(--state-error)]">{error}</p>
      )}

      {!identityIsPersistent() && (
        /* Storage refused the client id, so authorship lasts this page load only.
           Said here because this is the panel that claims to be about identity. */
        <p className="mt-1.5 text-[11px] leading-[15px] text-[var(--text-muted)]">
          This browser is blocking storage, so this name lasts until you reload.
        </p>
      )}
    </div>
  );
}
