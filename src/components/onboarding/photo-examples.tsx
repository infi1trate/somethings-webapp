import { Check, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Photo sources live here as named slots (served from public/) — swap the files
// or paths without touching layout. Each example has descriptive alt text.
const goodExampleSrc: string | undefined =
  "/onboarding/photo-examples/good.jpg";
const skipExamples: { src?: string; label: string; alt: string }[] = [
  {
    src: "/onboarding/photo-examples/too-far.jpg",
    label: "Too far",
    alt: "A person seated on a couch across a living room, small in the frame",
  },
  {
    src: "/onboarding/photo-examples/poor-lighting.jpg",
    label: "Poor lighting",
    alt: "A backlit photo with the face in shadow against a bright window",
  },
  {
    src: "/onboarding/photo-examples/too-close.jpg",
    label: "Too close",
    alt: "An extreme close-up showing only half of the face",
  },
  {
    src: "/onboarding/photo-examples/too-busy.jpg",
    label: "Too busy",
    alt: "A portrait in front of a cluttered bookshelf and busy wall",
  },
];

// A placeholder-friendly image slot: renders the real <img> once a src is set,
// otherwise a muted box at the same 1:1 ratio. Carries alt text either way
// (role=img + aria-label for the placeholder), so descriptions are real now.
function ExampleImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={cn("object-cover", className)} />;
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground/50",
        className
      )}
    >
      <ImageIcon className="size-4" aria-hidden />
    </div>
  );
}

// Corner marker — aria-hidden, because the meaning rides on the figcaption + alt
// text (and, on the good tile, the "Aim for this" label), never on color.
function CornerBadge({ tone }: { tone: "good" | "skip" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute right-1 top-1 flex size-4 items-center justify-center rounded-full text-white shadow-sm",
        tone === "good" ? "bg-emerald-600" : "bg-rose-600"
      )}
    >
      {tone === "good" ? (
        <Check className="size-2.5" strokeWidth={3} />
      ) : (
        <X className="size-2.5" strokeWidth={3} />
      )}
    </span>
  );
}

// Compact, illustrated do/don't guidance for the profile photo. Replaces the
// text-only tips checklist (same guidance, shown once). Stays lighter than the
// upload CTA below it (muted card, matching StepTips' treatment). The good tile
// is one-of-four at the SAME size — it's distinguished by an outline + ✓ badge +
// label, not by being larger, so the section stays compact.
export function PhotoExamples() {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-3.5 text-sm">
      <p className="text-muted-foreground text-pretty">
        Face clear, shoulders up, plain light background — skip filters, busy
        rooms, and dim shots.
      </p>

      <div className="grid grid-cols-5 gap-2">
        {/* Good — same tile size; set apart by the success outline + ✓ + label */}
        <figure className="space-y-1">
          <div className="relative">
            <ExampleImage
              src={goodExampleSrc}
              alt="Portrait framed from the shoulders up, face clear, plain background"
              className="aspect-square w-full rounded-lg ring-2 ring-emerald-600"
            />
            <CornerBadge tone="good" />
          </div>
          <figcaption className="text-center text-xs font-medium text-emerald-700">
            Aim for this
          </figcaption>
        </figure>

        {/* Don'ts */}
        {skipExamples.map((ex) => (
          <figure key={ex.label} className="space-y-1">
            <div className="relative">
              <ExampleImage
                src={ex.src}
                alt={ex.alt}
                className="aspect-square w-full rounded-lg"
              />
              <CornerBadge tone="skip" />
            </div>
            <figcaption className="text-center text-xs text-muted-foreground">
              {ex.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
