import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { generateRoundRobin } from "../domain/roundRobin.js";
import { layoutGames } from "../domain/scheduleLayout.js";
import type {
  CourtRecord,
  CourtRepo,
  GameRepo,
  LineupRepo,
  MatchupRepo,
  NewGame,
  NewMatchup,
  SuddenDeathRepo,
  TeamRepo,
  TournamentConfig,
  TournamentDetail,
  TournamentRepo,
  TournamentStatus,
  UnitOfWork,
} from "../ports/index.js";

export interface ScheduleGameView {
  id: string;
  roundNo: number;
  courtId: string | null;
  courtLabel: string | null;
  status: string;
}

export interface ScheduleMatchupView {
  id: string;
  roundIndex: number | null;
  stage: string;
  status: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  games: ScheduleGameView[];
}

export interface ScheduleRoundView {
  roundIndex: number;
  matchups: ScheduleMatchupView[];
}

export interface ScheduleView {
  status: TournamentStatus;
  courts: CourtRecord[];
  rounds: ScheduleRoundView[];
}

export interface ScheduleServiceDeps {
  tournaments: TournamentRepo;
  teams: TeamRepo;
  matchups: MatchupRepo;
  games: GameRepo;
  courts: CourtRepo;
  lineups: LineupRepo;
  suddenDeath: SuddenDeathRepo;
  uow: UnitOfWork;
}

export interface ScheduleService {
  getConfig(tournamentId: string): Promise<TournamentDetail>;
  updateConfig(tournamentId: string, patch: Partial<TournamentConfig>): Promise<TournamentDetail>;
  listCourts(tournamentId: string): Promise<CourtRecord[]>;
  renameCourt(tournamentId: string, courtId: string, label: string): Promise<CourtRecord>;
  reassignCourt(tournamentId: string, gameId: string, courtId: string): Promise<void>;
  editMatchup(tournamentId: string, matchupId: string, teamAId: string, teamBId: string): Promise<void>;
  generate(tournamentId: string): Promise<ScheduleView>;
  getSchedule(tournamentId: string): Promise<ScheduleView>;
  reset(tournamentId: string): Promise<void>;
}

const CONFIG_KEYS: (keyof TournamentConfig)[] = [
  "teamCount",
  "teamSize",
  "pairSize",
  "pairsPerLineup",
  "roundsPerMatchup",
  "roundRobinCycles",
  "playoffQualifiers",
  "courtCount",
];

export function makeScheduleService(deps: ScheduleServiceDeps): ScheduleService {
  async function requireTournament(tournamentId: string): Promise<TournamentDetail> {
    const t = await deps.tournaments.getDetail(tournamentId);
    if (!t) throw new ValidationError("No tournament exists yet");
    return t;
  }

  /** Lazily seed the court list from `courtCount` the first time courts are needed. */
  async function ensureCourts(t: TournamentDetail): Promise<CourtRecord[]> {
    const existing = await deps.courts.listByTournament(t.id);
    if (existing.length > 0) return existing;
    return deps.courts.createMany(t.id, defaultCourtLabels(t.courtCount));
  }

  function buildView(
    status: TournamentStatus,
    matchupViews: Awaited<ReturnType<MatchupRepo["listByTournament"]>>,
    courts: CourtRecord[],
  ): ScheduleView {
    const courtLabel = new Map(courts.map((c) => [c.id, c.label]));
    const byRound = new Map<number, ScheduleMatchupView[]>();

    for (const m of matchupViews) {
      const view: ScheduleMatchupView = {
        id: m.id,
        roundIndex: m.roundIndex,
        stage: m.stage,
        status: m.status,
        teamAId: m.teamAId,
        teamAName: m.teamAName,
        teamBId: m.teamBId,
        teamBName: m.teamBName,
        games: m.games.map((g) => ({
          id: g.id,
          roundNo: g.roundNo,
          courtId: g.courtId,
          courtLabel: g.courtId ? (courtLabel.get(g.courtId) ?? null) : null,
          status: g.status,
        })),
      };
      const key = m.roundIndex ?? 0;
      const list = byRound.get(key) ?? [];
      list.push(view);
      byRound.set(key, list);
    }

    const rounds: ScheduleRoundView[] = [...byRound.entries()]
      .sort(([a], [b]) => a - b)
      .map(([roundIndex, matchups]) => ({ roundIndex, matchups }));

    return { status, courts, rounds };
  }

  async function getSchedule(tournamentId: string): Promise<ScheduleView> {
    const t = await requireTournament(tournamentId);
    const [matchupViews, courts] = await Promise.all([
      deps.matchups.listByTournament(t.id),
      ensureCourts(t),
    ]);
    return buildView(t.status, matchupViews, courts);
  }

  return {
    async getConfig(tournamentId) {
      return requireTournament(tournamentId);
    },

    async updateConfig(tournamentId, patch) {
      const t = await requireTournament(tournamentId);
      if (t.status !== "setup") {
        throw new ConflictError("Config can only be edited while the tournament is in setup");
      }

      const clean: Partial<TournamentConfig> = {};
      for (const key of CONFIG_KEYS) {
        const value = patch[key];
        if (value === undefined) continue;
        if (!Number.isInteger(value) || value < 1) {
          throw new ValidationError(`${key} must be a positive integer`);
        }
        clean[key] = value;
      }

      const merged = { ...t, ...clean };
      if (merged.teamCount < 2) throw new ValidationError("teamCount must be at least 2");
      if (merged.playoffQualifiers > merged.teamCount) {
        throw new ValidationError("playoffQualifiers cannot exceed teamCount");
      }

      return deps.uow.run(async () => {
        const updated = await deps.tournaments.updateConfig(t.id, clean);
        // Keep the court list in sync when the count changes (safe: no games in setup).
        if (clean.courtCount !== undefined) {
          await deps.courts.deleteByTournament(t.id);
          await deps.courts.createMany(t.id, defaultCourtLabels(updated.courtCount));
        }
        return updated;
      });
    },

    async listCourts(tournamentId) {
      const t = await requireTournament(tournamentId);
      return ensureCourts(t);
    },

    async renameCourt(tournamentId, courtId, label) {
      const t = await requireTournament(tournamentId);
      const court = await deps.courts.findById(courtId);
      if (!court || court.tournamentId !== t.id) throw new NotFoundError("Court not found");
      return deps.courts.rename(courtId, label);
    },

    async reassignCourt(tournamentId, gameId, courtId) {
      const t = await requireTournament(tournamentId);
      const game = await deps.games.findById(gameId);
      if (!game) throw new NotFoundError("Game not found");
      const gameMatchup = await deps.matchups.findById(game.matchupId);
      if (!gameMatchup || gameMatchup.tournamentId !== t.id) throw new NotFoundError("Game not found");
      const court = await deps.courts.findById(courtId);
      if (!court || court.tournamentId !== t.id) throw new NotFoundError("Court not found");
      await deps.games.setCourt(gameId, courtId);
    },

    async editMatchup(tournamentId, matchupId, teamAId, teamBId) {
      const t = await requireTournament(tournamentId);
      if (teamAId === teamBId) throw new ValidationError("A matchup needs two different teams");
      const matchup = await deps.matchups.findById(matchupId);
      if (!matchup || matchup.tournamentId !== t.id) throw new NotFoundError("Matchup not found");
      for (const id of [teamAId, teamBId]) {
        const team = await deps.teams.findById(id);
        if (!team || team.tournamentId !== t.id) throw new NotFoundError("Team not found");
      }
      await deps.matchups.updateTeams(matchupId, teamAId, teamBId);
    },

    async generate(tournamentId) {
      const t = await requireTournament(tournamentId);
      if (t.status !== "setup") {
        throw new ConflictError("Schedule can only be generated while the tournament is in setup");
      }

      const teams = await deps.teams.listByTournament(t.id);
      if (teams.length !== t.teamCount) {
        throw new ValidationError(
          `Create all ${t.teamCount} teams before generating (have ${teams.length})`,
        );
      }

      const courts = await ensureCourts(t);
      if (courts.length < 1) throw new ValidationError("At least one court is required");

      const rrMatchups = generateRoundRobin(
        teams.map((team) => team.id),
        t.roundRobinCycles,
      );
      const slots = layoutGames({
        matchups: rrMatchups,
        roundsPerMatchup: t.roundsPerMatchup,
        pairsPerLineup: t.pairsPerLineup,
        courtCount: courts.length,
      });

      await deps.uow.run(async () => {
        // Clean slate in case a prior partial schedule lingers (order matters:
        // games, lineups, and sudden-death rows reference matchups).
        await deps.suddenDeath.deleteByTournament(t.id);
        await deps.games.deleteByTournament(t.id);
        await deps.lineups.deleteByTournament(t.id);
        await deps.matchups.deleteByTournament(t.id);

        const newMatchups: NewMatchup[] = rrMatchups.map((m) => ({
          stage: "round_robin",
          roundIndex: m.roundIndex,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
        }));
        const created = await deps.matchups.createMany(t.id, newMatchups);

        const newGames: NewGame[] = slots.map((s) => ({
          matchupId: created[s.matchupIndex]!.id,
          roundNo: s.roundNo,
          courtId: courts[s.courtIndex]!.id,
        }));
        await deps.games.createMany(newGames);

        await deps.tournaments.setStatus(t.id, "round_robin");
      });

      return getSchedule(t.id);
    },

    getSchedule,

    async reset(tournamentId) {
      const t = await requireTournament(tournamentId);
      if (t.status === "setup") return;
      const finalGames = await deps.games.countByStatus(t.id, "final");
      if (finalGames > 0) {
        throw new ConflictError("Cannot reset a schedule that already has finalized games");
      }
      await deps.uow.run(async () => {
        await deps.suddenDeath.deleteByTournament(t.id);
        await deps.games.deleteByTournament(t.id);
        await deps.lineups.deleteByTournament(t.id);
        await deps.matchups.deleteByTournament(t.id);
        await deps.tournaments.setStatus(t.id, "setup");
      });
    },
  };
}

function defaultCourtLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Court ${i + 1}`);
}
