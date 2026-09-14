import { Router } from "express";
import type { ResultsService } from "../../../../services/resultsService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";

/** Read-only match results + standings for any signed-in user (US9/US10). */
export function resultsRouter(
  results: ResultsService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/results",
    asyncHandler(async (req, res) => {
      res.json(await results.getResults(req.tournamentId!, req.user!));
    }),
  );

  router.get(
    "/standings",
    asyncHandler(async (req, res) => {
      res.json(await results.getStandings(req.tournamentId!));
    }),
  );

  return router;
}
