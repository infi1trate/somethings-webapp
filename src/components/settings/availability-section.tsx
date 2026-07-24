// Availability (settings-03) — the home for the old /app/profile Schedule tab,
// reframed as "Online hours" (when a mentor is around for teens). The schedule
// editor isn't built, so this is a calm coming-soon placeholder, consistent
// with settings-01's treatment (no fake controls). The staff-facing schedule
// editing on the Mentor Record is a separate surface and is untouched.

export function AvailabilitySection() {
  return (
    <p
      className="text-[var(--text-secondary)]"
      style={{ font: "var(--type-row-value)" }}
    >
      Online hours — the times you&apos;re around for teens — will live here.
      You&apos;ll be able to set them in a coming update.
    </p>
  );
}
