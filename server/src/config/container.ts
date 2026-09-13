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
import { makeBcryptHasher } from "../adapters/security/bcryptHasher.js";
import { makeJwtTokenService } from "../adapters/security/jwtTokenService.js";
import { makeAuthMiddleware, type AuthMiddleware } from "../adapters/http/express/middleware/auth.js";
import { makeHealthService, type HealthService } from "../services/healthService.js";
import { makeAuthService, type AuthService } from "../services/authService.js";
import { makeRosterService, type RosterService } from "../services/rosterService.js";
import { makeScheduleService, type ScheduleService } from "../services/scheduleService.js";
import type { UnitOfWork } from "../ports/index.js";
import type { Env } from "./env.js";

export interface Container {
  env: Env;
  unitOfWork: UnitOfWork;
  services: {
    health: HealthService;
    auth: AuthService;
    roster: RosterService;
    schedule: ScheduleService;
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
  const unitOfWork = makePrismaUnitOfWork();

  const hasher = makeBcryptHasher();
  const tokens = makeJwtTokenService(env.JWT_SECRET);

  const auth = makeAuthService({
    users,
    invites,
    memberships,
    teams,
    tournaments,
    hasher,
    tokens,
    bootstrapAdminCode: env.BOOTSTRAP_ADMIN_CODE,
  });

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
    uow: unitOfWork,
  });

  return {
    env,
    unitOfWork,
    services: {
      health: makeHealthService({ system }),
      auth,
      roster,
      schedule,
    },
    authMiddleware: makeAuthMiddleware({ tokens, users }),
  };
}
