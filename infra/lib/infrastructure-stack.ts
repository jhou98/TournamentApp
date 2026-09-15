import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface InfrastructureStackProps extends cdk.StackProps {
  /** Base name used for resource naming (e.g. "tournamentapp"). */
  readonly appName: string;
  /** Port the Node server listens on (and, for now, is exposed publicly on). */
  readonly appPort: number;
}

/**
 * TournamentApp base infrastructure:
 *   - a dedicated VPC (2 public subnets for the box, 2 isolated subnets for the DB)
 *   - a public EC2 box with an Elastic IP, serving the API + built SPA
 *   - a private RDS PostgreSQL instance reachable only from the app security group
 *   - a private S3 bucket for release artifacts
 *   - Secrets Manager for DB creds + app secrets
 *
 * NOTE: the design doc specifies Aurora Serverless v2; this uses plain RDS
 * PostgreSQL per the project owner's request. Prisma's connection string is
 * identical either way.
 */
export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const { appName, appPort } = props;

    // BOOTSTRAP_ADMIN_CODE is passed at deploy time (never stored in the repo).
    const bootstrapAdminCode = new cdk.CfnParameter(this, "BootstrapAdminCode", {
      type: "String",
      noEcho: true,
      minLength: 8,
      description: "First-admin signup code (BOOTSTRAP_ADMIN_CODE), stored in Secrets Manager.",
    });

    // ----------------------------------------------------------------- Networking
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // no NAT: the box is in a public subnet; the DB needs no egress.
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // ------------------------------------------------------------ Security groups
    const appSg = new ec2.SecurityGroup(this, "AppSg", {
      vpc,
      description: "TournamentApp EC2 box - public web access.",
      allowAllOutbound: true,
    });
    appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP (future Caddy reverse proxy)");
    appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS (future Caddy reverse proxy)");
    // TEMPORARY: the Node app port is exposed publicly so the app is reachable at
    // http://<EIP>:<appPort> before Caddy is added. Remove once Caddy fronts 80/443.
    appSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(appPort),
      "Node app port (temporary public access until Caddy is added)",
    );

    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      description: "TournamentApp RDS - private, only from the app security group.",
      allowAllOutbound: false,
    });
    dbSg.addIngressRule(appSg, ec2.Port.tcp(5432), "PostgreSQL from the app security group only");

    // ------------------------------------------------------------------- Secrets
    const appSecret = new secretsmanager.Secret(this, "AppSecret", {
      secretName: `${appName}/app`,
      description: "App secrets: JWT_SECRET (generated) and BOOTSTRAP_ADMIN_CODE (provided).",
      generateSecretString: {
        secretStringTemplate: this.toJsonString({
          BOOTSTRAP_ADMIN_CODE: bootstrapAdminCode.valueAsString,
        }),
        generateStringKey: "JWT_SECRET",
        passwordLength: 48,
        excludePunctuation: true,
      },
    });

    // ----------------------------------------------------------------------- RDS
    const database = new rds.DatabaseInstance(this, "Database", {
      // Major-version only: RDS selects a supported minor at deploy time, which
      // avoids pinning to a minor that later gets deprecated.
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of("16", "16"),
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromGeneratedSecret("tournament", {
        secretName: `${appName}/db`,
      }),
      databaseName: "tournament",
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // ------------------------------------------------------------- S3 artifacts
    const artifactsBucket = new s3.Bucket(this, "Artifacts", {
      bucketName: `${appName}-artifacts-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "expire-old-releases",
          prefix: "releases/",
          noncurrentVersionExpiration: cdk.Duration.days(30),
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // -------------------------------------------------------- EC2 + instance role
    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });
    database.secret!.grantRead(instanceRole);
    appSecret.grantRead(instanceRole);
    artifactsBucket.grantRead(instanceRole);

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "set -euxo pipefail",
      // Node 20 (NodeSource) + tooling.
      "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -",
      "dnf install -y nodejs git jq tar gzip unzip",
      // AWS CLI v2 (not preinstalled on AL2023 minimal).
      'if ! command -v aws >/dev/null 2>&1; then curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip && unzip -q /tmp/awscliv2.zip -d /tmp && /tmp/aws/install; fi',
      // App user + directory layout (releases/<sha> with a "current" symlink).
      "id -u tournament >/dev/null 2>&1 || useradd --system --home /opt/tournamentapp --shell /usr/sbin/nologin tournament",
      "mkdir -p /opt/tournamentapp/releases",
      "chown -R tournament:tournament /opt/tournamentapp",
      // systemd unit. WorkingDirectory is the server dir so the app resolves
      // ../client/dist for the SPA and reads server/.env via dotenv.
      "cat >/etc/systemd/system/tournamentapp.service <<'UNIT'",
      "[Unit]",
      "Description=TournamentApp (Node/Express)",
      "After=network-online.target",
      "Wants=network-online.target",
      "",
      "[Service]",
      "Type=simple",
      "User=tournament",
      "WorkingDirectory=/opt/tournamentapp/current/server",
      "ExecStart=/usr/bin/node dist/main.js",
      "Restart=on-failure",
      "RestartSec=5",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "UNIT",
      "systemctl daemon-reload",
      // Enable now; it starts serving after the first deploy populates current/.
      "systemctl enable tournamentapp.service || true",
    );

    const instance = new ec2.Instance(this, "App", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: appSg,
      role: instanceRole,
      userData,
    });

    const eip = new ec2.CfnEIP(this, "Eip", {
      domain: "vpc",
      instanceId: instance.instanceId,
      tags: [{ key: "Name", value: `${appName}-eip` }],
    });

    // --------------------------------------------------------------------- Outputs
    new cdk.CfnOutput(this, "PublicIp", {
      description: "Elastic IP of the app box.",
      value: eip.ref,
    });
    new cdk.CfnOutput(this, "AppUrl", {
      description: "Temporary app URL (pre-Caddy).",
      value: `http://${eip.ref}:${appPort}`,
    });
    new cdk.CfnOutput(this, "InstanceId", {
      description: "EC2 instance id (target of SSM deploy commands).",
      value: instance.instanceId,
    });
    new cdk.CfnOutput(this, "ArtifactsBucketName", {
      description: "S3 bucket for release artifacts.",
      value: artifactsBucket.bucketName,
    });
    new cdk.CfnOutput(this, "DBEndpoint", {
      description: "RDS writer endpoint (private).",
      value: database.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, "DBPort", {
      description: "RDS port.",
      value: database.dbInstanceEndpointPort,
    });
    new cdk.CfnOutput(this, "DBName", { description: "Database name.", value: "tournament" });
    new cdk.CfnOutput(this, "DBSecretArn", {
      description: "Secrets Manager ARN holding DB master username/password.",
      value: database.secret!.secretArn,
    });
    new cdk.CfnOutput(this, "AppSecretArn", {
      description: "Secrets Manager ARN holding JWT_SECRET and BOOTSTRAP_ADMIN_CODE.",
      value: appSecret.secretArn,
    });
    new cdk.CfnOutput(this, "AppPort", {
      description: "Port the Node server listens on.",
      value: String(appPort),
    });
  }
}
