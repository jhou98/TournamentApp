# CLAUDE.md — agent orientation

Fast map of this repo so you can find the right file without re-deriving structure.
This is a routing table, not documentation — follow the pointers rather than assuming.

## What this is

Web app to run a fixed-shape Friendsgiving badminton tournament (24 players, 4 teams of 6).
Round-robin schedule → random doubles pairing on lineup lock → scoring/standings → playoff
bracket with 1v1 sudden death. npm-workspaces monorepo: `server` (Node/Express/Prisma) +
`client` (React/Vite/Tailwind).

**Design intent lives in [artifacts/artifact.md](artifacts/artifact.md)** — the original spec that
seeded the build (data model → §4 · flows → §5 · API → §6 · phases → §8 · **architecture rules → §11**).
Read it to understand *why* things are shaped the way they are and where the project is headed.
- It captures initial design and **will drift from the code over time** — it is not kept in lockstep.
  When the doc and the actual code disagree, **the code is authoritative**; treat the doc as intent,
  not a spec to conform the code back to. Flag notable drift to the user rather than silently "fixing" it.
- The architecture rules (§11) are the exception — those are still the governing conventions.
- Status/roadmap live in the design doc, **not** in the README or here.

## Commands (run from repo root)

```bash
npm run dev         # server (tsx watch) + client (Vite) together
npm run typecheck   # both workspaces — run before declaring done
npm run test        # server vitest (domain + services)
npm run build
npm run db:migrate  # prisma migrate dev   (-w server)
npm run db:seed     # seed default tournament
npm run db:studio
```

- **For browser verification use http://localhost:4000** (server serves the API + app). `:5173` is
  the raw Vite port and flakes with 500s — don't verify against it.
- `.env` lives in **`server/.env`** (that's where Prisma and the server read it), not repo root.
  Copy from `server/.env.example`. Postgres via `docker compose up -d` (:5432) or a Neon string.
- Node 20 (`.nvmrc`).

## Where things live

### server/src — ports & adapters (hexagonal); see design doc §11 before changing shape
- `domain/` — **pure logic, no framework/ORM imports.** roundRobin, playoffs, standings,
  randomAssign, autoBalance, lineup, scheduleLayout, roles, errors, tournamentDefaults.
- `services/` — use-cases; depend on **ports only**, never import express/prisma. One file per area
  (auth, tournament, roster, schedule, lineup, results, playoffs, suddenDeath, health).
- `ports/` — repository + unit-of-work interfaces (`*Repo.ts`, `UnitOfWork.ts`, `index.ts`).
- `adapters/db/prisma/` — Prisma implementations of the ports (`*Repo.ts`, `unitOfWork.ts`).
- `adapters/http/express/` — thin routes + middleware; validate (zod) → call service → map errors.
  Routes in `routes/`, middleware (auth, tournament scoping) in `middleware/`.
- `adapters/security/` — bcrypt hasher, JWT token service.
- `config/container.ts` — **the single composition root**; wires concrete repos into services.
  Add a new service/repo here after creating its port + adapter.
- `config/env.ts` — env loading. `main.ts` — boots Express, serves `client/dist`.
- Tests mirror source under `server/test/{domain,services}/`. **Domain logic must have unit tests.**

### client/src — React SPA
- `pages/` — route screens (`admin/`, `tournament/`, plus Home/Login/Signup/Captain/Profile).
- `components/` — `ui.tsx` (shared primitives), `layout/` (AppShell, AuthLayout), Icon, Overtime.
- `lib/` — `api.ts` (fetch wrapper), `auth.tsx` (auth context), `types.ts`, `nav.ts`.
- `App.tsx` — router. Vite proxies `/api` → server.

## Conventions & gotchas

- **Adding a server feature** typically touches, in order: `ports/` (interface) →
  `adapters/db/prisma/` (impl) → `services/` (use-case) → `adapters/http/express/routes/` (endpoint)
  → `config/container.ts` (wire it) → `server/test/` (cover domain/service). Keep business rules in
  services/domain, never in routes.
- **Never import express or prisma inside `services/` or `domain/`** — that's the portability rule
  (§11) the whole architecture exists for.
- **ESM**: server uses `"type": "module"` and NodeNext — local imports use the **`.js`** extension in
  TS source (e.g. `import { x } from "./foo.js"`). Match the existing style.
- **Terminology**: UI says Round / Matchup / Match / Game / Set; the code keeps its field names
  (`round_index`, `round_no`, etc.). Relabel in the UI layer — don't rename code fields to match copy.
- Writes that span multiple steps go through the **unit-of-work** transaction port, not ad-hoc calls.
- Lint isn't configured yet (`lint` scripts are stubs) — rely on `typecheck` + `test`.
