import { randomBytes } from "node:crypto";
import { makePrismaSystemRepo } from "../adapters/db/prisma/systemRepo.js";
import { makePrismaUnitOfWork } from "../adapters/db/prisma/unitOfWork.js";
import { makePrismaUserRepo } from "../adapters/db/prisma/userRepo.js";
import { makePrismaTeamRepo } from "../adapters/db/prisma/teamRepo.js";
import { makePrismaMembershipRepo } from "../adapters/db/prisma/membershipRepo.js";
import { makePrismaInviteRepo } from "../adapters/db/prisma/inviteRepo.js";
import { makePrismaTournamentRepo } from "../adapters/db/prisma/tournamentRepo.js";
import { makePrismaCourtRepo } from "../adapters/db/prisma/courtRepo.js";
import { makePrismaMatchupRepo } from "../adapters/db/prisma/matchupRepo.js";
import { makePrismaGameRepo } from "../adapters/db/prisma/gameRepo.js";
import { makePrismaLineupRepo } from "../adapters/db/prisma/lineupRepo.js";
import { makePrismaSuddenDeathRepo } from "../adapters/db/prisma/suddenDeathRepo.js";
import { makePrismaCoinLedgerRepo } from "../adapters/db/prisma/coinLedgerRepo.js";
import { makeBcryptHasher } from "../adapters/security/bcryptHasher.js";
import { makeJwtTokenService } from "../adapters/security/jwtTokenService.js";
import { makeAuthMiddleware, type AuthMiddleware } from "../adapters/http/express/middleware/auth.js";
import { makeHealthService, type HealthService } from "../services/healthService.js";
import { makeAuthService, type AuthService } from "../services/authService.js";
import { makeTournamentService, type TournamentService } from "../services/tournamentService.js";
import { makeRosterService, type RosterService } from "../services/rosterService.js";
import { makeScheduleService, type ScheduleService } from "../services/scheduleService.js";
import { makeLineupService, type LineupService } from "../services/lineupService.js";
import { makeResultsService, type ResultsService } from "../services/resultsService.js";
import { makePlayoffsService, type PlayoffsService } from "../services/playoffsService.js";
import { makeSuddenDeathService, type SuddenDeathService } from "../services/suddenDeathService.js";
import type { UnitOfWork } from "../ports/index.js";
import type { Env } from "./env.js";

export interface Container {
  env: Env;
  unitOfWork: UnitOfWork;
  services: {
    health: HealthService;
    auth: AuthService;
    tournaments: TournamentService;
    roster: RosterService;
    schedule: ScheduleService;
    lineups: LineupService;
    results: ResultsService;
    playoffs: PlayoffsService;
    suddenDeath: SuddenDeathService;
  };
  authMiddleware: AuthMiddleware;
}

/** The single composition root: wires Prisma repos + security adapters into services. */
export function buildContainer(env: Env): Container {
  const system = makePrismaSystemRepo();
  const users = makePrismaUserRepo();
  const teams = makePrismaTeamRepo();
  const memberships = makePrismaMembershipRepo();
  const invites = makePrismaInviteRepo();
  const tournaments = makePrismaTournamentRepo();
  const courts = makePrismaCourtRepo();
  const matchups = makePrismaMatchupRepo();
  const gamesRepo = makePrismaGameRepo();
  const lineups = makePrismaLineupRepo();
  const suddenDeathRepo = makePrismaSuddenDeathRepo();
  // Not yet consumed by any service — Commit 3 wires this into the coin-earning use-case.
  const coinLedger = makePrismaCoinLedgerRepo();
  const unitOfWork = makePrismaUnitOfWork();

  const hasher = makeBcryptHasher();
  const tokens = makeJwtTokenService(env.JWT_SECRET);

  const auth = makeAuthService({
    users,
    invites,
    memberships,
    teams,
    hasher,
    tokens,
    bootstrapAdminCode: env.BOOTSTRAP_ADMIN_CODE,
  });

  const tournamentService = makeTournamentService({ tournaments, memberships });

  const roster = makeRosterService({
    users,
    teams,
    memberships,
    invites,
    tournaments,
    uow: unitOfWork,
    generateCode: () => randomBytes(6).toString("hex"),
  });

  const schedule = makeScheduleService({
    tournaments,
    teams,
    matchups,
    games: gamesRepo,
    courts,
    lineups,
    suddenDeath: suddenDeathRepo,
    uow: unitOfWork,
  });

  const lineupService = makeLineupService({
    tournaments,
    matchups,
    teams,
    memberships,
    users,
    courts,
    lineups,
    games: gamesRepo,
    uow: unitOfWork,
  });

  const results = makeResultsService({
    tournaments,
    matchups,
    teams,
    memberships,
    users,
    courts,
    lineups,
    games: gamesRepo,
    uow: unitOfWork,
  });

  const playoffs = makePlayoffsService({
    tournaments,
    matchups,
    teams,
    games: gamesRepo,
    courts,
    uow: unitOfWork,
  });

  const suddenDeath = makeSuddenDeathService({
    tournaments,
    matchups,
    teams,
    memberships,
    users,
    games: gamesRepo,
    suddenDeath: suddenDeathRepo,
    uow: unitOfWork,
  });

  return {
    env,
    unitOfWork,
    services: {
      health: makeHealthService({ system }),
      auth,
      tournaments: tournamentService,
      roster,
      schedule,
      lineups: lineupService,
      results,
      playoffs,
      suddenDeath,
    },
    authMiddleware: makeAuthMiddleware({ tokens, users }),
  };
}
