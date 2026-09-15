import { describe, expect, it } from "vitest";
import { computeLedger, type LedgerGameInput } from "../../src/domain/ledger.js";
import type { CoinRule } from "../../src/domain/coinRule.js";
import { DEFAULT_COIN_RULE } from "../../src/domain/tournamentDefaults.js";

function game(overrides: Partial<LedgerGameInput> = {}): LedgerGameInput {
  return {
    gameId: "g1",
    scoreHome: 21,
    scoreAway: 10,
    homePlayerIds: ["h1", "h2"],
    awayPlayerIds: ["a1", "a2"],
    ...overrides,
  };
}

describe("computeLedger", () => {
  it("credits perWin to the winning side and perLoss to the losing side", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, closeLossMargin: 3 };
    const rows = computeLedger(rule, [game({ scoreHome: 21, scoreAway: 10 })]);
    const byUser = new Map(rows.map((r) => [r.userId, r.delta]));
    expect(byUser.get("h1")).toBe(100);
    expect(byUser.get("h2")).toBe(100);
    expect(byUser.get("a1")).toBe(50);
    expect(byUser.get("a2")).toBe(50);
  });

  it("both players on a pair get the same delta", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50 };
    const rows = computeLedger(rule, [game()]);
    const homeDeltas = rows.filter((r) => ["h1", "h2"].includes(r.userId)).map((r) => r.delta);
    expect(homeDeltas).toEqual([100, 100]);
  });

  it("credits perCloseLoss when the margin is within closeLossMargin", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, perCloseLoss: 75, closeLossMargin: 3 };
    // Losing side trails by 2 -> close loss.
    const rows = computeLedger(rule, [game({ scoreHome: 21, scoreAway: 19 })]);
    const away = rows.filter((r) => r.userId === "a1" || r.userId === "a2");
    expect(away.every((r) => r.delta === 75)).toBe(true);
  });

  it("a big-margin loss is NOT close and falls back to perLoss", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, perCloseLoss: 75, closeLossMargin: 3 };
    // Losing side trails by 11 -> not close.
    const rows = computeLedger(rule, [game({ scoreHome: 21, scoreAway: 10 })]);
    const away = rows.filter((r) => r.userId === "a1" || r.userId === "a2");
    expect(away.every((r) => r.delta === 50)).toBe(true);
  });

  it("a loss exactly at the margin boundary counts as close", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, perCloseLoss: 75, closeLossMargin: 3 };
    // Losing side trails by exactly 3 -> close loss (<=).
    const rows = computeLedger(rule, [game({ scoreHome: 21, scoreAway: 18 })]);
    const away = rows.filter((r) => r.userId === "a1" || r.userId === "a2");
    expect(away.every((r) => r.delta === 75)).toBe(true);
  });

  it("accumulates multiple games' deltas per player (as separate rows)", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50 };
    const rows = computeLedger(rule, [
      game({ gameId: "g1", scoreHome: 21, scoreAway: 10 }),
      game({ gameId: "g2", scoreHome: 15, scoreAway: 21, homePlayerIds: ["h1", "h2"], awayPlayerIds: ["a1", "a2"] }),
    ]);
    const h1Rows = rows.filter((r) => r.userId === "h1");
    expect(h1Rows).toHaveLength(2);
    expect(h1Rows.map((r) => r.delta).sort((a, b) => a - b)).toEqual([50, 100]);
    expect(rows.every((r) => r.reason === "match_result")).toBe(true);
  });

  it("skips a tied game defensively (no ties by construction)", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50 };
    const rows = computeLedger(rule, [game({ scoreHome: 15, scoreAway: 15 })]);
    expect(rows).toHaveLength(0);
  });

  it("stamps each row with the originating gameId", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50 };
    const rows = computeLedger(rule, [game({ gameId: "g42" })]);
    expect(rows.every((r) => r.gameId === "g42")).toBe(true);
  });

  it("DEFAULT_COIN_RULE: realistic win/close-loss game produces 100 / 75", () => {
    // DEFAULT_COIN_RULE.closeLossMargin is 3; losing side trails by 2.
    const rows = computeLedger(DEFAULT_COIN_RULE, [game({ scoreHome: 21, scoreAway: 19 })]);
    const byUser = new Map(rows.map((r) => [r.userId, r.delta]));
    expect(byUser.get("h1")).toBe(100);
    expect(byUser.get("a1")).toBe(75);
  });
});
