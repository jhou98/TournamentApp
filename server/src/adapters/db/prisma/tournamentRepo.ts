import { getDb } from "./client.js";
import type { TournamentRepo } from "../../../ports/index.js";

export function makePrismaTournamentRepo(): TournamentRepo {
  return {
    async getCurrent() {
      return getDb().tournament.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      });
    },
  };
}
