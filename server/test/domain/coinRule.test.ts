import { describe, expect, it } from "vitest";
import { computeCoinDelta, type CoinRule, type PlayerGameResult } from "../../src/domain/coinRule.js";
import { DEFAULT_COIN_RULE } from "../../src/domain/tournamentDefaults.js";

function result(overrides: Partial<PlayerGameResult>): PlayerGameResult {
  return {
    win: false,
    loss: false,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
    closeLoss: false,
    ...overrides,
  };
}

describe("computeCoinDelta", () => {
  it("credits perWin on a win", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50 };
    expect(computeCoinDelta(rule, result({ win: true }))).toBe(100);
  });

  it("adds flatPerGame on top of perWin", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, flatPerGame: 10 };
    expect(computeCoinDelta(rule, result({ win: true }))).toBe(110);
  });

  it("credits perLoss on a plain loss", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, perCloseLoss: 75 };
    expect(computeCoinDelta(rule, result({ loss: true, closeLoss: false }))).toBe(50);
  });

  it("credits perCloseLoss (not perLoss) on a close loss", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, perCloseLoss: 75 };
    expect(computeCoinDelta(rule, result({ loss: true, closeLoss: true }))).toBe(75);
  });

  it("falls back to perLoss on a close loss when perCloseLoss is unset", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50 };
    expect(computeCoinDelta(rule, result({ loss: true, closeLoss: true }))).toBe(50);
  });

  it("applies perPointDiff for a positive diff", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, perPointDiff: 2 };
    expect(computeCoinDelta(rule, result({ win: true, diff: 5 }))).toBe(110);
  });

  it("applies perPointDiff for a negative diff", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, perPointDiff: 2 };
    expect(computeCoinDelta(rule, result({ loss: true, diff: -8 }))).toBe(34);
  });

  it("floor clamps a low/negative total up", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 10, perPointDiff: 5, floor: 0 };
    expect(computeCoinDelta(rule, result({ loss: true, diff: -20 }))).toBe(0);
  });

  it("floor does not affect a total already above it", () => {
    const rule: CoinRule = { perWin: 100, perLoss: 50, floor: 0 };
    expect(computeCoinDelta(rule, result({ win: true }))).toBe(100);
  });

  it("DEFAULT_COIN_RULE produces 100 / 75 / 50 for win / close-loss / plain-loss", () => {
    expect(computeCoinDelta(DEFAULT_COIN_RULE, result({ win: true }))).toBe(100);
    expect(computeCoinDelta(DEFAULT_COIN_RULE, result({ loss: true, closeLoss: true }))).toBe(75);
    expect(computeCoinDelta(DEFAULT_COIN_RULE, result({ loss: true, closeLoss: false }))).toBe(50);
  });
});
