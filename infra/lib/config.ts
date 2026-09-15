export interface EnvironmentConfig {
  readonly appPort: number;
}

// Per-environment settings. Add prod/staging/dev overrides here (e.g. instance
// sizes) as they diverge; unknown names fall back to `defaultConfig`, so a new
// environment can be deployed with `-c env=<name>` without a code change.
export const environments: Record<string, EnvironmentConfig> = {
  dev: { appPort: 4000 },
  staging: { appPort: 4000 },
  prod: { appPort: 4000 },
};

export const defaultEnvironment = "dev";
export const defaultConfig: EnvironmentConfig = { appPort: 4000 };

export function configFor(envName: string): EnvironmentConfig {
  return environments[envName] ?? defaultConfig;
}
