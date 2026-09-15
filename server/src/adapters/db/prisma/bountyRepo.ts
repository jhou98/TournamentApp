import { getDb } from "./client.js";
import type { BountyRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  tournamentId: true,
  targetType: true,
  open: true,
  targetId: true,
  description: true,
  coinValue: true,
  active: true,
  awardedAt: true,
  createdAt: true,
} as const;

export function makePrismaBountyRepo(): BountyRepo {
  return {
    async create(bounty) {
      return getDb().bounty.create({ data: bounty, select: RECORD_SELECT });
    },
    async findById(id) {
      return getDb().bounty.findUnique({ where: { id }, select: RECORD_SELECT });
    },
    async listByTournament(tournamentId) {
      return getDb().bounty.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "desc" },
        select: RECORD_SELECT,
      });
    },
    async markAwarded(id, winnerId) {
      return getDb().bounty.update({
        where: { id },
        data: { active: false, awardedAt: new Date(), ...(winnerId ? { targetId: winnerId } : {}) },
        select: RECORD_SELECT,
      });
    },
    async delete(id) {
      await getDb().bounty.delete({ where: { id } });
    },
  };
}
