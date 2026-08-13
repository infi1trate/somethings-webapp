"use client";

// Notifications (settings-03) — role-derived switches, persisted PER PERSONA.
// Categories + defaults + the locked Escalations flag come from the config
// registry; this component only renders them and writes overrides. Toggling is
// optimistic (the store write is synchronous, so the switch reflects instantly)
// with a quiet sonner confirmation — self-service, staff-context toasts are
// fine. The one locked category (supervisor Escalations) renders on + disabled
// with an inline reason; it can't be written.

import { Lock } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { roleForPersona } from "@/components/settings/tabs-config";
import {
  notificationCategoriesForRole,
  notificationGroupsForRole,
  type NotificationCategory,
} from "@/components/settings/notifications-config";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GROUP =
  "divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function ToggleSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-brand" : "bg-black/[0.15]",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        RING
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-[var(--surface-card)] shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function CategoryRow({
  category,
  checked,
  onChange,
}: {
  category: NotificationCategory;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 px-[var(--card-pad)] py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] leading-[20px] text-[var(--text-primary)]">
            {category.label}
          </span>
          {category.locked && (
            <Lock
              className="size-3.5 shrink-0 text-[var(--text-muted)]"
              aria-hidden
            />
          )}
        </div>
        <p className="mt-0.5 text-[12px] leading-[16px] text-[var(--text-muted)]">
          {category.description}
        </p>
        {category.locked && category.lockReason && (
          <p className="mt-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
            {category.lockReason}
          </p>
        )}
      </div>
      <div className="pt-0.5">
        <ToggleSwitch
          checked={checked}
          disabled={category.locked}
          label={category.label}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

export function NotificationsSection() {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const prefs = useOnboardingStore((s) => s.notificationPrefs);
  const setNotificationPref = useOnboardingStore((s) => s.setNotificationPref);

  const role = mounted ? roleForPersona(persona) : "mentor";
  const groups = notificationGroupsForRole(role);
  const categories = notificationCategoriesForRole(role);

  const isOn = (c: NotificationCategory) => {
    if (c.locked) return true;
    // Pre-mount: deterministic defaults (no persona-specific read) so there's
    // no hydration flip; post-mount: the persona's stored override wins.
    if (!mounted) return c.defaultOn;
    return prefs[persona]?.[c.id] ?? c.defaultOn;
  };

  const change = (c: NotificationCategory, next: boolean) => {
    setNotificationPref(persona, c.id, next);
    toast(next ? `${c.label} on` : `${c.label} off`);
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group} aria-label={group}>
          <h3 className="mb-2 font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
            {group}
          </h3>
          <div className={GROUP}>
            {categories
              .filter((c) => c.group === group)
              .map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  checked={isOn(c)}
                  onChange={(next) => change(c, next)}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
