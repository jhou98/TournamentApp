import { getDb } from "./client.js";
import type { MatchupRecord, MatchupRepo, MatchupView } from "../../../ports/index.js";

const RECORD_SELECT = {
  id: true,
  tournamentId: true,
  stage: true,
  roundIndex: true,
  teamAId: true,
  teamBId: true,
  status: true,
  winnerTeamId: true,
} as const;

export function makePrismaMatchupRepo(): MatchupRepo {
  return {
    async createMany(tournamentId, matchups) {
      const created: MatchupRecord[] = [];
      // Loop (not createMany) so ids come back in input order for game mapping.
      for (const m of matchups) {
        created.push(
          await getDb().matchup.create({
            data: {
              tournamentId,
              stage: m.stage,
              roundIndex: m.roundIndex,
              teamAId: m.teamAId,
              teamBId: m.teamBId,
            },
            select: RECORD_SELECT,
          }),
        );
      }
      return created;
    },

    async listByTournament(tournamentId) {
      const rows = await getDb().matchup.findMany({
        where: { tournamentId },
        orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }],
        include: {
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
          games: {
            orderBy: [{ roundNo: "asc" }, { createdAt: "asc" }],
            select: { id: true, roundNo: true, courtId: true, status: true },
          },
        },
      });
      return rows.map(
        (r): MatchupView => ({
          id: r.id,
          tournamentId: r.tournamentId,
          stage: r.stage,
          roundIndex: r.roundIndex,
          teamAId: r.teamAId,
          teamBId: r.teamBId,
          status: r.status,
          winnerTeamId: r.winnerTeamId,
          teamAName: r.teamA.name,
          teamBName: r.teamB.name,
          games: r.games,
        }),
      );
    },

    async findById(id) {
      return getDb().matchup.findUnique({ where: { id }, select: RECORD_SELECT });
    },

    async updateTeams(id, teamAId, teamBId) {
      return getDb().matchup.update({
        where: { id },
        data: { teamAId, teamBId },
        select: RECORD_SELECT,
      });
    },

    async deleteByTournament(tournamentId) {
      await getDb().matchup.deleteMany({ where: { tournamentId } });
    },
  };
}
