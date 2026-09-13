import { getDb } from "./client.js";
import type { TournamentDetail, TournamentRepo } from "../../../ports/index.js";

const DETAIL_SELECT = {
  id: true,
  name: true,
  status: true,
  teamCount: true,
  teamSize: true,
  pairSize: true,
  pairsPerLineup: true,
  roundsPerMatchup: true,
  roundRobinCycles: true,
  playoffQualifiers: true,
  courtCount: true,
} as const;

type DetailRow = {
  id: string;
  name: string;
  status: TournamentDetail["status"];
  teamCount: number;
  teamSize: number;
  pairSize: number;
  pairsPerLineup: number;
  roundsPerMatchup: number;
  roundRobinCycles: number;
  playoffQualifiers: number;
  courtCount: number;
};

const toDetail = (row: DetailRow): TournamentDetail => row;

export function makePrismaTournamentRepo(): TournamentRepo {
  return {
    async getCurrent() {
      return getDb().tournament.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      });
    },
    async getCurrentDetail() {
      const row = await getDb().tournament.findFirst({
        orderBy: { createdAt: "asc" },
        select: DETAIL_SELECT,
      });
      return row ? toDetail(row) : null;
    },
    async setStatus(id, status) {
      await getDb().tournament.update({ where: { id }, data: { status } });
    },
    async updateConfig(id, patch) {
      const row = await getDb().tournament.update({
        where: { id },
        data: patch,
        select: DETAIL_SELECT,
      });
      return toDetail(row);
    },
  };
}
