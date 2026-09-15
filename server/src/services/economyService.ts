/**
 * Ledger recompute engine (US13 core / US14, streaks US15/D16).
 *
 * On every score finalize, the whole tournament's DERIVED coin rows
 * (match_result + streak_bonus) are deleted and re-inserted from scratch
 * (idempotent by construction — editing a score reverses+reapplies
 * correctly). Playoff games — and playoff matchups, for streaks — earn coins
 * too; there is no filter to round-robin.
 */

import { NotFoundError, ValidationError } from "../domain/errors.js";
import { MAX_COIN_ADJUSTMENT } from "../domain/coinRule.js";
import { computeCoinLeaderboard, type LeaderboardRow } from "../domain/coinLeaderboard.js";
import { computeLedger, type DerivedCoinTxn, type LedgerGameInput } from "../domain/ledger.js";
import { computeStreakBonuses, type MatchupOutcome, type PlayerOutcomes } from "../domain/streak.js";
import type {
  CoinLedgerRepo,
  CoinReason,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  MatchupRepo,
  MatchupView,
  MembershipRepo,
  TeamRepo,
  TournamentRepo,
  UnitOfWork,
  UserRepo,
} from "../ports/index.js";

export interface EconomyServiceDeps {
  tournaments: TournamentRepo;
  games: GameRepo;
  lineups: LineupRepo;
  matchups: MatchupRepo;
  memberships: MembershipRepo;
  users: UserRepo;
  teams: TeamRepo;
  coinLedger: CoinLedgerRepo;
  uow: UnitOfWork;
}

/** Chronological ordering for streak sequencing: stage, then round, then id. */
const STAGE_RANK: Record<MatchupView["stage"], number> = { round_robin: 0, semifinal: 1, final: 2 };

function compareMatchupsChronologically(a: MatchupView, b: MatchupView): number {
  const stageDiff = STAGE_RANK[a.stage] - STAGE_RANK[b.stage];
  if (stageDiff !== 0) return stageDiff;
  const roundDiff = (a.roundIndex ?? 0) - (b.roundIndex ?? 0);
  if (roundDiff !== 0) return roundDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Every distinct playerId appearing in any pair of any of the matchup's lineups, grouped by team. */
function participantsByTeam(lineups: LineupWithPairs[]): Map<string, Set<string>> {
  const byTeam = new Map<string, Set<string>>();
  for (const lineup of lineups) {
    const set = byTeam.get(lineup.teamId) ?? new Set<string>();
    for (const pair of lineup.pairs) {
      for (const playerId of pair.playerIds) set.add(playerId);
    }
    byTeam.set(lineup.teamId, set);
  }
  return byTeam;
}

/**
 * The match a `match_result` transaction was earned in, oriented to the player
 * (their side's score first). Populated only for `match_result` rows whose game
 * and lineups can still be resolved; null otherwise.
 */
export interface CoinMatchDetail {
  matchupId: string;
  stage: MatchupView["stage"];
  /** Round-robin round number (null for playoff stages). */
  roundIndex: number | null;
  /** The match (doubles round) within the matchup this game belonged to. */
  roundNo: number;
  opponentTeamName: string;
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
}

/** One coin-ledger entry, shaped for the client (createdAt as an ISO string). */
export interface CoinTransactionView {
  id: string;
  delta: number;
  reason: CoinReason;
  note: string | null;
  gameId: string | null;
  createdAt: string;
  /** Match context for `match_result` rows; null for other reasons. */
  match: CoinMatchDetail | null;
}

/** A player's coin balance and history within one tournament (US16). */
export interface CoinSummaryView {
  /** Tournament-scoped balance = SUM(delta); 0 when the player has no entries. */
  balance: number;
  transactions: CoinTransactionView[];
}

/** Every player of a tournament, ranked by coin balance (US17). */
export interface LeaderboardView {
  rows: LeaderboardRow[];
}

/** The result of a manual admin coin adjustment (US17): the new balance + the row written. */
export interface CoinAdjustResult {
  /** The player's tournament balance after the adjustment. */
  balance: number;
  transaction: CoinTransactionView;
}

export interface EconomyService {
  /** Recompute (delete + re-insert) the tournament's derived coin rows from its finalized games. */
  recomputeTournamentLedger(tournamentId: string): Promise<void>;
  /** One player's coin balance + transaction history for a tournament (newest first). */
  getCoinSummary(tournamentId: string, userId: string): Promise<CoinSummaryView>;
  /** All players of a tournament ranked by coin balance (players with no coins rank at 0). */
  getLeaderboard(tournamentId: string): Promise<LeaderboardView>;
  /**
   * Manually credit or debit a player's coins (US17). Writes an auditable
   * `admin_adjust` row — never a delete — so it survives ledger recompute and
   * every change stays in the history. Returns the player's new balance.
   */
  adjustCoins(input: {
    tournamentId: string;
    userId: string;
    delta: number;
    note?: string | null;
  }): Promise<CoinAdjustResult>;
}

export function makeEconomyService(deps: EconomyServiceDeps): EconomyService {
  return {
    async recomputeTournamentLedger(tournamentId) {
      const t = await deps.tournaments.getDetail(tournamentId);
      if (!t) return;

      const allGames = await deps.games.listByTournament(tournamentId);
      const finalGames = allGames.filter(
        (g) =>
          g.status === "final" &&
          g.scoreHome !== null &&
          g.scoreAway !== null &&
          g.homePairId !== null &&
          g.awayPairId !== null,
      );

      const allMatchups = await deps.matchups.listByTournament(tournamentId);
      const decidedMatchups = allMatchups
        .filter((m) => m.status === "final" && m.winnerTeamId)
        .sort(compareMatchupsChronologically);

      // Cache lineups per matchup so the match_result pairById lookup and the
      // streak participants lookup share fetches instead of double-querying.
      const lineupsByMatchup = new Map<string, LineupWithPairs[]>();
      async function lineupsFor(matchupId: string): Promise<LineupWithPairs[]> {
        let ls = lineupsByMatchup.get(matchupId);
        if (!ls) {
          ls = await deps.lineups.listByMatchup(matchupId);
          lineupsByMatchup.set(matchupId, ls);
        }
        return ls;
      }

      // Build pairId -> playerIds across every matchup touched by final games
      // (mirrors resultsService.getResults' pairById pattern).
      const matchupIds = [...new Set(finalGames.map((g) => g.matchupId))];
      const pairById = new Map<string, string[]>();
      for (const matchupId of matchupIds) {
        const lineups = await lineupsFor(matchupId);
        for (const pair of lineups.flatMap((l) => l.pairs)) {
          pairById.set(pair.id, pair.playerIds);
        }
      }

      const inputs: LedgerGameInput[] = [];
      for (const g of finalGames) {
        const homePlayerIds = pairById.get(g.homePairId!);
        const awayPlayerIds = pairById.get(g.awayPairId!);
        if (!homePlayerIds || !awayPlayerIds) continue; // defensive: pair ids not found
        inputs.push({
          gameId: g.id,
          scoreHome: g.scoreHome!,
          scoreAway: g.scoreAway!,
          homePlayerIds,
          awayPlayerIds,
        });
      }

      const matchResultRows = computeLedger(t.coinRule, inputs);

      // Per-player chronological win/loss sequence over decided matchups
      // (round robin and playoff stages alike) for streak bonuses.
      const outcomesByUser = new Map<string, MatchupOutcome[]>();
      for (const m of decidedMatchups) {
        const lineups = await lineupsFor(m.id);
        const teamPlayers = participantsByTeam(lineups);
        for (const [teamId, playerIds] of teamPlayers) {
          const outcome: MatchupOutcome = teamId === m.winnerTeamId ? "win" : "loss";
          for (const playerId of playerIds) {
            const seq = outcomesByUser.get(playerId) ?? [];
            seq.push(outcome);
            outcomesByUser.set(playerId, seq);
          }
        }
      }
      const playerOutcomes: PlayerOutcomes[] = [...outcomesByUser.entries()].map(([userId, outcomes]) => ({
        userId,
        outcomes,
      }));
      const streakRows = computeStreakBonuses(t.streakRule, playerOutcomes);

      const derived: DerivedCoinTxn[] = [...matchResultRows, ...streakRows];

      await deps.uow.run(async () => {
        await deps.coinLedger.deleteDerivedByTournament(tournamentId);
        await deps.coinLedger.createMany(derived.map((d) => ({ ...d, tournamentId })));
      });
    },

    async getCoinSummary(tournamentId, userId) {
      const [balance, rows] = await Promise.all([
        deps.coinLedger.sumByUser(tournamentId, userId),
        deps.coinLedger.listByUser(tournamentId, userId),
      ]);

      // Enrich each match_result row with the game/matchup it was earned in,
      // oriented to this player. Skipped when the game or the player's side can
      // no longer be resolved (the row still renders without a match detail).
      const gameIds = new Set(
        rows.filter((r) => r.reason === "match_result" && r.gameId).map((r) => r.gameId!),
      );
      const matchByGame = new Map<string, CoinMatchDetail>();

      if (gameIds.size > 0) {
        const [games, matchups] = await Promise.all([
          deps.games.listByTournament(tournamentId),
          deps.matchups.listByTournament(tournamentId),
        ]);
        const gameById = new Map(games.map((g) => [g.id, g]));
        const matchupById = new Map(matchups.map((m) => [m.id, m]));

        // pairId -> playerIds, limited to the matchups those games belong to.
        const neededMatchupIds = new Set<string>();
        for (const id of gameIds) {
          const g = gameById.get(id);
          if (g) neededMatchupIds.add(g.matchupId);
        }
        const pairById = new Map<string, string[]>();
        for (const matchupId of neededMatchupIds) {
          const lineups = await deps.lineups.listByMatchup(matchupId);
          for (const pair of lineups.flatMap((l) => l.pairs)) pairById.set(pair.id, pair.playerIds);
        }

        for (const id of gameIds) {
          const g = gameById.get(id);
          if (!g || g.scoreHome === null || g.scoreAway === null) continue;
          const m = matchupById.get(g.matchupId);
          if (!m) continue;

          const homePlayers = g.homePairId ? (pairById.get(g.homePairId) ?? []) : [];
          const awayPlayers = g.awayPairId ? (pairById.get(g.awayPairId) ?? []) : [];
          const onHome = homePlayers.includes(userId);
          const onAway = awayPlayers.includes(userId);
          if (!onHome && !onAway) continue; // can't orient the score to this player

          const scoreFor = onHome ? g.scoreHome : g.scoreAway;
          const scoreAgainst = onHome ? g.scoreAway : g.scoreHome;
          matchByGame.set(id, {
            matchupId: m.id,
            stage: m.stage,
            roundIndex: m.roundIndex,
            roundNo: g.roundNo,
            opponentTeamName: onHome ? m.teamBName : m.teamAName,
            scoreFor,
            scoreAgainst,
            won: scoreFor > scoreAgainst,
          });
        }
      }

      return {
        balance,
        transactions: rows.map((r) => ({
          id: r.id,
          delta: r.delta,
          reason: r.reason,
          note: r.note,
          gameId: r.gameId,
          createdAt: r.createdAt.toISOString(),
          match: r.reason === "match_result" && r.gameId ? (matchByGame.get(r.gameId) ?? null) : null,
        })),
      };
    },

    async getLeaderboard(tournamentId) {
      // The roster comes from memberships (the definitive list of who's in the
      // tournament), so players who haven't earned yet still appear at 0 — coins
      // start at 0 per tournament and never carry over (D6).
      const [balances, memberships, teams] = await Promise.all([
        deps.coinLedger.sumByTournamentGroupedByUser(tournamentId),
        deps.memberships.listByTournament(tournamentId),
        deps.teams.listByTournament(tournamentId),
      ]);
      const balanceByUser = new Map(balances.map((b) => [b.userId, b.balance]));
      const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

      const players = [];
      for (const m of memberships) {
        const user = await deps.users.findById(m.userId);
        if (!user) continue;
        players.push({
          userId: user.id,
          displayName: user.displayName,
          teamId: m.teamId,
          teamName: teamNameById.get(m.teamId) ?? null,
          balance: balanceByUser.get(user.id) ?? 0,
        });
      }

      return { rows: computeCoinLeaderboard(players) };
    },

    async adjustCoins({ tournamentId, userId, delta, note }) {
      if (!Number.isInteger(delta) || delta === 0) {
        throw new ValidationError("Adjustment amount must be a non-zero whole number");
      }
      if (Math.abs(delta) > MAX_COIN_ADJUSTMENT) {
        throw new ValidationError(
          `Adjustment must be between -${MAX_COIN_ADJUSTMENT} and ${MAX_COIN_ADJUSTMENT} coins`,
        );
      }

      // Only players who are in this tournament can be adjusted — coins are
      // tournament-scoped (D6), so an adjustment must target a member of it.
      const membership = await deps.memberships.findByUserAndTournament(userId, tournamentId);
      if (!membership) {
        throw new NotFoundError("Player is not a member of this tournament");
      }

      const row = await deps.coinLedger.create({
        tournamentId,
        userId,
        delta,
        reason: "admin_adjust",
        note: note?.trim() ? note.trim() : null,
      });

      const balance = await deps.coinLedger.sumByUser(tournamentId, userId);

      return {
        balance,
        transaction: {
          id: row.id,
          delta: row.delta,
          reason: row.reason,
          note: row.note,
          gameId: row.gameId,
          createdAt: row.createdAt.toISOString(),
          match: null,
        },
      };
    },
  };
}
