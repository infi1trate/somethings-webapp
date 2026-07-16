"use client";

// The settings Profile tab — revised §4 (Phase 2.5): two grouped containers,
// Basics and Account, with dense EditRows divided by hairlines (the per-field
// accordion cards are gone; accordions remain the Matching tab's paradigm).
// Grouping (logged, gaps.md #28): Basics = identity fields; Account = the two
// §4 change-flow credentials (phone, email).
//
// These fields save DIRECTLY, per row — they do NOT route through the
// changeRequests review loop. Only pronouns are teen-facing: the Matching
// tab's live preview reads them from this same draft state, so a pronouns
// save here shows up there immediately. One row edits at a time; leaving a
// modified row (another Edit, Esc, tab switch) is guarded.

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { EditRow, type EditRowState } from "@/components/settings/edit-row";
import { PillButton } from "@/components/settings/pill-button";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  saveAccountField,
  sendVerificationCode,
  verifyCode,
} from "@/lib/mock-api";
import { downscaleImageToWebP, readFileAsDataUrl } from "@/lib/files";
import { PRONOUN_OPTIONS, RACE_OPTIONS, SEX_OPTIONS } from "@/lib/options";
import type { MentorDraft } from "@/lib/types";

const EMPTY = "—";

type SaveState = "idle" | "saving" | "saved" | "error";
type ReportDirty = (id: string, dirty: boolean) => void;

// ── Shared direct-save model ────────────────────────────────────────────────
// ASSUMPTION(product): Profile fields bypass admin review. Pronouns are
// teen-facing and therefore currently go live unreviewed — confirm.
function useDirectSave<T>(opts: {
  id: string;
  storeValue: T;
  commit: (value: T) => void;
  reportDirty: ReportDirty;
}) {
  const { id, storeValue, commit, reportDirty } = opts;
  const [value, setValue] = useState<T>(storeValue);
  const [state, setState] = useState<SaveState>("idle");
  const dirty = JSON.stringify(value) !== JSON.stringify(storeValue);

  useEffect(() => {
    reportDirty(id, dirty);
    return () => reportDirty(id, false);
  }, [id, dirty, reportDirty]);

  const edit = (next: T) => {
    setValue(next);
    if (state === "error" || state === "saved") setState("idle");
  };

  const save = async (): Promise<boolean> => {
    setState("saving");
    const res = await saveAccountField(id, value);
    if (!res.ok) {
      setState("error");
      return false;
    }
    commit(value); // straight to the draft — never enters the review loop
    setState("saved");
    return true;
  };

  const reset = useCallback(() => {
    setValue(storeValue);
    setState("idle");
  }, [storeValue]);

  return { value, edit, dirty, state, save, reset };
}

// Row-state derivation shared by the simple rows.
function rowStateOf(editing: boolean, save: SaveState): EditRowState {
  if (editing) {
    if (save === "saving") return "saving";
    if (save === "error") return "error";
    return "edit";
  }
  return save === "saved" ? "saved" : "read";
}

interface RowProps {
  editing: boolean;
  onEditStart: () => void;
  onClose: () => void;
  reportDirty: ReportDirty;
}

// Keeps a row's local state honest across edit transitions: entering edit pulls
// a fresh value from the store; leaving without a save discards.
function useEditTransitions(
  editing: boolean,
  saveState: SaveState,
  reset: () => void
) {
  const prev = useRef(editing);
  const stateRef = useRef(saveState);
  useEffect(() => {
    stateRef.current = saveState;
  }, [saveState]);
  useEffect(() => {
    if (editing !== prev.current) {
      if (editing) reset(); // fresh edit session
      else if (stateRef.current !== "saved") reset(); // discarded
      prev.current = editing;
    }
  }, [editing, reset]);
}

// ── Simple rows ─────────────────────────────────────────────────────────────

function TextRow(
  props: RowProps & { id: "firstName" | "lastName"; label: string }
) {
  const storeValue = useOnboardingStore((s) => s.draft[props.id]);
  const update = useOnboardingStore((s) => s.update);
  const hook = useDirectSave<string>({
    id: props.id,
    storeValue,
    commit: (v) => update({ [props.id]: v } as Partial<MentorDraft>),
    reportDirty: props.reportDirty,
  });
  useEditTransitions(props.editing, hook.state, hook.reset);
  return (
    <EditRow
      label={props.label}
      value={storeValue || EMPTY}
      state={rowStateOf(props.editing, hook.state)}
      onEditStart={props.onEditStart}
      onCancel={() => {
        hook.reset();
        props.onClose();
      }}
      onSave={async () => {
        if (await hook.save()) props.onClose();
      }}
      saveDisabled={!hook.value.trim()}
    >
      <Input
        aria-label={props.label}
        className="max-w-sm"
        value={hook.value}
        onChange={(e) => hook.edit(e.target.value)}
      />
    </EditRow>
  );
}

function fmtDob(dob: string): string {
  if (!dob) return EMPTY;
  const d = new Date(`${dob}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? dob
    : d.toLocaleDateString(undefined, { dateStyle: "long" });
}

function DobRow(props: RowProps) {
  const dob = useOnboardingStore((s) => s.draft.dob);
  const update = useOnboardingStore((s) => s.update);
  const hook = useDirectSave<string>({
    id: "dob",
    storeValue: dob,
    commit: (v) => update({ dob: v }),
    reportDirty: props.reportDirty,
  });
  useEditTransitions(props.editing, hook.state, hook.reset);
  return (
    <EditRow
      label="Date of birth"
      value={fmtDob(dob)}
      state={rowStateOf(props.editing, hook.state)}
      onEditStart={props.onEditStart}
      onCancel={() => {
        hook.reset();
        props.onClose();
      }}
      onSave={async () => {
        if (await hook.save()) props.onClose();
      }}
      saveDisabled={!hook.value}
    >
      <Input
        aria-label="Date of birth"
        type="date"
        className="max-w-sm"
        value={hook.value}
        onChange={(e) => hook.edit(e.target.value)}
      />
    </EditRow>
  );
}

function AccountPhotoRow(props: RowProps) {
  const accountPhoto = useOnboardingStore((s) => s.draft.accountPhoto);
  const update = useOnboardingStore((s) => s.update);
  const hook = useDirectSave<string | null>({
    id: "accountPhoto",
    storeValue: accountPhoto,
    commit: (v) => update({ accountPhoto: v }),
    reportDirty: props.reportDirty,
  });
  useEditTransitions(props.editing, hook.state, hook.reset);
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    setProcessing(true);
    try {
      // Plain downscale — the internal photo doesn't get the teen-facing
      // cut-out treatment.
      const url = await downscaleImageToWebP(file).catch(() =>
        readFileAsDataUrl(file)
      );
      hook.edit(url);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <EditRow
      label="Profile photo"
      value={
        <span className="flex items-center gap-2">
          {accountPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={accountPhoto}
              alt=""
              className="size-5 shrink-0 rounded-md border border-[var(--border-subtle)] object-cover"
            />
          )}
          <span className="truncate">
            {accountPhoto ? "Photo added" : "No photo yet"}
            <span className="text-[12px] text-[var(--text-muted)]">
              {" "}
              · Internal — teens don&apos;t see this photo
            </span>
          </span>
        </span>
      }
      state={rowStateOf(props.editing, hook.state)}
      onEditStart={props.onEditStart}
      onCancel={() => {
        hook.reset();
        props.onClose();
      }}
      onSave={async () => {
        if (await hook.save()) props.onClose();
      }}
      saveDisabled={processing}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-muted">
          {hook.value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hook.value}
              alt="Account photo"
              className="size-full object-cover"
            />
          ) : (
            <ImagePlus className="size-6 text-[var(--text-muted)]" aria-hidden />
          )}
          {processing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={processing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {hook.value ? "Replace photo" : "Upload photo"}
          </Button>
          {hook.value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={processing}
              onClick={() => hook.edit(null)}
            >
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
    </EditRow>
  );
}

function PronounsRow(props: RowProps) {
  const pronouns = useOnboardingStore((s) => s.draft.pronouns);
  const update = useOnboardingStore((s) => s.update);
  const hook = useDirectSave<string[]>({
    id: "pronouns",
    storeValue: pronouns,
    commit: (v) => update({ pronouns: v }),
    reportDirty: props.reportDirty,
  });
  useEditTransitions(props.editing, hook.state, hook.reset);
  return (
    <EditRow
      label="Pronouns"
      value={pronouns.length ? pronouns.join(" · ") : EMPTY}
      state={rowStateOf(props.editing, hook.state)}
      onEditStart={props.onEditStart}
      onCancel={() => {
        hook.reset();
        props.onClose();
      }}
      onSave={async () => {
        if (await hook.save()) props.onClose();
      }}
    >
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        Shown under your name on your teen-facing profile.
      </p>
      <MultiSelectChips
        options={PRONOUN_OPTIONS}
        value={hook.value}
        onChange={hook.edit}
      />
    </EditRow>
  );
}

function SexRow(props: RowProps) {
  const sex = useOnboardingStore((s) => s.draft.sex);
  const update = useOnboardingStore((s) => s.update);
  const hook = useDirectSave<string>({
    id: "sex",
    storeValue: sex,
    commit: (v) => update({ sex: v }),
    reportDirty: props.reportDirty,
  });
  useEditTransitions(props.editing, hook.state, hook.reset);
  const label = SEX_OPTIONS.find((o) => o.value === sex)?.label ?? EMPTY;
  return (
    <EditRow
      label="Sex"
      value={sex ? label : EMPTY}
      state={rowStateOf(props.editing, hook.state)}
      onEditStart={props.onEditStart}
      onCancel={() => {
        hook.reset();
        props.onClose();
      }}
      onSave={async () => {
        if (await hook.save()) props.onClose();
      }}
    >
      <div className="max-w-sm">
        <Select value={hook.value || undefined} onValueChange={hook.edit}>
          <SelectTrigger aria-label="Sex">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {SEX_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </EditRow>
  );
}

function RaceRow(props: RowProps) {
  const races = useOnboardingStore((s) => s.draft.races);
  const update = useOnboardingStore((s) => s.update);
  const hook = useDirectSave<string[]>({
    id: "races",
    storeValue: races,
    commit: (v) => update({ races: v }),
    reportDirty: props.reportDirty,
  });
  useEditTransitions(props.editing, hook.state, hook.reset);
  return (
    <EditRow
      label="Race"
      value={races.length ? races.join(", ") : EMPTY}
      state={rowStateOf(props.editing, hook.state)}
      onEditStart={props.onEditStart}
      onCancel={() => {
        hook.reset();
        props.onClose();
      }}
      onSave={async () => {
        if (await hook.save()) props.onClose();
      }}
    >
      <MultiSelectChips
        options={RACE_OPTIONS}
        value={hook.value}
        onChange={hook.edit}
      />
    </EditRow>
  );
}

// ── Change-flow rows (§4: phone + email are flows, not bare inputs) ────────

function PhoneRow(props: RowProps) {
  const phone = useOnboardingStore((s) => s.draft.phone);
  const update = useOnboardingStore((s) => s.update);
  const [next, setNext] = useState("");
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<"idle" | "saved" | "error">("idle");
  const [errText, setErrText] = useState("That didn't save. Try again.");

  const dirty = props.editing && (next.trim() !== "" || step === "code");
  useEffect(() => {
    props.reportDirty("phone", dirty);
    return () => props.reportDirty("phone", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const resetFlow = useCallback(() => {
    setNext("");
    setCode("");
    setStep("enter");
    setFlow("idle");
  }, []);

  // Fresh flow on each edit session; discard on unsaved exit.
  const prev = useRef(props.editing);
  useEffect(() => {
    if (props.editing !== prev.current && flow !== "saved") resetFlow();
    prev.current = props.editing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editing]);

  const requestCode = async () => {
    setBusy(true);
    setFlow("idle");
    const res = await sendVerificationCode(next);
    setBusy(false);
    if (!res.ok) {
      setErrText("That didn't send. Try again.");
      setFlow("error");
      return;
    }
    setStep("code");
  };

  const confirm = async () => {
    setBusy(true);
    setFlow("idle");
    const ok =
      (await verifyCode(code)).ok &&
      (await saveAccountField("phone", next)).ok;
    setBusy(false);
    if (!ok) {
      setErrText("That code didn't match. Try again.");
      setFlow("error");
      return;
    }
    update({ phone: next }); // direct save — see ASSUMPTION note above
    resetFlow();
    setFlow("saved");
    props.onClose();
  };

  return (
    <EditRow
      label="Phone number"
      value={phone || EMPTY}
      state={
        props.editing
          ? flow === "error"
            ? "error"
            : "edit"
          : flow === "saved"
            ? "saved"
            : "read"
      }
      onEditStart={props.onEditStart}
      onCancel={() => {
        resetFlow();
        props.onClose();
      }}
      onSave={step === "code" ? confirm : requestCode}
      errorMessage={errText}
      customActions
    >
      {step === "enter" ? (
        <>
          <div className="max-w-sm space-y-1.5">
            <Input
              aria-label="New phone number"
              type="tel"
              placeholder="(555) 555-0123"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                if (flow !== "idle") setFlow("idle");
              }}
            />
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              We&apos;ll text a code to confirm it&apos;s yours.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PillButton
              onClick={requestCode}
              loading={busy}
              disabled={!next.trim() || next.trim() === phone}
            >
              Text a code
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="max-w-sm space-y-1.5">
            <label
              htmlFor="pf-phone-code"
              className="block text-sm font-medium text-foreground"
            >
              Enter the 6-digit code we texted to {next}
            </label>
            <Input
              id="pf-phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="w-36 tracking-[0.3em]"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                if (flow !== "idle") setFlow("idle");
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <PillButton onClick={confirm} loading={busy} disabled={code.length !== 6}>
              Confirm new number
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Keep my current number
            </button>
          </div>
        </>
      )}
    </EditRow>
  );
}

function EmailRow(props: RowProps) {
  const email = useOnboardingStore((s) => s.draft.email);
  const update = useOnboardingStore((s) => s.update);
  const [next, setNext] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<"idle" | "saved" | "error">("idle");

  const valid = /\S+@\S+\.\S+/.test(next.trim());
  const dirty = props.editing && (next.trim() !== "" || step === "confirm");
  useEffect(() => {
    props.reportDirty("email", dirty);
    return () => props.reportDirty("email", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const resetFlow = useCallback(() => {
    setNext("");
    setStep("enter");
    setFlow("idle");
  }, []);

  const prev = useRef(props.editing);
  useEffect(() => {
    if (props.editing !== prev.current && flow !== "saved") resetFlow();
    prev.current = props.editing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editing]);

  const confirm = async () => {
    setBusy(true);
    setFlow("idle");
    const res = await saveAccountField("email", next.trim());
    setBusy(false);
    if (!res.ok) {
      setFlow("error");
      return;
    }
    update({ email: next.trim() }); // direct save — see ASSUMPTION note above
    resetFlow();
    setFlow("saved");
    props.onClose();
  };

  return (
    <EditRow
      label="Email"
      value={email || EMPTY}
      state={
        props.editing
          ? flow === "error"
            ? "error"
            : "edit"
          : flow === "saved"
            ? "saved"
            : "read"
      }
      onEditStart={props.onEditStart}
      onCancel={() => {
        resetFlow();
        props.onClose();
      }}
      onSave={confirm}
      customActions
    >
      {step === "enter" ? (
        <>
          <div className="max-w-sm">
            <Input
              aria-label="New email"
              type="email"
              placeholder="you@example.com"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                if (flow !== "idle") setFlow("idle");
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <PillButton
              onClick={() => setStep("confirm")}
              disabled={!valid || next.trim() === email}
            >
              Continue
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
            You&apos;re changing your sign-in email to{" "}
            <span className="font-medium text-foreground">{next.trim()}</span>.
            We&apos;ll send updates there from now on.
          </p>
          <div className="flex items-center gap-3">
            <PillButton onClick={confirm} loading={busy}>
              Confirm change
            </PillButton>
            <button
              data-row-cancel
              type="button"
              onClick={() => {
                resetFlow();
                props.onClose();
              }}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Keep my current email
            </button>
          </div>
        </>
      )}
    </EditRow>
  );
}

// ── Groups + tab root ───────────────────────────────────────────────────────

function RowGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        {title}
      </h2>
      <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
        {children}
      </div>
    </section>
  );
}

const ROW_LABELS: Record<string, string> = {
  accountPhoto: "Profile photo",
  firstName: "First name",
  lastName: "Last name",
  dob: "Date of birth",
  pronouns: "Pronouns",
  sex: "Sex",
  races: "Race",
  phone: "Phone number",
  email: "Email",
};

export function ProfileSettingsEditor({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  // Plain state (not a ref): children report from effects, so a setState here
  // is legal, and render-time reads (requestEdit) stay rule-clean.
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});

  const reportDirty = useCallback<ReportDirty>((id, dirty) => {
    setDirtyMap((m) => (Boolean(m[id]) === dirty ? m : { ...m, [id]: dirty }));
  }, []);

  useEffect(() => {
    onDirtyChange?.(Object.values(dirtyMap).some(Boolean));
  }, [dirtyMap, onDirtyChange]);

  // One row edits at a time; leaving a MODIFIED row via another Edit is
  // guarded inline (§6) — untouched rows just swap.
  const requestEdit = (id: string) => {
    if (editingId && editingId !== id && dirtyMap[editingId]) {
      setPendingEditId(id);
      return;
    }
    setEditingId(id);
  };
  const closeEdit = () => setEditingId(null);
  const discardAndEdit = () => {
    setEditingId(pendingEditId); // the abandoned row resets via its transition effect
    setPendingEditId(null);
  };

  const rowProps = (id: string): RowProps => ({
    editing: editingId === id,
    onEditStart: () => requestEdit(id),
    onClose: closeEdit,
    reportDirty,
  });

  // Killed production fields (Location, Zipcode, Groups, Role, the duplicate
  // Email) are fully absent — no parked remnants.
  return (
    <div className="space-y-5">
      <RowGroup title="Basics">
        <AccountPhotoRow {...rowProps("accountPhoto")} />
        <TextRow {...rowProps("firstName")} id="firstName" label="First name" />
        <TextRow {...rowProps("lastName")} id="lastName" label="Last name" />
        <DobRow {...rowProps("dob")} />
        <PronounsRow {...rowProps("pronouns")} />
        <SexRow {...rowProps("sex")} />
        <RaceRow {...rowProps("races")} />
      </RowGroup>

      <RowGroup title="Account">
        <PhoneRow {...rowProps("phone")} />
        <EmailRow {...rowProps("email")} />
      </RowGroup>

      {/* Row-switch guard (§6) — inline prompt, not a browser alert. */}
      <Dialog
        open={pendingEditId !== null}
        onOpenChange={(open) => !open && setPendingEditId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              Your changes to{" "}
              {editingId ? ROW_LABELS[editingId] ?? "this field" : "this field"}{" "}
              will be lost if you edit another field now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setPendingEditId(null)}>
              Keep editing
            </Button>
            <Button className="min-h-11" onClick={discardAndEdit}>Discard changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
