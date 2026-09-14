import { describe, expect, it } from "vitest";
import {
  computeMatchupResult,
  computeStandings,
  type GameResultInput,
  type MatchupTeamsInput,
} from "../../src/domain/standings.js";

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

  type M = MatchupTeamsInput & { winnerTeamId: string | null; status: string };

  it("credits record only for completed matchups and games/points for all final games", () => {
    const matchups: M[] = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: "A", status: "final" },
      { id: "m2", teamAId: "C", teamBId: "A", winnerTeamId: null, status: "in_progress" }, // not done
    ];
    const games = [
      // m1: A beats B 2–0 in points-heavy games
      game("m1", 1, 21, 10),
      game("m1", 1, 21, 12),
      // m2: only one game final, A won it
      game("m2", 1, 15, 21), // home C=15, away A=21 -> A game win
    ];
    const rows = computeStandings(teams, matchups, games);
    const byId = new Map(rows.map((r) => [r.teamId, r]));

    const a = byId.get("A")!;
    expect(a.matchupsWon).toBe(1);
    expect(a.matchupsLost).toBe(0);
    expect(a.points).toBe(3);
    expect(a.gamesWon).toBe(3); // 2 in m1 + 1 in m2 (as away)
    expect(a.gamesLost).toBe(0);
    expect(a.pointsFor).toBe(21 + 21 + 21);
    expect(a.pointsAgainst).toBe(10 + 12 + 15);

    const b = byId.get("B")!;
    expect(b.matchupsLost).toBe(1);
    expect(b.gamesWon).toBe(0);
    expect(b.gamesLost).toBe(2);

    const c = byId.get("C")!;
    expect(c.matchupsPlayed).toBe(0); // m2 not completed
    expect(c.gamesLost).toBe(1); // still lost the one final game
  });

  it("credits a tie to both teams and awards a point each", () => {
    const twoTeams = [
      { id: "A", name: "Alpha" },
      { id: "B", name: "Bravo" },
    ];
    // Completed matchup with no winner = a draw (1–1 game split).
    const matchups: M[] = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: null, status: "final" },
    ];
    const games = [game("m1", 1, 21, 10), game("m1", 2, 10, 21)];
    const rows = computeStandings(twoTeams, matchups, games);
    for (const r of rows) {
      expect(r.matchupsTied).toBe(1);
      expect(r.matchupsPlayed).toBe(1);
      expect(r.matchupsWon).toBe(0);
      expect(r.matchupsLost).toBe(0);
      expect(r.points).toBe(1);
    }
  });

  it("ranks by points (W=3, T=1), then game diff, then point diff, then name", () => {
    const matchups: M[] = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: "A", status: "final" },
      { id: "m2", teamAId: "B", teamBId: "C", winnerTeamId: "B", status: "final" },
      { id: "m3", teamAId: "A", teamBId: "C", winnerTeamId: "A", status: "final" },
    ];
    const games = [game("m1", 1, 21, 5), game("m2", 1, 21, 5), game("m3", 1, 21, 5)];
    const rows = computeStandings(teams, matchups, games);
    // A: 2 wins (6), B: 1 win (3), C: 0 (0)
    expect(rows.map((r) => r.teamId)).toEqual(["A", "B", "C"]);
    expect(rows.map((r) => r.points)).toEqual([6, 3, 0]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("ranks an undefeated-with-ties team above an equal-win team with a loss", () => {
    // A: beat B, tied C -> 1W 1T 0L = 4 pts (undefeated).
    // B: lost to A, beat C -> 1W 0T 1L = 3 pts.
    // C: tied A, lost to B -> 0W 1T 1L = 1 pt.
    const matchups: M[] = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: "A", status: "final" },
      { id: "m2", teamAId: "A", teamBId: "C", winnerTeamId: null, status: "final" }, // draw
      { id: "m3", teamAId: "B", teamBId: "C", winnerTeamId: "B", status: "final" },
    ];
    const games = [
      game("m1", 1, 21, 5),
      game("m2", 1, 21, 5), // A wins game 1
      game("m2", 2, 5, 21), // C wins game 2 -> 1–1 draw
      game("m3", 1, 21, 5),
    ];
    const rows = computeStandings(teams, matchups, games);
    expect(rows.map((r) => r.teamId)).toEqual(["A", "B", "C"]);
    expect(rows.map((r) => r.points)).toEqual([4, 3, 1]);
    expect(rows[0]!.matchupsTied).toBe(1);
    expect(rows[0]!.matchupsLost).toBe(0);
  });

  it("breaks an equal points total by game differential", () => {
    const twoTeams = [
      { id: "A", name: "Alpha" },
      { id: "B", name: "Bravo" },
    ];
    // Both won one matchup (3 pts each), but A won its games more decisively.
    const matchups: M[] = [
      { id: "m1", teamAId: "A", teamBId: "B", winnerTeamId: "A", status: "final" },
      { id: "m2", teamAId: "A", teamBId: "B", winnerTeamId: "B", status: "final" },
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
