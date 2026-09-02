// THE ONE ERROR SHAPE EVERY STORE METHOD CAN FAIL WITH.
//
// ═══ WHY A CLASS AND A REJECTION, RATHER THAN A `Result` RETURN ═══
//
// The adapter contract in the brief types every method as `Promise<T>` — not
// `Promise<Result<T>>` — so a failure has to travel as a rejection. What the
// brief actually forbids is a THROWN STRING and an UNHANDLED rejection, and both
// are addressed here: every failure that leaves the adapter is an `AnnoError`
// with a machine-readable `code`, a `retryable` flag and a sentence the UI can
// put on screen without inspecting anything.
//
// So: the signature stays exactly as specified, and `catch (e)` always receives
// this type. `normalize()` is what guarantees it — every adapter wraps its body
// so that a TypeError from a bad JSON parse, a DOMException from a revoked
// `localStorage`, and a 500 from the API all arrive as the same object.
//
// FLAGGED AT THE GATE: if "returns a typed error" meant `Result<T, AnnoError>`
// rather than a typed rejection, that is a one-line change to each signature and
// a mechanical change at every call site. Say which you want before anno-02
// builds on it.

export type AnnoErrorCode =
  /** The store could not be reached at all — offline, DNS, the endpoint is down,
   *  or (Path A) the KV binding is missing. Retrying later is meaningful. */
  | "unreachable"
  /** The store answered, and said no such comment. Retrying is pointless. */
  | "not-found"
  /** The caller sent something the model rejects — an over-long body, a missing
   *  anchor. Retrying the same payload is pointless; fixing it is the move. */
  | "invalid"
  /** A write raced another write and lost. Retrying IS the resolution. */
  | "conflict"
  /** The browser refused the storage API: Safari private mode, a revoked
   *  permission, a full quota. Not retryable in the same session. */
  | "storage-denied"
  /** The store answered with a failure of its own. Usually retryable. */
  | "server";

const RETRYABLE: Record<AnnoErrorCode, boolean> = {
  unreachable: true,
  "not-found": false,
  invalid: false,
  conflict: true,
  "storage-denied": false,
  server: true,
};

/** Sentences, not labels. Each one is written to be rendered verbatim — it says
 *  what happened and what the reader can do, and never mentions a status code. */
const DEFAULT_MESSAGE: Record<AnnoErrorCode, string> = {
  unreachable: "Couldn't reach the comment store. Your note is saved here and will retry.",
  "not-found": "That comment no longer exists.",
  invalid: "That comment can't be saved as written.",
  conflict: "Someone else changed that comment first. Try again.",
  "storage-denied": "This browser is blocking local storage, so comments can't be kept.",
  server: "The comment store hit an error. Your note is saved here and will retry.",
};

export class AnnoError extends Error {
  readonly code: AnnoErrorCode;
  readonly retryable: boolean;
  /** The sentence to render. Distinct from `message`, which stays developer-
   *  facing and may carry detail no reader should see. */
  readonly userMessage: string;

  constructor(code: AnnoErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(detail ?? DEFAULT_MESSAGE[code], options);
    this.name = "AnnoError";
    this.code = code;
    this.retryable = RETRYABLE[code];
    this.userMessage = DEFAULT_MESSAGE[code];
  }
}

export function isAnnoError(e: unknown): e is AnnoError {
  return e instanceof AnnoError;
}

/** ═══ THE FUNNEL ═══
 *
 *  Anything an adapter body can throw, converted to the one type. Called from
 *  every method's catch, so nothing that is not an `AnnoError` ever escapes.
 *
 *  `DOMException` is picked out by name rather than by `instanceof` because the
 *  quota and security errors this cares about are reported under several
 *  constructor identities across browsers, and the NAME is the stable part. */
export function normalize(e: unknown, fallback: AnnoErrorCode = "server"): AnnoError {
  if (isAnnoError(e)) return e;

  if (typeof DOMException !== "undefined" && e instanceof DOMException) {
    return new AnnoError("storage-denied", e.message, { cause: e });
  }
  if (e instanceof Error) {
    if (e.name === "QuotaExceededError" || e.name === "SecurityError") {
      return new AnnoError("storage-denied", e.message, { cause: e });
    }
    // `fetch` reports every network-layer failure as a bare TypeError.
    if (e instanceof TypeError) {
      return new AnnoError("unreachable", e.message, { cause: e });
    }
    return new AnnoError(fallback, e.message, { cause: e });
  }
  // A thrown string, a thrown object, a thrown undefined. The thing this file
  // exists to make impossible downstream.
  return new AnnoError(fallback, typeof e === "string" ? e : undefined, { cause: e });
}

/** HTTP status → code. One place, so the two adapters cannot disagree about what
 *  a 409 means. */
export function codeForStatus(status: number): AnnoErrorCode {
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "invalid";
  if (status >= 500) return "server";
  return "server";
}
