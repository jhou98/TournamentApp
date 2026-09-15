import { describe, expect, it } from "vitest";
import { computeCoinLeaderboard, type LeaderboardPlayerInput } from "../../src/domain/coinLeaderboard.js";

function player(over: Partial<LeaderboardPlayerInput>): LeaderboardPlayerInput {
  return { userId: "u", displayName: "U", teamId: "t1", teamName: "Team", balance: 0, ...over };
}

describe("computeCoinLeaderboard", () => {
  it("ranks by balance, highest first", () => {
    const rows = computeCoinLeaderboard([
      player({ userId: "a", displayName: "Ann", balance: 100 }),
      player({ userId: "b", displayName: "Bob", balance: 300 }),
      player({ userId: "c", displayName: "Cid", balance: 200 }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("gives tied balances the same rank (competition ranking) and skips the next", () => {
    const rows = computeCoinLeaderboard([
      player({ userId: "a", displayName: "Ann", balance: 100 }),
      player({ userId: "b", displayName: "Bob", balance: 100 }),
      player({ userId: "c", displayName: "Cid", balance: 50 }),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("breaks ties by display name for a stable order", () => {
    const rows = computeCoinLeaderboard([
      player({ userId: "z", displayName: "Zoe", balance: 100 }),
      player({ userId: "a", displayName: "Ann", balance: 100 }),
    ]);
    expect(rows.map((r) => r.displayName)).toEqual(["Ann", "Zoe"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("keeps players with a zero balance in the ranking (start-at-0)", () => {
    const rows = computeCoinLeaderboard([
      player({ userId: "a", displayName: "Ann", balance: 0 }),
      player({ userId: "b", displayName: "Bob", balance: 40 }),
    ]);
    expect(rows.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("returns an empty list for no players", () => {
    expect(computeCoinLeaderboard([])).toEqual([]);
  });
});
