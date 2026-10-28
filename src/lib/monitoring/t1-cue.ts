"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TIER 1 CUE (Monitoring v4, §4) — Web Audio, no asset, no dependency
//
// The strips' job of being NOTICED moved to the bell: an unconfirmed Tier 1
// arriving while the console is open plays one short two-note chime, unless
// this persona muted it in the tray's header (`t1CueMuted`, persisted).
//
// ═══ AN ARRIVAL, NOT A STATE ═══ What was already waiting when the console
// loaded is not news — the badge and the tray state it. The first set of
// unconfirmed ids seen is the baseline; only an id after it sounds. Module
// state, so the desktop and mobile bells (both mounted) sound once.
//
// ═══ THE BROWSER'S RULE ═══ An AudioContext may only start after a gesture
// on the page. It is created on the first pointerdown/keydown; an arrival
// before any gesture is announced (the badge, the live region) but silent —
// the platform's limit, stated rather than worked around.

let ctx: AudioContext | null = null;
let armed = false;
function arm() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const unlock = () => {
    try {
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      /* No audio on this device: the cue is an extra, never the only signal. */
    }
  };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}

/** Two soft sine notes, a rising fourth, ~0.45s. Quiet: a cue, not an alarm. */
export function playT1Cue() {
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  for (const [i, freq] of [659.25, 880].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const at = t0 + i * 0.16;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.12, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.3);
  }
}

let heard: Set<string> | null = null;
/** The ids among `ids` that have not been heard before. The first call is
 *  the baseline and returns none. Call from an effect. */
export function takeArrivals(ids: readonly string[]): string[] {
  arm();
  if (heard === null) {
    heard = new Set(ids);
    return [];
  }
  const fresh = ids.filter((id) => !heard!.has(id));
  for (const id of fresh) heard.add(id);
  return fresh;
}
