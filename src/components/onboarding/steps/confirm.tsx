"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Check } from "lucide-react";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SEX_OPTIONS,
  GENDER_IDENTITY_OPTIONS,
  PRONOUN_OPTIONS,
  RACE_OPTIONS,
} from "@/lib/options";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useDraftSync } from "@/lib/onboarding/use-live-sync";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDob(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function ageFrom(dob: string) {
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d))
    age--;
  return age;
}

function formatPhone(raw: string) {
  const p = raw.replace(/\D/g, "").slice(0, 10);
  if (p.length < 4) return p;
  if (p.length < 7) return `(${p.slice(0, 3)}) ${p.slice(3)}`;
  return `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`;
}

const schema = z.object({
  firstName: z.string().trim().min(1, "Add your first name."),
  lastName: z.string().trim().min(1, "Add your last name."),
  dob: z
    .string()
    .min(1, "Add your date of birth.")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Pick a valid date.")
    .refine((v) => ageFrom(v) >= 18, "Mentors need to be 18 or older."),
  email: z.string().trim().email("That doesn't look like an email yet."),
  phone: z
    .string()
    .refine((v) => v.replace(/\D/g, "").length === 10, "Enter a 10-digit number."),
  sex: z.string().min(1, "Pick one."),
  genderIdentity: z.string().min(1, "Pick one."),
  pronouns: z.array(z.string()).min(1, "Pick at least one."),
  races: z.array(z.string()),
});

type Values = z.infer<typeof schema>;
type FieldKey = keyof Values | "name";

export function ConfirmStep() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, goNext, goBack } = useOnboardingNav();
  const [open, setOpen] = useState<Set<FieldKey>>(new Set());

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      firstName: draft.firstName,
      lastName: draft.lastName,
      dob: draft.dob,
      email: draft.email,
      phone: draft.phone,
      sex: draft.sex,
      genderIdentity: draft.genderIdentity ?? "",
      pronouns: draft.pronouns ?? [],
      races: draft.races,
    },
  });

  useDraftSync(form.control, (v) => ({
    firstName: v.firstName,
    lastName: v.lastName,
    dob: v.dob,
    email: v.email,
    phone: v.phone,
    sex: v.sex,
    genderIdentity: v.genderIdentity,
    pronouns: v.pronouns,
    races: v.races,
  }));

  const { errors } = form.formState;

  // A row is open if the mentor opened it, or if it has a validation error
  // (so a failed "continue" reveals exactly what needs fixing). Derived during
  // render — no effects.
  const errorKeys = new Set<FieldKey>();
  for (const k of Object.keys(errors)) {
    errorKeys.add(k === "firstName" || k === "lastName" ? "name" : (k as FieldKey));
  }
  const isOpen = (key: FieldKey) => open.has(key) || errorKeys.has(key);

  const toggle = (key: FieldKey) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const values = useWatch({ control: form.control }) as Values;
  const sexLabel =
    SEX_OPTIONS.find((o) => o.value === values.sex)?.label ?? "—";
  const genderLabel =
    GENDER_IDENTITY_OPTIONS.find((o) => o.value === values.genderIdentity)
      ?.label ?? "—";

  return (
    <StepScaffold
      form={form}
      onSubmit={(v) => {
        update(v);
        goNext();
      }}
      title="Quick check — does this look right?"
      subtitle="We pulled these from your application — give them a quick look and fix anything that's off."
      continueLabel="Yep, this is right"
      canGoBack={canGoBack}
      onBack={goBack}
    >
      {/* Compact two-column review grid: collapsed fields scan quickly; the one
          being edited expands in place. Hairlines come from the gap over a
          border-colored track. */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
        <Field
          label="Name"
          value={`${values.firstName} ${values.lastName}`.trim() || "—"}
          span
          editing={isOpen("name")}
          onToggle={() => toggle("name")}
          error={errors.firstName?.message ?? errors.lastName?.message}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="First name" {...form.register("firstName")} />
            <Input placeholder="Last name" {...form.register("lastName")} />
          </div>
        </Field>

        <Field
          label="Email"
          value={values.email || "—"}
          span
          editing={isOpen("email")}
          onToggle={() => toggle("email")}
          error={errors.email?.message}
        >
          <Input type="email" {...form.register("email")} />
        </Field>

        <Field
          label="Date of birth"
          value={values.dob ? formatDob(values.dob) : "—"}
          editing={isOpen("dob")}
          onToggle={() => toggle("dob")}
          error={errors.dob?.message}
        >
          <Input type="date" className="w-full" {...form.register("dob")} />
        </Field>

        <Field
          label="Phone"
          value={values.phone || "—"}
          editing={isOpen("phone")}
          onToggle={() => toggle("phone")}
          error={errors.phone?.message}
        >
          <Input
            inputMode="tel"
            value={values.phone}
            onChange={(e) => form.setValue("phone", formatPhone(e.target.value))}
          />
        </Field>

        <Field
          label="Sex"
          value={sexLabel}
          editing={isOpen("sex")}
          onToggle={() => toggle("sex")}
          error={errors.sex?.message}
        >
          <Select
            value={values.sex}
            onValueChange={(v) => form.setValue("sex", v, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
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
        </Field>

        <Field
          label="Gender identity"
          value={genderLabel}
          editing={isOpen("genderIdentity")}
          onToggle={() => toggle("genderIdentity")}
          error={errors.genderIdentity?.message}
        >
          <Select
            value={values.genderIdentity}
            onValueChange={(v) =>
              form.setValue("genderIdentity", v, { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_IDENTITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Pronouns"
          value={values.pronouns.length ? values.pronouns.join(", ") : "—"}
          hint="Shows on your profile"
          multiline
          editing={isOpen("pronouns")}
          onToggle={() => toggle("pronouns")}
          error={errors.pronouns?.message}
        >
          <MultiSelectChips
            options={PRONOUN_OPTIONS}
            value={values.pronouns}
            onChange={(next) =>
              form.setValue("pronouns", next, { shouldValidate: true })
            }
          />
        </Field>

        <Field
          label="Race"
          value={values.races.length ? values.races.join(", ") : "—"}
          multiline
          editing={isOpen("races")}
          onToggle={() => toggle("races")}
        >
          <MultiSelectChips
            options={RACE_OPTIONS}
            value={values.races}
            onChange={(next) => form.setValue("races", next)}
          />
        </Field>
      </div>
    </StepScaffold>
  );
}

function Field({
  label,
  value,
  span,
  multiline,
  hint,
  editing,
  onToggle,
  error,
  children,
}: {
  label: string;
  value: string;
  /** Span both columns (for wide fields like name, email, race). */
  span?: boolean;
  /** Let the value wrap instead of truncating (for multi-select fields). */
  multiline?: boolean;
  /** Small caption under the value (e.g. teen-visibility note). */
  hint?: string;
  editing: boolean;
  onToggle: () => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-card px-4 py-3.5 sm:px-5", span && "sm:col-span-2")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {!editing && (
            <p
              className={cn(
                "mt-0.5 text-[15px] text-foreground",
                !multiline && "truncate"
              )}
            >
              {value}
            </p>
          )}
          {/* No `/80` on the hint — see the note in `step-tips.tsx`; gap row 286.
              This comment sits OUTSIDE the `&&` expression on purpose: a
              parenthesised JSX expression takes exactly one element, so a
              brace-comment sibling inside it is a syntax error, not a style
              choice. And a JSX comment cannot contain the close-comment
              digraph — writing it inline ends the comment early (TS1381).
              Both mistakes were made here before this note existed. */}
          {hint && !editing && (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
            editing
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {editing ? (
            <>
              <Check className="size-3.5" /> Done
            </>
          ) : (
            <>
              <Pencil className="size-3.5" /> Edit
            </>
          )}
        </button>
      </div>

      {editing && (
        <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
