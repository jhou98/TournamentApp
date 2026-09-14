import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import {
  computeMatchupResult,
  computeStandings,
  type GameResultInput,
  type StandingRow,
} from "../domain/standings.js";
import type { EconomyService } from "./economyService.js";
import type {
  CourtRepo,
  GameRecord,
  GameRepo,
  LineupRepo,
  MatchupRepo,
  MatchupStatus,
  MembershipRepo,
  PublicUser,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
  UserRepo,
} from "../ports/index.js";

// --- Read-model shapes ------------------------------------------------------

export interface ResultPlayerView {
  id: string;
  displayName: string;
}

export interface ResultGameView {
  id: string;
  roundNo: number;
  courtLabel: string | null;
  status: string;
  homePlayers: ResultPlayerView[];
  awayPlayers: ResultPlayerView[];
  scoreHome: number | null;
  scoreAway: number | null;
  /** "A" (home/teamA) or "B" (away/teamB) when scored, else null. */
  winner: "A" | "B" | null;
}

export interface ResultMatchView {
  roundNo: number;
  /** Game wins within this match (one doubles round). */
  roundScore: { teamA: number; teamB: number };
  games: ResultGameView[];
}

export interface ResultMatchupView {
  id: string;
  stage: string;
  roundIndex: number | null;
  status: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
  /** Total game wins across the whole matchup. */
  matchupScore: { teamA: number; teamB: number };
  decided: boolean;
  tied: boolean;
  matches: ResultMatchView[];
}

export interface ResultsView {
  status: string;
  isAdmin: boolean;
  matchups: ResultMatchupView[];
}

export interface StandingsView {
  status: string;
  rows: StandingRow[];
}

// --- Service ----------------------------------------------------------------

export interface ResultsServiceDeps {
  tournaments: TournamentRepo;
  matchups: MatchupRepo;
  teams: TeamRepo;
  memberships: MembershipRepo;
  users: UserRepo;
  courts: CourtRepo;
  lineups: LineupRepo;
  games: GameRepo;
  uow: UnitOfWork;
  economy: EconomyService;
}

export interface EnterScoreInput {
  scoreHome: number;
  scoreAway: number;
  courtId?: string;
}

export interface ResultsService {
  enterScore(
    tournamentId: string,
    user: PublicUser,
    gameId: string,
    input: EnterScoreInput,
  ): Promise<void>;
  getResults(tournamentId: string, user: PublicUser): Promise<ResultsView>;
  getStandings(tournamentId: string): Promise<StandingsView>;
}

export function makeResultsService(deps: ResultsServiceDeps): ResultsService {
  async function requireTournament(tournamentId: string): Promise<TournamentDetail> {
    const t = await deps.tournaments.getDetail(tournamentId);
    if (!t) throw new ValidationError("No tournament exists yet");
    return t;
  }

  /** Name lookup for every player in the tournament (bounded, ~24 users). */
  async function nameMap(tournamentId: string): Promise<Map<string, string>> {
    const members = await deps.memberships.listByTournament(tournamentId);
    const names = new Map<string, string>();
    for (const m of members) {
      const user = await deps.users.findById(m.userId);
      if (user) names.set(user.id, user.displayName);
    }
    return names;
  }

  /** Recompute and persist a matchup's derived outcome from its games. */
  async function recomputeMatchup(matchupId: string, t: TournamentDetail): Promise<void> {
    const matchup = await deps.matchups.findById(matchupId);
    if (!matchup) return;
    const games = await deps.games.listByMatchup(matchupId);
    const totalGames = t.roundsPerMatchup * t.pairsPerLineup;
    const result = computeMatchupResult(games as GameResultInput[], totalGames);

    let status: MatchupStatus;
    let winnerTeamId: string | null;
    if (result.decided) {
      status = "final";
      winnerTeamId = result.winner === "A" ? matchup.teamAId : matchup.teamBId;
    } else if (result.allFinal && result.tied) {
      // A level game tally never finalizes as a draw — every stage (round robin
      // included) goes to sudden death, so the matchup stays open.
      status = "in_progress";
      winnerTeamId = null;
    } else if (result.finalGames > 0) {
      status = "in_progress";
      winnerTeamId = null;
    } else {
      status = "scheduled";
      winnerTeamId = null;
    }
    await deps.matchups.setResult(matchupId, { status, winnerTeamId });
  }

  return {
    async enterScore(tournamentId, user, gameId, input) {
      if (!user.isAdmin) throw new ConflictError("Only an admin can enter scores");
      const t = await requireTournament(tournamentId);

      const game = await deps.games.findById(gameId);
      if (!game) throw new NotFoundError("Game not found");
      const matchup = await deps.matchups.findById(game.matchupId);
      if (!matchup || matchup.tournamentId !== t.id) throw new NotFoundError("Game not found");

      if (game.status === "awaiting_lineups" || !game.homePairId || !game.awayPairId) {
        throw new ConflictError("Lock both lineups so pairs are assigned before entering a score");
      }

      const { scoreHome, scoreAway } = input;
      for (const [label, value] of [
        ["scoreHome", scoreHome],
        ["scoreAway", scoreAway],
      ] as const) {
        if (!Number.isInteger(value) || value < 0) {
          throw new ValidationError(`${label} must be a non-negative integer`);
        }
      }
      if (scoreHome === scoreAway) {
        throw new ValidationError("A game cannot end in a tie — one side must win");
      }

      if (input.courtId) {
        const court = await deps.courts.findById(input.courtId);
        if (!court || court.tournamentId !== t.id) throw new NotFoundError("Court not found");
      }

      const winnerPairId = scoreHome > scoreAway ? game.homePairId : game.awayPairId;

      await deps.uow.run(async () => {
        await deps.games.setScore(gameId, {
          scoreHome,
          scoreAway,
          winnerPairId,
          finalizedBy: user.id,
          ...(input.courtId ? { courtId: input.courtId } : {}),
        });
        await recomputeMatchup(game.matchupId, t);
        await deps.economy.recomputeTournamentLedger(t.id);
      });
    },

    async getResults(tournamentId, user) {
      const t = await requireTournament(tournamentId);
      const [matchupViews, courts, names] = await Promise.all([
        deps.matchups.listByTournament(t.id),
        deps.courts.listByTournament(t.id),
        nameMap(t.id),
      ]);
      const courtLabel = new Map(courts.map((c) => [c.id, c.label]));

      const matchups: ResultMatchupView[] = [];
      for (const m of matchupViews) {
        const [games, lineups] = await Promise.all([
          deps.games.listByMatchup(m.id),
          deps.lineups.listByMatchup(m.id),
        ]);
        const pairById = new Map(lineups.flatMap((l) => l.pairs).map((p) => [p.id, p]));
        const playersOf = (pairId: string | null): ResultPlayerView[] => {
          if (!pairId) return [];
          const pair = pairById.get(pairId);
          return (pair?.playerIds ?? []).map((id) => ({ id, displayName: names.get(id) ?? id }));
        };
        const winnerOf = (g: GameRecord): "A" | "B" | null => {
          if (g.scoreHome === null || g.scoreAway === null) return null;
          if (g.scoreHome > g.scoreAway) return "A";
          if (g.scoreAway > g.scoreHome) return "B";
          return null;
        };

        const byRound = new Map<number, GameRecord[]>();
        for (const g of games) byRound.set(g.roundNo, [...(byRound.get(g.roundNo) ?? []), g]);

        const matches: ResultMatchView[] = [...byRound.entries()]
          .sort(([a], [b]) => a - b)
          .map(([roundNo, roundGames]) => {
            let teamA = 0;
            let teamB = 0;
            for (const g of roundGames) {
              const w = winnerOf(g);
              if (w === "A") teamA++;
              else if (w === "B") teamB++;
            }
            return {
              roundNo,
              roundScore: { teamA, teamB },
              games: roundGames.map((g) => ({
                id: g.id,
                roundNo: g.roundNo,
                courtLabel: g.courtId ? (courtLabel.get(g.courtId) ?? null) : null,
                status: g.status,
                homePlayers: playersOf(g.homePairId),
                awayPlayers: playersOf(g.awayPairId),
                scoreHome: g.scoreHome,
                scoreAway: g.scoreAway,
                winner: winnerOf(g),
              })),
            };
          });

        const totalGames = t.roundsPerMatchup * t.pairsPerLineup;
        const tally = computeMatchupResult(games as GameResultInput[], totalGames);

        matchups.push({
          id: m.id,
          stage: m.stage,
          roundIndex: m.roundIndex,
          status: m.status,
          teamAId: m.teamAId,
          teamAName: m.teamAName,
          teamBId: m.teamBId,
          teamBName: m.teamBName,
          winnerTeamId: m.winnerTeamId,
          winnerTeamName:
            m.winnerTeamId === m.teamAId
              ? m.teamAName
              : m.winnerTeamId === m.teamBId
                ? m.teamBName
                : null,
          matchupScore: { teamA: tally.homeWins, teamB: tally.awayWins },
          decided: tally.decided,
          tied: tally.tied,
          matches,
        });
      }

      return { status: t.status, isAdmin: user.isAdmin, matchups };
    },

    async getStandings(tournamentId) {
      const t = await requireTournament(tournamentId);
      const [teams, matchupViews, games] = await Promise.all([
        deps.teams.listByTournament(t.id),
        deps.matchups.listByTournament(t.id),
        deps.games.listByTournament(t.id),
      ]);
      // Standings (and playoff seeding) come from round-robin play only.
      const rrMatchups = matchupViews.filter((m) => m.stage === "round_robin");
      const rrMatchupIds = new Set(rrMatchups.map((m) => m.id));
      const rows = computeStandings(
        teams.map((team) => ({ id: team.id, name: team.name })),
        rrMatchups.map((m) => ({
          id: m.id,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          winnerTeamId: m.winnerTeamId,
          status: m.status,
        })),
        (games as GameResultInput[]).filter((g) => rrMatchupIds.has(g.matchupId)),
      );
      return { status: t.status, rows };
    },
  };
}
