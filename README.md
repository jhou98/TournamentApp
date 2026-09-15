# Friendsgiving Badminton Tournament

A web app to run a fixed-shape badminton tournament: 24 players across 4 teams of 6,
each with a captain who picks doubles pairs per round. The system generates a
round-robin schedule, randomly matches pairs once lineups lock, tracks scoring and
standings, and seeds a playoff bracket (with 1v1 sudden death to break ties). Later
phases layer on a per-player coin economy, a power-up shop, and commissioner tools.

See [artifacts/artifact.md](./artifacts/artifact.md) for the full design doc — the
original design intent that seeded the build (data model, flows, and the architecture
rules the server still follows). It captures initial design and may drift from the code
over time; where they disagree, the code is authoritative. The
[original user stories](./artifacts/Friendsgiving%20Badminton%20Tournament%20%E2%80%94%20Vibe%20Coding%20User%20Stories.md)
are also preserved there.

Built as an npm-workspaces monorepo (`server`, `client`) with a ports & adapters
(hexagonal) server core — see §11 of the design doc for the architecture rules.

## Prerequisites

- Node.js 20 (see `.nvmrc`)
- Docker Desktop (for local Postgres), **or** an RDS PostgreSQL connection string

## Setup

Environment lives in the `server/` workspace (that's where Prisma and the server read it):

```bash
npm install
cp server/.env.example server/.env
# edit server/.env if not using the default docker-compose Postgres
# (for the deployed box, point DATABASE_URL/DIRECT_URL at the RDS PostgreSQL
#  instance endpoint with ?sslmode=require — see artifact.md §11)

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

## Infrastructure & deployment

Base AWS infrastructure (a public EC2 box with an Elastic IP + a private RDS PostgreSQL instance) is
defined as an **AWS CDK** app under [`infra/`](./infra/README.md), and CI/CD lives in
[`.github/workflows/`](./.github/workflows):

- **`pr.yml`** — on every pull request: build + lint + unit tests, and `cdk synth` + `cfn-lint`
  validation of the CloudFormation templates.
- **`deploy.yml`** — a manual "Deploy to AWS" action: pick an environment (`prod`/`staging`/`dev`) and
  a branch/tag; it runs those same checks, then provisions/updates that environment's CDK stack and
  publishes the chosen branch onto its EC2 box (via SSM). AWS access uses GitHub OIDC — no long-lived
  keys, with per-environment config held in GitHub Environments.

See [`infra/README.md`](./infra/README.md) for the environment model, one-time bootstrap steps, and
required variables/secrets. Caddy/HTTPS is a planned follow-up — for now the app is served directly
over the Elastic IP on the app port.

## Prod Setup
- Amazon sign-in: https://293532442953.signin.aws.amazon.com/console
