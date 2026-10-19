// Whether the browser says it is online (SUP-3's offline banner). The
// `online`/`offline` events and `navigator.onLine`, read through
// `useSyncExternalStore`; the server render assumes online.

import { useSyncExternalStore } from "react";

export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener("online", l);
      window.addEventListener("offline", l);
      return () => {
        window.removeEventListener("online", l);
        window.removeEventListener("offline", l);
      };
    },
    () => navigator.onLine,
    () => true
  );
}
