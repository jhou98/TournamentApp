import { Router } from "express";
import { z } from "zod";
import { ValidationError } from "../../../../domain/errors.js";
import type { LineupService } from "../../../../services/lineupService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireParam } from "../params.js";

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

const submitSchema = z.object({
  teamId: z.string().min(1),
  roundNo: z.number().int().positive(),
  pairs: z.array(z.array(z.string().min(1))).min(1),
});
const lockSchema = z.object({
  teamId: z.string().min(1),
  roundNo: z.number().int().positive(),
});

/** Captain lineups + random assignment (US6–US8). Auth required; team-scoped in the service. */
export function matchupsRouter(lineups: LineupService, mw: AuthMiddleware): Router {
  const router = Router();
  router.use(mw.requireAuth);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json({ matchups: await lineups.listMyMatchups(req.user!) });
    }),
  );

  router.get(
    "/:id/lineups",
    asyncHandler(async (req, res) => {
      res.json(await lineups.getContext(req.user!, requireParam(req, "id")));
    }),
  );

  router.post(
    "/:id/lineups",
    asyncHandler(async (req, res) => {
      const { teamId, roundNo, pairs } = parse(submitSchema, req.body);
      const lineup = await lineups.submit(req.user!, {
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
      const result = await lineups.lock(req.user!, {
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
      await lineups.unlock(req.user!, {
        matchupId: requireParam(req, "id"),
        teamId,
        roundNo,
      });
      res.status(204).end();
    }),
  );

  return router;
}
