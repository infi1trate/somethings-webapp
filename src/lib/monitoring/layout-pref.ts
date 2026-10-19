// Monitoring's list / cards choice (proto/monitoring-merge), kept per browser in
// localStorage, read through `useSyncExternalStore`. Every storage call is in
// a try / catch: a private window or blocked storage falls back to the list
// and the page still renders.

import { useSyncExternalStore } from "react";

export type MonitoringLayout = "list" | "cards";
const KEY = "somethings.monitoring.layout";
const listeners = new Set<() => void>();
let memo: MonitoringLayout | null = null;

function read(): MonitoringLayout {
  if (memo) return memo;
  try {
    memo = localStorage.getItem(KEY) === "cards" ? "cards" : "list";
  } catch {
    memo = "list";
  }
  return memo;
}

export function setMonitoringLayout(next: MonitoringLayout): void {
  memo = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* Storage blocked: it still holds for this page. */
  }
  listeners.forEach((l) => l());
}

export function useMonitoringLayout(): MonitoringLayout {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "list"
  );
}
