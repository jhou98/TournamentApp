import { Prisma } from "@prisma/client";
import { getDb } from "./client.js";
import type { GamePowerupUseRepo } from "../../../ports/index.js";

export function makePrismaGamePowerupUseRepo(): GamePowerupUseRepo {
  return {
    async claim(gameId, userId) {
      try {
        await getDb().gamePowerupUse.create({ data: { gameId, userId } });
        return true;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return false;
        }
        throw err;
      }
    },
  };
}
