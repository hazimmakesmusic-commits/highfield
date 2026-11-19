# Afterimage

HAZIM's private AI studio for music videos, album art, cinematic scenes, visualizers and promo clips.
One owner, one password, no sign-up. **It runs completely free** on free accounts. Paid models are an optional extra.

## What's free and what isn't

| Tool | Free models | What "free" really means | Paid extras (optional Replicate key) |
| --- | --- | --- | --- |
| **Image** | Sana (no account at all), FLUX Schnell, Z-Image Turbo, FLUX 1.1 Pro, FLUX Kontext edit | Sana: low quality, small watermark, ~1 image per 15 s. The others need a free Pollinations key and spend its free balance; when it runs out you'll see the error on the card. | FLUX Ultra, Ideogram, Imagen 4 |
| **Video** | LTX Video (image or text → clip) | Needs a free Hugging Face token. **5 GPU-minutes a day ≈ 2 short clips.** 2–5 s, ~480p, the queue can be slow. | Kling 2.1, Hailuo 02, Seedance, Wan, Veo 3 |
| **Lip Sync** | LatentSync (video + audio) | Same 5 GPU-minutes a day. Needs a video of a face: make one from a photo in Video first. | OmniHuman (photo + vocals), Lipsync 2 |
| **Upscale** | Real-ESRGAN (images 2–8×, short videos 2–4×) | Same 5 GPU-minutes a day. Images take seconds; video is slow. | Topaz image/video |

Every result is real (nothing is mocked) and is copied into your own storage so it never expires.
Free services are shared and sometimes busy or down. When that happens the result card says so; try again later.
Camera moves, effects and styles are presets that add direction to your prompt.

## Set it up (about 30 minutes, all free)

You'll create four free accounts, copy a few keys into Vercel, and deploy. Keep a note open to paste keys into as you go, and **never share keys in chat**.

### 1. Hugging Face (free video, lip sync, upscale)
1. Sign up at [huggingface.co/join](https://huggingface.co/join) and confirm your email.
2. Go to [Settings → Access Tokens](https://huggingface.co/settings/tokens) → **Create new token** → type **Read** → name it `afterimage` → create.
3. Copy the token (starts with `hf_`). This is your `HF_TOKEN`.

### 2. Pollinations (better free images, optional)
1. Go to [enter.pollinations.ai](https://enter.pollinations.ai) and sign in with GitHub.
2. Open **Keys** → create a **secret key** (starts with `sk_`). This is your `POLLINATIONS_API_KEY`.
   Skip this and you still get the no-account Sana model.

### 3. Cloudflare R2 (where your media is saved)
1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up). Open **R2 Object Storage**.
   Cloudflare asks for a card to switch R2 on, but the free tier (10 GB stored, no download fees) costs nothing if you stay under it.
2. **Create bucket** → name `afterimage` → create.
3. On the R2 overview page, copy your **Account ID**. Your `S3_ENDPOINT` is `https://<Account ID>.r2.cloudflarestorage.com`.
4. **Manage API tokens** → **Create API token** → permission **Object Read & Write**, limited to the `afterimage` bucket → create.
   Copy the **Access Key ID** (`S3_ACCESS_KEY_ID`) and **Secret Access Key** (`S3_SECRET_ACCESS_KEY`). The secret is shown once.
5. Open the bucket → **Settings → CORS policy → Edit**, paste this (you'll fix the address after step 4 of Vercel), and save:
   ```json
   [{ "AllowedOrigins": ["https://YOUR-APP.vercel.app"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```

### 4. Vercel (free hosting)
1. Sign up at [vercel.com/signup](https://vercel.com/signup) with GitHub (the Hobby plan is free).
2. **Add New → Project** → import `highfield`.
3. Before deploying, open **Environment Variables** and add each line from [`.env.example`](.env.example):
   - `OWNER_PASSWORD`: the password you'll log in with.
   - `SESSION_SECRET`: any random text of 40+ characters (mash the keyboard, or use a password generator).
   - `S3_ENDPOINT`, `S3_BUCKET` (`afterimage`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (`auto`).
   - `HF_TOKEN`, and `POLLINATIONS_API_KEY` if you made one.
   - Leave `REPLICATE_API_TOKEN` out to stay free.
4. **Deploy**. Copy your site address (like `https://highfield-xyz.vercel.app`), put it in the R2 CORS rule from step 3.5, and save.
5. Open the site, log in with your password, and make your first image.

Changed a variable later? Redeploy from the Vercel dashboard (Deployments → ⋯ → Redeploy) so it takes effect.

### Optional: paid models
Create a token at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens), add billing there, and add it to Vercel as `REPLICATE_API_TOKEN`. The models marked **Paid** unlock.

## Run it on your own computer

```bash
cp .env.example .env.local   # fill in OWNER_PASSWORD, SESSION_SECRET, HF_TOKEN; leave S3_* empty to use ./data
npm install
npm run dev                  # then open http://localhost:3000
```

## For developers

- Models, their inputs and limits: `src/lib/models.ts`. Presets: `src/lib/presets.ts`. Free providers: `src/lib/providers.ts`.
- Pollinations answers synchronously. Hugging Face Spaces jobs are queued through Gradio's REST API and polled; Replicate predictions are polled.
- Keys stay server-side; the browser only learns *whether* a key is set (`/api/config`).

```bash
npm test && npm run typecheck && npm run lint && npm run build
```
