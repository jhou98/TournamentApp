import { Router } from "express";
import type { ShopService } from "../../../../services/shopService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireParam } from "../params.js";

/** Player-facing shop: browse, buy, and view owned powerups (US20). */
export function shopRouter(
  shop: ShopService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json({ powerups: await shop.listForUser(req.tournamentId!, req.user!) });
    }),
  );

  router.get(
    "/inventory",
    asyncHandler(async (req, res) => {
      res.json({ inventory: await shop.listInventory(req.tournamentId!, req.user!) });
    }),
  );

  router.post(
    "/:powerupId/buy",
    asyncHandler(async (req, res) => {
      const result = await shop.purchase(req.tournamentId!, req.user!, requireParam(req, "powerupId"));
      res.status(201).json(result);
    }),
  );

  router.post(
    "/inventory/:purchaseId/use",
    asyncHandler(async (req, res) => {
      const result = await shop.use(req.tournamentId!, req.user!, requireParam(req, "purchaseId"));
      res.json(result);
    }),
  );

  return router;
}
