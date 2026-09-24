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
import { makePrismaBountyRepo } from "../adapters/db/prisma/bountyRepo.js";
import { makePrismaPowerupRepo } from "../adapters/db/prisma/powerupRepo.js";
import { makePrismaPurchaseRepo } from "../adapters/db/prisma/purchaseRepo.js";
import { makePrismaPotluckRsvpRepo } from "../adapters/db/prisma/potluckRsvpRepo.js";
import { makePrismaGamePowerupUseRepo } from "../adapters/db/prisma/gamePowerupUseRepo.js";
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
import { makeEconomyService, type EconomyService } from "../services/economyService.js";
import { makeBountyService, type BountyService } from "../services/bountyService.js";
import { makePowerupService, type PowerupService } from "../services/powerupService.js";
import { makeShopService, type ShopService } from "../services/shopService.js";
import { makePotluckService, type PotluckService } from "../services/potluckService.js";
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
    economy: EconomyService;
    bounties: BountyService;
    powerups: PowerupService;
    shop: ShopService;
    potluck: PotluckService;
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
  const coinLedger = makePrismaCoinLedgerRepo();
  const bountyRepo = makePrismaBountyRepo();
  const powerupRepo = makePrismaPowerupRepo();
  const purchaseRepo = makePrismaPurchaseRepo();
  const potluckRsvpRepo = makePrismaPotluckRsvpRepo();
  const gamePowerupUseRepo = makePrismaGamePowerupUseRepo();
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
    registrationCode: env.REGISTRATION_CODE,
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

  const economy = makeEconomyService({
    tournaments,
    games: gamesRepo,
    lineups,
    matchups,
    memberships,
    users,
    teams,
    coinLedger,
    uow: unitOfWork,
  });

  const bounties = makeBountyService({
    bounties: bountyRepo,
    coinLedger,
    tournaments,
    teams,
    memberships,
    users,
    uow: unitOfWork,
  });

  const powerups = makePowerupService({ powerups: powerupRepo });
  const shop = makeShopService({
    powerups: powerupRepo,
    purchases: purchaseRepo,
    coinLedger,
    memberships,
    games: gamesRepo,
    gamePowerupUses: gamePowerupUseRepo,
    matchups,
    lineups,
    tournaments,
    uow: unitOfWork,
  });

  const potluck = makePotluckService({ rsvps: potluckRsvpRepo, tournaments, users });

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
    economy,
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
    economy,
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
      economy,
      bounties,
      powerups,
      shop,
      potluck,
    },
    authMiddleware: makeAuthMiddleware({ tokens, users }),
  };
}
