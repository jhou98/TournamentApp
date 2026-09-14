import { getDb } from "./client.js";
import type { SuddenDeathRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  matchupId: true,
  teamAId: true,
  teamBId: true,
  teamARep: true,
  teamBRep: true,
  scoreA: true,
  scoreB: true,
  winnerTeamId: true,
} as const;

export function makePrismaSuddenDeathRepo(): SuddenDeathRepo {
  return {
    async findByMatchup(matchupId) {
      return getDb().suddenDeath.findUnique({ where: { matchupId }, select: RECORD_SELECT });
    },
    async create(input) {
      return getDb().suddenDeath.create({ data: input, select: RECORD_SELECT });
    },
    async setRep(matchupId, side, userId) {
      return getDb().suddenDeath.update({
        where: { matchupId },
        data: side === "A" ? { teamARep: userId } : { teamBRep: userId },
        select: RECORD_SELECT,
      });
    },
    async setResult(matchupId, result) {
      return getDb().suddenDeath.update({
        where: { matchupId },
        data: { scoreA: result.scoreA, scoreB: result.scoreB, winnerTeamId: result.winnerTeamId },
        select: RECORD_SELECT,
      });
    },
    async deleteByTournament(tournamentId) {
      await getDb().suddenDeath.deleteMany({ where: { matchup: { tournamentId } } });
    },
  };
}
