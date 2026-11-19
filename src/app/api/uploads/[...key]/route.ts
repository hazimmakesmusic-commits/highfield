import { NextResponse } from "next/server";
import { assertKey, getStorage, mimeFor } from "@/lib/storage";

/** Local-storage upload target (R2 uploads go straight to the bucket via a presigned URL). */
export async function PUT(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  try { assertKey(key); } catch { return NextResponse.json({ error: "Bad key" }, { status: 400 }); }
  if (!key.startsWith("uploads/")) return NextResponse.json({ error: "Bad key" }, { status: 400 });
  const s = getStorage();
  if (s.presignPut) return NextResponse.json({ error: "Upload directly to storage" }, { status: 400 });
  await s.put(key, new Uint8Array(await req.arrayBuffer()), mimeFor(key));
  return NextResponse.json({ key });
}
