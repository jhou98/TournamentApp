import { Router } from "express";
import type { HealthService } from "../../../../services/healthService.js";

export function healthRouter(health: HealthService): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    health
      .check()
      .then((status) => res.json(status))
      .catch(next);
  });

  return router;
}
