"use client";

import { useEffect } from "react";
import { useWatch, type Control, type FieldValues } from "react-hook-form";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { MentorDraft } from "@/lib/types";

/**
 * Streams a step's form values into the draft store on every change, so the live
 * profile preview populates as the mentor types — while the Continue button still
 * validates via the form resolver. We key the effect on a serialized snapshot so
 * it only fires on real content changes (useWatch returns a fresh object each
 * render, which would otherwise loop). `update` is a zustand setter, not React
 * state, so there's no set-state-in-effect concern.
 */
export function useDraftSync<T extends FieldValues>(
  control: Control<T>,
  toDraft: (values: T) => Partial<MentorDraft>
) {
  const update = useOnboardingStore((s) => s.update);
  const values = useWatch({ control });
  const snapshot = JSON.stringify(values);

  useEffect(() => {
    update(toDraft(values as T));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);
}
