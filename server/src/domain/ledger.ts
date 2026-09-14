/**
 * Ledger projector (US13 core / US14) — pure logic.
 *
 * Projects finalized games into per-player match-reward coin transactions by
 * calling `computeCoinDelta` once per player per game. This is the "caller"
 * `coinRule.ts` refers to: `closeLoss` is derived here from
 * `rule.closeLossMargin`, not inside `computeCoinDelta`.
 *
 * Streak bonuses are NOT computed here (Commit 4) — this module only ever
 * emits `"match_result"` rows.
 */

import { computeCoinDelta, type CoinRule } from "./coinRule.js";

export interface LedgerGameInput {
  gameId: string;
  scoreHome: number;
  scoreAway: number;
  homePlayerIds: string[];
  awayPlayerIds: string[];
}

export interface DerivedCoinTxn {
  userId: string;
  delta: number;
  reason: "match_result";
  gameId: string;
}

/**
 * Project finalized games → per-player match-reward coin transactions.
 * Each player on the home side gets a result computed from (scoreHome vs
 * scoreAway); each on the away side gets the reverse. `closeLoss` is derived
 * here from `rule.closeLossMargin`: a loss is close when the margin against
 * the losing player is `<= closeLossMargin`.
 *
 * A game can't legitimately tie (D19) — a tied game is skipped defensively
 * rather than assigning either side a win.
 */
export function computeLedger(rule: CoinRule, games: LedgerGameInput[]): DerivedCoinTxn[] {
  const out: DerivedCoinTxn[] = [];
  const margin = rule.closeLossMargin ?? 0;

  for (const g of games) {
    if (g.scoreHome === g.scoreAway) continue; // defensive: no ties by construction

    const homeWin = g.scoreHome > g.scoreAway;
    const sides: Array<{ playerIds: string[]; win: boolean; pointsFor: number; pointsAgainst: number }> = [
      { playerIds: g.homePlayerIds, win: homeWin, pointsFor: g.scoreHome, pointsAgainst: g.scoreAway },
      { playerIds: g.awayPlayerIds, win: !homeWin, pointsFor: g.scoreAway, pointsAgainst: g.scoreHome },
    ];

    for (const side of sides) {
      const diff = side.pointsFor - side.pointsAgainst;
      const closeLoss = !side.win && side.pointsAgainst - side.pointsFor <= margin;
      const delta = computeCoinDelta(rule, {
        win: side.win,
        loss: !side.win,
        pointsFor: side.pointsFor,
        pointsAgainst: side.pointsAgainst,
        diff,
        closeLoss,
      });
      for (const userId of side.playerIds) {
        out.push({ userId, delta, reason: "match_result", gameId: g.gameId });
      }
    }
  }

  return out;
}
