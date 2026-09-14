import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../domain/errors.js";
import { computeMatchupResult, type GameResultInput } from "../domain/standings.js";
import type {
  GameRepo,
  MatchupRecord,
  MatchupRepo,
  MembershipRepo,
  PublicUser,
  SuddenDeathRepo,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
  UserRepo,
} from "../ports/index.js";

// Default 1v1 rule from the brief (US12). Configurable later via
// `tournament.suddenDeathRule`; kept as a constant until that's surfaced.
const RULE = { firstTo: 5, winBy: 2, cap: 7 };

export interface SDPlayerView {
  id: string;
  displayName: string;
}

export interface SDTeamView {
  id: string;
  name: string;
  rep: SDPlayerView | null;
  eligible: SDPlayerView[];
}

export interface SuddenDeathState {
  /** Matchup is tied on game wins, awaiting a 1v1 sudden-death decision. */
  active: boolean;
  teamA: SDTeamView;
  teamB: SDTeamView;
  result: { scoreA: number; scoreB: number; winnerTeamId: string; winnerName: string } | null;
}

export interface SuddenDeathService {
  getState(tournamentId: string, user: PublicUser, matchupId: string): Promise<SuddenDeathState>;
  chooseRep(
    tournamentId: string,
    user: PublicUser,
    matchupId: string,
    args: { teamId: string; userId: string },
  ): Promise<void>;
  enterResult(
    tournamentId: string,
    user: PublicUser,
    matchupId: string,
    args: { scoreA: number; scoreB: number },
  ): Promise<void>;
}

export interface SuddenDeathServiceDeps {
  tournaments: TournamentRepo;
  matchups: MatchupRepo;
  teams: TeamRepo;
  memberships: MembershipRepo;
  users: UserRepo;
  games: GameRepo;
  suddenDeath: SuddenDeathRepo;
  uow: UnitOfWork;
}

export function makeSuddenDeathService(deps: SuddenDeathServiceDeps): SuddenDeathService {
  async function requireTournament(tournamentId: string): Promise<TournamentDetail> {
    const t = await deps.tournaments.getDetail(tournamentId);
    if (!t) throw new ValidationError("No tournament exists yet");
    return t;
  }

  async function requireMatchup(id: string, tournamentId: string): Promise<MatchupRecord> {
    const m = await deps.matchups.findById(id);
    if (!m || m.tournamentId !== tournamentId) throw new NotFoundError("Matchup not found");
    return m;
  }

  async function rosterOf(teamId: string): Promise<SDPlayerView[]> {
    const members = await deps.memberships.listByTeam(teamId);
    const players: SDPlayerView[] = [];
    for (const m of members) {
      const u = await deps.users.findById(m.userId);
      if (u) players.push({ id: u.id, displayName: u.displayName });
    }
    return players;
  }

  /** A matchup (round robin or playoffs) whose games are all final but tied on game wins. */
  async function isTiedMatchup(matchup: MatchupRecord, t: TournamentDetail): Promise<boolean> {
    const games = await deps.games.listByMatchup(matchup.id);
    const result = computeMatchupResult(games as GameResultInput[], t.roundsPerMatchup * t.pairsPerLineup);
    return result.tied;
  }

  async function authorizeForTeam(user: PublicUser, matchup: MatchupRecord, teamId: string, tournamentId: string) {
    if (teamId !== matchup.teamAId && teamId !== matchup.teamBId) {
      throw new ValidationError("That team is not in this matchup");
    }
    if (user.isAdmin) return;
    const membership = await deps.memberships.findByUserAndTournament(user.id, tournamentId);
    if (!membership || membership.teamId !== teamId || membership.role !== "captain") {
      throw new ForbiddenError("Only this team's captain or an admin can pick the representative");
    }
  }

  return {
    async getState(tournamentId, _user, matchupId) {
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(matchupId, t.id);
      const [teamA, teamB, rosterA, rosterB, sd] = await Promise.all([
        deps.teams.findById(matchup.teamAId),
        deps.teams.findById(matchup.teamBId),
        rosterOf(matchup.teamAId),
        rosterOf(matchup.teamBId),
        deps.suddenDeath.findByMatchup(matchupId),
      ]);
      if (!teamA || !teamB) throw new NotFoundError("Matchup team not found");

      const nameOf = new Map([...rosterA, ...rosterB].map((p) => [p.id, p.displayName]));
      const repView = (id: string | null): SDPlayerView | null =>
        id ? { id, displayName: nameOf.get(id) ?? id } : null;

      const decided = !!matchup.winnerTeamId;
      const active = (await isTiedMatchup(matchup, t)) && !decided;

      const result =
        sd && sd.scoreA !== null && sd.scoreB !== null && sd.winnerTeamId
          ? {
              scoreA: sd.scoreA,
              scoreB: sd.scoreB,
              winnerTeamId: sd.winnerTeamId,
              winnerName: sd.winnerTeamId === teamA.id ? teamA.name : teamB.name,
            }
          : null;

      return {
        active,
        teamA: { id: teamA.id, name: teamA.name, rep: repView(sd?.teamARep ?? null), eligible: rosterA },
        teamB: { id: teamB.id, name: teamB.name, rep: repView(sd?.teamBRep ?? null), eligible: rosterB },
        result,
      };
    },

    async chooseRep(tournamentId, user, matchupId, { teamId, userId }) {
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(matchupId, t.id);
      await authorizeForTeam(user, matchup, teamId, t.id);

      if (!(await isTiedMatchup(matchup, t))) {
        throw new ConflictError("Sudden death applies only to a tied matchup");
      }
      if (matchup.winnerTeamId) {
        throw new ConflictError("The sudden-death result is already recorded");
      }

      const roster = await rosterOf(teamId);
      if (!roster.some((p) => p.id === userId)) {
        throw new ValidationError("The representative must be a player on that team");
      }

      const side: "A" | "B" = teamId === matchup.teamAId ? "A" : "B";
      await deps.uow.run(async () => {
        const existing = await deps.suddenDeath.findByMatchup(matchupId);
        if (!existing) {
          await deps.suddenDeath.create({
            matchupId,
            teamAId: matchup.teamAId,
            teamBId: matchup.teamBId,
          });
        }
        await deps.suddenDeath.setRep(matchupId, side, userId);
      });
    },

    async enterResult(tournamentId, user, matchupId, { scoreA, scoreB }) {
      if (!user.isAdmin) throw new ForbiddenError("Only an admin can enter the sudden-death result");
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(matchupId, t.id);

      if (!(await isTiedMatchup(matchup, t))) {
        throw new ConflictError("Sudden death applies only to a tied matchup");
      }

      // Admins may re-enter this to correct a mistake — no "already recorded"
      // guard here (unlike chooseRep, which locks reps once decided).
      const sd = await deps.suddenDeath.findByMatchup(matchupId);
      if (!sd?.teamARep || !sd?.teamBRep) {
        throw new ConflictError("Both teams must choose a representative first");
      }

      for (const [label, value] of [
        ["scoreA", scoreA],
        ["scoreB", scoreB],
      ] as const) {
        if (!Number.isInteger(value) || value < 0) {
          throw new ValidationError(`${label} must be a non-negative integer`);
        }
      }
      const hi = Math.max(scoreA, scoreB);
      const lo = Math.min(scoreA, scoreB);
      if (scoreA === scoreB) throw new ValidationError("Sudden death cannot end in a tie");
      if (hi > RULE.cap) throw new ValidationError(`Score is capped at ${RULE.cap}`);
      if (hi < RULE.firstTo) throw new ValidationError(`The winner must reach ${RULE.firstTo}`);
      if (hi < RULE.cap && hi - lo < RULE.winBy) {
        throw new ValidationError(`The winner must lead by ${RULE.winBy} (unless capped at ${RULE.cap})`);
      }

      const winnerTeamId = scoreA > scoreB ? matchup.teamAId : matchup.teamBId;
      await deps.uow.run(async () => {
        await deps.suddenDeath.setResult(matchupId, { scoreA, scoreB, winnerTeamId });
        await deps.matchups.setResult(matchupId, { status: "final", winnerTeamId });
      });
    },
  };
}
