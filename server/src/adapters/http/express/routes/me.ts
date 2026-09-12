import { Router } from "express";
import type { AuthService } from "../../../../services/authService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";

export function meRouter(auth: AuthService, mw: AuthMiddleware): Router {
  const router = Router();

  router.get(
    "/",
    mw.requireAuth,
    asyncHandler(async (req, res) => {
      const profile = await auth.me(req.user!.id);
      res.json(profile);
    }),
  );

  return router;
}
