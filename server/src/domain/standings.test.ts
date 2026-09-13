import { describe, expect, it } from "vitest";
import {
  computeMatchupResult,
  computeStandings,
  type GameResultInput,
  type MatchupTeamsInput,
} from "./standings.js";

function game(
  matchupId: string,
  roundNo: number,
  scoreHome: number | null,
  scoreAway: number | null,
): GameResultInput {
  const status = scoreHome !== null && scoreAway !== null ? "final" : "assigned";
  return { matchupId, roundNo, status, scoreHome, scoreAway };
}

describe("computeMatchupResult", () => {
  it("tallies game wins per side and reports the winner when all final", () => {
    // 6 games: home wins 4, away wins 2.
    const games = [
      game("m", 1, 21, 10),
      game("m", 1, 21, 15),
      game("m", 1, 10, 21),
      game("m", 2, 21, 19),
      game("m", 2, 12, 21),
      game("m", 2, 21, 18),
    ];
    const r = computeMatchupResult(games, 6);
    expect(r.homeWins).toBe(4);
    expect(r.awayWins).toBe(2);
    expect(r.allFinal).toBe(true);
    expect(r.decided).toBe(true);
    expect(r.tied).toBe(false);
    expect(r.winner).toBe("A");
  });

  it("is undecided while games remain unscored", () => {
    const games = [game("m", 1, 21, 10), game("m", 1, null, null)];
    const r = computeMatchupResult(games, 2);
    expect(r.allFinal).toBe(false);
    expect(r.decided).toBe(false);
    expect(r.winner).toBeNull();
  });

  it("flags a 3–3 tie as tied and undecided (sudden death territory)", () => {
    const games = [
      game("m", 1, 21, 10),
      game("m", 1, 21, 15),
      game("m", 1, 10, 21),
      game("m", 2, 21, 19),
      game("m", 2, 12, 21),
      game("m", 2, 18, 21),
    ];
    const r = computeMatchupResult(games, 6);
    expect(r.homeWins).toBe(3);
    expect(r.awayWins).toBe(3);
    expect(r.allFinal).toBe(true);
    expect(r.tied).toBe(true);
    expect(r.decided).toBe(false);
    expect(r.winner).toBeNull();
  });
});

describe("computeStandings", () => {
  const teams = [
    { id: "A", name: "Alpha" },
    { id: "B", name: "Bravo" },
    { id: "C", name: "Charlie" },
  ];

  it("credits record only for decided matchups and games/points for all final games", () => {
    const matchups: (MatchupTeamsInput & { winnerTeamId: string | null })[] = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: "A" },
      { id: "m2", teamAId: "C", teamBId: "A", winnerTeamId: null }, // undecided
    ];
    const games = [
      // m1: A beats B 2–0 in points-heavy games
      game("m1", 1, 21, 10),
      game("m1", 1, 21, 12),
      // m2: only one game final, C won it
      game("m2", 1, 15, 21), // home C=15, away A=21 -> A game win
    ];
    const rows = computeStandings(teams, matchups, games);
    const byId = new Map(rows.map((r) => [r.teamId, r]));

    const a = byId.get("A")!;
    expect(a.matchupsWon).toBe(1);
    expect(a.matchupsLost).toBe(0);
    expect(a.gamesWon).toBe(3); // 2 in m1 + 1 in m2 (as away)
    expect(a.gamesLost).toBe(0);
    expect(a.pointsFor).toBe(21 + 21 + 21);
    expect(a.pointsAgainst).toBe(10 + 12 + 15);

    const b = byId.get("B")!;
    expect(b.matchupsLost).toBe(1);
    expect(b.gamesWon).toBe(0);
    expect(b.gamesLost).toBe(2);

    const c = byId.get("C")!;
    expect(c.matchupsPlayed).toBe(0); // m2 undecided
    expect(c.gamesLost).toBe(1); // still lost the one final game
  });

  it("ranks by record, then game diff, then point diff, then name", () => {
    const matchups = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: "A" },
      { id: "m2", teamAId: "B", teamBId: "C", winnerTeamId: "B" },
      { id: "m3", teamAId: "A", teamBId: "C", winnerTeamId: "A" },
    ];
    const games = [
      game("m1", 1, 21, 5),
      game("m2", 1, 21, 5),
      game("m3", 1, 21, 5),
    ];
    const rows = computeStandings(teams, matchups, games);
    // A: 2 wins, B: 1 win, C: 0 wins
    expect(rows.map((r) => r.teamId)).toEqual(["A", "B", "C"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("breaks an equal record by game differential", () => {
    const twoTeams = [
      { id: "A", name: "Alpha" },
      { id: "B", name: "Bravo" },
    ];
    // Both won one matchup, but A won its games more decisively.
    const matchups = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: "A" },
      { id: "m2", teamAId: "A", teamBId: "B", winnerTeamId: "B" },
    ];
    const games = [
      // m1: A wins 3–0
      game("m1", 1, 21, 1),
      game("m1", 1, 21, 1),
      game("m1", 1, 21, 1),
      // m2: B wins 2–1
      game("m2", 1, 1, 21),
      game("m2", 1, 1, 21),
      game("m2", 1, 21, 1),
    ];
    const rows = computeStandings(twoTeams, matchups, games);
    // A game diff = (3+1) won - (0+2) lost = +2 ; B = -2
    expect(rows[0]!.teamId).toBe("A");
    expect(rows[0]!.gameDiff).toBe(2);
    expect(rows[1]!.gameDiff).toBe(-2);
  });
});
