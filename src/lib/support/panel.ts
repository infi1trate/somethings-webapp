// ═══════════════════════════════════════════════════════════════════════════
// WHETHER THE SUPPORT PANEL IS OPEN (SUP-1; the panel itself is SUP-2)
//
// Module state read through `useSyncExternalStore`, the pattern the dev panel
// and the annotation drawer already use (`lib/dev/panel.ts`,
// `lib/anno/mode.ts`). It survives route changes because the module does, and
// the shell that renders the toggle now persists too (`(console)/layout.tsx`).
//
// SESSION-SCOPED: a reload starts closed. The pack asks for the panel to
// survive ROUTE changes; a panel reopening itself on every visit is a
// different decision and is not made here.

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setSupportOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

export function toggleSupport(): void {
  setSupportOpen(!open);
}

export function useSupportOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false
  );
}

/* ═══ WHICH THREAD IS OPEN (SUP-4) ═══
   null is the list. Here rather than in the panel component so SUP-5's
   "Supervisor notified" link can open a thread from outside the panel. */
let thread: string | null = null;
const threadListeners = new Set<() => void>();

export function setSupportThread(id: string | null): void {
  if (thread === id) return;
  thread = id;
  threadListeners.forEach((l) => l());
}

export function useSupportThread(): string | null {
  return useSyncExternalStore(
    (l) => {
      threadListeners.add(l);
      return () => threadListeners.delete(l);
    },
    () => thread,
    () => null
  );
}
