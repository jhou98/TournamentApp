import { describe, expect, it } from "vitest";
import { makeHealthService } from "./healthService.js";
import type { SystemPort } from "../ports/index.js";

const fakeSystem = (ping: SystemPort["ping"]): SystemPort => ({ ping });

describe("healthService", () => {
  it("reports db up when the system port pings true", async () => {
    const service = makeHealthService({ system: fakeSystem(async () => true) });
    expect(await service.check()).toEqual({ status: "ok", db: "up" });
  });

  it("reports db down when the system port pings false", async () => {
    const service = makeHealthService({ system: fakeSystem(async () => false) });
    expect(await service.check()).toEqual({ status: "ok", db: "down" });
  });

  it("reports db down when the system port throws", async () => {
    const service = makeHealthService({
      system: fakeSystem(async () => {
        throw new Error("connection refused");
      }),
    });
    expect(await service.check()).toEqual({ status: "ok", db: "down" });
  });
});
