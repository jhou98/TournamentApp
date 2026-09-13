import { Router } from "express";
import type { ScheduleService } from "../../../../services/scheduleService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";

/** Read-only schedule view for any signed-in user (players + admins). */
export function scheduleRouter(schedule: ScheduleService, mw: AuthMiddleware): Router {
  const router = Router();

  router.get(
    "/",
    mw.requireAuth,
    asyncHandler(async (_req, res) => {
      res.json(await schedule.getSchedule());
    }),
  );

  return router;
}
