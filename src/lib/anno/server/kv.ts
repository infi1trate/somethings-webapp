// THE SERVER'S STORAGE PORT — two drivers, one interface.
//
// ═══ WHY THERE IS A PORT AT ALL, AND NOT JUST `@vercel/kv` ═══
//
// anno-00 established that Path A is buildable — the deployment runs middleware
// and a route handler, so a server runtime exists — but ALSO that no KV is
// provisioned: no `.vercel/` linkage, no CLI, and no KV/Redis/Postgres env var
// anywhere in the project. Writing straight against a client for a store that
// does not exist yet would mean nothing runs until someone provisions it.
//
// So the port has two drivers and picks by environment:
//
//   • UPSTASH — plain `fetch` against the Upstash REST API. NO NEW DEPENDENCY:
//     the REST surface is HTTP, so `@vercel/kv` would only be a wrapper over the
//     same calls, and adding a package for a binding nobody has tested yet is
//     how a prototype acquires dead weight. Live the moment
//     `UPSTASH_REDIS_REST_URL` / `_TOKEN` (or Vercel KV's `KV_REST_API_*`
//     aliases, which are the same service) are set.
//
//   • FILE — a JSON file under `.anno-data/`. Genuinely shared: two browsers, or
//     a laptop and a phone, hitting the same dev server see each other's
//     comments. That is real shared review for a demo on one machine, and it is
//     what makes this phase testable today.
//
// ═══ WHAT THE FILE DRIVER IS NOT ═══
//
// It is NOT production. Vercel's filesystem is read-only outside `/tmp` and
// serverless instances do not share one, so on the deployment it would fail
// writes or silently fragment per instance. `driverKind()` reports which driver
// is live so `/api/anno` can say so honestly, and the gap is logged in GAPS.md.
// Switching is an env var, not a code change — that is the whole point of the
// port.

import { promises as fs } from "node:fs";
import path from "node:path";

export type DriverKind = "upstash" | "file";

/** The narrow slice of Redis this feature needs. Deliberately small: anything
 *  added here has to be implemented twice and mocked once more. */
export interface KvPort {
  readonly kind: DriverKind;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  /** ATOMIC. This is the whole reason numbering is a store concern rather than a
   *  caller concern — see `repo.ts`. */
  incr(key: string): Promise<number>;
  /** Values for every key under a prefix. */
  scan<T>(prefix: string): Promise<T[]>;
  del(key: string): Promise<void>;
}

/* ═══════════════════════════ UPSTASH (REST) ═══════════════════════════ */

function upstashConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
  return url && token ? { url, token } : null;
}

class UpstashDriver implements KvPort {
  readonly kind = "upstash" as const;
  constructor(private cfg: { url: string; token: string }) {}

  /** One shape for every command. Upstash's REST API takes the command as path
   *  segments and answers `{ result }`, so this is the entire protocol. */
  private async cmd<T>(...parts: (string | number)[]): Promise<T> {
    const res = await fetch(
      `${this.cfg.url}/${parts.map((p) => encodeURIComponent(String(p))).join("/")}`,
      {
        headers: { Authorization: `Bearer ${this.cfg.token}` },
        // Never let Next's data cache serve a stale comment list.
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`upstash ${res.status} ${await res.text().catch(() => "")}`);
    }
    const json = (await res.json()) as { result: T };
    return json.result;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.cmd<string | null>("get", key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // POST, so a large body is not squeezed through the URL.
    const res = await fetch(`${this.cfg.url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstash set ${res.status}`);
  }

  incr(key: string): Promise<number> {
    return this.cmd<number>("incr", key);
  }

  async scan<T>(prefix: string): Promise<T[]> {
    const keys = await this.cmd<string[]>("keys", `${prefix}*`);
    if (keys.length === 0) return [];
    const raw = await this.cmd<(string | null)[]>("mget", ...keys);
    return raw.filter((r): r is string => r !== null).map((r) => JSON.parse(r) as T);
  }

  async del(key: string): Promise<void> {
    await this.cmd("del", key);
  }
}

/* ═══════════════════════════ FILE (dev) ═══════════════════════════════ */

type FileShape = Record<string, unknown>;

class FileDriver implements KvPort {
  readonly kind = "file" as const;
  private file = path.join(process.cwd(), ".anno-data", "store.json");

  /** ═══ THE WRITE QUEUE IS WHAT MAKES NUMBERING SAFE ═══
   *
   *  Node runs one instance single-threaded, but `await` interleaves: two
   *  concurrent `incr` calls can both read 6 before either writes 7, and both
   *  comments come out numbered 7. Chaining every operation onto one promise
   *  serialises read-modify-write, which is the atomicity Redis `INCR` gives for
   *  free and this driver has to construct.
   *
   *  This is per-process. Two dev servers on one file would still race — which is
   *  another way of saying this driver is for one server, and is part of why it
   *  is not the production answer. */
  private chain: Promise<unknown> = Promise.resolve();

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    // Swallow only for the CHAIN's copy — the caller still sees the rejection.
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async read(): Promise<FileShape> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as FileShape;
    } catch {
      // No file yet is the empty store, not an error.
      return {};
    }
  }

  private async write(data: FileShape): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    /* Write-then-rename. A crash midway through a direct write leaves truncated
       JSON, which reads back as an empty store — i.e. silent total data loss.
       `rename` is atomic within a filesystem, so a reader sees either the old
       file or the new one. */
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, this.file);
  }

  get<T>(key: string): Promise<T | null> {
    return this.run(async () => ((await this.read())[key] as T) ?? null);
  }

  set<T>(key: string, value: T): Promise<void> {
    return this.run(async () => {
      const data = await this.read();
      data[key] = value;
      await this.write(data);
    });
  }

  incr(key: string): Promise<number> {
    return this.run(async () => {
      const data = await this.read();
      const next = (typeof data[key] === "number" ? (data[key] as number) : 0) + 1;
      data[key] = next;
      await this.write(data);
      return next;
    });
  }

  scan<T>(prefix: string): Promise<T[]> {
    return this.run(async () => {
      const data = await this.read();
      return Object.entries(data)
        .filter(([k]) => k.startsWith(prefix))
        .map(([, v]) => v as T);
    });
  }

  del(key: string): Promise<void> {
    return this.run(async () => {
      const data = await this.read();
      delete data[key];
      await this.write(data);
    });
  }
}

/* ═══════════════════════════ SELECTION ════════════════════════════════ */

let cached: KvPort | null = null;

export function kv(): KvPort {
  if (cached) return cached;
  const cfg = upstashConfig();
  cached = cfg ? new UpstashDriver(cfg) : new FileDriver();
  return cached;
}

export function driverKind(): DriverKind {
  return kv().kind;
}

/** TEST SEAM — drops the cached driver so a suite can flip env vars. */
export function __resetKvForTests(): void {
  cached = null;
}
