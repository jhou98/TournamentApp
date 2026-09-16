import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface EnvironmentConfig {
  readonly appPort: number;
  readonly dbAllocatedStorageGb: number;
  readonly dbBackupRetentionDays: number;
  readonly ec2InstanceSize: ec2.InstanceSize;
}

// Per-environment settings. Unknown names fall back to `defaultConfig`, so a
// new environment can be deployed with `-c env=<name>` without a code change.
export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    appPort: 4000,
    dbAllocatedStorageGb: 20,
    dbBackupRetentionDays: 7,
    ec2InstanceSize: ec2.InstanceSize.NANO,
  },
  staging: {
    appPort: 4000,
    dbAllocatedStorageGb: 20,
    dbBackupRetentionDays: 7,
    ec2InstanceSize: ec2.InstanceSize.NANO,
  },
  prod: {
    appPort: 4000,
    dbAllocatedStorageGb: 20,
    dbBackupRetentionDays: 7,
    ec2InstanceSize: ec2.InstanceSize.MICRO,
  },
};

export const defaultEnvironment = "dev";
export const defaultConfig: EnvironmentConfig = environments.dev;

export function configFor(envName: string): EnvironmentConfig {
  return environments[envName] ?? defaultConfig;
}
