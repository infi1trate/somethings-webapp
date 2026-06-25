"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Disc3, Wifi } from "lucide-react";
import { SpotifySong } from "@/components/onboarding/spotify-song";
import { cn } from "@/lib/utils";
import { iconFor } from "@/lib/interest-icons";
import { SwipeDeck } from "@/components/onboarding/swipe-deck";
import {
  type InterestEntry,
  type MediaIntro,
  type MentorDraft,
} from "@/lib/types";

const PURPLE = "#b164ff";
const CYAN = "#71e0ff";
// Slight polaroid-style angles for the "My vibe" photos.
const VIBE_TILT = [-3.5, 2.5, -1.5, 3, -2.5];

export interface PreviewFocus {
  region: string;
  zoom: number;
}

export function MentorProfilePreview({
  draft,
  focus,
}: {
  draft: MentorDraft;
  focus?: PreviewFocus;
}) {
  const name = draft.nickname || draft.firstName || "";
  const cutout = draft.profilePhoto;
  const heroInterests = draft.interests.slice(0, 4);
  const vibe = draft.vibe ?? [];

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const focused = !!focus && focus.region !== "all";

  // Depth-of-field: keep the active block crisp, blur + dim the rest. The purple
  // hero (name/bio/interests) is one focus group; each section below is its own.
  const activeGroup = !focused
    ? null
    : ["identity", "bio"].includes(focus!.region)
      ? "hero"
      : focus!.region;
  const dof = (group: string) =>
    cn(
      "transition-[filter,opacity,transform] duration-500 ease-out",
      activeGroup && activeGroup !== group
        ? "scale-[0.98] opacity-40 blur-[3px]"
        : "opacity-100 blur-none"
    );

  const offsetTopWithin = (el: HTMLElement, ancestor: HTMLElement) => {
    let y = 0;
    let node: HTMLElement | null = el;
    while (node && node !== ancestor) {
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return y;
  };

  const applyFocus = useCallback(() => {
    const stage = stageRef.current;
    const vp = viewportRef.current;
    if (!stage || !vp) return;
    if (!focus || focus.region === "all") {
      stage.style.transform = "none";
      return;
    }
    // Hero steps anchor the purple block to the very top (fills behind the
    // status bar / Dynamic Island, like the real profile). Lower sections frame
    // with some breathing room below the top edge so they don't crowd the notch.
    const isHero = ["identity", "bio"].includes(focus.region);
    const region =
      stage.querySelector<HTMLElement>(
        `[data-region="${isHero ? "identity" : focus.region}"]`
      ) ?? stage.querySelector<HTMLElement>(`[data-region="identity"]`);
    if (!region) {
      stage.style.transform = "none";
      return;
    }
    const vpH = vp.clientHeight;
    const top = offsetTopWithin(region, stage);
    const s = focus.zoom;
    const headroom = isHero ? 0 : vpH * 0.18;
    const t = headroom / s - top;
    stage.style.transform = `scale(${s}) translateY(${t}px)`;
  }, [focus]);

  useEffect(() => {
    applyFocus();
  }, [applyFocus, name, draft.bio, heroInterests.length]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => applyFocus());
    ro.observe(stage);
    window.addEventListener("resize", applyFocus);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", applyFocus);
    };
  }, [applyFocus]);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative h-full bg-white text-[#1f1e1d]",
        focused
          ? "overflow-hidden"
          : "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      <div
        ref={stageRef}
        className="relative origin-top transition-transform duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
      >
        {/* ── Purple match-card hero ─────────────────────────────────────── */}
        <div
          data-region="identity"
          className={cn(
            "relative overflow-hidden px-5 pt-16",
            dof("hero")
          )}
          style={{ background: PURPLE }}
        >
          <StatusBar />

          {/* Empty state: a CRISP dot-matrix portrait bust flush to the hero's
              bottom. Three dot layers share ONE aligned grid (only the circle
              radius changes) + two erode masks carve an inner core / mid band,
              so the dots are normal-size + opaque in the core and shrink + fade
              through the contour to the edge — a halftone dissolve. No blur, no
              opacity mask (those caused the fuzz). */}
          {!cutout && (
            <div className="pointer-events-none absolute bottom-0 right-[-1%] z-0 h-[62%] w-[54%] text-white">
              {/* The torso runs PAST the bottom of the viewBox, so the SVG crops
                  it flat at y=120 (like a real cropped photo) with full-strength
                  dots — the graphic sits flush on the hero's bottom edge instead
                  of fading into a gap. The halftone fade then only touches the
                  head + sides (true silhouette), never the bottom crop. */}
              <svg
                viewBox="0 0 100 120"
                preserveAspectRatio="xMidYMax meet"
                className="size-full"
                aria-hidden
              >
                <defs>
                  {/* one clean bust: round head · wider neck · broad shoulders,
                      torso extended below y=120 to crop flush at the bottom */}
                  <path
                    id="bust"
                    d="M50 4 C65 4 78 15 78 31 C78 42 72 49 65 51 C65 55 65 59 65 64 C78 68 88 75 93 87 C98 96 99 108 99 120 L99 132 L1 132 L1 120 C1 108 2 96 7 87 C12 75 22 68 35 64 C35 59 35 55 35 51 C28 49 22 42 22 31 C22 15 35 4 50 4 Z"
                  />
                  {/* identical grid + dot center across all three — only the
                      radius differs, so dots stay concentric and shrink core→edge */}
                  <pattern id="bustDotsLg" width="7" height="7" patternUnits="userSpaceOnUse">
                    <circle cx="3.5" cy="3.5" r="1.2" fill="currentColor" />
                  </pattern>
                  <pattern id="bustDotsMd" width="7" height="7" patternUnits="userSpaceOnUse">
                    <circle cx="3.5" cy="3.5" r="0.8" fill="currentColor" />
                  </pattern>
                  <pattern id="bustDotsSm" width="7" height="7" patternUnits="userSpaceOnUse">
                    <circle cx="3.5" cy="3.5" r="0.45" fill="currentColor" />
                  </pattern>
                  {/* erode the bust to carve an inner "core" + a "mid" region.
                      Keep the band THIN so thin features (head, neck) retain a
                      bright core and the whole figure stays legible — only the
                      outer ring dissolves. */}
                  <filter id="bustErodeMid">
                    <feMorphology operator="erode" radius="2.5" />
                  </filter>
                  <filter id="bustErodeCore">
                    <feMorphology operator="erode" radius="5.5" />
                  </filter>
                  <mask id="bustMaskMid">
                    <use href="#bust" fill="#fff" filter="url(#bustErodeMid)" />
                  </mask>
                  <mask id="bustMaskCore">
                    <use href="#bust" fill="#fff" filter="url(#bustErodeCore)" />
                  </mask>
                </defs>
                {/* edge — full bust · small dots · faint (but visible enough to
                    read the silhouette, incl. the head) */}
                <use href="#bust" fill="url(#bustDotsSm)" opacity="0.24" />
                {/* mid — medium dots, inset from the edge */}
                <use href="#bust" fill="url(#bustDotsMd)" mask="url(#bustMaskMid)" opacity="0.42" />
                {/* core — normal-size dots, deep interior (opacity stacks) */}
                <use href="#bust" fill="url(#bustDotsLg)" mask="url(#bustMaskCore)" opacity="0.52" />
              </svg>
            </div>
          )}

          <div className="relative z-10 flex flex-col gap-3.5 text-white">
            <div className="text-center">
              {name ? (
                <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-white [overflow-wrap:anywhere]">
                  {name}
                </h2>
              ) : (
                <Bar className="mx-auto h-7 w-40 bg-white/30" />
              )}
              {draft.pronouns.length > 0 ? (
                <p className="mt-1 text-sm text-white/80">
                  {draft.pronouns.join(" · ")}
                </p>
              ) : (
                <Bar className="mx-auto mt-2 h-2.5 w-24 bg-white/25" />
              )}
            </div>

            {/* Intro bubble — sits vertically above the photo */}
            <div
              data-region="bio"
              className="w-full rounded-[16px] rounded-bl-[4px] bg-white/15 px-3.5 py-2.5 text-left backdrop-blur-sm"
            >
              {draft.bio ? (
                <p className="text-[15px] leading-[1.4] text-white [overflow-wrap:anywhere]">
                  {draft.bio}
                </p>
              ) : (
                <div className="space-y-1.5 py-0.5">
                  <Bar className="h-2.5 w-full bg-white/30" />
                  <Bar className="h-2.5 w-[78%] bg-white/30" />
                </div>
              )}
            </div>

            {/* Lower row: interest chips on the left, profile photo on the
                right. The photo sits BELOW the bio (no z-index overlap) and
                bleeds to the card's bottom + right edge. */}
            <div className="relative flex items-stretch gap-2">
              <div className="relative z-10 flex flex-1 flex-col items-start gap-2 pb-7">
                {heroInterests.length > 0
                  ? heroInterests.map((entry) => {
                      const Icon = iconFor(entry.name);
                      return (
                        <span
                          key={entry.name}
                          className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-[#b164ff]/40 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
                        >
                          <Icon className="size-4" />
                          {entry.name}
                        </span>
                      );
                    })
                  : [44, 60, 52].map((w, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-3 py-1.5"
                      >
                        <span className="size-4 rounded-full bg-white/30" />
                        <span
                          className="block h-2.5 rounded-full bg-white/30"
                          style={{ width: w }}
                        />
                      </span>
                    ))}
              </div>

              {/* Profile cutout on a cyan spray-paint contour */}
              <div className="pointer-events-none relative z-0 -mr-5 min-h-[232px] w-[56%] shrink-0 self-stretch">
                {cutout && <CutoutSpray cutout={cutout} />}
              </div>
            </div>
          </div>
        </div>

        {/* ── Below the hero ───────────────────────────────────────────── */}
        <div className="space-y-6 px-5 pb-12 pt-6">
          {/* Spotify — the record straddles up onto the hero, so this sits above it */}
          <div data-region="spotify" className={cn("relative z-10", dof("spotify"))}>
            {draft.spotifyUrl ? (
              <SpotifySong key={draft.spotifyUrl} url={draft.spotifyUrl} />
            ) : (
              <SkeletonRow icon={<Disc3 className="size-5 text-foreground/30" />} label="On repeat" />
            )}
          </div>

          {/* Audio intro */}
          <div data-region="media" className={dof("media")}>
            {draft.media.kind ? (
              <MediaNote name={name || "you"} media={draft.media} />
            ) : (
              <SkeletonRow icon={<Play className="size-5 text-foreground/30" />} label={`Hear from ${name || "you"}`} waveform />
            )}
          </div>

          {/* My vibe — an all-at-once carousel board, sitting directly above the
              interests stack (deliberately a different shape: a scannable row vs.
              the interests z-stack).
              Vibe reflection slot (v2, OUT of scope now): a short, dismissable
              read of the BOARD could later sit just below this carousel — reflect
              the board not the person, keep it editable ("sounds right / not
              quite"), use provisional language ("so far this reads…"), and NO
              completion/strength meter. Don't build the model call yet. */}
          <div data-region="vibe" className={dof("vibe")}>
            <SectionLabel>My vibe</SectionLabel>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {vibe.length > 0
                ? vibe.map((v, i) => (
                    <div
                      key={v.id}
                      className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-[0_4px_14px_rgba(31,30,29,0.12)]"
                      style={{ transform: `rotate(${VIBE_TILT[i % VIBE_TILT.length]}deg)` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.photo} alt="" className="size-full object-cover" />
                    </div>
                  ))
                : [0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] w-24 shrink-0 rounded-xl border-2 border-dashed border-foreground/15 bg-foreground/[0.03]"
                      style={{ transform: `rotate(${VIBE_TILT[i % VIBE_TILT.length]}deg)` }}
                    />
                  ))}
            </div>
          </div>

          {/* My interests — stacked, swipeable photo deck */}
          <div data-region="interests" className={dof("interests")}>
            <SectionLabel>My interests</SectionLabel>
            <InterestPhotoDeck entries={draft.interests} />
          </div>

          <ChipRegion
            dataRegion="languages"
            className={dof("languages")}
            title="Languages"
            items={draft.languages}
          />
        </div>
      </div>
    </div>
  );
}

// ── Skeleton primitives ──────────────────────────────────────────────────────
function Bar({ className }: { className?: string }) {
  return <div className={cn("h-3 rounded-full bg-foreground/10", className)} />;
}

function SkeletonRow({
  icon,
  label,
  waveform,
}: {
  icon: React.ReactNode;
  label: string;
  waveform?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground/40">{label}</p>
        <Bar className="h-2 w-24" />
      </div>
      {waveform && (
        <div className="ml-auto flex items-end gap-0.5">
          {[8, 14, 7, 18, 10, 15, 6].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-foreground/15"
              style={{ height: h }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Cyan spray-paint contour via SVG filters. Two layers, both derived from the
// cutout's alpha and uniformly dilated with feMorphology (so the band thickness
// is even all around — not scaled from one origin like before):
//   • #cutoutBand — a thick SOLID cyan band hugging the silhouette, and
//   • #cutoutSpray — organic, fully-opaque flecks that fray just BEYOND that
//     band's edge (dilate → soft falloff → fractal-noise hard threshold → flood).
// The crisp photo sits on top. R sets the band thickness / where the speckle
// begins (px in the img's CSS space — the filter is NOT scale-invariant, so
// calibrate at the real phone render size, not magnified).
// True only when the user hasn't asked to reduce motion — gates the SMIL "TV
// static" shimmer. (CSS-driven animations are gated in globals.css instead.)
function usePrefersMotion() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: no-preference)");
    setOk(mq.matches);
    const handler = () => setOk(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return ok;
}

function CutoutSpray({ cutout }: { cutout: string }) {
  const R = 10; // dilation radius ≈ solid-band thickness; flecks fray beyond it
  const motionOk = usePrefersMotion();
  return (
    <>
      {/* Filters rendered once (duplicate identical defs across preview
          instances are harmless — url(#id) resolves to the first match). */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          {/* Solid, uniform cyan band: dilate the silhouette evenly, soften the
              morphology corners, flood cyan. */}
          <filter
            id="cutoutBand"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={R}
              result="fat"
            />
            {/* no blur — a crisp solid band; the scatter masks its edge */}
            <feFlood floodColor={CYAN} result="paint" />
            <feComposite in="paint" in2="fat" operator="in" />
          </filter>

          {/* Organic opaque flecks fraying off the band's outer edge: dilate to
              the band edge first so the speckle starts there, then the soft
              falloff + noise threshold paint broken cyan specks beyond it. */}
          <filter
            id="cutoutSpray"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            {/* push the falloff out to the band edge so speckle starts there */}
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={R}
              result="fat"
            />
            {/* wide soft falloff → dramatic scatter reaching well past the band */}
            <feGaussianBlur in="fat" stdDeviation="15" result="soft" />
            {/* fine fractal noise → small, varied organic spots/blotches */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.55"
              numOctaves="4"
              seed="7"
              stitchTiles="noStitch"
              result="noise"
            >
              {/* TV-static shimmer: cycling the noise seed reshuffles only the
                  thresholded flecks each step, so just the sprayed EDGE crackles
                  — the solid band + photo are separate layers and stay still. */}
              {motionOk && (
                <animate
                  attributeName="seed"
                  values="7;31;3;22;13;28;5;19"
                  dur="0.8s"
                  calcMode="discrete"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            {/* couple noise to the falloff: dense crisp spots at the band edge
                thinning outward (alpha = k1·soft·noise + k2·soft + k4) */}
            <feComposite
              in="soft"
              in2="noise"
              operator="arithmetic"
              k1="2"
              k2="0.1"
              k3="0"
              k4="0.24"
              result="mix"
            />
            {/* hard threshold → fully opaque specks, zero transparency */}
            <feComponentTransfer in="mix" result="cut">
              <feFuncA type="discrete" tableValues="0 0 1 1" />
            </feComponentTransfer>
            {/* paint the specks solid cyan */}
            <feFlood floodColor={CYAN} result="paint" />
            <feComposite in="paint" in2="cut" operator="in" />
          </filter>
        </defs>
      </svg>

      {/* All three layers Ken-Burns together so the cyan contour tracks the
          photo as one (CSS animation in globals.css; off under reduced motion). */}
      <div className="kenburns absolute inset-0">
        {/* 1 · thick solid band hugging the person */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cutout}
          alt=""
          className="absolute inset-0 size-full object-contain object-bottom"
          style={{ filter: "url(#cutoutBand)" }}
        />
        {/* 2 · organic opaque flecks fraying off the band edge */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cutout}
          alt=""
          className="absolute inset-0 size-full object-contain object-bottom"
          style={{ filter: "url(#cutoutSpray)" }}
        />
        {/* 3 · the person, crisp, on top */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cutout}
          alt=""
          className="absolute inset-0 size-full object-contain object-bottom"
        />
      </div>
    </>
  );
}

// Faux iOS status bar — sits on the purple hero, flanking the Dynamic Island.
function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-[15] flex items-center justify-between px-6 pt-3.5 text-white">
      <span className="text-[13px] font-semibold tracking-tight tabular-nums">
        9:41
      </span>
      <div className="flex items-center gap-1.5">
        {/* cellular */}
        <span className="flex items-end gap-[2px]">
          {[5, 7, 9, 11].map((h) => (
            <span
              key={h}
              className="w-[3px] rounded-[1px] bg-white"
              style={{ height: h }}
            />
          ))}
        </span>
        <Wifi className="size-3.5" strokeWidth={2.5} />
        {/* battery */}
        <span className="flex items-center">
          <span className="flex h-[12px] w-[22px] items-center rounded-[3px] border border-white/80 p-[1.5px]">
            <span className="h-full w-[70%] rounded-[1px] bg-white" />
          </span>
          <span className="ml-[1px] h-[4px] w-[1.5px] rounded-r bg-white/80" />
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function ChipRegion({
  title,
  items,
  dataRegion,
  className,
}: {
  title: string;
  items: string[];
  dataRegion: string;
  className?: string;
}) {
  return (
    <div data-region={dataRegion} className={className}>
      <SectionLabel>{title}</SectionLabel>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {[56, 72, 48].map((w, i) => (
            <span
              key={i}
              className="h-7 rounded-full bg-foreground/8"
              style={{ width: w }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// "My interests" — a stacked, swipe-one-at-a-time deck of the mentor's interest
// photos (each card = the photo + its interest pill, mirroring the editing step).
function InterestPhotoDeck({ entries }: { entries: InterestEntry[] }) {
  const withPhoto = entries.filter((e) => e.photo);
  const [index, setIndex] = useState(0);

  if (withPhoto.length === 0) {
    return (
      <div className="relative mx-auto aspect-[3/4] w-[72%] max-w-[230px]">
        {[2, 1, 0].map((o) => (
          <div
            key={o}
            className="absolute inset-0 overflow-hidden rounded-2xl border-4 border-white bg-muted shadow-[0_6px_16px_rgba(31,30,29,0.08)]"
            style={{
              transform: `translateY(${o * 8}px) scale(${1 - o * 0.05}) rotate(${o === 1 ? 3 : o === 2 ? -2.5 : 0}deg)`,
              zIndex: 3 - o,
            }}
          >
            {/* Opaque cards (so the stack doesn't bleed into a busy moiré); a
                faint, sparse dot texture on just the top card reads as a
                placeholder without the noise. */}
            {o === 0 && (
              <div
                className="size-full text-foreground/[0.08]"
                style={{
                  backgroundImage:
                    "radial-gradient(currentColor 1px, transparent 1.5px)",
                  backgroundSize: "11px 11px",
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  const i = Math.min(index, withPhoto.length - 1);
  return (
    <SwipeDeck
      count={withPhoto.length}
      index={i}
      onIndexChange={setIndex}
      controls={false}
      className="mx-auto aspect-[3/4] w-[72%] max-w-[230px]"
      renderCard={(idx) => {
        const e = withPhoto[idx];
        const Icon = iconFor(e.name);
        return (
          <div className="relative size-full overflow-hidden rounded-2xl border-4 border-white shadow-[0_10px_26px_rgba(31,30,29,0.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.photo!} alt={e.name} className="size-full object-cover" />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-black/35 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Icon className="size-3.5" />
              {e.name}
            </span>
          </div>
        );
      }}
    />
  );
}

function MediaNote({ name, media }: { name: string; media: MediaIntro }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      <button
        type="button"
        onClick={toggle}
        disabled={!media.url}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60"
        style={{ background: PURPLE }}
      >
        {playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="size-4 fill-current" />
        )}
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium">Hear from {name}</p>
        <p className="truncate text-xs text-muted-foreground capitalize">
          {media.kind} intro
          {media.durationSec
            ? ` · ${Math.floor(media.durationSec / 60)}:${String(
                media.durationSec % 60
              ).padStart(2, "0")}`
            : ""}
        </p>
      </div>
      <div className="ml-auto flex items-end gap-0.5">
        {[10, 16, 8, 20, 12, 18, 7].map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-muted-foreground/40"
            style={{ height: h }}
          />
        ))}
      </div>
      {media.url && (
        <audio
          ref={audioRef}
          src={media.url}
          className="hidden"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  );
}
