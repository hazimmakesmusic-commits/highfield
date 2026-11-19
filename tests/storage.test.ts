import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStorage, assertKey, extFor, mimeFor, parseRange } from "@/lib/storage";

describe("local storage", () => {
  const s = new LocalStorage(mkdtempSync(path.join(tmpdir(), "ai-")));
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  it("puts, reads, lists, ranges and deletes", async () => {
    await s.put("outputs/g1/0.mp4", bytes);
    await s.put("meta/g1.json", new Uint8Array([123, 125]));
    expect(await s.readBytes("outputs/g1/0.mp4")).toEqual(bytes);
    expect(await s.list("outputs/")).toEqual(["outputs/g1/0.mp4"]);
    expect(await s.list("nothing/")).toEqual([]);

    const full = await s.get("outputs/g1/0.mp4");
    expect(full.headers.get("content-type")).toBe("video/mp4");
    const part = await s.get("outputs/g1/0.mp4", "bytes=2-4");
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(new Uint8Array([3, 4, 5]));

    await s.delete("outputs/g1/0.mp4");
    expect(await s.readBytes("outputs/g1/0.mp4")).toBeNull();
    expect((await s.get("outputs/g1/0.mp4")).status).toBe(404);
  });

  it("refuses path traversal", async () => {
    for (const k of ["../etc/passwd", "a/../../b", "/abs", "a//b", ""]) expect(() => assertKey(k)).toThrow();
    await expect(s.put("../x", bytes, "image/png")).rejects.toThrow();
  });
});

describe("helpers", () => {
  it("maps types", () => {
    expect(mimeFor("a/b.PNG")).toBe("image/png");
    expect(extFor("audio/mpeg")).toBe("mp3");
    expect(extFor("image/jpeg; charset=x")).toBe("jpg");
    expect(extFor("application/zip")).toBe("bin");
  });
  it("parses ranges", () => {
    expect(parseRange("bytes=0-", 10)).toEqual([0, 9]);
    expect(parseRange("bytes=-3", 10)).toEqual([7, 9]);
    expect(parseRange("bytes=5-100", 10)).toEqual([5, 9]);
    expect(parseRange("bytes=20-", 10)).toBeNull();
    expect(parseRange("nonsense", 10)).toBeNull();
  });
});
