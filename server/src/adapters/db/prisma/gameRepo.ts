import { getDb } from "./client.js";
import type { GameRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  matchupId: true,
  roundNo: true,
  courtId: true,
  status: true,
} as const;

export function makePrismaGameRepo(): GameRepo {
  return {
    async createMany(games) {
      await getDb().game.createMany({ data: games });
    },
    async findById(id) {
      return getDb().game.findUnique({ where: { id }, select: RECORD_SELECT });
    },
    async setCourt(id, courtId) {
      return getDb().game.update({ where: { id }, data: { courtId }, select: RECORD_SELECT });
    },
    async countByStatus(tournamentId, status) {
      return getDb().game.count({ where: { status, matchup: { tournamentId } } });
    },
    async deleteByTournament(tournamentId) {
      await getDb().game.deleteMany({ where: { matchup: { tournamentId } } });
    },
  };
}
