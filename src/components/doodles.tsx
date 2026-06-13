import { cn } from "@/lib/utils";

/**
 * "Moodie" doodles — the real Somethings brand artwork, exported from the Figma
 * Mobile Design System (spray-paint scribbles + emotion faces) into
 * /public/moodies. They're full-color illustrations, so we render them as-is
 * (no tinting) and lean on the warm UI around them.
 */

export type MoodieName =
  | "scribble-1"
  | "scribble-2"
  | "scribble-3"
  | "scribble-4"
  | "scribble-5"
  | "scribble-6"
  | "scribble-7"
  | "scribble-8"
  | "gradient-1"
  | "face-happy"
  | "face-love"
  | "face-excited"
  | "face-pleased"
  | "face-surprised"
  | "face-confused"
  | "face-awkward"
  | "face-sad"
  | "face-angry"
  | "face-tired";

export function Moodie({
  name,
  className,
  style,
}: {
  name: MoodieName;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/moodies/${name}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("pointer-events-none select-none object-contain", className)}
      style={style}
    />
  );
}

// ── Section theming ─────────────────────────────────────────────────────────
// Each onboarding section gets a Moodie; the profile section rotates through a
// few for variety.
const SECTION_MOODIES: Record<string, MoodieName[]> = {
  Account: ["scribble-4"],
  "About you": ["face-happy"],
  "Your profile": [
    "scribble-1",
    "face-pleased",
    "scribble-2",
    "scribble-5",
    "face-love",
    "scribble-6",
    "scribble-7",
    "face-surprised",
    "scribble-8",
  ],
  Availability: ["scribble-3"],
};

const FALLBACK = SECTION_MOODIES["Your profile"];

/** The Moodie badge shown above each step title. */
export function SectionDoodle({
  section,
  seed = 0,
  className,
}: {
  section: string;
  seed?: number;
  className?: string;
}) {
  const set = SECTION_MOODIES[section] ?? FALLBACK;
  const name = set[seed % set.length];
  return (
    <span
      className={cn(
        "flex size-14 items-center justify-center rounded-2xl bg-muted/60",
        className
      )}
    >
      <Moodie name={name} className="doodle-float size-10" />
    </span>
  );
}

/** Scattered, gently-floating Moodies for hero / celebratory backdrops. */
const SCATTER: { name: MoodieName; style: React.CSSProperties }[] = [
  { name: "scribble-1", style: { top: "6%", left: "8%", width: 66, "--doodle-rot": "-10deg" } as React.CSSProperties },
  { name: "face-happy", style: { top: "15%", right: "10%", width: 56, "--doodle-rot": "8deg" } as React.CSSProperties },
  { name: "scribble-5", style: { bottom: "14%", left: "11%", width: 60, "--doodle-rot": "9deg" } as React.CSSProperties },
  { name: "face-love", style: { bottom: "9%", right: "8%", width: 58, "--doodle-rot": "-6deg" } as React.CSSProperties },
  { name: "scribble-2", style: { top: "44%", left: "4%", width: 50, "--doodle-rot": "6deg" } as React.CSSProperties },
  { name: "scribble-6", style: { top: "40%", right: "5%", width: 54, "--doodle-rot": "-12deg" } as React.CSSProperties },
];

export function DoodleScatter({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {SCATTER.map((it, i) => (
        <Moodie
          key={i}
          name={it.name}
          className="doodle-float absolute"
          style={{ animationDelay: `${i * 0.6}s`, ...it.style }}
        />
      ))}
    </div>
  );
}
