"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cutoutBackground } from "@/lib/cutout";

/** Photo editor: upload a file, background-cut it (same `cutoutBackground` the
 *  onboarding step uses), and write the data URL. Camera capture is left to the
 *  mentor's onboarding step; here we just need upload / replace / remove. */
export function PhotoField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    setProcessing(true);
    try {
      onChange(await cutoutBackground(file));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Profile" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-7 text-muted-foreground" aria-hidden />
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
          {value ? "Replace photo" : "Upload photo"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={processing}
            onClick={() => onChange(null)}
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
  );
}
