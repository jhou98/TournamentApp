/**
 * Ledger recompute engine (US13 core / US14, streaks US15/D16).
 *
 * On every score finalize, the whole tournament's DERIVED coin rows
 * (match_result + streak_bonus) are deleted and re-inserted from scratch
 * (idempotent by construction — editing a score reverses+reapplies
 * correctly). Playoff games — and playoff matchups, for streaks — earn coins
 * too; there is no filter to round-robin.
 */

import { computeLedger, type DerivedCoinTxn, type LedgerGameInput } from "../domain/ledger.js";
import { computeStreakBonuses, type MatchupOutcome, type PlayerOutcomes } from "../domain/streak.js";
import type {
  CoinLedgerRepo,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  MatchupRepo,
  MatchupView,
  TournamentRepo,
  UnitOfWork,
} from "../ports/index.js";

export interface EconomyServiceDeps {
  tournaments: TournamentRepo;
  games: GameRepo;
  lineups: LineupRepo;
  matchups: MatchupRepo;
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

export interface EconomyService {
  /** Recompute (delete + re-insert) the tournament's derived coin rows from its finalized games. */
  recomputeTournamentLedger(tournamentId: string): Promise<void>;
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
  };
}
