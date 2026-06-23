"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Camera, Upload, RotateCcw, Loader2, X } from "lucide-react";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { Button } from "@/components/ui/button";
import { Moodie } from "@/components/doodles";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { cutoutBackground } from "@/lib/cutout";
import { PhotoExamples } from "@/components/onboarding/photo-examples";

type Mode = "idle" | "camera" | "processing" | "denied";

export function ProfilePhotoStep() {
  const profilePhoto = useOnboardingStore((s) => s.draft.profilePhoto);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();
  const [mode, setMode] = useState<Mode>("idle");

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const form = useForm();

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => stopStream(), []);

  const process = async (blob: Blob) => {
    stopStream();
    setMode("processing");
    const url = await cutoutBackground(blob);
    update({ profilePhoto: url });
    setMode("idle");
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("denied");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      setMode("camera");
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      stopStream();
      setMode("denied");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    // Near-lossless WebP keeps the captured frame crisp before background removal.
    canvas.toBlob((b) => b && process(b), "image/webp", 0.95);
  };

  const onFile = (file: File | undefined) => {
    if (file) process(file);
  };

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => onFile(e.target.files?.[0])}
    />
  );

  return (
    <StepScaffold
      form={form}
      onSubmit={() => goNext()}
      title="Add a profile photo"
      subtitle="Snap one somewhere with a plain, light background — we'll lift you out and set you against a splash of color."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => goNext()}
    >
      {!profilePhoto && (mode === "idle" || mode === "denied") && <PhotoExamples />}

      {/* Saved */}
      {profilePhoto && mode === "idle" && (
        <div className="space-y-3">
          <div className="relative flex h-56 items-end justify-center overflow-hidden rounded-2xl border bg-[#71e0ff]/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profilePhoto}
              alt="Your profile photo"
              className="h-full w-auto object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button type="button" variant="ghost" onClick={startCamera}>
              <RotateCcw className="size-4" />
              Retake
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Upload another
            </Button>
          </div>
          {hiddenFileInput}
        </div>
      )}

      {/* Camera */}
      {mode === "camera" && (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="aspect-[3/4] w-full rounded-xl bg-black object-cover"
          />
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                stopStream();
                setMode("idle");
              }}
            >
              <X className="size-4" />
              Cancel
            </Button>
            <Button type="button" onClick={capture}>
              <Camera className="size-4" />
              Capture
            </Button>
          </div>
        </div>
      )}

      {/* Processing */}
      {mode === "processing" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
          <Loader2 className="size-6 animate-spin text-brand" />
          <p className="text-sm font-medium">Lifting you out…</p>
          <p className="text-xs text-muted-foreground">
            Removing the background. This can take a moment the first time.
          </p>
        </div>
      )}

      {/* Denied / unsupported */}
      {mode === "denied" && (
        <div className="space-y-4 rounded-2xl border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground text-pretty">
            We couldn&apos;t reach your camera. Check your browser permissions, or
            upload a photo instead.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setMode("idle")}>
              Try again
            </Button>
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload a photo
            </Button>
          </div>
          {hiddenFileInput}
        </div>
      )}

      {/* Choose (idle, nothing saved) */}
      {!profilePhoto && mode === "idle" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
          <Moodie name="face-happy" className="size-12" />
          <div className="space-y-1">
            <p className="text-sm font-medium">A clear photo of you</p>
            <p className="text-xs text-muted-foreground text-pretty">
              Plain, light background works best — it&apos;ll get cut out and dropped
              onto your color.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" variant="secondary" onClick={startCamera}>
              <Camera className="size-4" />
              Take a photo
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Upload
            </Button>
          </div>
          {hiddenFileInput}
        </div>
      )}
    </StepScaffold>
  );
}
