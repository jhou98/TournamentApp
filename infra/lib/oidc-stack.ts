import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface OidcStackProps extends cdk.StackProps {
  /** Base name used for resource naming (e.g. "tournamentapp"). */
  readonly appName: string;
  /** GitHub org/user that owns the repo. */
  readonly githubOrg: string;
  /** Repository name (without owner prefix). */
  readonly githubRepo: string;
  /**
   * Set to true if the GitHub OIDC provider already exists in this account
   * (only one per account is allowed). When true, `existingOidcProviderArn`
   * must be supplied via context.
   */
  readonly useExistingProvider?: boolean;
}

/**
 * One-time bootstrap: the GitHub Actions OIDC provider and the IAM role the
 * deploy workflow assumes. Deploy this ONCE (with admin credentials), then set
 * the repo variable AWS_DEPLOY_ROLE_ARN to the DeployRoleArn output.
 *
 * The deploy role does not carry broad infra permissions itself: `cdk deploy`
 * assumes the CDK bootstrap roles to do the actual work, so this role only needs
 * to (a) assume the cdk-* roles, (b) read stack outputs, (c) stage release
 * artifacts in S3, and (d) drive the on-box deploy via SSM.
 */
export class OidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OidcStackProps) {
    super(scope, id, props);

    const useExisting =
      props.useExistingProvider ?? this.node.tryGetContext("useExistingProvider") === "true";
    const existingArn = this.node.tryGetContext("existingOidcProviderArn") as string | undefined;

    const provider = useExisting
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          "GitHubOidcProvider",
          existingArn ??
            `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
        )
      : new iam.OpenIdConnectProvider(this, "GitHubOidcProvider", {
          url: "https://token.actions.githubusercontent.com",
          clientIds: ["sts.amazonaws.com"],
        });

    const subject = `repo:${props.githubOrg}/${props.githubRepo}:*`;

    const deployRole = new iam.Role(this, "DeployRole", {
      roleName: `${props.appName}-github-deploy`,
      description: "Assumed by GitHub Actions (OIDC) to deploy TournamentApp.",
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
        // Any branch/tag/environment of this repo. Tighten later if desired, e.g.
        //   `repo:ORG/REPO:environment:production`
        StringLike: {
          "token.actions.githubusercontent.com:sub": subject,
        },
      }),
    });

    // (a) Let `cdk deploy` assume the CDK bootstrap roles.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AssumeCdkBootstrapRoles",
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    // CDK reads the bootstrap version from SSM before deploying.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadCdkBootstrapVersion",
        actions: ["ssm:GetParameter"],
        resources: [`arn:aws:ssm:*:${this.account}:parameter/cdk-bootstrap/*`],
      }),
    );

    // (b) Read stack outputs (endpoints, bucket name, instance id).
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadStackOutputs",
        actions: ["cloudformation:DescribeStacks"],
        resources: ["*"],
      }),
    );

    // (c) Stage release artifacts in the app's artifacts bucket.
    const artifactsBucketArn = `arn:aws:s3:::${props.appName}-artifacts-${this.account}`;
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "StageArtifacts",
        actions: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject",
        ],
        resources: [artifactsBucketArn, `${artifactsBucketArn}/*`],
      }),
    );

    // (d) Drive the on-box deploy via SSM Run Command.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SsmRunCommand",
        actions: [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations",
          "ssm:DescribeInstanceInformation",
        ],
        resources: ["*"],
      }),
    );

    new cdk.CfnOutput(this, "DeployRoleArn", {
      description: "Put this into the GitHub repo variable AWS_DEPLOY_ROLE_ARN.",
      value: deployRole.roleArn,
    });

    new cdk.CfnOutput(this, "OidcProviderArn", {
      description: "ARN of the GitHub OIDC provider used by the deploy role.",
      value: provider.openIdConnectProviderArn,
    });
  }
}
