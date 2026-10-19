import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NavHistoryInstaller } from "@/components/app-shell/nav-history-installer";
import { DevBar, DEV_BAR_H } from "@/components/dev/dev-bar";
// The annotation layer. Renders NOTHING in Off mode (the default) — see R11.
import { AnnoLayer } from "@/components/anno/anno-layer";

// Real Somethings brand type, self-hosted from src/app/fonts.
// TWK Lausanne = body / UI. Avantt Bold = display (headings, buttons, wordmark).
const lausanne = localFont({
  variable: "--font-lausanne",
  display: "swap",
  src: [
    { path: "./fonts/TWKLausanne-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/TWKLausanne-400.woff", weight: "400", style: "normal" },
  ],
});

const avantt = localFont({
  variable: "--font-avantt",
  display: "swap",
  src: [
    { path: "./fonts/Avantt-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Avantt-Bold.woff", weight: "700", style: "normal" },
    { path: "./fonts/Avantt-BoldItalic.woff2", weight: "700", style: "italic" },
    { path: "./fonts/Avantt-BoldItalic.woff", weight: "700", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: "Become a mentor · Somethings",
  description: "Set up your mentor profile on Somethings.",
};

// Pre-paint theme script. The theme lives in localStorage (see
// lib/use-appearance.ts), which React can only read AFTER hydration — so
// without this the page paints light for a frame and then snaps to dark.
//
// This is a RAW inline <script> in <head> on purpose. next/script's
// `beforeInteractive` is the more idiomatic App Router path, but in App Router
// it defers the source into Next's `self.__next_s` queue, which the runtime
// drains after the document parses — i.e. after first paint, which is exactly
// the flash we are removing. A synchronous inline script in <head> is the only
// form with a hard ordering guarantee.
//
// ═══ IF YOU SEE "Encountered a script tag while rendering React component" ═══
//
// It is NOT this line, and it is not cosmetic — DO NOT silence it. React only
// renders a Server Component's output on the client when it has to REGENERATE
// the tree, which is what it does after a hydration mismatch. So that notice is
// a second symptom of a mismatch somewhere else in the tree, and the fix is
// there rather than here.
//
// ═══ THE SCRIPT IS BACK, AND IT NO LONGER ASKS THE OS (addendum §2.5, §3.5) ═══
//
// The version that was removed read `localStorage["somethings.theme"]`,
// defaulted to `"system"` and consulted `prefers-color-scheme`. That default is
// what handed an inverted clinical surface to every supervisor on a dark OS.
//
// THIS ONE READS THE STORED CHOICE AND NOTHING ELSE. No media query, no
// fallback to the OS, and anything that is not exactly `"dark"` — including a
// stale `"system"` written by the old build — resolves to light. The only way
// to a dark clinical surface is a person having pressed the toggle.
//
// IT MIRRORS `themeFromStored` IN `lib/use-appearance.ts`, which is a real
// duplication and worth naming: this runs before any module loads, so it cannot
// import that function. The two rules are one line each and disagree loudly if
// they ever drift — the page would paint one theme and hydrate into the other.
//
// `suppressHydrationWarning` STAYS on `<html>`: the script mutates the class
// before React hydrates, which is exactly what the attribute is for.
const THEME_SCRIPT = `try{var t=localStorage.getItem("somethings.theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The script below mutates <html>'s class before React hydrates.
      suppressHydrationWarning
      className={`${lausanne.variable} ${avantt.variable} h-full antialiased`}
    >
      <head>
        {/* RAW AND SYNCHRONOUS, in <head> — see the note above on why
            next/script's `beforeInteractive` is the wrong tool here. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* THE BAR'S HEIGHT AS BOTTOM PADDING, so the strip does NOT overlay the
          product. Three floating dev docks used to sit on top of the UI at
          different corners, each dodging the last; one bar with the page padded
          clear of it means no product pixel is ever underneath dev chrome.
          The value comes from the component so the two cannot drift. */}
      <body
        className="flex min-h-full flex-col"
        style={{ paddingBottom: DEV_BAR_H }}
      >
        {/* In-app back/forward availability for the console top bar (SUP-1).
            Here, not in the console layout, so it sees every navigation from
            the first page. Renders nothing. */}
        <NavHistoryInstaller />
        {children}
        <Toaster />
        {/* Dev/demo scaffolding — intentionally rendered in ALL environments
            (incl. the Vercel demo) so reviewers can flip between roles and
            scenarios. No auth behind it; the gate is that a real deployment
            ships no mock data. See the note in dev-bar.tsx. */}
        <DevBar />
        {/* Off by default: returns null, so the prototype is unchanged. */}
        <AnnoLayer />
      </body>
    </html>
  );
}
