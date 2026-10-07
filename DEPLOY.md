# Deploying SevaSetu

The backend runs as four Node services on Render, the web app on Vercel, and the data in MongoDB Atlas.
The AI key is optional: without it, every AI job answers with its fallback.

## 1. MongoDB Atlas

1. Create a free cluster and a database user. Allow network access from anywhere (Render's IPs change).
2. Copy the connection string twice, once ending in `/seva_core` and once in `/seva_reflect`.
3. Seed both databases from your laptop. The seed scripts clear their collections first, so they are safe to rerun.

   ```bash
   npm install
   MONGO_URI="mongodb+srv://…/seva_core" node seed/seed-core.js
   MONGO_URI="mongodb+srv://…/seva_reflect" node seed/seed-reflect.js
   ```

## 2. Render: the four services

New → Blueprint → pick this repo. [render.yaml](render.yaml) creates `sevasetu-core`, `sevasetu-reflect`,
`sevasetu-bridge` and `sevasetu-gateway`. Fill in the values it asks for:

| Service | Variable | Value |
|---|---|---|
| core | `MONGO_URI` | the `/seva_core` string |
| core | `JWT_SECRET` | any long random string |
| reflect | `MONGO_URI` | the `/seva_reflect` string |
| bridge | `LLM_API_KEY`, `LLM_MODEL` | a Groq key and the model name (optional; see the README table for every bridge variable) |
| bridge | `BHASHINI_USER_ID`, `BHASHINI_ULCA_API_KEY` | optional; only for Tamil/Hindi speech and translation |
| gateway | `JWT_SECRET` | the same value as core |
| gateway | `CORE_URL`, `REFLECT_URL`, `BRIDGE_URL` | the three service URLs from the Render dashboard |
| gateway | `WEB_ORIGIN` | the Vercel URL (step 3) |

Every service answers `GET /health`. Open `https://<gateway>/health/all`: all three must be `true`.

**One-service fallback:** create a single web service with start command `node mono.js`, and set `MONGO_URI`
(or `CORE_MONGO_URI`), `JWT_SECRET` and, if you have them, the Groq and Bhashini variables. It runs all four
services in one process. Locally, every variable comes from the one root `.env` (see `.env.example`).

## 3. Vercel: the web app

Import the repo and set the root directory to `apps/web`. Set the environment variable `VITE_API_URL` to the
gateway URL. [vercel.json](apps/web/vercel.json) sends every path to the app, so refreshing `/my-seva` works.
Then copy the Vercel URL into the gateway's `WEB_ORIGIN`.

## 4. Check it

```bash
GW=https://<gateway> node scripts/api-test.js      # needs freshly seeded data
WEB=https://<vercel-url> node scripts/ui-test.js   # needs Google Chrome
```

Render's free services sleep. Open `/health/all` two minutes before a demo to wake them.

## Showing Swami Vivekananda's words

Quotes are hidden until a person checks each one in a printed volume of the *Complete Works*. To show one, set
`"verified": true` and its `"page"` in [seed/wisdom.json](seed/wisdom.json), then run `seed-reflect.js` again.
The bridge reads the same file for the Teaching Finder, so redeploy the bridge too.
