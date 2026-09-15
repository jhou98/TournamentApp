/**
 * Matchup-level streak bonuses (US15/D16) — pure logic.
 *
 * A player's sequence is the win/loss result of each decided matchup they
 * participated in, in chronological order (round_robin -> semifinal -> final,
 * then roundIndex, then matchup id — imposed by the caller). On each matchup
 * that continues a run in the configured direction, the highest tier whose
 * `after <= runLength` is awarded; the run resets to 0 on the opposite result.
 * Direction is admin-tunable config (see DEFAULT_STREAK_RULE).
 */

import type { DerivedCoinTxn } from "./ledger.js";

export interface StreakTier {
  after: number;
  bonus: number;
}

export interface StreakRule {
  direction: "loss" | "win" | "both";
  tiers: StreakTier[];
}

export type MatchupOutcome = "win" | "loss";

export interface PlayerOutcomes {
  userId: string;
  outcomes: MatchupOutcome[];
}

/** The highest tier's bonus whose `after <= run`, or 0 when no tier qualifies. */
function tierBonus(tiers: StreakTier[], run: number): number {
  let best = 0;
  for (const tier of tiers) {
    if (run >= tier.after && tier.bonus > best) best = tier.bonus;
  }
  return best;
}

/**
 * Project each player's ordered matchup outcomes into `streak_bonus`
 * DerivedCoinTxn rows (gameId null, a descriptive note). Awards only on
 * matchups that extend a run in the configured direction(s), and only when
 * the awarded tier bonus is > 0.
 */
export function computeStreakBonuses(rule: StreakRule, players: PlayerOutcomes[]): DerivedCoinTxn[] {
  const out: DerivedCoinTxn[] = [];
  const wantLoss = rule.direction === "loss" || rule.direction === "both";
  const wantWin = rule.direction === "win" || rule.direction === "both";

  for (const player of players) {
    let lossRun = 0;
    let winRun = 0;

    for (const outcome of player.outcomes) {
      if (outcome === "loss") {
        lossRun += 1;
        winRun = 0;
        if (wantLoss) {
          const bonus = tierBonus(rule.tiers, lossRun);
          if (bonus > 0) {
            out.push({
              userId: player.userId,
              delta: bonus,
              reason: "streak_bonus",
              gameId: null,
              note: `Loss streak x${lossRun}`,
            });
          }
        }
      } else {
        winRun += 1;
        lossRun = 0;
        if (wantWin) {
          const bonus = tierBonus(rule.tiers, winRun);
          if (bonus > 0) {
            out.push({
              userId: player.userId,
              delta: bonus,
              reason: "streak_bonus",
              gameId: null,
              note: `Win streak x${winRun}`,
            });
          }
        }
      }
    }
  }

  return out;
}
