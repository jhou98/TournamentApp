/**
 * Pluggable per-player coin-earning rule (§4/D4) — pure logic.
 *
 * On finalize, each player gets a coin delta from their own game result via
 * `computeCoinDelta`. The rule is admin-tunable config (see DEFAULT_COIN_RULE).
 * There are no ties (D19): a game is a win or a loss. `closeLoss` is decided by
 * the caller (using `closeLossMargin`), not re-derived here.
 */

/**
 * Largest magnitude a single coin transaction may carry. The `delta` column is
 * a 32-bit int in the DB (±2.1B); we cap well below that so a manual admin
 * adjustment can never overflow the column (which would surface as a 500) — and
 * the ceiling is a sane business limit besides.
 */
export const MAX_COIN_ADJUSTMENT = 1_000_000;

/** Pluggable per-player coin-earning rule (D4). */
export interface CoinRule {
  perWin: number;
  perLoss: number;
  perCloseLoss?: number;
  perPointDiff?: number;
  floor?: number;
  closeLossMargin?: number;
}

/** One player's result in one finalized game, from that player's perspective. */
export interface PlayerGameResult {
  win: boolean;
  loss: boolean;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  closeLoss: boolean;
}

/**
 * Compute one player's coin delta for one finalized game under `rule`. A close
 * loss uses `perCloseLoss` when set, else falls back to `perLoss`. `floor` is
 * applied last, after every additive term. The result is always an integer.
 */
export function computeCoinDelta(rule: CoinRule, result: PlayerGameResult): number {
  let delta = 0;

  if (result.win) {
    delta += rule.perWin;
  } else {
    delta += result.closeLoss && rule.perCloseLoss !== undefined ? rule.perCloseLoss : rule.perLoss;
  }

  if (rule.perPointDiff) delta += rule.perPointDiff * result.diff;

  delta = Math.round(delta);

  if (rule.floor !== undefined) delta = Math.max(delta, rule.floor);

  return delta;
}
