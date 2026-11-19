import { AwsClient } from "aws4fetch";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Persistent media storage. Two drivers:
 *  - "s3": any S3-compatible bucket (Cloudflare R2 in production).
 *  - "local": a folder on disk (./data by default), for running on your own machine.
 */
export interface MediaStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Streams an object as an HTTP response, honouring a Range header (video seeking). */
  get(key: string, range?: string | null): Promise<Response>;
  readBytes(key: string): Promise<Uint8Array | null>;
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
  /** Internet-reachable, time-limited URL. Undefined for local storage. */
  presignGet?(key: string, seconds?: number, downloadName?: string): Promise<string>;
  /** URL the browser can PUT a file to directly. Undefined for local storage. */
  presignPut?(key: string, contentType: string, seconds?: number): Promise<string>;
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg", aac: "audio/aac", flac: "audio/flac",
  json: "application/json",
};

export function mimeFor(key: string): string {
  return MIME[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

export function extFor(contentType: string): string {
  const hit = Object.entries(MIME).find(([, m]) => m === contentType.split(";")[0].trim());
  return hit ? hit[0] : "bin";
}

/** Keys are generated server-side, but they also arrive in URLs: reject anything path-like. */
export function assertKey(key: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

export function parseRange(range: string, size: number): [number, number] | null {
  const m = range.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number, end: number;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  return start <= end && start < size ? [start, end] : null;
}

export class LocalStorage implements MediaStorage {
  constructor(private root: string) {}

  private file(key: string) {
    assertKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, body: Uint8Array, _contentType?: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, body);
  }

  async readBytes(key: string) {
    try { return new Uint8Array(await fs.readFile(this.file(key))); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
  }

  async get(key: string, range?: string | null) {
    const buf = await this.readBytes(key);
    if (!buf) return new Response("Not found", { status: 404 });
    const headers: Record<string, string> = { "Content-Type": mimeFor(key), "Accept-Ranges": "bytes" };
    const r = range ? parseRange(range, buf.length) : null;
    if (r) {
      const [s, e] = r;
      return new Response(buf.slice(s, e + 1), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${s}-${e}/${buf.length}`, "Content-Length": String(e - s + 1) },
      });
    }
    return new Response(buf, { headers: { ...headers, "Content-Length": String(buf.length) } });
  }

  async list(prefix: string) {
    const dir = this.file(prefix.replace(/\/$/, ""));
    try {
      const names = await fs.readdir(dir, { recursive: true, withFileTypes: true });
      return names
        .filter((d) => d.isFile())
        .map((d) => path.relative(this.root, path.join(d.parentPath, d.name)).split(path.sep).join("/"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  async delete(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
}

export class S3Storage implements MediaStorage {
  private aws: AwsClient;
  constructor(private endpoint: string, private bucket: string, accessKeyId: string, secretAccessKey: string, region = "auto") {
    this.aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region });
  }

  private url(key = "") {
    if (key) assertKey(key);
    return `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${key}`;
  }

  private async check(res: Response, what: string) {
    if (!res.ok) throw new Error(`Storage ${what} failed: ${res.status} ${await res.text()}`);
    return res;
  }

  async put(key: string, body: Uint8Array, contentType: string) {
    await this.check(await this.aws.fetch(this.url(key), { method: "PUT", body: body as BodyInit, headers: { "Content-Type": contentType } }), "put");
  }

  async readBytes(key: string) {
    const res = await this.aws.fetch(this.url(key));
    if (res.status === 404) return null;
    await this.check(res, "read");
    return new Uint8Array(await res.arrayBuffer());
  }

  async get(key: string, range?: string | null) {
    const res = await this.aws.fetch(this.url(key), { headers: range ? { Range: range } : {} });
    if (res.status === 404) return new Response("Not found", { status: 404 });
    await this.check(res, "get");
    const headers = new Headers();
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(res.body, { status: res.status, headers });
  }

  async list(prefix: string) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const q = new URLSearchParams({ "list-type": "2", prefix });
      if (token) q.set("continuation-token", token);
      const xml = await (await this.check(await this.aws.fetch(`${this.url()}?${q}`), "list")).text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, "&"));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]+)</)?.[1] : undefined;
    } while (token);
    return keys;
  }

  async delete(key: string) {
    const res = await this.aws.fetch(this.url(key), { method: "DELETE" });
    if (res.status !== 404) await this.check(res, "delete");
  }

  private async presign(key: string, method: string, seconds: number, headers: Record<string, string> = {}, query: Record<string, string> = {}) {
    const u = new URL(this.url(key));
    u.searchParams.set("X-Amz-Expires", String(seconds));
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    const signed = await this.aws.sign(u.toString(), { method, headers, aws: { signQuery: true } });
    return signed.url;
  }

  presignGet(key: string, seconds = 3600, downloadName?: string) {
    return this.presign(key, "GET", seconds, {}, downloadName ? { "response-content-disposition": `attachment; filename="${downloadName}"` } : {});
  }
  presignPut(key: string, contentType: string, seconds = 900) { return this.presign(key, "PUT", seconds, { "Content-Type": contentType }); }
}

let cached: MediaStorage | undefined;

export function getStorage(): MediaStorage {
  if (cached) return cached;
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env;
  if (S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    cached = new S3Storage(S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION || "auto");
  } else {
    if (process.env.VERCEL) throw new Error("S3_* storage variables must be set on Vercel (the disk there is not persistent)");
    cached = new LocalStorage(path.resolve(process.env.DATA_DIR || "data"));
  }
  return cached;
}
