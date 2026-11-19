import { NextResponse } from "next/server";
import { extFor, getStorage } from "@/lib/storage";

const ALLOWED = /^(image|video|audio)\//;

/** Step 1 of an upload: returns where the browser should PUT the file (R2 directly, or our own route locally). */
export async function POST(req: Request) {
  const { contentType } = await req.json().catch(() => ({}));
  if (typeof contentType !== "string" || !ALLOWED.test(contentType)) {
    return NextResponse.json({ error: "Only image, video or audio files" }, { status: 400 });
  }
  const ext = extFor(contentType);
  if (ext === "bin") return NextResponse.json({ error: `Unsupported file type: ${contentType}` }, { status: 400 });
  const key = `uploads/${crypto.randomUUID()}.${ext}`;
  const s = getStorage();
  const uploadUrl = s.presignPut ? await s.presignPut(key, contentType) : `/api/uploads/${key}`;
  return NextResponse.json({ key, uploadUrl });
}
