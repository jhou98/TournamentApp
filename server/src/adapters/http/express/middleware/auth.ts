import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../../../../domain/errors.js";
import { toPublicUser, type TokenService, type UserRepo } from "../../../../ports/index.js";

export const AUTH_COOKIE = "token";

export interface AuthMiddleware {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
}

export function makeAuthMiddleware(deps: { tokens: TokenService; users: UserRepo }): AuthMiddleware {
  const load: RequestHandler = (req, _res, next) => {
    const token = req.cookies?.[AUTH_COOKIE] as string | undefined;
    if (!token) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }
    const payload = deps.tokens.verify(token);
    if (!payload) {
      next(new UnauthorizedError("Invalid or expired session"));
      return;
    }
    deps.users
      .findById(payload.userId)
      .then((user) => {
        if (!user) {
          next(new UnauthorizedError("User no longer exists"));
          return;
        }
        req.user = toPublicUser(user);
        next();
      })
      .catch(next);
  };

  const requireAdmin: RequestHandler = (req, res, next) => {
    load(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      if (!req.user?.isAdmin) {
        next(new ForbiddenError("Admin access required"));
        return;
      }
      next();
    });
  };

  return { requireAuth: load, requireAdmin };
}
