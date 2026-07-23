"use client";

// PhotoRowCore (record-04a) — THE one editor extraction in this project.
// The Account Photo row's state machine, lifted VERBATIM from
// account-editor's PhotoRow and made controlled/prop-fed: `value` is the
// stored photo, `onSave` is the persistence seam (the settings wrapper wires
// gated-free direct save exactly as before; the record wrapper wires the
// staff write path). States: read / edit / uploading / error / saved / empty.
// mode="read" renders the locked read row (no affordances) — the record's
// Lead Mentor view.

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { EditRow, type EditRowState } from "@/components/settings/edit-row";
import { Button } from "@/components/ui/button";
import { downscaleImageToWebP, readFileAsDataUrl } from "@/lib/files";

/** The row-shell contract this state machine renders through — the shared
 *  subset of EditRow/RecordRow props. Settings keep the default (EditRow,
 *  byte-identical); the record injects its open-row shell (record Phase 2). */
export type PhotoRowShell = React.ComponentType<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  state: EditRowState;
  locked?: boolean;
  onEditStart: () => void;
  onCancel: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  children?: React.ReactNode;
}>;

export interface PhotoRowCoreProps {
  label?: string;
  /** Stored photo (data URL) — the row's source of truth between edits. */
  value: string | null;
  /** Initial-letter placeholder when empty. */
  initial: string;
  /** Persistence seam: resolve true on success, false on failure (the row
   *  shows its error state and stays in edit). */
  onSave: (pending: string | null) => Promise<boolean>;
  /** "edit" = full row lifecycle; "read" = locked read row, no affordances. */
  mode?: "edit" | "read";
  editing: boolean;
  onEditStart: () => void;
  onClose: () => void;
  reportDirty?: (id: string, dirty: boolean) => void;
  /** Muted line under the value (e.g. the record's audit line). */
  hint?: string;
  /** Row shell to render through — defaults to the settings EditRow. */
  row?: PhotoRowShell;
}

export function PhotoRowCore({
  label = "Photo",
  value,
  initial,
  onSave,
  mode = "edit",
  editing,
  onEditStart,
  onClose,
  reportDirty,
  hint,
  row: Row = EditRow,
}: PhotoRowCoreProps) {
  const [pending, setPending] = useState<string | null>(value);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = editing && pending !== value;
  useEffect(() => {
    reportDirty?.("photo", dirty);
    return () => reportDirty?.("photo", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

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

  const onFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await downscaleImageToWebP(file).catch(() =>
        readFileAsDataUrl(file)
      );
      setPending(url);
      if (save !== "idle") setSave("idle");
    } finally {
      setUploading(false);
    }
  };

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

  const thumb = (src: string | null, size: string) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    ) : (
      <span
        aria-hidden
        className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground`}
      >
        {initial}
      </span>
    );

  const readValue = (
    <span className="flex items-center gap-2.5">
      {thumb(value, "size-10")}
      <span className="truncate">{value ? "Photo added" : "No photo yet"}</span>
    </span>
  );

  if (mode === "read") {
    return (
      <Row
        label={label}
        value={readValue}
        hint={hint}
        state="read"
        locked
        onEditStart={() => {}}
        onCancel={() => {}}
      />
    );
  }

  return (
    <div data-row="photo">
      <Row
        label={label}
        value={readValue}
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
        saveDisabled={!dirty || uploading}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            {thumb(pending, "size-20")}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <Loader2
                  className="size-5 animate-spin text-brand"
                  aria-hidden
                />
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {pending ? "Replace" : "Upload photo"}
            </Button>
            {pending && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={uploading}
                onClick={() => setPending(null)}
              >
                <ImagePlus className="size-4" />
                Remove
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </Row>
    </div>
  );
}
