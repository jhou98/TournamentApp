import { Router } from "express";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";

/** Tournaments the signed-in user may access — for the client's picker (US28). */
export function tournamentsRouter(tournaments: TournamentService, mw: AuthMiddleware): Router {
  const router = Router();

  router.get(
    "/",
    mw.requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ tournaments: await tournaments.listAccessible(req.user!) });
    }),
  );

  return router;
}
