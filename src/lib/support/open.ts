// Open a support contact's thread in the panel, read (SUP-5). Shared by the
// chat page and the bell's escalation notices (pack v5.0, C3), so "Open
// Support" is one action wherever it is offered.

import { markSupportRead } from "@/lib/support/outbox";
import { setSupportOpen, setSupportThread } from "@/lib/support/panel";

export function openInSupport(id: string): void {
  markSupportRead(id);
  setSupportThread(id);
  setSupportOpen(true);
}
