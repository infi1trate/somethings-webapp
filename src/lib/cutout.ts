"use client";

// Removes the background from a profile photo (client-side ML via
// @imgly/background-removal) and returns a transparent PNG data URL, resized so
// it stays small enough to persist. The library is dynamically imported so it
// never enters the SSR / main bundle, and it lazy-downloads its model on first
// use. On any failure we fall back to the original image so the flow never breaks.

const MAX_DIM = 720;

async function resizedPngDataUrl(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/png");
}

export async function cutoutBackground(input: Blob): Promise<string> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const result = await removeBackground(input);
    return await resizedPngDataUrl(result);
  } catch {
    // Model/network/anything failed — keep the original so setup still works.
    return resizedPngDataUrl(input);
  }
}
