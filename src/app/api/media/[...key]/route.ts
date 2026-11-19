import { assertKey, getStorage } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  try { assertKey(key); } catch { return new Response("Bad key", { status: 400 }); }
  if (key.startsWith("meta/")) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download") ? key.split("/").slice(-2).join("-") : undefined;
  const s = getStorage();

  // R2: send the browser straight to the bucket (big videos shouldn't stream through a serverless function).
  if (s.presignGet) return Response.redirect(await s.presignGet(key, 3600, download), 302);

  const res = await s.get(key, req.headers.get("range"));
  res.headers.set("Cache-Control", "private, max-age=31536000, immutable");
  if (download) res.headers.set("Content-Disposition", `attachment; filename="${download}"`);
  return res;
}
