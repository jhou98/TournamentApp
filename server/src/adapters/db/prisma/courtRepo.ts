import { getDb } from "./client.js";
import type { CourtRepo } from "../../../ports/index.js";

export function makePrismaCourtRepo(): CourtRepo {
  return {
    async listByTournament(tournamentId) {
      return getDb().court.findMany({
        where: { tournamentId },
        orderBy: { label: "asc" },
      });
    },
    async findById(id) {
      return getDb().court.findUnique({ where: { id } });
    },
    async createMany(tournamentId, labels) {
      const created = [];
      for (const label of labels) {
        created.push(await getDb().court.create({ data: { tournamentId, label } }));
      }
      return created;
    },
    async rename(id, label) {
      return getDb().court.update({ where: { id }, data: { label } });
    },
    async deleteByTournament(tournamentId) {
      await getDb().court.deleteMany({ where: { tournamentId } });
    },
  };
}
