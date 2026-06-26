import { Image as ImageIcon } from "lucide-react";
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

// Compact do/don't guidance for the profile photo — a captioned figure strip,
// NOT a gallery: borderless + quiet (a caption eyebrow, no card chrome, no
// badges) so it reads as reference, never as content the mentor uploaded. The
// upload zone below it is the screen's focal point.
//
// The good tile is set apart by an emerald outline + "Aim for this" label; the
// "don'ts" by a subtle, inert destructive-tinted outline. Meaning rides on the
// text labels, never colour alone (WCAG 1.4.1), and nothing here reads as a
// tappable control — the old corner ✕ badge (which mimicked a "remove upload"
// affordance) is gone.
export function PhotoExamples() {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">
        Examples — aim for the first one
      </p>

      <div className="grid grid-cols-5 gap-2">
        {/* Good — emerald outline + label (no success badge) */}
        <figure className="space-y-1">
          <ExampleImage
            src={goodExampleSrc}
            alt="Portrait framed from the shoulders up, face clear, plain background"
            className="aspect-square w-full rounded-lg ring-2 ring-emerald-600"
          />
          <figcaption className="text-center text-xs font-medium text-emerald-700">
            Aim for this
          </figcaption>
        </figure>

        {/* Don'ts — subtle inert outline; the caption label carries the meaning */}
        {skipExamples.map((ex) => (
          <figure key={ex.label} className="space-y-1">
            <ExampleImage
              src={ex.src}
              alt={ex.alt}
              className="aspect-square w-full rounded-lg ring-1 ring-destructive/40"
            />
            <figcaption className="text-center text-xs text-foreground/70">
              {ex.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
