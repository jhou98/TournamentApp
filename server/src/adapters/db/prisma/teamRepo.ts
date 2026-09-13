import { getDb } from "./client.js";
import type { TeamRepo } from "../../../ports/index.js";

export function makePrismaTeamRepo(): TeamRepo {
  return {
    async create(tournamentId, name) {
      return getDb().team.create({ data: { tournamentId, name } });
    },
    async findById(id) {
      return getDb().team.findUnique({ where: { id } });
    },
    async findByName(tournamentId, name) {
      return getDb().team.findUnique({
        where: { tournamentId_name: { tournamentId, name } },
      });
    },
    async listByTournament(tournamentId) {
      return getDb().team.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "asc" },
      });
    },
    async delete(id) {
      await getDb().team.delete({ where: { id } });
    },
  };
}
