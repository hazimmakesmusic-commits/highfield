import { describe, expect, it } from "vitest";
import { HF_GENERIC_ERROR, parseGradioStream } from "@/lib/providers";

describe("parseGradioStream", () => {
  it("reads a completed job", () => {
    const body = 'event: heartbeat\ndata: null\n\nevent: complete\ndata: [{"video":{"path":"/tmp/a.mp4","url":"https://s.hf.space/file=/tmp/a.mp4"},"subtitles":null},42]\n\n';
    const r = parseGradioStream(body);
    expect(r).toEqual({ done: true, data: [{ video: { path: "/tmp/a.mp4", url: "https://s.hf.space/file=/tmp/a.mp4" }, subtitles: null }, 42] });
  });
  it("turns a null error (e.g. quota) into a plain explanation", () => {
    expect(parseGradioStream("event: error\ndata: null\n\n")).toEqual({ done: true, error: HF_GENERIC_ERROR });
    expect(parseGradioStream('event: error\ndata: "Video too long"\n\n')).toEqual({ done: true, error: "Video too long" });
  });
  it("treats an unfinished stream as still running", () => {
    expect(parseGradioStream("event: heartbeat\ndata: null\n\n")).toEqual({ done: false });
    expect(parseGradioStream("")).toEqual({ done: false });
  });
});
