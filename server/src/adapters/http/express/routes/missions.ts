import { Router } from "express";
import type { MissionService } from "../../../../services/missionService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireParam } from "../params.js";

/** A player's own missions: list + mark done (US23). */
export function missionsRouter(
  missions: MissionService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json({ missions: await missions.listForUser(req.tournamentId!, req.user!.id) });
    }),
  );

  router.post(
    "/:id/complete",
    asyncHandler(async (req, res) => {
      await missions.complete(req.tournamentId!, req.user!.id, requireParam(req, "id"));
      res.status(204).end();
    }),
  );

  return router;
}
