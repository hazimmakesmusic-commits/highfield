# Afterimage

HAZIM's private AI studio for music videos, album art, cinematic scenes, visualizers and promo clips.
One owner, one password, no sign-up. Generation runs on [Replicate](https://replicate.com); every result is copied into your own storage (Cloudflare R2) so it never expires.

## What's in it

| Tool | Models | Extras |
| --- | --- | --- |
| **Image** | FLUX 1.1 Pro Ultra, FLUX Schnell, Ideogram v3 Turbo, Imagen 4, FLUX Kontext Pro (edit) | 12 style presets (cinematic, album cover, neon noir, VHS…) |
| **Video** | Kling 2.1, Hailuo 02, Seedance 1 Pro, Wan 2.2 Fast, Veo 3 Fast | 16 camera moves (dolly, crash zoom, 360 orbit, FPV…), 12 effects (disintegrate, explosion, music visualizer…) |
| **Lip Sync** | OmniHuman (photo + vocals → singing avatar), Lipsync 2 (re-sync a video) | |
| **Upscale** | Topaz Image, Real-ESRGAN, Topaz Video (to 4K/60fps) | |
| **Library** | Every generation, filterable, with download and one-click *Animate / Edit / Lip sync / Upscale* hand-offs | |

Presets add real direction to the prompt the model receives; nothing is mocked.
Models, their inputs and the presets all live in `src/lib/models.ts` and `src/lib/presets.ts`; add a model by adding one entry.

## Set up (Vercel + Cloudflare R2)

1. **Replicate**: create a token at replicate.com/account/api-tokens and add billing.
2. **R2**: in Cloudflare, create a bucket (e.g. `afterimage`), then *R2 → Manage API tokens → Create* with *Object Read & Write* on that bucket. Note the Access Key ID, Secret, and the S3 endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **R2 CORS** (lets your browser upload straight to the bucket): bucket → *Settings → CORS policy*:
   ```json
   [{ "AllowedOrigins": ["https://YOUR-APP.vercel.app"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
4. **Vercel**: import this repo, add every variable from `.env.example` under *Settings → Environment Variables*, deploy.

Keys stay server-side: the browser never sees the Replicate token or R2 secret. Media is served through short-lived signed links, only after you sign in.

## Run locally

```bash
cp .env.example .env.local   # fill in OWNER_PASSWORD, SESSION_SECRET, REPLICATE_API_TOKEN; leave S3_* empty for ./data
npm install
npm run dev
```

## Checks

```bash
npm test          # unit tests (auth, storage, model inputs, presets, library records)
npm run typecheck
npm run lint
npm run build
```
