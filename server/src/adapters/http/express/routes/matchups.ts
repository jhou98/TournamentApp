import { Router } from "express";
import { z } from "zod";
import type { LineupService } from "../../../../services/lineupService.js";
import type { SuddenDeathService } from "../../../../services/suddenDeathService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";
import { parse } from "../validation.js";
import { requireParam } from "../params.js";

const submitSchema = z.object({
  teamId: z.string().min(1),
  roundNo: z.number().int().positive(),
  pairs: z.array(z.array(z.string().min(1))).min(1),
});
const lockSchema = z.object({
  teamId: z.string().min(1),
  roundNo: z.number().int().positive(),
});
const repSchema = z.object({ teamId: z.string().min(1), userId: z.string().min(1) });

/** Captain lineups + random assignment (US6–US8) and sudden-death rep picks (US12). */
export function matchupsRouter(
  lineups: LineupService,
  suddenDeath: SuddenDeathService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAuth, makeResolveTournament(tournaments));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json({ matchups: await lineups.listMyMatchups(req.tournamentId!, req.user!) });
    }),
  );

  router.get(
    "/:id/lineups",
    asyncHandler(async (req, res) => {
      res.json(await lineups.getContext(req.tournamentId!, req.user!, requireParam(req, "id")));
    }),
  );

  router.post(
    "/:id/lineups",
    asyncHandler(async (req, res) => {
      const { teamId, roundNo, pairs } = parse(submitSchema, req.body);
      const lineup = await lineups.submit(req.tournamentId!, req.user!, {
        matchupId: requireParam(req, "id"),
        teamId,
        roundNo,
        pairs,
      });
      res.status(201).json({ lineup });
    }),
  );

  router.post(
    "/:id/lineups/lock",
    asyncHandler(async (req, res) => {
      const { teamId, roundNo } = parse(lockSchema, req.body);
      const result = await lineups.lock(req.tournamentId!, req.user!, {
        matchupId: requireParam(req, "id"),
        teamId,
        roundNo,
      });
      res.json(result);
    }),
  );

  router.post(
    "/:id/lineups/unlock",
    asyncHandler(async (req, res) => {
      const { teamId, roundNo } = parse(lockSchema, req.body);
      await lineups.unlock(req.tournamentId!, req.user!, {
        matchupId: requireParam(req, "id"),
        teamId,
        roundNo,
      });
      res.status(204).end();
    }),
  );

  // Admin-only re-randomize of the whole matchup's pairings (checked in the service).
  router.post(
    "/:id/lineups/rematch",
    asyncHandler(async (req, res) => {
      await lineups.reshuffle(req.tournamentId!, req.user!, requireParam(req, "id"));
      res.status(204).end();
    }),
  );

  // Sudden death (US12): read state; captains pick a representative.
  router.get(
    "/:id/sudden-death",
    asyncHandler(async (req, res) => {
      res.json(await suddenDeath.getState(req.tournamentId!, req.user!, requireParam(req, "id")));
    }),
  );

  router.post(
    "/:id/sudden-death/rep",
    asyncHandler(async (req, res) => {
      const { teamId, userId } = parse(repSchema, req.body);
      await suddenDeath.chooseRep(req.tournamentId!, req.user!, requireParam(req, "id"), {
        teamId,
        userId,
      });
      res.status(204).end();
    }),
  );

  return router;
}
