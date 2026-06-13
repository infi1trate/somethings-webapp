"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Music,
  Gamepad2,
  Palette,
  Trophy,
  BookOpen,
  Clapperboard,
  ChefHat,
  Camera,
  Shirt,
  Dumbbell,
  Mountain,
  Code,
  Sparkles,
  HeartHandshake,
  Play,
  Pause,
  CalendarClock,
  Disc3,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { SpotifySong } from "@/components/onboarding/spotify-song";
import { cn } from "@/lib/utils";
import { WEEKDAYS, type MediaIntro, type MentorDraft } from "@/lib/types";

const INTEREST_ICONS: Record<string, LucideIcon> = {
  Music,
  Gaming: Gamepad2,
  "Art & drawing": Palette,
  Sports: Trophy,
  Reading: BookOpen,
  "Movies & TV": Clapperboard,
  Cooking: ChefHat,
  Photography: Camera,
  Fashion: Shirt,
  "Working out": Dumbbell,
  Anime: Sparkles,
  "Hiking & outdoors": Mountain,
  Coding: Code,
  Dance: Music,
  Skateboarding: Trophy,
  Volunteering: HeartHandshake,
};
const iconFor = (i: string) => INTEREST_ICONS[i] ?? Sparkles;

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

const PURPLE = "#b164ff";
const TILT = [-3, 2.5, -1.5, 3, -2, 1.5]; // organic polaroid angles
const CYAN = "#71e0ff";

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
  const availableDays = WEEKDAYS.filter((d) => draft.schedule[d].enabled);

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const focused = !!focus && focus.region !== "all";

  // Depth-of-field: keep the active block crisp, blur + dim the rest. The purple
  // hero (name/bio/interests) is one focus group; each section below is its own.
  const activeGroup = !focused
    ? null
    : ["identity", "bio", "interests"].includes(focus!.region)
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
    // just below the top edge.
    const isHero = ["identity", "bio", "interests"].includes(focus.region);
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
    const headroom = isHero ? 0 : vpH * 0.12;
    const t = headroom / s - top;
    stage.style.transform = `scale(${s}) translateY(${t}px)`;
  }, [focus]);

  useEffect(() => {
    applyFocus();
  }, [applyFocus, name, draft.bio, heroInterests.length, availableDays.length]);

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
            "relative overflow-hidden px-5 pb-7 pt-16",
            dof("hero")
          )}
          style={{ background: PURPLE }}
        >
          <StatusBar />

          {/* Profile cutout on a cyan spray-paint contour, bottom-right */}
          <div className="pointer-events-none absolute bottom-0 right-0 z-0 h-[72%] w-[58%]">
            {cutout ? (
              <CutoutSpray cutout={cutout} />
            ) : (
              <div
                className="absolute inset-x-4 bottom-0 top-8 rounded-t-[120px] text-white/25"
                style={{
                  backgroundImage:
                    "radial-gradient(currentColor 1.1px, transparent 1.3px)",
                  backgroundSize: "8px 8px",
                }}
              />
            )}
          </div>

          <div className="relative z-10 flex flex-col gap-3.5 text-white">
            <div className="text-center">
              {name ? (
                <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-white">
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

            {/* Intro bubble */}
            <div
              data-region="bio"
              className="w-full rounded-[16px] rounded-bl-[4px] bg-white/15 px-3.5 py-2.5 text-left backdrop-blur-sm"
            >
              {draft.bio ? (
                <p className="text-[15px] leading-[1.4] text-white">
                  {draft.bio}
                </p>
              ) : (
                <div className="space-y-1.5 py-0.5">
                  <Bar className="h-2.5 w-full bg-white/30" />
                  <Bar className="h-2.5 w-[78%] bg-white/30" />
                </div>
              )}
            </div>

            {/* Interest chips — left column so the cutout sits to the right */}
            <div
              data-region="interests"
              className="flex max-w-[60%] flex-col items-start gap-2"
            >
              {heroInterests.length > 0
                ? heroInterests.map((interest) => {
                    const Icon = iconFor(interest);
                    return (
                      <span
                        key={interest}
                        className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-[#b164ff]/40 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
                      >
                        <Icon className="size-4" />
                        {interest}
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
          </div>
        </div>

        {/* ── Below the hero ───────────────────────────────────────────── */}
        <div className="space-y-6 px-5 pb-12 pt-6">
          {/* Spotify */}
          <div data-region="spotify" className={dof("spotify")}>
            {draft.spotifyUrl ? (
              <SpotifySong key={draft.spotifyUrl} url={draft.spotifyUrl} />
            ) : (
              <SkeletonRow icon={<Disc3 className="size-5 text-foreground/30" />} label="On repeat" />
            )}
          </div>

          {/* Audio / video intro */}
          <div data-region="media" className={dof("media")}>
            {draft.media.kind ? (
              <MediaNote name={name || "you"} media={draft.media} />
            ) : (
              <SkeletonRow icon={<Play className="size-5 text-foreground/30" />} label={`Hear from ${name || "you"}`} waveform />
            )}
          </div>

          {/* Photos — tilted polaroid carousel */}
          <div data-region="photos" className={dof("photos")}>
            <SectionLabel>Photos</SectionLabel>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {draft.additionalImages.length > 0
                ? draft.additionalImages.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.dataUrl}
                      alt={img.name}
                      className="aspect-[3/4] w-28 shrink-0 rounded-xl border-4 border-white object-cover shadow-[0_4px_14px_rgba(31,30,29,0.12)]"
                      style={{ transform: `rotate(${TILT[i % TILT.length]}deg)` }}
                    />
                  ))
                : [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] w-28 shrink-0 rounded-xl border-4 border-white text-foreground/15 shadow-[0_4px_14px_rgba(31,30,29,0.08)]"
                      style={{
                        transform: `rotate(${TILT[i % TILT.length]}deg)`,
                        backgroundImage:
                          "radial-gradient(currentColor 1.1px, transparent 1.3px)",
                        backgroundSize: "8px 8px",
                      }}
                    />
                  ))}
            </div>
          </div>

          <ChipRegion
            dataRegion="life"
            className={dof("life")}
            title="Can relate to"
            items={draft.lifeExperiences}
          />
          <ChipRegion
            dataRegion="languages"
            className={dof("languages")}
            title="Languages"
            items={draft.languages}
          />

          {/* Availability */}
          <div data-region="schedule" className={dof("schedule")}>
            <SectionLabel>Usually free</SectionLabel>
            {availableDays.length > 0 ? (
              <div className="flex items-start gap-2 text-sm">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="space-y-0.5">
                  {availableDays.map((d) => (
                    <div key={d} className="capitalize">
                      {d}{" "}
                      <span className="text-muted-foreground">
                        {formatTime(draft.schedule[d].start)}–
                        {formatTime(draft.schedule[d].end)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-foreground/25" />
                <div className="flex-1 space-y-1.5 pt-0.5">
                  <Bar className="w-2/3" />
                  <Bar className="w-1/2" />
                </div>
              </div>
            )}
          </div>
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

// Cyan spray-paint contour via an SVG turbulence filter. Fractal noise is
// coupled to the silhouette's blurred edge, then hard-thresholded to a binary,
// fully-opaque alpha and flooded cyan — so it reads as a SOLID band hugging the
// person that frays into small, organic, varied flecks a short distance off the
// edge (no grid, no soft/see-through dots). A solid core sits behind to keep the
// band dense; the spray img is dilated so its broken rim shows just past the
// core; the crisp photo sits on top.
function CutoutSpray({ cutout }: { cutout: string }) {
  const mask: React.CSSProperties = {
    WebkitMaskImage: `url("${cutout}")`,
    maskImage: `url("${cutout}")`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "bottom center",
    maskPosition: "bottom center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    transformOrigin: "bottom center",
  };
  return (
    <>
      {/* Filter rendered once (duplicate identical defs across preview instances
          are harmless — url(#cutoutSpray) resolves to the first match). */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter
            id="cutoutSpray"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            {/* silhouette alpha → soft edge falloff (how far flecks can reach) */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="soft" />
            {/* fractal noise: multi-scale → organic, varied fleck sizes/shapes */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.28"
              numOctaves="4"
              seed="7"
              stitchTiles="noStitch"
              result="noise"
            />
            {/* couple noise to the falloff: solid deep inside, broken at the
                fringe, gone past it (alpha = k1·soft·noise + k2·soft + k4) */}
            <feComposite
              in="soft"
              in2="noise"
              operator="arithmetic"
              k1="2.1"
              k2="0.62"
              k3="0"
              k4="-0.42"
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

      {/* 1 · solid core — clean dense band hugging the person */}
      <div
        className="absolute inset-0"
        style={{
          ...mask,
          background: CYAN,
          transform: "scale(1.04)",
          filter: "blur(0.5px)",
        }}
      />
      {/* 2 · spray — organic opaque flecks fraying off the dilated edge */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cutout}
        alt=""
        className="absolute inset-0 size-full object-contain object-bottom"
        style={{
          transform: "scale(1.08)",
          transformOrigin: "bottom center",
          filter: "url(#cutoutSpray)",
        }}
      />
      {/* 3 · the person, crisp, on top */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cutout}
        alt=""
        className="absolute inset-0 size-full object-contain object-bottom"
      />
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

function MediaNote({ name, media }: { name: string; media: MediaIntro }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  if (media.kind === "video" && media.url) {
    return (
      <div className="space-y-1.5">
        <SectionLabel>Meet {name}</SectionLabel>
        <video src={media.url} controls className="w-full rounded-2xl bg-black" />
      </div>
    );
  }

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
