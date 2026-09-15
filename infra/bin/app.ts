#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { OidcStack } from "../lib/oidc-stack";
import { InfrastructureStack } from "../lib/infrastructure-stack";

const app = new cdk.App();

// Config (overridable via `cdk deploy -c key=value` or env vars).
const appName = app.node.tryGetContext("appName") ?? "tournamentapp";
const githubOrg = app.node.tryGetContext("githubOrg") ?? "jhou98";
const githubRepo = app.node.tryGetContext("githubRepo") ?? "TournamentApp";
const appPort = Number(app.node.tryGetContext("appPort") ?? 4000);

// Environment-agnostic by default so `cdk synth` needs no AWS credentials in CI.
// At deploy time CDK resolves the account/region from the assumed role, or you
// can pin them with CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION.
const env =
  process.env.CDK_DEFAULT_ACCOUNT && process.env.CDK_DEFAULT_REGION
    ? { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
    : undefined;

// One-time bootstrap stack: GitHub OIDC provider + deploy role.
new OidcStack(app, "TournamentAppOidc", {
  stackName: `${appName}-oidc`,
  env,
  appName,
  githubOrg,
  githubRepo,
  description: "GitHub Actions OIDC provider + deploy role for TournamentApp.",
});

// Main application infrastructure: VPC, EC2 + EIP, RDS Postgres, S3, secrets.
new InfrastructureStack(app, "TournamentAppInfra", {
  stackName: appName,
  env,
  appName,
  appPort,
  description: "TournamentApp base infrastructure: EC2 (public, EIP) + private RDS Postgres.",
});

app.synth();
