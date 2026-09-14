import { getDb } from "./client.js";
import type { MembershipRepo, MembershipRole } from "../../../ports/index.js";

export function makePrismaMembershipRepo(): MembershipRepo {
  return {
    async findByUserAndTournament(userId, tournamentId) {
      return getDb().membership.findUnique({
        where: { userId_tournamentId: { userId, tournamentId } },
      });
    },
    async listByUser(userId) {
      return getDb().membership.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
    },
    async listByTeam(teamId) {
      return getDb().membership.findMany({
        where: { teamId },
        orderBy: { createdAt: "asc" },
      });
    },
    async listByTournament(tournamentId) {
      return getDb().membership.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "asc" },
      });
    },
    async assign(userId, tournamentId, teamId, role: MembershipRole) {
      return getDb().membership.upsert({
        where: { userId_tournamentId: { userId, tournamentId } },
        update: { teamId, role },
        create: { userId, tournamentId, teamId, role },
      });
    },
    async setRole(userId, tournamentId, role: MembershipRole) {
      return getDb().membership.update({
        where: { userId_tournamentId: { userId, tournamentId } },
        data: { role },
      });
    },
    async removeByUserAndTournament(userId, tournamentId) {
      await getDb().membership.deleteMany({ where: { userId, tournamentId } });
    },
  };
}
