import { Router } from "express";
import type { AuthService } from "../../../../services/authService.js";
import type { EconomyService } from "../../../../services/economyService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";
import { makeResolveTournament, requestedTournamentId } from "../middleware/tournament.js";

export function meRouter(
  auth: AuthService,
  tournaments: TournamentService,
  economy: EconomyService,
  mw: AuthMiddleware,
): Router {
  const router = Router();

  router.get(
    "/",
    mw.requireAuth,
    asyncHandler(async (req, res) => {
      // Resolve softly: the profile's role is per active tournament, but /me must
      // still work before the client has picked one (or with an unusable choice).
      let tournamentId: string | null = null;
      try {
        tournamentId = await tournaments.resolveActive(req.user!, requestedTournamentId(req));
      } catch {
        tournamentId = null;
      }
      res.json(await auth.me(req.user!.id, tournamentId));
    }),
  );

  // The signed-in player's coin balance + history in the active tournament (US16).
  // Requires a resolved tournament — a balance is meaningless without one (D6).
  router.get(
    "/coins",
    mw.requireAuth,
    makeResolveTournament(tournaments),
    asyncHandler(async (req, res) => {
      res.json(await economy.getCoinSummary(req.tournamentId!, req.user!.id));
    }),
  );

  return router;
}
