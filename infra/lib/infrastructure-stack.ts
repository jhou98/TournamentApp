import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface InfrastructureStackProps extends cdk.StackProps {
  readonly appName: string;
  readonly environment: string;
  readonly appPort: number;
}

/** TournamentApp infrastructure: a public EC2 box + private RDS Postgres. */
export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const { appName, environment, appPort } = props;
    const prefix = `${appName}-${environment}`;

    // Passed at deploy time; never stored in the repo.
    const bootstrapAdminCode = new cdk.CfnParameter(this, "BootstrapAdminCode", {
      type: "String",
      noEcho: true,
      minLength: 8,
      description: "First-admin signup code (BOOTSTRAP_ADMIN_CODE), stored in Secrets Manager.",
    });
    const registrationCode = new cdk.CfnParameter(this, "RegistrationCode", {
      type: "String",
      noEcho: true,
      minLength: 8,
      description: "Shared signup code (REGISTRATION_CODE) gating registration, stored in Secrets Manager.",
    });

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // box is in a public subnet; the DB needs no egress.
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    const appSg = new ec2.SecurityGroup(this, "AppSg", {
      vpc,
      description: `${prefix} EC2 box - public web access.`,
      allowAllOutbound: true,
    });
    appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP (future Caddy reverse proxy)");
    appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS (future Caddy reverse proxy)");
    // Temporary: exposes the app at http://<EIP>:<appPort> until Caddy fronts 80/443.
    appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(appPort), "Node app port (temporary)");

    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      description: `${prefix} RDS - private, only from the app security group.`,
      allowAllOutbound: false,
    });
    dbSg.addIngressRule(appSg, ec2.Port.tcp(5432), "PostgreSQL from the app security group only");

    const appSecret = new secretsmanager.Secret(this, "AppSecret", {
      secretName: `${appName}/${environment}/app`,
      description: "App secrets: JWT_SECRET (generated), BOOTSTRAP_ADMIN_CODE + REGISTRATION_CODE (provided).",
      generateSecretString: {
        secretStringTemplate: this.toJsonString({
          BOOTSTRAP_ADMIN_CODE: bootstrapAdminCode.valueAsString,
          REGISTRATION_CODE: registrationCode.valueAsString,
        }),
        generateStringKey: "JWT_SECRET",
        passwordLength: 48,
        excludePunctuation: true,
      },
    });

    const database = new rds.DatabaseInstance(this, "Database", {
      // Major-version only: RDS selects a supported minor at deploy time.
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of("16", "16"),
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromGeneratedSecret("tournament", {
        secretName: `${appName}/${environment}/db`,
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

    const artifactsBucket = new s3.Bucket(this, "Artifacts", {
      bucketName: `${prefix}-artifacts-${this.account}`,
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
      "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -",
      "dnf install -y nodejs git jq tar gzip unzip",
      'if ! command -v aws >/dev/null 2>&1; then curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip && unzip -q /tmp/awscliv2.zip -d /tmp && /tmp/aws/install; fi',
      "id -u tournament >/dev/null 2>&1 || useradd --system --home /opt/tournamentapp --shell /usr/sbin/nologin tournament",
      "mkdir -p /opt/tournamentapp/releases",
      "chown -R tournament:tournament /opt/tournamentapp",
      // WorkingDirectory is the server dir so the app resolves ../client/dist and reads server/.env.
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
      tags: [{ key: "Name", value: `${prefix}-eip` }],
    });

    const outputs: Record<string, string> = {
      PublicIp: eip.ref,
      AppUrl: `http://${eip.ref}:${appPort}`,
      InstanceId: instance.instanceId,
      ArtifactsBucketName: artifactsBucket.bucketName,
      DBEndpoint: database.dbInstanceEndpointAddress,
      DBPort: database.dbInstanceEndpointPort,
      DBName: "tournament",
      DBSecretArn: database.secret!.secretArn,
      AppSecretArn: appSecret.secretArn,
      AppPort: String(appPort),
    };
    for (const [key, value] of Object.entries(outputs)) {
      new cdk.CfnOutput(this, key, { value });
    }
  }
}
