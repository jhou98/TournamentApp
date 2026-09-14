import { getDb } from "./client.js";
import type { CoinLedgerRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  tournamentId: true,
  userId: true,
  delta: true,
  reason: true,
  gameId: true,
  bountyId: true,
  missionId: true,
  purchaseId: true,
  note: true,
  createdAt: true,
} as const;

export function makePrismaCoinLedgerRepo(): CoinLedgerRepo {
  return {
    async createMany(rows) {
      await getDb().coinTransaction.createMany({ data: rows });
    },
    async deleteDerivedByTournament(tournamentId) {
      await getDb().coinTransaction.deleteMany({
        where: { tournamentId, reason: { in: ["match_result", "streak_bonus"] } },
      });
    },
    async sumByUser(tournamentId, userId) {
      const res = await getDb().coinTransaction.aggregate({
        where: { tournamentId, userId },
        _sum: { delta: true },
      });
      return res._sum.delta ?? 0;
    },
    async listByUser(tournamentId, userId) {
      return getDb().coinTransaction.findMany({
        where: { tournamentId, userId },
        orderBy: { createdAt: "desc" },
        select: RECORD_SELECT,
      });
    },
    async sumByTournamentGroupedByUser(tournamentId) {
      const groups = await getDb().coinTransaction.groupBy({
        by: ["userId"],
        where: { tournamentId },
        _sum: { delta: true },
      });
      return groups.map((g) => ({ userId: g.userId, balance: g._sum.delta ?? 0 }));
    },
  };
}
