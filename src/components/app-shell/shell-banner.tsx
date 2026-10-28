"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE SHELL'S BANNER SLOT (pack v11.0, Supersession 8)
//
// An escalation banner spans from the sidebar's right edge to the content
// gutter — over the conversation, Care AND an open Support column. Support
// is the shell's own column beside the canvas, outside any surface's grid,
// so a banner inside the chat grid stopped at chat + Care (measured: 1072 of
// a 1496 gutter with Support open). The shell renders this one slot above
// the canvas-and-Support row; a surface portals its banner into it. Empty,
// it is nothing — no height, no landmark.

import { createContext, useContext } from "react";

export const ShellBannerSlot = createContext<HTMLElement | null>(null);

/** The slot element, once the shell has mounted it — null on the server and
 *  on the first client frame, and on a shell with no aside column. */
export const useShellBannerSlot = () => useContext(ShellBannerSlot);
