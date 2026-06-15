import { Check, X } from "lucide-react";

interface StepTipsProps {
  dos?: string[];
  donts?: string[];
  note?: string;
}

// A small do/don't guidance block for steps without a form field to hang a
// FormDescription on (e.g. the photo steps). Matches the muted helper styling.
export function StepTips({ dos = [], donts = [], note }: StepTipsProps) {
  return (
    <div className="space-y-1.5 rounded-xl border bg-muted/40 px-3.5 py-3 text-sm">
      {dos.map((t) => (
        <div key={t} className="flex items-start gap-2 text-muted-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <span>{t}</span>
        </div>
      ))}
      {donts.map((t) => (
        <div key={t} className="flex items-start gap-2 text-muted-foreground">
          <X className="mt-0.5 size-4 shrink-0 text-rose-500" />
          <span>{t}</span>
        </div>
      ))}
      {note && (
        <p className="pt-0.5 text-xs text-muted-foreground/80">{note}</p>
      )}
    </div>
  );
}
