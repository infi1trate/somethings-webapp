"use client";

// Removes the background from a profile photo (client-side ML via
// @imgly/background-removal) and returns a transparent (alpha) WebP data URL.
// The library is dynamically imported so it never enters the SSR / main bundle,
// and it lazy-downloads its model on first use. On any failure we fall back to
// the original image so the flow never breaks.
//
// Quality: the source is only downscaled if it exceeds MAX_DIM, using
// high-quality resampling, then encoded as near-lossless WebP (q 0.92) — WebP
// keeps the alpha channel and is ~10× smaller than a lossless PNG, so it stays
// crisp at the sizes we display while still fitting the localStorage quota.

const MAX_DIM = 1440;
const WEBP_QUALITY = 0.92;

async function encodeCutout(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  // High-quality resampling so any downscale stays sharp (default is "low").
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/webp", WEBP_QUALITY);
}

export async function cutoutBackground(input: Blob): Promise<string> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const result = await removeBackground(input);
    return await encodeCutout(result);
  } catch {
    // Model/network/anything failed — keep the original so setup still works.
    return encodeCutout(input);
  }
}
