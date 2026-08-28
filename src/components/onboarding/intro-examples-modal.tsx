"use client";

import { useRef, useState } from "react";
import { Play, Pause, Volume2, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Progressive disclosure for the audio-intro step: an opt-in modal of a few real
// mentor intros, kept OFF the main screen so it never competes with Record (the
// primary action). The transcript below each clip is the teaching content AND the
// caption (WCAG 1.2.1) — transcribed from the recordings (brand normalized to
// "Somethings"; otherwise verbatim, spoken phrasing kept).
const SAMPLES: { name: string; src: string; transcript: string }[] = [
  {
    name: "Valerie Pulido",
    src: "/onboarding/intro-samples/valerie-pulido.mp3",
    transcript:
      "Hi, I'm Valerie, one of the mentors here with Somethings. I love connecting with people and reminding you that it's totally okay not to have everything figured out yet. When I'm not mentoring, you'll probably find me at a coffee shop, at a Pilates class, or getting lost in a book. I became a mentor because I've had people in my life who showed up for me when I needed it most, and now I get to be that person for someone else. If we match, I hope you feel like you can be your true, authentic self around me, no pressure, no judgment, just real talks and good energy.",
  },
  {
    name: "Sailor Smoak",
    src: "/onboarding/intro-samples/sailor-smoak.mp3",
    transcript:
      "Hi, I'm Sailor, and I'm a mentor with Somethings, because I know what it feels like to struggle silently, and I want to help others not have to do that. Some things I love are music, workout classes, and getting iced coffee and pup cups with my dog, Ash. If we match, I hope you feel like you can chat with me about anything, there's no pressure, no judgment. I'm here for you.",
  },
  {
    name: "Charisma Mayo",
    src: "/onboarding/intro-samples/charisma-mayo.mp3",
    transcript:
      "Hey, my name is Charisma, and I am your new Somethings mentor. I am a mentor at Somethings because I want to be able to provide that safe space that I believe that everybody deserves. Two things that I am currently doing right now is watching the TV show Dairy and reading. I became a mentor because I wanted to be able to provide a listening ear and support for people, whether it's in their darkest moments or their lightest moments. Just know that if me and you partner up and I become your mentor, we are in this together, no matter what. You are never alone.",
  },
];

function fmt(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Custom player matching the Figma sample-intro design (tangelo play/pause, a
// thin seek track + thumb, running time, a decorative speaker glyph). It wraps a
// real <audio> so play/pause/seek/time work; the transparent <input type=range>
// overlay keeps the scrubber keyboard-operable + labelled (the visible track/
// thumb are drawn beneath it, so we get the design AND the a11y for free).
function AudioSample({ src, name }: { src: string; name: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const pct = duration ? (Math.min(current, duration) / duration) * 100 : 0;

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  return (
    <div className="flex items-center gap-3">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={`${playing ? "Pause" : "Play"} ${name}'s intro`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {playing ? (
          <Pause className="size-5 fill-current" aria-hidden />
        ) : (
          <Play className="size-5 translate-x-px fill-current" aria-hidden />
        )}
      </button>

      {/* Seek track — visible track/fill/thumb drawn beneath a transparent native
          range input (h-6 keeps the pointer target ≥24px per WCAG 2.5.8). */}
      <div className="group relative flex h-6 flex-1 items-center">
        <div className="h-0.5 w-full rounded-full bg-foreground/15" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brand"
          style={{ width: `${pct}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] ring-1 ring-foreground/20 group-focus-within:ring-2 group-focus-within:ring-ring"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={Math.min(current, duration || 0)}
          onChange={(e) => {
            const a = ref.current;
            const t = Number(e.target.value);
            if (a) a.currentTime = t;
            setCurrent(t);
          }}
          aria-label={`Seek ${name}'s intro`}
          className="absolute inset-0 size-full cursor-pointer appearance-none bg-transparent opacity-0"
        />
      </div>

      <span className="shrink-0 font-display text-[13px] font-bold tabular-nums tracking-tight text-foreground/55">
        {fmt(current)} / {fmt(duration)}
      </span>
      <Volume2 className="size-5 shrink-0 text-foreground/45" aria-hidden />
    </div>
  );
}

export function IntroExamplesModal() {
  return (
    <Dialog>
      {/* Low-weight text link — deliberately quiet so Record stays dominant.
          DialogTrigger owns the open state and restores focus to this button on
          close (WCAG 2.4.3 / 2.4.7). */}
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-sm text-xs font-medium text-foreground/70 underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Listen to a few examples
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        /* LOCAL max-h REMOVED — the primitive carries the bound now (max-h-[90dvh]),
           and this was `88vh`, which on mobile Safari is taller than the visible
           viewport whenever the URL bar is showing. One behaviour, one place. */
        className="gap-6 rounded-3xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.15)] sm:max-w-[480px]"
      >
        <DialogHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-display text-2xl leading-tight font-bold tracking-tight text-foreground">
              A few example intros
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-foreground/65">
              No need to copy these — just a feel for what works.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground/70 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* Real transcripts run long, so the list scrolls while the header +
            "Got it" stay put. */}
        <ul className="-mx-1 flex max-h-[56vh] flex-col gap-3 overflow-y-auto px-1">
          {SAMPLES.map((s) => (
            <li key={s.name} className="rounded-2xl bg-muted p-4">
              <AudioSample src={s.src} name={s.name} />
              <p className="mt-3 text-[15px] leading-relaxed text-foreground">
                <span className="font-medium">{s.name}:</span> {s.transcript}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex justify-center pt-1">
          <DialogClose asChild>
            <Button size="lg">Got it</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
