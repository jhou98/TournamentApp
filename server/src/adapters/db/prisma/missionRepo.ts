import { getDb } from "./client.js";
import type { MissionRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  tournamentId: true,
  userId: true,
  description: true,
  prize: true,
  completed: true,
  completedAt: true,
  createdAt: true,
} as const;

export function makePrismaMissionRepo(): MissionRepo {
  return {
    async create(mission) {
      return getDb().mission.create({ data: mission, select: RECORD_SELECT });
    },
    async findById(id) {
      return getDb().mission.findUnique({ where: { id }, select: RECORD_SELECT });
    },
    async listByTournament(tournamentId) {
      return getDb().mission.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "desc" },
        select: RECORD_SELECT,
      });
    },
    async listByUser(tournamentId, userId) {
      return getDb().mission.findMany({
        where: { tournamentId, userId },
        orderBy: { createdAt: "desc" },
        select: RECORD_SELECT,
      });
    },
    async markCompleted(id) {
      return getDb().mission.update({
        where: { id },
        data: { completed: true, completedAt: new Date() },
        select: RECORD_SELECT,
      });
    },
    async delete(id) {
      await getDb().mission.delete({ where: { id } });
    },
  };
}
