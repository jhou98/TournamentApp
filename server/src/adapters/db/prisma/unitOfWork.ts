import type { PrismaClient } from "@prisma/client";
import type { UnitOfWork } from "../../../ports/index.js";

export function makePrismaUnitOfWork(prisma: PrismaClient): UnitOfWork {
  return {
    async run<T>(work: () => Promise<T>): Promise<T> {
      return prisma.$transaction(async () => work());
    },
  };
}
