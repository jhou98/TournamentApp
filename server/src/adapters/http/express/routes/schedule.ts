import { Router } from "express";
import type { ScheduleService } from "../../../../services/scheduleService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";

/** Read-only schedule view for any signed-in user (players + admins). */
export function scheduleRouter(
  schedule: ScheduleService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json(await schedule.getSchedule(req.tournamentId!));
    }),
  );

  return router;
}
