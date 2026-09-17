import { getDb } from "./client.js";
import type { PowerupRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  tournamentId: true,
  name: true,
  description: true,
  cost: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function makePrismaPowerupRepo(): PowerupRepo {
  return {
    async create(powerup) {
      return getDb().powerup.create({ data: powerup, select: RECORD_SELECT });
    },
    async findById(id) {
      return getDb().powerup.findUnique({ where: { id }, select: RECORD_SELECT });
    },
    async listByTournament(tournamentId) {
      return getDb().powerup.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "desc" },
        select: RECORD_SELECT,
      });
    },
    async update(id, patch) {
      return getDb().powerup.update({ where: { id }, data: patch, select: RECORD_SELECT });
    },
    async delete(id) {
      await getDb().powerup.delete({ where: { id } });
    },
  };
}
