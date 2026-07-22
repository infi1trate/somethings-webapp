"use client";

// Generic controlled record field row (record-04a) — NEW component, not an
// extraction: the settings identity fields stay LockedRow ("Contact support
// to change this" is the settings contract; unlocking happens on the Mentor
// Record only). Same EditRow lifecycle as PhotoRowCore: read / edit / saving
// / error / saved, explicit per-field save through an onSave seam (the
// record wires the staff write path — invariant 2). mode="read" renders the
// locked row (Lead Mentor view).

import { useCallback, useEffect, useRef, useState } from "react";
import { EditRow } from "@/components/settings/edit-row";

const norm = (v: unknown) => JSON.stringify(v ?? null);

export interface StaffFieldRowProps<T> {
  label: string;
  /** Stored value — the row's source of truth between edits. */
  value: T;
  /** Read-state rendering of the stored value. */
  display: (v: T) => React.ReactNode;
  /** Edit-state controls, fed the pending value. */
  editor: (pending: T, setPending: (v: T) => void) => React.ReactNode;
  /** Persistence seam — resolve false to show the row's error state. */
  onSave: (pending: T) => Promise<boolean>;
  /** Optional save gate (e.g. names must be non-empty). */
  validate?: (pending: T) => boolean;
  mode: "edit" | "read";
  /** Muted line under the value (the record's audit line). */
  hint?: string;
  editing: boolean;
  onEditStart: () => void;
  onClose: () => void;
}

export function StaffFieldRow<T>({
  label,
  value,
  display,
  editor,
  onSave,
  validate,
  mode,
  hint,
  editing,
  onEditStart,
  onClose,
}: StaffFieldRowProps<T>) {
  const [pending, setPending] = useState<T>(value);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const dirty = editing && norm(pending) !== norm(value);

  // Fresh edit session pulls the stored value; unsaved exit discards.
  const resetLocal = useCallback(() => {
    setPending(value);
    setSave((s) => (s === "saved" ? s : "idle"));
  }, [value]);
  const prev = useRef(editing);
  useEffect(() => {
    if (editing !== prev.current) {
      resetLocal();
      prev.current = editing;
    }
  }, [editing, resetLocal]);

  const commit = async () => {
    setSave("saving");
    const ok = await onSave(pending);
    if (!ok) {
      setSave("error");
      return;
    }
    setSave("saved");
    onClose();
  };

  if (mode === "read") {
    return (
      <EditRow
        label={label}
        value={display(value)}
        hint={hint}
        state="read"
        locked
        onEditStart={() => {}}
        onCancel={() => {}}
      />
    );
  }

  return (
    <EditRow
      label={label}
      value={display(value)}
      hint={hint}
      state={
        editing
          ? save === "saving"
            ? "saving"
            : save === "error"
              ? "error"
              : "edit"
          : save === "saved"
            ? "saved"
            : "read"
      }
      onEditStart={onEditStart}
      onCancel={() => {
        setPending(value);
        setSave("idle");
        onClose();
      }}
      onSave={commit}
      saveDisabled={!dirty || (validate ? !validate(pending) : false)}
    >
      {editor(pending, (v) => {
        setPending(v);
        setSave((s) => (s === "idle" ? s : "idle"));
      })}
    </EditRow>
  );
}
