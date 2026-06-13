"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

export function MultiSelectChips({ options, value, onChange, max }: Props) {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, option]);
    }
  };

  const atMax = max != null && value.length >= max;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option);
        const disabled = !selected && atMax;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(option)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] transition-all duration-150 active:scale-95",
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card hover:border-foreground/30 hover:bg-accent",
              disabled && "cursor-not-allowed opacity-40 hover:border-border hover:bg-card"
            )}
          >
            {selected && <Check className="size-3.5" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}
