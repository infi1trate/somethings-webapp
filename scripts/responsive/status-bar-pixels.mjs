// ═══ THE ONE HONEST WAY TO CHECK A GRADIENT SCRIM: READ THE PIXELS ═══
//
// The status-bar scrim is a `linear-gradient` on a sibling span, so no
// computed-style checker can see it — `bgOf` walks ancestor BACKGROUND-COLOURS,
// and a gradient sets `background-image` on an element that is not an ancestor.
// Every style-based probe therefore reports the clock at 3.42:1 (white on the
// raw hero purple) whether the scrim is there or not.
//
// So this decodes the screenshot. Node ships zlib, which is the only hard part
// of a PNG: parse IHDR, inflate the concatenated IDAT, undo the per-scanline
// filter, and index into RGBA. It then samples the pixels the clock is drawn on
// and reports the real measured contrast of the darkest and lightest text pixels
// against the local background beside them.
import { chromium } from "playwright";
import { inflateSync } from "node:zlib";

function decodePng(buf) {
  let pos = 8, width = 0, height = 0, depth = 0, ctype = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2)) {
    throw new Error(`unsupported PNG: depth ${depth}, colour type ${ctype}`);
  }
  const ch = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= ch && prev ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, ch, data: out };
}

const lum = ([r, g, b]) => {
  const s = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const BASE = process.env.BASE ?? "http://localhost:3003";
const b = await chromium.launch();
let fails = 0;
for (const mode of ["light", "dark"]) {
  const ctx = await b.newContext({ colorScheme: mode, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/onboarding/preview`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);

  const scrim = await p.evaluate(`(() => {
    const el = document.querySelector("[data-status-scrim]");
    if (!el) return "ABSENT";
    const cs = getComputedStyle(el);
    return cs.backgroundImage.slice(0, 78) + "  z=" + cs.zIndex;
  })()`);
  console.log(`  ${mode}: scrim → ${scrim}`);

  const clock = p.locator("span.tabular-nums").first();
  const box = await clock.boundingBox();
  if (!box) { console.log(`  ${mode}: clock not found`); fails++; await ctx.close(); continue; }
  // A generous crop around the glyphs: the scrim's own alpha varies with y, so
  // the sample must be the band the TEXT occupies, not the strip's whole height.
  const pad = 2;
  const shot = await p.screenshot({
    clip: { x: Math.floor(box.x - pad), y: Math.floor(box.y - pad), width: Math.ceil(box.width + pad * 2), height: Math.ceil(box.height + pad * 2) },
    type: "png",
  });
  const img = decodePng(shot);
  const px = (x, y) => {
    const i = y * img.width * img.ch + x * img.ch;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  // Separate glyph pixels from local background by luminance: the ink is white,
  // the ground is a mid purple, and nothing else is in this crop.
  // ═══ SAMPLE THE EXTREMES, NOT PERCENTILES ═══
  // A 13px glyph at 1× is mostly ANTIALIASED EDGE. A 2nd-percentile pick landed
  // on rgb(204,204,204) — a half-covered pixel — and reported 3.14:1 for text
  // that is actually white. WCAG compares the INTENDED colours, so the ink is the
  // brightest pixel (a fully covered glyph core) and the ground is the most
  // common colour in the crop (the field the glyphs sit on).
  const all = [];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) all.push(px(x, y));
  const ink = all.reduce((best, c) => (lum(c) > lum(best) ? c : best), all[0]);
  const tally = new Map();
  for (const c of all) {
    const k = c.join(",");
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const ground = [...tally.entries()].sort((a, z) => z[1] - a[1])[0][0].split(",").map(Number);
  const r = ratio(ink, ground);
  const ok = r >= 4.5;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${mode}: clock ink rgb(${ink}) on scrimmed ground rgb(${ground}) = ${r.toFixed(2)}:1 (need 4.5)`);
  await ctx.close();
}
await b.close();
console.log(fails === 0 ? "\nSCRIM VERIFIED" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
