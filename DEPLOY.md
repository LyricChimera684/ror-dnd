# DnD Clone — Deployment Guide

Stack: **Vercel** (frontend) · **Render** (API) · **Supabase** (Postgres) · **Clerk** (auth)

---

## Prerequisites

- [pnpm](https://pnpm.io/installation) installed locally
- Accounts on [Vercel](https://vercel.com), [Render](https://render.com), [Supabase](https://supabase.com), [Clerk](https://clerk.com)
- Your code pushed to a GitHub repo

---

## Step 1 — Supabase (Database)

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **Settings → Database → Connection string → URI** and copy the `postgres://...` string.
3. From your local machine, run the DB migration:

```bash
cd lib/db
DATABASE_URL="<your-supabase-uri>" pnpm push
```

That's it — Supabase is ready.

---

## Step 2 — Clerk (Auth)

1. Create an app at [clerk.com](https://clerk.com).
2. From **API Keys**, grab:
   - `CLERK_SECRET_KEY` → for Render
   - `VITE_CLERK_PUBLISHABLE_KEY` → for Vercel
3. After deploying (Steps 3 & 4), come back and add both URLs to:
   - **Clerk → Domains** → Allowed origins
   - **Clerk → Paths → Sign-in / Sign-up** redirect URLs

---

## Step 3 — Render (API Server)

### Option A: Using `render.yaml` (recommended)

A `render.yaml` is included at the repo root. Connect your repo on Render and it will auto-configure the service.

After connecting, set these **environment variables** manually in the Render dashboard (they are marked `sync: false` for security):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase URI from Step 1 |
| `CLERK_SECRET_KEY` | From Clerk dashboard |
| `FRONTEND_URL` | Your Vercel URL (set after Step 4), e.g. `https://your-app.vercel.app` |
| `GROQ_API_KEY` | Your Groq key (if using AI features) |

### Option B: Manual setup

- **Runtime**: Node
- **Root Directory**: `.` (repo root)
- **Build Command**: `pnpm install --no-frozen-lockfile && pnpm run build`
- **Start Command**: `node artifacts/api-server/dist/index.cjs`
- **Port**: `10000`

Set the same env vars as Option A.

> ⚠️ After Render deploys, copy your Render service URL (e.g. `https://dnd-api.onrender.com`) — you'll need it for Vercel.

---

## Step 4 — Vercel (Frontend)

1. Import your repo on [vercel.com](https://vercel.com).
2. Set these settings:

| Setting | Value |
|---|---|
| **Root Directory** | `artifacts/dnd-game` |
| **Build Command** | `cd ../.. && pnpm install --no-frozen-lockfile && pnpm run build` |
| **Output Directory** | `dist/public` |
| **Install Command** | *(leave blank)* |

3. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | From Clerk dashboard |
| `VITE_API_URL` | Your Render URL from Step 3 (no trailing slash) |

> ⚠️ Do **not** set `VITE_CLERK_PROXY_URL` — that was Replit-specific and will break auth.

4. Deploy. The included `vercel.json` handles SPA routing automatically.

---

## Step 5 — Wire it all together

1. Copy your Vercel URL → go to Render → set `FRONTEND_URL` env var → trigger a redeploy.
2. Go to Clerk → add both your Vercel and Render URLs to allowed origins/redirects.

---

## Changes made to the codebase

| File | What changed | Why |
|---|---|---|
| `artifacts/api-server/src/app.ts` | CORS now uses `FRONTEND_URL` in production; added Express 5 preflight route | Express 5 needs explicit `app.options("/{*wildcard}", ...)` for preflight CORS |
| `artifacts/dnd-game/vercel.json` | Created | SPA routing — without this, direct URL visits return 404 |
| `artifacts/dnd-game/.env.example` | Created | Documents required Vercel env vars |
| `pnpm-workspace.yaml` | Removed per-platform esbuild exclusions | Those overrides blocked Render/Vercel from resolving the correct linux-x64 esbuild binary |
| `render.yaml` | Created | Declarative Render service config |

---

## Local development

```bash
pnpm install

# Terminal 1 — API
cd artifacts/api-server
PORT=3001 DATABASE_URL=<local-or-supabase-url> CLERK_SECRET_KEY=<key> pnpm dev

# Terminal 2 — Frontend
cd artifacts/dnd-game
PORT=5173 VITE_API_URL=http://localhost:3001 VITE_CLERK_PUBLISHABLE_KEY=<pk_test_...> pnpm dev
```
