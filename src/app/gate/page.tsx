// THE GATE PAGE.
//
// A SERVER COMPONENT WITH NO CLIENT JAVASCRIPT. `searchParams` is awaited here
// rather than read through the `use(searchParams)` client pattern the rest of
// this codebase needs, because nothing on this page is interactive beyond a
// native form — so there is no hydration surface, and no bundle for the password
// to leak into.
//
// The form POSTs to `/api/gate`, which is the only place the password is
// compared. Submitting works before hydration, with JavaScript disabled, and in
// a password manager.

import { Wordmark } from "@/components/brand";

export const metadata = { title: "Somethings — internal prototype" }; // TODO-COPY

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export default async function Gate({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = await searchParams;
  const failed = q.error === "1";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Wordmark className="h-6" />
          <h1 className="mt-6 text-[20px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--text-primary)]">
            {/* TODO-COPY */}
            Internal prototype
          </h1>
          <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-secondary)]">
            {/* TODO-COPY — says who it is for, so someone who has arrived by
                accident knows they are not meant to be here and why. */}
            This is a demo build of the Somethings platform, for the team only.
            Enter the shared password to continue.
          </p>
        </div>

        <form
          action="/api/gate"
          method="post"
          className="mt-7 rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] p-4"
        >
          <label
            htmlFor="gate-password"
            className="block text-[var(--text-muted)] [font:var(--type-field-label)] [letter-spacing:var(--type-field-label-tracking)]"
          >
            {/* TODO-COPY */}
            Password
          </label>
          <input
            id="gate-password"
            name="password"
            type="password"
            autoComplete="current-password"
            // The only control on the page. Focusing it costs a reader nothing
            // and saves everyone else a click.
            autoFocus
            required
            aria-invalid={failed || undefined}
            aria-describedby={failed ? "gate-error" : undefined}
            // `--radius-control`, NOT `--radius-field`: the latter does not exist,
            // and an undefined custom property inside an arbitrary radius value
            // silently renders no radius at all — settings-tokens.css:54 records
            // the same mistake being made before. Checked rather than assumed.
            //
            // AND THE ARBITRARY-VALUE SYNTAX IS NOT WRITTEN OUT ABOVE ON PURPOSE.
            // Tailwind scans source files for class-like strings and does not skip
            // comments: an earlier version of this note spelled the utility out
            // with an ellipsis inside the brackets, Tailwind generated a rule with
            // that ellipsis as the value, and the invalid declaration took the
            // whole stylesheet down with a 500. Describe such a class in words.
            className={`mt-1.5 block h-11 w-full rounded-[var(--radius-control)] border bg-[var(--surface-card)] px-3 text-[15px] text-[var(--text-primary)] ${
              failed
                ? "border-[color:var(--state-error)]"
                : "border-[color:var(--border-subtle)]"
            } ${RING}`}
          />

          {/* THE ERROR SAYS ONE THING AND NAMES NO CAUSE. "Incorrect password"
              is all that is knowable — offering "did you mean" or hinting at the
              shape of the password would help the wrong person more than the
              right one. Non-blaming, with the next step implied by the field
              still being there. */}
          {failed && (
            <p
              id="gate-error"
              // Announced because it appears on a fresh page load after a
              // redirect, which a screen reader would otherwise pass silently.
              role="alert"
              className="mt-2 text-[13px] leading-[18px] text-[var(--state-error)]"
            >
              {/* TODO-COPY */}
              That password did not match. Try again.
            </p>
          )}

          <button
            type="submit"
            className={`mt-4 h-11 w-full rounded-full bg-[var(--text-primary)] text-[15px] font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 ${RING}`}
          >
            {/* TODO-COPY */}
            Continue
          </button>
        </form>

        <p className="mt-5 text-center text-[12.5px] leading-[18px] text-[var(--text-muted)]">
          {/* TODO-COPY — the reassurance that matters most on a locked door for a
              clinical-looking product: there is nothing real behind it. */}
          No real people and no PHI are behind this gate. Everything in the
          prototype is fixture data.
        </p>
      </div>
    </main>
  );
}
