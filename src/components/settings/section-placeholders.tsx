// Shared Settings placeholders (settings-01). Two honest treatments, no fake
// controls:
//   ComingSoon — roadmap slot (language/accessibility/audio-video): label,
//     one-line description, a quiet "Coming soon" chip. Visible and inert by
//     design (roadmap transparency). Coming-soon row + section anatomy:
//     design-system-gaps.md #100.
//   BeingSetUp — a "live" section whose content arrives in a later S-prompt
//     (account/security/notifications/availability in S1): a calm note, no
//     chip (it's imminent, not roadmap). Somethings voice — never "you have
//     no …".

export function ComingSoonChip() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[11px] font-medium leading-none text-[var(--text-secondary)]">
      Coming soon
    </span>
  );
}

export function ComingSoonSection() {
  return (
    <div className="flex items-center gap-3">
      <ComingSoonChip />
      <p
        className="min-w-0 flex-1 text-[var(--text-muted)]"
        style={{ font: "var(--type-helper)" }}
      >
        We&apos;ll turn this on in a future update.
      </p>
    </div>
  );
}

export function BeingSetUp({ label }: { label: string }) {
  return (
    <p
      className="text-[var(--text-secondary)]"
      style={{ font: "var(--type-row-value)" }}
    >
      {label} is being set up — the controls land in a coming update.
    </p>
  );
}
