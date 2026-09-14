import type { Prisma } from "@prisma/client";
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

const SUMMARY_SELECT = { id: true, name: true, status: true } as const;

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
    async getDetail(id) {
      const row = await getDb().tournament.findUnique({ where: { id }, select: DETAIL_SELECT });
      return row ? toDetail(row) : null;
    },
    async list() {
      return getDb().tournament.findMany({ orderBy: { createdAt: "asc" }, select: SUMMARY_SELECT });
    },
    async listByIds(ids) {
      if (ids.length === 0) return [];
      return getDb().tournament.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: "asc" },
        select: SUMMARY_SELECT,
      });
    },
    async create(input) {
      const { name, coinRule, streakRule, suddenDeathRule, ...config } = input;
      const row = await getDb().tournament.create({
        data: {
          name,
          ...config,
          coinRule: coinRule as Prisma.InputJsonValue,
          streakRule: streakRule as Prisma.InputJsonValue,
          suddenDeathRule: suddenDeathRule as Prisma.InputJsonValue,
        },
        select: DETAIL_SELECT,
      });
      return toDetail(row);
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
