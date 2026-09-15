# Infrastructure (AWS CDK)

Base hosted shape for TournamentApp and the CI/CD that ships to it.

- **Compute:** one public **EC2** box (Amazon Linux 2023, `t3.micro`) with an **Elastic IP**. It runs
  the Node server (which also serves the built SPA) under `systemd` (`tournamentapp.service`).
- **Database:** a private **RDS PostgreSQL** instance (`db.t4g.micro`, engine 16), **not** publicly
  accessible — reachable only from the app security group over port 5432.
- **Networking:** a dedicated VPC — public subnets for the box, isolated subnets for the DB, no NAT.
- **Secrets:** DB creds and app secrets (`JWT_SECRET`, `BOOTSTRAP_ADMIN_CODE`) live in **Secrets
  Manager**, never in the repo.
- **Artifacts:** releases are staged in a private, versioned **S3** bucket and pulled onto the box via
  **SSM Run Command** (no SSH keys).

> **Drift from the design doc:** `artifacts/artifact.md` (D8/D15) specifies **Aurora Serverless v2**.
> This stack uses **plain RDS PostgreSQL** per the project owner's request. Prisma's connection string
> is identical either way, so the app code is unaffected — the doc is intent; the code/infra is
> authoritative (per `CLAUDE.md`).

## Security groups

- **App SG** (EC2): inbound `80` and `443` from `0.0.0.0/0` (for the future Caddy reverse proxy), plus
  the **Node app port (default `4000`) open to `0.0.0.0/0` temporarily** so the app is reachable at
  `http://<EIP>:4000` before Caddy exists. Port 22 is **not** opened — management is via SSM.
- **DB SG** (RDS): inbound `5432` **only from the App SG** (by SG id, not a CIDR). `PubliclyAccessible`
  is `false`.

### Caddy / HTTPS — the follow-up

Caddy is intentionally **not** part of this base stack. Once DNS + HTTPS are wanted, a follow-up will:
add Caddy on the box to reverse-proxy `80`/`443` → the app port, issue Let's Encrypt certs, and
**remove the temporary public app-port rule** from the App SG.

## Layout

```
infra/
  bin/app.ts                  CDK app entrypoint (instantiates the two stacks)
  lib/oidc-stack.ts           GitHub OIDC provider + deploy role (one-time)
  lib/infrastructure-stack.ts VPC, SGs, RDS, EC2 + EIP, S3, secrets
  scripts/deploy-on-box.sh    Runs on the instance via SSM (fetch artifact, migrate, restart)
```

CDK stacks: `TournamentAppOidc` (physical name `tournamentapp-oidc`) and `TournamentAppInfra`
(physical name `tournamentapp`).

## One-time bootstrap (admin, run locally with AWS credentials)

```bash
cd infra
npm install

# 1. Bootstrap CDK in the target account/region (creates the CDKToolkit stack).
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>

# 2. Deploy the OIDC provider + GitHub deploy role. Note the DeployRoleArn output.
#    If a GitHub OIDC provider already exists in the account, add:
#      -c useExistingProvider=true -c existingOidcProviderArn=<arn>
npx cdk deploy TournamentAppOidc
```

Then configure the GitHub repo (Settings → Secrets and variables → Actions):

| Kind     | Name                   | Value                                             |
| -------- | ---------------------- | ------------------------------------------------- |
| Variable | `AWS_REGION`           | e.g. `us-east-1`                                   |
| Variable | `AWS_DEPLOY_ROLE_ARN`  | the `DeployRoleArn` output from `TournamentAppOidc` |
| Secret   | `BOOTSTRAP_ADMIN_CODE` | the first-admin signup code (min 8 chars)         |

> The artifacts bucket name is derived as `tournamentapp-artifacts-<accountId>`, which the deploy
> role's S3 policy is scoped to. If you change `appName` (via `-c appName=...`), keep it consistent
> across both stacks.

## Deploying

Everything after bootstrap is done from GitHub Actions:

- **Every PR** runs `.github/workflows/pr.yml` → build + lint + unit tests, and `cdk synth` +
  `cfn-lint` on the synthesized templates.
- **Manual deploy:** Actions → **Deploy to AWS (prod)** → run with a `ref` (branch/tag) and type
  `deploy` to confirm. It re-runs the checks, then `cdk deploy TournamentAppInfra`, uploads the
  release to S3, and runs `deploy-on-box.sh` on the instance via SSM. The first deploy also seeds the
  database (default tournament + bootstrap admin).

## Local commands

```bash
cd infra
npm run typecheck   # tsc --noEmit
npm run synth       # cdk synth --all (no AWS credentials needed)
npm run diff        # cdk diff (needs credentials)
```

## Teardown

```bash
cd infra
npx cdk destroy TournamentAppInfra   # RDS leaves a final snapshot; the S3 bucket is retained
```

Free-tier notes: `t3.micro` (EC2) and `db.t4g.micro` (RDS) are free-tier eligible for 12 months;
watch storage and hours in Billing to stay in-tier.
