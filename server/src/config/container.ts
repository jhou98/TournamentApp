import { getPrisma } from "../adapters/db/prisma/client.js";
import { makePrismaSystemRepo } from "../adapters/db/prisma/systemRepo.js";
import { makePrismaUnitOfWork } from "../adapters/db/prisma/unitOfWork.js";
import { makeHealthService, type HealthService } from "../services/healthService.js";
import type { UnitOfWork } from "../ports/index.js";
import type { Env } from "./env.js";

export interface Container {
  env: Env;
  unitOfWork: UnitOfWork;
  services: {
    health: HealthService;
  };
}

/** The single composition root: wires Prisma repos into services. */
export function buildContainer(env: Env): Container {
  const prisma = getPrisma();

  const system = makePrismaSystemRepo(prisma);
  const unitOfWork = makePrismaUnitOfWork(prisma);

  return {
    env,
    unitOfWork,
    services: {
      health: makeHealthService({ system }),
    },
  };
}
