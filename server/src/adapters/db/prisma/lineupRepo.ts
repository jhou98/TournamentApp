import { getDb } from "./client.js";
import type { LineupRepo, LineupWithPairs } from "../../../ports/index.js";

const WITH_PAIRS = {
  include: {
    pairs: {
      orderBy: { slot: "asc" as const },
      include: { players: { orderBy: { slotInPair: "asc" as const } } },
    },
  },
} as const;

type Row = {
  id: string;
  matchupId: string;
  teamId: string;
  roundNo: number;
  submittedBy: string;
  locked: boolean;
  lockedAt: Date | null;
  pairs: { id: string; lineupId: string; slot: number; players: { userId: string }[] }[];
};

function toView(row: Row): LineupWithPairs {
  return {
    id: row.id,
    matchupId: row.matchupId,
    teamId: row.teamId,
    roundNo: row.roundNo,
    submittedBy: row.submittedBy,
    locked: row.locked,
    lockedAt: row.lockedAt,
    pairs: row.pairs.map((p) => ({
      id: p.id,
      lineupId: p.lineupId,
      slot: p.slot,
      playerIds: p.players.map((pp) => pp.userId),
    })),
  };
}

export function makePrismaLineupRepo(): LineupRepo {
  async function load(id: string): Promise<LineupWithPairs | null> {
    const row = await getDb().lineup.findUnique({ where: { id }, ...WITH_PAIRS });
    return row ? toView(row as Row) : null;
  }

  return {
    async findByRound(matchupId, teamId, roundNo) {
      const row = await getDb().lineup.findUnique({
        where: { matchupId_teamId_roundNo: { matchupId, teamId, roundNo } },
        ...WITH_PAIRS,
      });
      return row ? toView(row as Row) : null;
    },

    async listByMatchup(matchupId) {
      const rows = await getDb().lineup.findMany({
        where: { matchupId },
        orderBy: [{ teamId: "asc" }, { roundNo: "asc" }],
        ...WITH_PAIRS,
      });
      return rows.map((r) => toView(r as Row));
    },

    async listByTeam(teamId) {
      const rows = await getDb().lineup.findMany({
        where: { teamId },
        orderBy: [{ matchupId: "asc" }, { roundNo: "asc" }],
        ...WITH_PAIRS,
      });
      return rows.map((r) => toView(r as Row));
    },

    findById: load,

    async save({ matchupId, teamId, roundNo, submittedBy, pairs }) {
      const db = getDb();
      const lineup = await db.lineup.upsert({
        where: { matchupId_teamId_roundNo: { matchupId, teamId, roundNo } },
        update: { submittedBy },
        create: { matchupId, teamId, roundNo, submittedBy },
        select: { id: true },
      });

      // Replace the pairs wholesale (players first — they reference pairs).
      await db.pairPlayer.deleteMany({ where: { pair: { lineupId: lineup.id } } });
      await db.pair.deleteMany({ where: { lineupId: lineup.id } });
      for (const p of pairs) {
        const pair = await db.pair.create({
          data: { lineupId: lineup.id, slot: p.slot },
          select: { id: true },
        });
        await db.pairPlayer.createMany({
          data: p.playerIds.map((userId, idx) => ({
            pairId: pair.id,
            userId,
            slotInPair: idx + 1,
          })),
        });
      }

      const saved = await load(lineup.id);
      if (!saved) throw new Error("Lineup vanished after save");
      return saved;
    },

    async setLocked(id, locked) {
      const row = await getDb().lineup.update({
        where: { id },
        data: { locked, lockedAt: locked ? new Date() : null },
        select: {
          id: true,
          matchupId: true,
          teamId: true,
          roundNo: true,
          submittedBy: true,
          locked: true,
          lockedAt: true,
        },
      });
      return row;
    },

    async deleteByTournament(tournamentId) {
      const db = getDb();
      await db.pairPlayer.deleteMany({
        where: { pair: { lineup: { matchup: { tournamentId } } } },
      });
      await db.pair.deleteMany({ where: { lineup: { matchup: { tournamentId } } } });
      await db.lineup.deleteMany({ where: { matchup: { tournamentId } } });
    },
  };
}
