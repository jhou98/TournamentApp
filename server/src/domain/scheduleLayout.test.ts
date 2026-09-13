import { describe, expect, it } from "vitest";
import { layoutGames } from "./scheduleLayout.js";

describe("layoutGames", () => {
  it("creates roundsPerMatchup x pairsPerLineup games per matchup", () => {
    const games = layoutGames({
      matchups: [{ roundIndex: 1 }, { roundIndex: 1 }],
      roundsPerMatchup: 2,
      pairsPerLineup: 3,
      courtCount: 6,
    });
    expect(games).toHaveLength(2 * 2 * 3);
    expect(games.filter((g) => g.matchupIndex === 0)).toHaveLength(6);
  });

  it("gives concurrent games (same RR round + matchup round) distinct courts", () => {
    // Reference shape: 2 matchups in one RR round, 3 pairs, 6 courts.
    const games = layoutGames({
      matchups: [{ roundIndex: 1 }, { roundIndex: 1 }],
      roundsPerMatchup: 2,
      pairsPerLineup: 3,
      courtCount: 6,
    });

    for (const roundNo of [1, 2]) {
      const concurrent = games.filter((g) => g.roundNo === roundNo);
      const courts = concurrent.map((g) => g.courtIndex);
      // 6 concurrent games -> all 6 courts used with no clash.
      expect(new Set(courts).size).toBe(6);
      expect([...courts].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it("frees courts between a matchup's own sequential rounds", () => {
    const games = layoutGames({
      matchups: [{ roundIndex: 1 }],
      roundsPerMatchup: 2,
      pairsPerLineup: 3,
      courtCount: 3,
    });
    const round1 = games.filter((g) => g.roundNo === 1).map((g) => g.courtIndex);
    const round2 = games.filter((g) => g.roundNo === 2).map((g) => g.courtIndex);
    expect(round1.sort()).toEqual([0, 1, 2]);
    expect(round2.sort()).toEqual([0, 1, 2]); // reused, not continued
  });

  it("wraps court assignment when concurrent games exceed courts", () => {
    const games = layoutGames({
      matchups: [{ roundIndex: 1 }, { roundIndex: 1 }],
      roundsPerMatchup: 1,
      pairsPerLineup: 3,
      courtCount: 4,
    });
    // 6 concurrent games over 4 courts -> 0,1,2,3,0,1
    expect(games.map((g) => g.courtIndex)).toEqual([0, 1, 2, 3, 0, 1]);
  });

  it("keys concurrency by round index, so different RR rounds reuse courts", () => {
    const games = layoutGames({
      matchups: [{ roundIndex: 1 }, { roundIndex: 2 }],
      roundsPerMatchup: 1,
      pairsPerLineup: 2,
      courtCount: 4,
    });
    expect(games.filter((g) => g.matchupIndex === 0).map((g) => g.courtIndex)).toEqual([0, 1]);
    expect(games.filter((g) => g.matchupIndex === 1).map((g) => g.courtIndex)).toEqual([0, 1]);
  });

  it("rejects a court count below 1", () => {
    expect(() =>
      layoutGames({ matchups: [{ roundIndex: 1 }], roundsPerMatchup: 1, pairsPerLineup: 1, courtCount: 0 }),
    ).toThrow();
  });
});
