// THE UPSTASH DRIVER, RUN FOR REAL — against a local stub of the REST contract.
//
// ═══ WHY THIS TEST EXISTS ═══
//
// `docs/anno/GAPS.md` [anno-01] has said the same thing since the data layer
// landed: the Upstash driver is "written and typechecked but has never been run
// against a live instance, because there is no instance". Typechecking proves the
// shapes line up. It proves nothing about whether the driver speaks the protocol —
// whether `keys`/`mget` are sent as path segments, whether `set` goes as a POST
// body, whether a `{result}` envelope is unwrapped, whether `incr` is atomic
// enough to number comments.
//
// So the protocol is stubbed rather than the driver mocked. An in-process HTTP
// server implements the subset of Upstash's REST API the driver uses, backed by a
// plain Map, and the REAL `UpstashDriver` and the REAL `repo.ts` run against it.
// If the request shapes are wrong, these tests fail — which is exactly what would
// otherwise be discovered by a reviewer losing a comment.
//
// WHAT THIS DOES NOT PROVE: that Upstash's production service behaves identically
// to this stub. It cannot. What it does prove is that the driver is not wrong in
// any of the ways a never-executed code path usually is, so the remaining risk on
// switching is Upstash's own behaviour rather than ours.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { __resetKvForTests, driverKind, kv } from "@/lib/anno/server/kv";
import {
  createComment,
  listComments,
  listReviewers,
  restoreComment,
  softDeleteComment,
  updateComment,
  upsertReviewer,
} from "@/lib/anno/server/repo";

/* ══════════════════ THE STUB ══════════════════
 *
 *  Upstash's REST API takes the command as path segments and answers
 *  `{"result": …}`. Only the five commands the driver actually issues are
 *  implemented — anything else 400s loudly, so a driver that starts sending a
 *  sixth command fails here rather than in production. */
const store = new Map<string, string>();
let server: Server;
let base = "";
/** Every request the driver made, so the SHAPE can be asserted, not just the
 *  outcome. */
let seen: { method: string; path: string; auth: string | undefined }[] = [];

function start(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      seen.push({
        method: req.method ?? "",
        path: url.pathname,
        auth: req.headers.authorization,
      });

      const send = (result: unknown, code = 200) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ result }));
      };
      const [cmd, ...args] = parts;

      if (cmd === "get") return send(store.get(args[0]) ?? null);

      if (cmd === "set") {
        /* Upstash takes the value as the request BODY for a POST — the driver
           does this deliberately so a large document is not squeezed into a URL. */
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          store.set(args[0], body);
          send("OK");
        });
        return;
      }

      if (cmd === "incr") {
        const next = Number(store.get(args[0]) ?? "0") + 1;
        store.set(args[0], String(next));
        return send(next);
      }

      if (cmd === "keys") {
        const pattern = args[0] ?? "*";
        const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
        return send([...store.keys()].filter((k) => k.startsWith(prefix)));
      }

      if (cmd === "mget") return send(args.map((k) => store.get(k) ?? null));

      if (cmd === "del") {
        store.delete(args[0]);
        return send(1);
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `stub does not implement "${cmd}"` }));
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      base = typeof addr === "object" && addr ? `http://127.0.0.1:${addr.port}` : "";
      resolve();
    });
  });
}

const ANCHOR = {
  elementRef: "app-main/care-summary-panel",
  structuralPath: null,
  offsetX: 0.5,
  offsetY: 0.5,
  fallbackX: 10,
  fallbackY: 20,
  scrollContainer: null,
};
const CONTEXT = {
  route: "/admin/person/t13",
  role: "supervisor" as const,
  scenario: "steady",
  loadState: "ready",
  viewportWidth: 1280,
};
const draft = (body: string) => ({ authorClientId: "c-1", body, anchor: ANCHOR, context: CONTEXT });

beforeAll(async () => {
  await start();
  process.env.UPSTASH_REDIS_REST_URL = base;
  process.env.UPSTASH_REDIS_REST_TOKEN = "stub-token";
  __resetKvForTests();
});

afterAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  __resetKvForTests();
  server?.close();
});

beforeEach(() => {
  store.clear();
  seen = [];
});

describe("driver selection", () => {
  it("picks Upstash the moment the two env vars exist — no code change", () => {
    expect(driverKind()).toBe("upstash");
  });

  it("carries the token as a bearer header on every request", async () => {
    await kv().set("k", { a: 1 });
    await kv().get("k");
    expect(seen.length).toBeGreaterThan(0);
    for (const r of seen) expect(r.auth).toBe("Bearer stub-token");
  });
});

describe("the five commands the driver issues", () => {
  it("round-trips a document through set and get", async () => {
    await kv().set("doc", { hello: "world", n: 3 });
    expect(await kv().get("doc")).toEqual({ hello: "world", n: 3 });
  });

  it("sends set as a POST with the value in the body, not the URL", async () => {
    await kv().set("doc", { big: "x".repeat(500) });
    const setReq = seen.find((r) => r.path.startsWith("/set/"));
    expect(setReq?.method).toBe("POST");
    // The 500-char payload must not be in the path.
    expect(setReq?.path.length).toBeLessThan(60);
  });

  it("returns null for a key that was never written", async () => {
    expect(await kv().get("absent")).toBeNull();
  });

  it("increments atomically from nothing", async () => {
    expect(await kv().incr("counter")).toBe(1);
    expect(await kv().incr("counter")).toBe(2);
    expect(await kv().incr("counter")).toBe(3);
  });

  it("scans by prefix and unwraps every document", async () => {
    await kv().set("p:a", { id: "a" });
    await kv().set("p:b", { id: "b" });
    await kv().set("other", { id: "c" });
    const found = await kv().scan<{ id: string }>("p:");
    expect(found.map((f) => f.id).sort()).toEqual(["a", "b"]);
  });

  it("scans to an empty array rather than issuing mget with no keys", async () => {
    expect(await kv().scan("nothing:")).toEqual([]);
    expect(seen.some((r) => r.path.startsWith("/mget"))).toBe(false);
  });

  it("deletes", async () => {
    await kv().set("gone", { x: 1 });
    await kv().del("gone");
    expect(await kv().get("gone")).toBeNull();
  });

  it("issues no command the stub does not implement", async () => {
    await kv().set("x", { a: 1 });
    await kv().get("x");
    await kv().incr("c");
    await kv().scan("x");
    await kv().del("x");
    const cmds = new Set(seen.map((r) => r.path.split("/")[1]));
    expect([...cmds].sort()).toEqual(["del", "get", "incr", "keys", "mget", "set"]);
  });
});

describe("the repo on top of it", () => {
  it("numbers comments from the atomic counter, in order, with no gaps", async () => {
    const a = await createComment(draft("first"), null);
    const b = await createComment(draft("second"), null);
    const c = await createComment(draft("third"), null);
    expect([a.number, b.number, c.number]).toEqual([1, 2, 3]);
  });

  it("never reuses a number across a soft delete", async () => {
    const a = await createComment(draft("a"), null);
    await softDeleteComment(a.id);
    const b = await createComment(draft("b"), null);
    expect(b.number).toBe(a.number + 1);
  });

  it("keeps concurrent creates distinct — the guarantee 'comment 7' rests on", async () => {
    const made = await Promise.all(
      Array.from({ length: 12 }, (_, i) => createComment(draft(`c${i}`), null))
    );
    const numbers = made.map((m) => m.number).sort((x, y) => x - y);
    expect(new Set(numbers).size).toBe(12);
    expect(numbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("lists in number order regardless of the order keys come back", async () => {
    for (const b of ["a", "b", "c", "d"]) await createComment(draft(b), null);
    const listed = await listComments();
    expect(listed.map((c) => c.number)).toEqual([1, 2, 3, 4]);
  });

  it("includes soft-deleted comments so restore can find them", async () => {
    const a = await createComment(draft("a"), null);
    await softDeleteComment(a.id);
    const listed = await listComments();
    expect(listed).toHaveLength(1);
    expect(listed[0].deletedAt).not.toBeNull();
  });

  it("soft-deletes and restores without touching the number", async () => {
    const a = await createComment(draft("a"), null);
    const deleted = await softDeleteComment(a.id);
    expect(deleted.deletedAt).not.toBeNull();
    const restored = await restoreComment(a.id);
    expect(restored.deletedAt).toBeNull();
    expect(restored.number).toBe(a.number);
  });

  it("patches only the fields a reviewer can change", async () => {
    const a = await createComment(draft("original"), null);
    const patched = await updateComment(a.id, {
      body: "edited",
      status: "resolved",
      // These must be ignored — a client cannot renumber or reassign authorship.
      number: 999,
      authorClientId: "someone-else",
      createdAt: "1999-01-01T00:00:00.000Z",
    });
    expect(patched.body).toBe("edited");
    expect(patched.status).toBe("resolved");
    expect(patched.number).toBe(a.number);
    expect(patched.authorClientId).toBe("c-1");
    expect(patched.createdAt).toBe(a.createdAt);
  });

  it("rejects a body over the limit rather than truncating it", async () => {
    await expect(createComment(draft("x".repeat(1001)), null)).rejects.toThrow(/1000/);
  });

  it("upserts a reviewer in place, so a rename touches no comment", async () => {
    const a = await createComment(draft("a"), null);
    await upsertReviewer({ clientId: "c-1", displayName: "Amber Otter", colorChip: "#7b5bd6" });
    await upsertReviewer({ clientId: "c-1", displayName: "Quiet Finch", colorChip: "#7b5bd6" });
    const reviewers = await listReviewers();
    expect(reviewers).toHaveLength(1);
    expect(reviewers[0].displayName).toBe("Quiet Finch");
    // R9: the comment carries no name, so it cannot disagree with the record.
    const listed = await listComments();
    expect(listed[0].authorClientId).toBe("c-1");
    expect("authorDisplayName" in listed[0]).toBe(false);
    expect(listed[0].updatedAt).toBe(a.updatedAt);
  });

  it("stores an ip hint truncated, and only from the header", async () => {
    const c = await createComment(draft("a"), "203.0.113.0/24");
    expect(c.authorIpHint).toBe("203.0.113.0/24");
    const d = await createComment(draft("b"), null);
    expect(d.authorIpHint).toBeNull();
  });
});
