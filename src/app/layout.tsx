import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lausanne.variable} ${avantt.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
