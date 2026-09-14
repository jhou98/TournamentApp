/**
 * Ledger recompute engine (US13 core / US14) — match rewards only.
 *
 * On every score finalize, the whole tournament's DERIVED coin rows are
 * deleted and re-inserted from scratch (idempotent by construction — editing
 * a score reverses+reapplies correctly). Playoff games earn coins too; there
 * is no filter to round-robin. Streak bonuses are Commit 4.
 */

import { computeLedger, type LedgerGameInput } from "../domain/ledger.js";
import type { CoinLedgerRepo, GameRepo, LineupRepo, TournamentRepo, UnitOfWork } from "../ports/index.js";

export interface EconomyServiceDeps {
  tournaments: TournamentRepo;
  games: GameRepo;
  lineups: LineupRepo;
  coinLedger: CoinLedgerRepo;
  uow: UnitOfWork;
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

      // Build pairId -> playerIds across every matchup touched by these games
      // (mirrors resultsService.getResults' pairById pattern).
      const matchupIds = [...new Set(finalGames.map((g) => g.matchupId))];
      const pairById = new Map<string, string[]>();
      for (const matchupId of matchupIds) {
        const lineups = await deps.lineups.listByMatchup(matchupId);
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

      const derived = computeLedger(t.coinRule, inputs);

      await deps.uow.run(async () => {
        await deps.coinLedger.deleteDerivedByTournament(tournamentId);
        await deps.coinLedger.createMany(derived.map((d) => ({ ...d, tournamentId })));
      });
    },
  };
}
