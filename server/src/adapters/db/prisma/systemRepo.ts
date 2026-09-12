import type { PrismaClient } from "@prisma/client";
import type { SystemPort } from "../../../ports/index.js";

export function makePrismaSystemRepo(prisma: PrismaClient): SystemPort {
  return {
    async ping() {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    },
  };
}
