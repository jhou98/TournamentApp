import { Router } from "express";
import { z } from "zod";
import { MAX_COIN_ADJUSTMENT } from "../../../../domain/coinRule.js";
import type { RosterService } from "../../../../services/rosterService.js";
import type { ScheduleService } from "../../../../services/scheduleService.js";
import type { ResultsService } from "../../../../services/resultsService.js";
import type { PlayoffsService } from "../../../../services/playoffsService.js";
import type { SuddenDeathService } from "../../../../services/suddenDeathService.js";
import type { EconomyService } from "../../../../services/economyService.js";
import type { BountyService } from "../../../../services/bountyService.js";
import type { PowerupService } from "../../../../services/powerupService.js";
import type { TournamentService } from "../../../../services/tournamentService.js";
import type { AuthMiddleware } from "../middleware/auth.js";
import { makeResolveTournament } from "../middleware/tournament.js";
import { asyncHandler } from "../asyncHandler.js";
import { parse, safeText } from "../validation.js";
import { requireParam } from "../params.js";

const setAdminSchema = z.object({ isAdmin: z.boolean() });
const inviteSchema = z.object({
  grantsAdmin: z.boolean().default(false),
  expiresAt: z.coerce.date().optional(),
});
const createTeamSchema = z.object({ name: safeText({ min: 1, max: 60 }) });
const assignMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["captain", "member"]).optional(),
});
const setCaptainSchema = z.object({ userId: z.string().min(1) });

const positiveInt = z.number().int().positive();
const createTournamentSchema = z.object({
  name: safeText({ min: 1, max: 80 }),
  config: z
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
    .optional(),
});
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
const renameCourtSchema = z.object({ label: safeText({ min: 1, max: 60 }) });
const suddenDeathResultSchema = z.object({
  scoreA: z.number().int().nonnegative(),
  scoreB: z.number().int().nonnegative(),
});
const adjustCoinsSchema = z.object({
  userId: z.string().min(1),
  delta: z
    .number()
    .int("Adjustment amount must be a whole number")
    .refine((n) => n !== 0, { message: "Adjustment amount must be non-zero" })
    .refine((n) => Math.abs(n) <= MAX_COIN_ADJUSTMENT, {
      message: `Adjustment must be between -${MAX_COIN_ADJUSTMENT} and ${MAX_COIN_ADJUSTMENT} coins`,
    }),
  note: safeText({ min: 0, max: 200 }).optional(),
});
const createBountySchema = z.object({
  targetType: z.enum(["player", "team"]),
  // Omit targetId for an OPEN bounty (first player/team to complete it wins).
  targetId: z.string().min(1).optional(),
  description: safeText({ min: 1, max: 200 }),
  coinValue: z.number().int().positive().max(MAX_COIN_ADJUSTMENT),
});
const awardBountySchema = z.object({ winnerId: z.string().min(1).optional() });
const createPowerupSchema = z.object({
  name: safeText({ min: 1, max: 60 }),
  description: safeText({ min: 1, max: 200 }),
  cost: z.number().int().positive().max(MAX_COIN_ADJUSTMENT),
});
const updatePowerupSchema = z
  .object({
    name: safeText({ min: 1, max: 60 }),
    description: safeText({ min: 1, max: 200 }),
    cost: z.number().int().positive().max(MAX_COIN_ADJUSTMENT),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });
const resetCoinsSchema = z.object({ note: safeText({ min: 0, max: 200 }).optional() });

// Coin values feed per-game/streak ledger rows (a 32-bit int column) — bound
// them to the same per-transaction cap so a rule can't overflow the ledger.
const coinInt = z.number().int().min(-MAX_COIN_ADJUSTMENT).max(MAX_COIN_ADJUSTMENT);
const coinRuleSchema = z.object({
  perWin: coinInt,
  perLoss: coinInt,
  perCloseLoss: coinInt.optional(),
  perPointDiff: z.number().min(-MAX_COIN_ADJUSTMENT).max(MAX_COIN_ADJUSTMENT).optional(),
  floor: coinInt.optional(),
  closeLossMargin: z.number().int().positive().optional(),
});
const streakRuleSchema = z.object({
  direction: z.enum(["loss", "win", "both"]),
  tiers: z.array(z.object({ after: z.number().int().positive(), bonus: coinInt })).max(20),
});
const updateRulesSchema = z
  .object({ coinRule: coinRuleSchema.optional(), streakRule: streakRuleSchema.optional() })
  .refine((v) => v.coinRule || v.streakRule, { message: "Provide a coin rule and/or a streak rule" });
// A game edit may enter/edit a score, reassign a court, or both (US9 + Part 2).
const editGameSchema = z
  .object({
    scoreHome: z.number().int().nonnegative().optional(),
    scoreAway: z.number().int().nonnegative().optional(),
    courtId: z.string().min(1).optional(),
  })
  .refine((v) => (v.scoreHome === undefined) === (v.scoreAway === undefined), {
    message: "Provide both scoreHome and scoreAway together",
  })
  .refine((v) => v.scoreHome !== undefined || v.courtId !== undefined, {
    message: "Provide a score and/or a courtId",
  });

export function adminRouter(
  roster: RosterService,
  schedule: ScheduleService,
  results: ResultsService,
  playoffs: PlayoffsService,
  suddenDeath: SuddenDeathService,
  economy: EconomyService,
  bounties: BountyService,
  powerups: PowerupService,
  tournaments: TournamentService,
  mw: AuthMiddleware,
): Router {
  const router = Router();
  router.use(mw.requireAdmin);

  // --- Global admin (not tied to a single tournament) ---------------------

  router.post(
    "/tournaments",
    asyncHandler(async (req, res) => {
      const { name, config } = parse(createTournamentSchema, req.body);
      const tournament = await tournaments.create(req.user!, { name, config });
      res.status(201).json({ tournament });
    }),
  );

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

  // --- Tournament-scoped admin (US28: every route below acts on the
  //     active tournament resolved from the request) -----------------------
  router.use(makeResolveTournament(tournaments));

  router.get(
    "/teams",
    asyncHandler(async (req, res) => {
      res.json({ teams: await roster.listTeams(req.tournamentId!) });
    }),
  );

  router.post(
    "/teams",
    asyncHandler(async (req, res) => {
      const { name } = parse(createTeamSchema, req.body);
      res.status(201).json({ team: await roster.createTeam(req.tournamentId!, name) });
    }),
  );

  router.delete(
    "/teams/:id",
    asyncHandler(async (req, res) => {
      await roster.removeTeam(req.tournamentId!, requireParam(req, "id"));
      res.status(204).end();
    }),
  );

  router.post(
    "/teams/auto-balance",
    asyncHandler(async (req, res) => {
      res.json({ teams: await roster.autoBalance(req.tournamentId!) });
    }),
  );

  router.post(
    "/teams/:id/members",
    asyncHandler(async (req, res) => {
      const { userId, role } = parse(assignMemberSchema, req.body);
      await roster.assignMember(req.tournamentId!, userId, requireParam(req, "id"), role);
      res.status(204).end();
    }),
  );

  router.delete(
    "/teams/:id/members/:userId",
    asyncHandler(async (req, res) => {
      await roster.removeMember(req.tournamentId!, requireParam(req, "userId"));
      res.status(204).end();
    }),
  );

  router.post(
    "/teams/:id/captain",
    asyncHandler(async (req, res) => {
      const { userId } = parse(setCaptainSchema, req.body);
      await roster.setCaptain(req.tournamentId!, requireParam(req, "id"), userId);
      res.status(204).end();
    }),
  );

  // --- Tournament config, schedule & courts (Part 2) ----------------------

  router.get(
    "/tournament/config",
    asyncHandler(async (req, res) => {
      res.json({ config: await schedule.getConfig(req.tournamentId!) });
    }),
  );

  router.patch(
    "/tournament/config",
    asyncHandler(async (req, res) => {
      const patch = parse(updateConfigSchema, req.body);
      res.json({ config: await schedule.updateConfig(req.tournamentId!, patch) });
    }),
  );

  router.post(
    "/schedule/generate",
    asyncHandler(async (req, res) => {
      res.status(201).json({ schedule: await schedule.generate(req.tournamentId!) });
    }),
  );

  router.post(
    "/schedule/reset",
    asyncHandler(async (req, res) => {
      await schedule.reset(req.tournamentId!);
      res.status(204).end();
    }),
  );

  router.patch(
    "/matchups/:id",
    asyncHandler(async (req, res) => {
      const { teamAId, teamBId } = parse(editMatchupSchema, req.body);
      await schedule.editMatchup(req.tournamentId!, requireParam(req, "id"), teamAId, teamBId);
      res.status(204).end();
    }),
  );

  router.get(
    "/courts",
    asyncHandler(async (req, res) => {
      res.json({ courts: await schedule.listCourts(req.tournamentId!) });
    }),
  );

  router.patch(
    "/courts/:id",
    asyncHandler(async (req, res) => {
      const { label } = parse(renameCourtSchema, req.body);
      res.json({ court: await schedule.renameCourt(req.tournamentId!, requireParam(req, "id"), label) });
    }),
  );

  router.patch(
    "/games/:id",
    asyncHandler(async (req, res) => {
      const body = parse(editGameSchema, req.body);
      const gameId = requireParam(req, "id");
      if (body.scoreHome !== undefined && body.scoreAway !== undefined) {
        await results.enterScore(req.tournamentId!, req.user!, gameId, {
          scoreHome: body.scoreHome,
          scoreAway: body.scoreAway,
          ...(body.courtId ? { courtId: body.courtId } : {}),
        });
        // A decided semifinal/final may advance the bracket (create the final /
        // complete the tournament). Idempotent no-op during the round robin.
        await playoffs.sync(req.tournamentId!);
      } else if (body.courtId) {
        await schedule.reassignCourt(req.tournamentId!, gameId, body.courtId);
      }
      res.status(204).end();
    }),
  );

  // --- Playoffs & sudden death (US11 / US12) -------------------------------

  router.post(
    "/playoffs/seed",
    asyncHandler(async (req, res) => {
      await playoffs.seed(req.tournamentId!, req.user!);
      res.status(201).json(await results.getResults(req.tournamentId!, req.user!));
    }),
  );

  router.post(
    "/matchups/:id/sudden-death",
    asyncHandler(async (req, res) => {
      const { scoreA, scoreB } = parse(suddenDeathResultSchema, req.body);
      await suddenDeath.enterResult(req.tournamentId!, req.user!, requireParam(req, "id"), {
        scoreA,
        scoreB,
      });
      await playoffs.sync(req.tournamentId!);
      res.status(204).end();
    }),
  );

  // --- Economy (US17: manual coin adjust / reverse) ------------------------

  router.post(
    "/coins/adjust",
    asyncHandler(async (req, res) => {
      const { userId, delta, note } = parse(adjustCoinsSchema, req.body);
      res.status(201).json(await economy.adjustCoins({ tournamentId: req.tournamentId!, userId, delta, note }));
    }),
  );

  router.post(
    "/coins/reset",
    asyncHandler(async (req, res) => {
      const { note } = parse(resetCoinsSchema, req.body);
      res.json(await economy.resetCoins(req.tournamentId!, note));
    }),
  );

  // --- Economy rules (US: coin + streak rule config editing) --------------

  router.get(
    "/tournament/rules",
    asyncHandler(async (req, res) => {
      res.json({ rules: await economy.getRules(req.tournamentId!) });
    }),
  );

  router.patch(
    "/tournament/rules",
    asyncHandler(async (req, res) => {
      const patch = parse(updateRulesSchema, req.body);
      res.json({ rules: await economy.updateRules(req.tournamentId!, patch) });
    }),
  );

  // --- Bounties (US16: admin creates, awards, removes) --------------------

  router.get(
    "/bounties",
    asyncHandler(async (req, res) => {
      res.json({ bounties: await bounties.listByTournament(req.tournamentId!) });
    }),
  );

  router.post(
    "/bounties",
    asyncHandler(async (req, res) => {
      const input = parse(createBountySchema, req.body);
      res.status(201).json({ bounty: await bounties.create({ tournamentId: req.tournamentId!, ...input }) });
    }),
  );

  router.post(
    "/bounties/:id/award",
    asyncHandler(async (req, res) => {
      const { winnerId } = parse(awardBountySchema, req.body ?? {});
      res.json(await bounties.award(req.tournamentId!, requireParam(req, "id"), winnerId));
    }),
  );

  router.delete(
    "/bounties/:id",
    asyncHandler(async (req, res) => {
      await bounties.remove(req.tournamentId!, requireParam(req, "id"));
      res.status(204).end();
    }),
  );

  // --- Powerups / shop catalog (US19: admin creates, edits, removes) ------

  router.get(
    "/powerups",
    asyncHandler(async (req, res) => {
      res.json({ powerups: await powerups.listByTournament(req.tournamentId!) });
    }),
  );

  router.post(
    "/powerups",
    asyncHandler(async (req, res) => {
      const input = parse(createPowerupSchema, req.body);
      res.status(201).json({ powerup: await powerups.create({ tournamentId: req.tournamentId!, ...input }) });
    }),
  );

  router.patch(
    "/powerups/:id",
    asyncHandler(async (req, res) => {
      const patch = parse(updatePowerupSchema, req.body);
      res.json({ powerup: await powerups.update(req.tournamentId!, requireParam(req, "id"), patch) });
    }),
  );

  router.delete(
    "/powerups/:id",
    asyncHandler(async (req, res) => {
      await powerups.remove(req.tournamentId!, requireParam(req, "id"));
      res.status(204).end();
    }),
  );

  return router;
}
