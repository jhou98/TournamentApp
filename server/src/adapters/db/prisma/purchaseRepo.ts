import { getDb } from "./client.js";
import type { PurchaseRepo } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  tournamentId: true,
  userId: true,
  powerupId: true,
  costPaid: true,
  createdAt: true,
} as const;

export function makePrismaPurchaseRepo(): PurchaseRepo {
  return {
    async create(purchase) {
      return getDb().purchase.create({ data: purchase, select: RECORD_SELECT });
    },
    async findById(id) {
      return getDb().purchase.findUnique({ where: { id }, select: RECORD_SELECT });
    },
    async listByUser(tournamentId, userId) {
      return getDb().purchase.findMany({
        where: { tournamentId, userId },
        orderBy: { createdAt: "desc" },
        select: RECORD_SELECT,
      });
    },
    async findByUserAndPowerup(userId, powerupId) {
      return getDb().purchase.findUnique({
        where: { userId_powerupId: { userId, powerupId } },
        select: RECORD_SELECT,
      });
    },
    async delete(id) {
      await getDb().purchase.delete({ where: { id } });
    },
  };
}
