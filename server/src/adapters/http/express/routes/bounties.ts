import { Router } from "express";
import type { BountyService } from "../../../../services/bountyService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";

/** Read-only list of active bounties for any signed-in user (US16). */
export function bountiesRouter(
  bounties: BountyService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json({ bounties: await bounties.listActive(req.tournamentId!) });
    }),
  );

  return router;
}
