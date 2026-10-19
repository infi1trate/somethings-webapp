// ═══════════════════════════════════════════════════════════════════════════
// WHAT THIS SESSION SENT, AND WHAT IT HAS READ (SUP-4)
//
// Module state through `useSyncExternalStore`, like `panel.ts`: it outlives a
// route change and a close-and-reopen, which is standing rule 4. Session-
// scoped, as the panel's open state is: this is a prototype with no server.
//
// ═══ A SEND IS OPTIMISTIC, AND CAN FAIL ═══ It shows at once as `pending`,
// then resolves after a beat. It FAILS if the browser is offline when it
// resolves — the real way a send fails, and one a probe can cause. A failed
// message stays in the thread with a retry, never a toast that disappears
// with the words in it.

import { useSyncExternalStore } from "react";

export type SendStatus = "pending" | "sent" | "failed";

export interface OutboxMessage {
  id: string;
  threadId: string;
  text: string;
  at: number;
  status: SendStatus;
}

/** How long a send takes to resolve. Long enough to see `Sending…`. */
export const SEND_MS = 900;

let outbox: OutboxMessage[] = [];
let read = new Set<string>();
const drafts = new Map<string, string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let seq = 0;

function resolve(id: string) {
  window.setTimeout(() => {
    const status: SendStatus = navigator.onLine ? "sent" : "failed";
    outbox = outbox.map((m) => (m.id === id ? { ...m, status } : m));
    emit();
  }, SEND_MS);
}

export function sendSupportMessage(threadId: string, text: string): void {
  const id = `out-${threadId}-${++seq}`;
  outbox = [...outbox, { id, threadId, text, at: Date.now(), status: "pending" }];
  drafts.delete(threadId);
  emit();
  resolve(id);
}

export function retrySupportMessage(id: string): void {
  outbox = outbox.map((m) => (m.id === id ? { ...m, status: "pending" } : m));
  emit();
  resolve(id);
}

/** Opening a thread reads it. */
export function markSupportRead(threadId: string): void {
  if (read.has(threadId)) return;
  read = new Set(read).add(threadId);
  emit();
}

/** The composer's unsent text per thread, so Back and a route change keep it.
 *  Not reactive: only the composer reads it, once, when it mounts. */
export const getDraft = (threadId: string) => drafts.get(threadId) ?? "";
export const setDraft = (threadId: string, text: string) => {
  if (text) drafts.set(threadId, text);
  else drafts.delete(threadId);
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useOutbox(): OutboxMessage[] {
  return useSyncExternalStore(subscribe, () => outbox, () => outbox);
}

export function useSupportRead(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => read, () => read);
}
