# Friendsgiving Badminton Tournament

A web app to run a fixed-shape badminton tournament: 24 players across 4 teams of 6,
each with a captain who picks doubles pairs per round. The system generates a
round-robin schedule, randomly matches pairs once lineups lock, tracks scoring and
standings, and seeds a playoff bracket (with 1v1 sudden death to break ties). Later
phases layer on a per-player coin economy, a power-up shop, and commissioner tools.

See [artifacts/artifact.md](./artifacts/artifact.md) for the full design doc (the
source of truth) and [artifacts/Friendsgiving Badminton Tournament — Vibe Coding User Stories.md](./artifacts/Friendsgiving%20Badminton%20Tournament%20%E2%80%94%20Vibe%20Coding%20User%20Stories.md)
for the original user stories.

Built as an npm-workspaces monorepo (`server`, `client`) with a ports & adapters
(hexagonal) server core — see §11 of the design doc for the architecture rules.

## Prerequisites

- Node.js 20 (see `.nvmrc`)
- Docker Desktop (for local Postgres), **or** a Neon Postgres connection string

## Setup

Environment lives in the `server/` workspace (that's where Prisma and the server read it):

```bash
npm install
cp server/.env.example server/.env
# edit server/.env if not using the default docker-compose Postgres

docker compose up -d     # starts local Postgres on :5432
npm run db:migrate       # applies the Prisma schema
npm run db:seed          # seeds the default tournament
```

## Run

```bash
npm run dev              # server (tsx watch) + client (Vite) concurrently
```

- Server: http://localhost:4000 — `/api/health` returns `{"status":"ok","db":"up"}`
- Client: http://localhost:5173 — proxies `/api` to the server

## Other scripts

```bash
npm run typecheck
npm run test
npm run build
npm run db:studio        # Prisma Studio
```
