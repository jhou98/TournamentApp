import type { SystemPort } from "../ports/index.js";

export interface HealthStatus {
  status: "ok";
  db: "up" | "down";
}

export interface HealthService {
  check(): Promise<HealthStatus>;
}

export function makeHealthService(deps: { system: SystemPort }): HealthService {
  return {
    async check() {
      let db: "up" | "down" = "down";
      try {
        db = (await deps.system.ping()) ? "up" : "down";
      } catch {
        db = "down";
      }
      return { status: "ok", db };
    },
  };
}
