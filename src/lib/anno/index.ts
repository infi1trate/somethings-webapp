// THE ANNOTATION LAYER'S PUBLIC SURFACE.
//
// One import site for everything anno-02 and later build on, and one place that
// decides which store implementation is live.

export * from "@/lib/anno/types";
export * from "@/lib/anno/errors";
export * from "@/lib/anno/identity";
export * from "@/lib/anno/store";
export { SharedAnnotationStore } from "@/lib/anno/store-shared";
export { LocalAnnotationStore } from "@/lib/anno/store-local";

import { configuredStoreKind, type FullAnnotationStore } from "@/lib/anno/store";
import { SharedAnnotationStore } from "@/lib/anno/store-shared";
import { LocalAnnotationStore } from "@/lib/anno/store-local";

let instance: FullAnnotationStore | null = null;

/** ═══ ONE STORE PER PAGE, AND WHY IT IS A SINGLETON ═══
 *
 *  The shared store holds the optimistic cache and the subscriber set. Two
 *  instances would each hold half the truth: a comment created through one is
 *  invisible to anything subscribed to the other, and a failed draft would be
 *  recoverable only through the instance that happened to make it. */
export function annotationStore(): FullAnnotationStore {
  if (instance) return instance;
  instance =
    configuredStoreKind() === "local"
      ? new LocalAnnotationStore()
      : new SharedAnnotationStore();
  return instance;
}

/** TEST SEAM. */
export function __resetStoreForTests(): void {
  instance = null;
}
