import { getDb } from "./client.js";
import type { PotluckRsvpRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  tournamentId: true,
  userId: true,
  attending: true,
  item: true,
  updatedAt: true,
} as const;

export function makePrismaPotluckRsvpRepo(): PotluckRsvpRepo {
  return {
    async findByUser(tournamentId, userId) {
      return getDb().potluckRsvp.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } },
        select: RECORD_SELECT,
      });
    },
    async listByTournament(tournamentId) {
      return getDb().potluckRsvp.findMany({
        where: { tournamentId },
        orderBy: { updatedAt: "asc" },
        select: RECORD_SELECT,
      });
    },
    async upsert({ tournamentId, userId, attending, item }) {
      return getDb().potluckRsvp.upsert({
        where: { tournamentId_userId: { tournamentId, userId } },
        create: { tournamentId, userId, attending, item },
        update: { attending, item },
        select: RECORD_SELECT,
      });
    },
  };
}
