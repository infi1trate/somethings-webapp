"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Video, Square, X, RotateCcw, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Moodie } from "@/components/doodles";
import { cn } from "@/lib/utils";
import type { MediaIntro } from "@/lib/types";

interface Props {
  value: MediaIntro;
  onChange: (next: MediaIntro) => void;
}

type Kind = "audio" | "video";
type Mode = "idle" | "recording" | "review" | "denied";

function pickMime(kind: Kind): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates =
    kind === "video"
      ? ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const MAX_SECONDS = 60;

export function MediaIntroField({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [kind, setKind] = useState<Kind>("audio");
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ url: string; durationSec: number } | null>(
    null
  );

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Clean up on unmount: stop hardware + revoke an unsaved review clip.
  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      if (clip && clip.url !== value.url) URL.revokeObjectURL(clip.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = () => {
    clearTimer();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const startRecording = async (k: Kind) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMode("denied");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        k === "video"
          ? { audio: true, video: { facingMode: "user" } }
          : { audio: true }
      );
      streamRef.current = stream;
      setKind(k);
      setElapsed(0);
      elapsedRef.current = 0;
      chunksRef.current = [];
      setMode("recording");

      if (k === "video" && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }

      const recorder = new MediaRecorder(stream, { mimeType: pickMime(k) });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || (k === "video" ? "video/webm" : "audio/webm"),
        });
        const url = URL.createObjectURL(blob);
        stopTracks();
        setClip({ url, durationSec: elapsedRef.current });
        setMode("review");
      };
      recorder.start();

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_SECONDS) stopRecording();
      }, 1000);
    } catch {
      stopTracks();
      setMode("denied");
    }
  };

  const cancelRecording = () => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null as never;
      recorderRef.current.stop();
    }
    stopTracks();
    setMode("idle");
  };

  const retake = () => {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setMode("idle");
  };

  const save = () => {
    if (!clip) return;
    onChange({
      kind,
      name: "Your recording",
      url: clip.url,
      durationSec: clip.durationSec,
    });
    setClip(null);
    setMode("idle");
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const k: Kind = file.type.startsWith("video") ? "video" : "audio";
    onChange({
      kind: k,
      name: file.name,
      url: URL.createObjectURL(file),
      durationSec: null,
    });
    setMode("idle");
  };

  const replace = () => {
    if (value.url) URL.revokeObjectURL(value.url);
    onChange({ kind: null, name: null, url: null, durationSec: null });
    setMode("idle");
  };

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="audio/*,video/*"
      className="hidden"
      onChange={(e) => onFile(e.target.files?.[0])}
    />
  );

  // ── Saved ────────────────────────────────────────────────────────────────
  if (value.kind && mode === "idle") {
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            {value.kind === "video" ? (
              <Video className="size-5" />
            ) : (
              <Mic className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {value.kind} intro
              {value.durationSec ? ` · ${fmt(value.durationSec)}` : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={replace}>
            <RotateCcw className="size-4" />
            Replace
          </Button>
        </div>
        {value.url &&
          (value.kind === "video" ? (
            <video
              src={value.url}
              controls
              className="w-full rounded-xl bg-black"
            />
          ) : (
            <audio src={value.url} controls className="w-full" />
          ))}
        {hiddenFileInput}
      </div>
    );
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  if (mode === "recording") {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        {kind === "video" ? (
          <video
            ref={liveVideoRef}
            muted
            autoPlay
            playsInline
            className="aspect-video w-full rounded-xl bg-black object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="relative flex size-20 items-center justify-center rounded-full bg-brand/15 text-brand">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
              <Mic className="size-8" />
            </span>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          <span className="font-medium tabular-nums">{fmt(elapsed)}</span>
          <span className="text-muted-foreground">/ {fmt(MAX_SECONDS)}</span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="ghost" onClick={cancelRecording}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button type="button" variant="brand" onClick={stopRecording}>
            <Square className="size-4 fill-current" />
            Stop
          </Button>
        </div>
      </div>
    );
  }

  // ── Review ───────────────────────────────────────────────────────────────
  if (mode === "review" && clip) {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        {kind === "video" ? (
          <video
            src={clip.url}
            controls
            className="aspect-video w-full rounded-xl bg-black object-cover"
          />
        ) : (
          <audio src={clip.url} controls className="w-full" />
        )}
        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="ghost" onClick={retake}>
            <RotateCcw className="size-4" />
            Re-take
          </Button>
          <Button type="button" onClick={save}>
            <Check className="size-4" />
            Use this
          </Button>
        </div>
      </div>
    );
  }

  // ── Denied / unsupported ───────────────────────────────────────────────────
  if (mode === "denied") {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground text-pretty">
          We couldn&apos;t reach your mic or camera. Check your browser permissions,
          or upload a file instead.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="ghost" onClick={() => setMode("idle")}>
            Try again
          </Button>
          <Button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            Upload a file
          </Button>
        </div>
        {hiddenFileInput}
      </div>
    );
  }

  // ── Choose (idle, nothing saved) ───────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
      <Moodie name="face-happy" className="size-12" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Record a quick hello</p>
        <p className="text-xs text-muted-foreground">
          A short audio or video intro helps teens get a feel for you. 30–60 seconds
          is plenty.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="secondary"
          onClick={() => startRecording("audio")}
        >
          <Mic className="size-4" />
          Record audio
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => startRecording("video")}
        >
          <Video className="size-4" />
          Record video
        </Button>
      </div>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        )}
      >
        or upload a file
      </button>
      {hiddenFileInput}
    </div>
  );
}
