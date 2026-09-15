import { Router } from "express";
import type { EconomyService } from "../../../../services/economyService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";

/** Read-only coin leaderboard for any signed-in user (US17). */
export function leaderboardRouter(
  economy: EconomyService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json(await economy.getLeaderboard(req.tournamentId!));
    }),
  );

  return router;
}
