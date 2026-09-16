#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { OidcStack } from "../lib/oidc-stack";
import { InfrastructureStack } from "../lib/infrastructure-stack";
import { configFor, defaultEnvironment } from "../lib/config";

const app = new cdk.App();

// Config (overridable via `cdk deploy -c key=value`).
const appName = app.node.tryGetContext("appName") ?? "tournamentapp";
const environment = String(app.node.tryGetContext("env") ?? defaultEnvironment).toLowerCase();
const githubOrg = app.node.tryGetContext("githubOrg") ?? "jhou98";
const githubRepo = app.node.tryGetContext("githubRepo") ?? "TournamentApp";

if (!/^[a-z0-9-]+$/.test(environment)) {
  throw new Error(`Invalid env '${environment}' — use lowercase letters, digits and dashes (e.g. prod, staging, dev).`);
}

const { appPort, dbAllocatedStorageGb, dbBackupRetentionDays, ec2InstanceSize } = configFor(environment);

// Environment-agnostic by default so `cdk synth` needs no AWS credentials in CI.
// At deploy time CDK resolves the account/region from the assumed role.
const env =
  process.env.CDK_DEFAULT_ACCOUNT && process.env.CDK_DEFAULT_REGION
    ? { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
    : undefined;

// One-time bootstrap: GitHub OIDC provider + deploy role (per environment).
new OidcStack(app, "TournamentAppOidc", {
  stackName: `${appName}-${environment}-oidc`,
  env,
  appName,
  environment,
  githubOrg,
  githubRepo,
  description: `GitHub Actions OIDC provider + deploy role for TournamentApp (${environment}).`,
});

// Application infrastructure: VPC, EC2 + EIP, RDS Postgres, S3, secrets.
new InfrastructureStack(app, "TournamentAppInfra", {
  stackName: `${appName}-${environment}`,
  env,
  appName,
  environment,
  appPort,
  dbAllocatedStorageGb,
  dbBackupRetentionDays,
  ec2InstanceSize,
  description: `TournamentApp infrastructure (${environment}): EC2 (public, EIP) + private RDS Postgres.`,
});

app.synth();
