"use client";

// A quote-framed line with its attribution: the mentor's note, a moment added
// from the chat, the supervisor's latest Support message. One frame, so every
// quoted voice on the escalation reads the same way.

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function Quote({ text, who, at, note, slot }: { text: string; who: string; at: number; note?: string; slot: string }) {
  return (
    <figure data-quote={slot} className="rounded-[var(--radius-inset)] border-l-2 border-[color:var(--border-default)] bg-[var(--surface-s1)] py-2 pr-3 pl-3">
      <blockquote className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
        &ldquo;{text}&rdquo;
      </blockquote>
      <figcaption className="mt-1 tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
        {who}, {TIME.format(at)}
      </figcaption>
      {note && (
        <p className="mt-1.5 text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          Note: {note}
        </p>
      )}
    </figure>
  );
}
