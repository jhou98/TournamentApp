import { getDb } from "./client.js";
import type { GameRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  matchupId: true,
  roundNo: true,
  courtId: true,
  homePairId: true,
  awayPairId: true,
  scoreHome: true,
  scoreAway: true,
  winnerPairId: true,
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
    async listByMatchup(matchupId) {
      return getDb().game.findMany({
        where: { matchupId },
        orderBy: [{ roundNo: "asc" }, { createdAt: "asc" }],
        select: RECORD_SELECT,
      });
    },
    async listByTournament(tournamentId) {
      return getDb().game.findMany({
        where: { matchup: { tournamentId } },
        orderBy: [{ roundNo: "asc" }, { createdAt: "asc" }],
        select: RECORD_SELECT,
      });
    },
    async setCourt(id, courtId) {
      return getDb().game.update({ where: { id }, data: { courtId }, select: RECORD_SELECT });
    },
    async setScore(id, score) {
      return getDb().game.update({
        where: { id },
        data: {
          scoreHome: score.scoreHome,
          scoreAway: score.scoreAway,
          winnerPairId: score.winnerPairId,
          status: "final",
          finalizedBy: score.finalizedBy,
          finalizedAt: new Date(),
          ...(score.courtId ? { courtId: score.courtId } : {}),
        },
        select: RECORD_SELECT,
      });
    },
    async assignPairs(assignments) {
      const db = getDb();
      for (const a of assignments) {
        await db.game.update({
          where: { id: a.gameId },
          data: { homePairId: a.homePairId, awayPairId: a.awayPairId, status: "assigned" },
        });
      }
    },
    async clearAssignmentsForRound(matchupId, roundNo) {
      await getDb().game.updateMany({
        where: { matchupId, roundNo, status: { not: "final" } },
        data: {
          homePairId: null,
          awayPairId: null,
          winnerPairId: null,
          status: "awaiting_lineups",
        },
      });
    },
    async countByStatus(tournamentId, status) {
      return getDb().game.count({ where: { status, matchup: { tournamentId } } });
    },
    async deleteByTournament(tournamentId) {
      await getDb().game.deleteMany({ where: { matchup: { tournamentId } } });
    },
  };
}
