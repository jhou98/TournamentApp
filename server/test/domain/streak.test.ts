import { describe, expect, it } from "vitest";
import { computeStreakBonuses, type PlayerOutcomes, type StreakRule } from "../../src/domain/streak.js";
import { DEFAULT_STREAK_RULE } from "../../src/domain/tournamentDefaults.js";

function outcomes(userId: string, seq: PlayerOutcomes["outcomes"]): PlayerOutcomes {
  return { userId, outcomes: seq };
}

describe("computeStreakBonuses", () => {
  it("a lone loss (run 1) awards nothing under the default loss rule", () => {
    const rows = computeStreakBonuses(DEFAULT_STREAK_RULE, [outcomes("p1", ["loss"])]);
    expect(rows).toHaveLength(0);
  });

  it("escalates through tiers 25/50/75 at runs 2/3/4", () => {
    const rows = computeStreakBonuses(DEFAULT_STREAK_RULE, [
      outcomes("p1", ["loss", "loss", "loss", "loss"]),
    ]);
    expect(rows.map((r) => r.delta)).toEqual([25, 50, 75]);
    expect(rows.every((r) => r.userId === "p1" && r.reason === "streak_bonus" && r.gameId === null)).toBe(true);
    expect(rows.map((r) => r.note)).toEqual(["Loss streak x2", "Loss streak x3", "Loss streak x4"]);
  });

  it("stays at the top tier (75) on a run longer than the highest configured tier", () => {
    const rows = computeStreakBonuses(DEFAULT_STREAK_RULE, [
      outcomes("p1", ["loss", "loss", "loss", "loss", "loss"]),
    ]);
    expect(rows.map((r) => r.delta)).toEqual([25, 50, 75, 75]);
  });

  it("a win resets the loss run to 0", () => {
    const rows = computeStreakBonuses(DEFAULT_STREAK_RULE, [
      outcomes("p1", ["loss", "loss", "win", "loss"]),
    ]);
    // run=2 -> 25, then win resets, then a single loss (run=1) -> nothing.
    expect(rows.map((r) => r.delta)).toEqual([25]);
  });

  it("under direction 'loss', a win streak never awards anything", () => {
    const rows = computeStreakBonuses(DEFAULT_STREAK_RULE, [
      outcomes("p1", ["win", "win", "win", "win"]),
    ]);
    expect(rows).toHaveLength(0);
  });

  it("direction 'win' is the symmetric mirror of 'loss'", () => {
    const rule: StreakRule = { direction: "win", tiers: DEFAULT_STREAK_RULE.tiers };
    const rows = computeStreakBonuses(rule, [outcomes("p1", ["win", "win", "win", "win"])]);
    expect(rows.map((r) => r.delta)).toEqual([25, 50, 75]);
    expect(rows.map((r) => r.note)).toEqual(["Win streak x2", "Win streak x3", "Win streak x4"]);

    // And a loss streak under 'win' direction awards nothing.
    const lossRows = computeStreakBonuses(rule, [outcomes("p2", ["loss", "loss", "loss"])]);
    expect(lossRows).toHaveLength(0);
  });

  it("direction 'both' awards on win runs and loss runs alike", () => {
    const rule: StreakRule = { direction: "both", tiers: DEFAULT_STREAK_RULE.tiers };
    const rows = computeStreakBonuses(rule, [outcomes("p1", ["loss", "loss", "win", "win"])]);
    expect(rows.map((r) => ({ delta: r.delta, note: r.note }))).toEqual([
      { delta: 25, note: "Loss streak x2" },
      { delta: 25, note: "Win streak x2" },
    ]);
  });

  it("tracks multiple players independently", () => {
    const rows = computeStreakBonuses(DEFAULT_STREAK_RULE, [
      outcomes("p1", ["loss", "loss"]),
      outcomes("p2", ["win", "win"]),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe("p1");
    expect(rows[0]!.delta).toBe(25);
  });

  it("order matters: the same multiset of outcomes in a different order yields a different result", () => {
    const rule = DEFAULT_STREAK_RULE;
    // Three losses + one win, arranged two different ways.
    const threeInARow = computeStreakBonuses(rule, [outcomes("p1", ["loss", "loss", "loss", "win"])]);
    const splitByWin = computeStreakBonuses(rule, [outcomes("p1", ["loss", "win", "loss", "loss"])]);
    expect(threeInARow.map((r) => r.delta)).toEqual([25, 50]);
    expect(splitByWin.map((r) => r.delta)).toEqual([25]);
  });

  it("a below-first-tier run length (0 tiers configured) awards nothing", () => {
    const rule: StreakRule = { direction: "loss", tiers: [] };
    const rows = computeStreakBonuses(rule, [outcomes("p1", ["loss", "loss", "loss"])]);
    expect(rows).toHaveLength(0);
  });
});
