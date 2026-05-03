# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

This workspace hosts a clone of the **D&D Text Adventure** ("Realms of Replit") originally
extracted from a user-provided Replit export. The project layout, schemas, routes, pages,
and assets are an exact mirror of the source.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + `@clerk/express` middleware
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle, output `dist/index.cjs`)
- **Frontend**: React 19 + Vite 7 + Tailwind v4 + wouter routing + framer-motion
- **Auth**: Local username/password (Express + bcrypt-style hash) **and** Clerk (`@clerk/react`) for Google OAuth
- **AI**: Groq SDK (`groq-sdk`) for the AI dungeon master

## Artifacts

- `artifacts/dnd-game` — React + Vite frontend at `/` (Realms of Replit)
- `artifacts/api-server` — Express API at `/api`, including the Clerk frontend-API proxy at `/api/__clerk`
- `artifacts/mockup-sandbox` — workspace component preview server at `/__mockup`

## Required Secrets / Env Vars

- `DATABASE_URL` — provisioned PostgreSQL (auto)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key, baked into the frontend bundle
- `CLERK_SECRET_KEY` — Clerk secret key, used by the Express middleware and proxy
- `GROQ_API_KEY` — Groq API key for AI generation
- Optional: `VITE_CLERK_PROXY_URL`, `VITE_API_URL`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/dnd-game run dev` — run the D&D frontend locally

## Typography Conventions

- The display face (`font-display`, Cinzel) renders poorly under ~12px. **Do not use `font-display` on text that is `text-xs` (12px) or smaller**, including `text-[10px]` and `text-[11px]`.
- For small labels, chips, badges, and stat micro-headers, use `font-sans font-semibold` (typically with `uppercase tracking-wide` / `tracking-widest` for header-style chips).
- Use `tabular-nums` on small numeric chips (HP/XP/Lv, ability scores, modifiers) so values stay aligned as they change.
- `font-display` remains appropriate for headings and prominent values at `text-sm` and larger.

## Default Admin Credentials (after seeding)

- username: `admin`
- password: `C@stor222`
- role: `admin` (id `6`)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
