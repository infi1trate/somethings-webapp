"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { MultiSelectChips } from "@/components/onboarding/multi-select-chips";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useDraftSync } from "@/lib/onboarding/use-live-sync";
import type { MentorDraft } from "@/lib/types";

type ArrayField = {
  [K in keyof MentorDraft]: MentorDraft[K] extends string[] ? K : never;
}[keyof MentorDraft];

interface ChipsStepProps {
  fieldKey: ArrayField;
  title: string;
  subtitle?: string;
  options: string[];
  min?: number;
  max?: number;
  minMessage?: string;
  hint?: string;
}

export function ChipsStep({
  fieldKey,
  title,
  subtitle,
  options,
  min = 0,
  max,
  minMessage = "Pick at least one.",
  hint,
}: ChipsStepProps) {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();

  const schema = z.object({
    items: z.array(z.string()).min(min, minMessage),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { items: draft[fieldKey] },
  });

  useDraftSync(
    form.control,
    (v) => ({ [fieldKey]: v.items }) as Partial<MentorDraft>
  );

  const save = (v: Values) => {
    update({ [fieldKey]: v.items } as Partial<MentorDraft>);
    goNext();
  };

  return (
    <StepScaffold
      form={form}
      onSubmit={save}
      title={title}
      subtitle={subtitle}
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => save({ items: draft[fieldKey] })}
    >
      <FormField
        control={form.control}
        name="items"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <MultiSelectChips
                options={options}
                value={field.value}
                onChange={field.onChange}
                max={max}
              />
            </FormControl>
            {hint && <FormDescription>{hint}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    </StepScaffold>
  );
}
