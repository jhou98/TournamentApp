import { Router } from "express";
import { z } from "zod";
import { ValidationError } from "../../../../domain/errors.js";
import type { RosterService } from "../../../../services/rosterService.js";
import type { ScheduleService } from "../../../../services/scheduleService.js";
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

const setAdminSchema = z.object({ isAdmin: z.boolean() });
const inviteSchema = z.object({
  grantsAdmin: z.boolean().default(false),
  expiresAt: z.coerce.date().optional(),
});
const createTeamSchema = z.object({ name: z.string().trim().min(1).max(60) });
const assignMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["captain", "member"]).optional(),
});
const setCaptainSchema = z.object({ userId: z.string().min(1) });

const positiveInt = z.number().int().positive();
const updateConfigSchema = z
  .object({
    teamCount: positiveInt,
    teamSize: positiveInt,
    pairSize: positiveInt,
    pairsPerLineup: positiveInt,
    roundsPerMatchup: positiveInt,
    roundRobinCycles: positiveInt,
    playoffQualifiers: positiveInt,
    courtCount: positiveInt,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one config field" });
const editMatchupSchema = z.object({
  teamAId: z.string().min(1),
  teamBId: z.string().min(1),
});
const renameCourtSchema = z.object({ label: z.string().trim().min(1).max(60) });
const reassignCourtSchema = z.object({ courtId: z.string().min(1) });

export function adminRouter(
  roster: RosterService,
  schedule: ScheduleService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAdmin);

  router.get(
    "/users",
    asyncHandler(async (_req, res) => {
      res.json({ users: await roster.listUsers() });
    }),
  );

  router.patch(
    "/users/:id",
    asyncHandler(async (req, res) => {
      const { isAdmin } = parse(setAdminSchema, req.body);
      res.json({ user: await roster.setAdmin(requireParam(req, "id"), isAdmin) });
    }),
  );

  router.post(
    "/invites",
    asyncHandler(async (req, res) => {
      const input = parse(inviteSchema, req.body);
      const invite = await roster.createInvite(
        { grantsAdmin: input.grantsAdmin, expiresAt: input.expiresAt ?? null },
        req.user!.id,
      );
      res.status(201).json({
        invite: { code: invite.code, grantsAdmin: invite.grantsAdmin, expiresAt: invite.expiresAt },
      });
    }),
  );

  router.get(
    "/teams",
    asyncHandler(async (_req, res) => {
      res.json({ teams: await roster.listTeams() });
    }),
  );

  router.post(
    "/teams",
    asyncHandler(async (req, res) => {
      const { name } = parse(createTeamSchema, req.body);
      res.status(201).json({ team: await roster.createTeam(name) });
    }),
  );

  router.delete(
    "/teams/:id",
    asyncHandler(async (req, res) => {
      await roster.removeTeam(requireParam(req, "id"));
      res.status(204).end();
    }),
  );

  router.post(
    "/teams/auto-balance",
    asyncHandler(async (_req, res) => {
      res.json({ teams: await roster.autoBalance() });
    }),
  );

  router.post(
    "/teams/:id/members",
    asyncHandler(async (req, res) => {
      const { userId, role } = parse(assignMemberSchema, req.body);
      await roster.assignMember(userId, requireParam(req, "id"), role);
      res.status(204).end();
    }),
  );

  router.delete(
    "/teams/:id/members/:userId",
    asyncHandler(async (req, res) => {
      await roster.removeMember(requireParam(req, "userId"));
      res.status(204).end();
    }),
  );

  router.post(
    "/teams/:id/captain",
    asyncHandler(async (req, res) => {
      const { userId } = parse(setCaptainSchema, req.body);
      await roster.setCaptain(requireParam(req, "id"), userId);
      res.status(204).end();
    }),
  );

  // --- Tournament config, schedule & courts (Part 2) ----------------------

  router.get(
    "/tournament/config",
    asyncHandler(async (_req, res) => {
      res.json({ config: await schedule.getConfig() });
    }),
  );

  router.patch(
    "/tournament/config",
    asyncHandler(async (req, res) => {
      const patch = parse(updateConfigSchema, req.body);
      res.json({ config: await schedule.updateConfig(patch) });
    }),
  );

  router.post(
    "/schedule/generate",
    asyncHandler(async (_req, res) => {
      res.status(201).json({ schedule: await schedule.generate() });
    }),
  );

  router.post(
    "/schedule/reset",
    asyncHandler(async (_req, res) => {
      await schedule.reset();
      res.status(204).end();
    }),
  );

  router.patch(
    "/matchups/:id",
    asyncHandler(async (req, res) => {
      const { teamAId, teamBId } = parse(editMatchupSchema, req.body);
      await schedule.editMatchup(requireParam(req, "id"), teamAId, teamBId);
      res.status(204).end();
    }),
  );

  router.get(
    "/courts",
    asyncHandler(async (_req, res) => {
      res.json({ courts: await schedule.listCourts() });
    }),
  );

  router.patch(
    "/courts/:id",
    asyncHandler(async (req, res) => {
      const { label } = parse(renameCourtSchema, req.body);
      res.json({ court: await schedule.renameCourt(requireParam(req, "id"), label) });
    }),
  );

  router.patch(
    "/games/:id",
    asyncHandler(async (req, res) => {
      const { courtId } = parse(reassignCourtSchema, req.body);
      await schedule.reassignCourt(requireParam(req, "id"), courtId);
      res.status(204).end();
    }),
  );

  return router;
}
