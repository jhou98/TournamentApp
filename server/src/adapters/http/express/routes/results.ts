import { Router } from "express";
import type { ResultsService } from "../../../../services/resultsService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";

/** Read-only match results + standings for any signed-in user (US9/US10). */
export function resultsRouter(results: ResultsService, mw: AuthMiddleware): Router {
  const router = Router();
  router.use(mw.requireAuth);

  router.get(
    "/results",
    asyncHandler(async (req, res) => {
      res.json(await results.getResults(req.user!));
    }),
  );

  router.get(
    "/standings",
    asyncHandler(async (_req, res) => {
      res.json(await results.getStandings());
    }),
  );

  return router;
}
