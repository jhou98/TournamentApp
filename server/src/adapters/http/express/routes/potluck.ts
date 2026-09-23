import { Router } from "express";
import { z } from "zod";
import type { PotluckService } from "../../../../services/potluckService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";
import { parse, safeText } from "../validation.js";

const rsvpSchema = z
  .object({
    attending: z.boolean(),
    item: safeText({ min: 1, max: 120 }).optional(),
  })
  .refine((v) => !v.attending || !!v.item, { message: "Tell us what you're bringing" });

/** Potluck RSVP: event details, the signed-in player's answer, and who's attending (US-potluck). */
export function potluckRouter(
  potluck: PotluckService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json(await potluck.get(req.tournamentId!, req.user!.id));
    }),
  );

  router.post(
    "/rsvp",
    asyncHandler(async (req, res) => {
      const input = parse(rsvpSchema, req.body);
      res.json(await potluck.setRsvp(req.tournamentId!, req.user!.id, input));
    }),
  );

  return router;
}
