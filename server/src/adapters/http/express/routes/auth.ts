import { Router, type Response } from "express";
import { z } from "zod";
import type { AuthService } from "../../../../services/authService.js";
import { asyncHandler } from "../asyncHandler.js";
import { parse, safeText } from "../validation.js";
import { AUTH_COOKIE } from "../middleware/auth.js";

const signupSchema = z.object({
  username: safeText({ min: 3, max: 30 }),
  password: z.string().min(8).max(200),
  displayName: safeText({ min: 1, max: 60 }),
  inviteCode: z.string().trim().min(1).optional(),
});

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const resetPasswordSchema = z.object({
  username: z.string().trim().min(1),
  code: z.string().trim().min(1),
  newPassword: z.string().min(8).max(200),
});

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function authRouter(auth: AuthService): Router {
  const router = Router();

  router.post(
    "/signup",
    asyncHandler(async (req, res) => {
      const cmd = parse(signupSchema, req.body);
      const result = await auth.signup(cmd);
      setAuthCookie(res, result.token);
      res.status(201).json({ user: result.user, role: result.role });
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const cmd = parse(loginSchema, req.body);
      const result = await auth.login(cmd);
      setAuthCookie(res, result.token);
      res.json({ user: result.user, role: result.role });
    }),
  );

  router.post(
    "/reset-password",
    asyncHandler(async (req, res) => {
      const cmd = parse(resetPasswordSchema, req.body);
      await auth.resetPassword(cmd);
      res.status(204).end();
    }),
  );

  router.post("/logout", (_req, res) => {
    res.clearCookie(AUTH_COOKIE, { path: "/" });
    res.status(204).end();
  });

  return router;
}
