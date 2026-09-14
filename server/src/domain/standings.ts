/**
 * Match results (US9) + standings/seeding (US10) — pure logic.
 *
 * By construction (see lineupService.maybeAssignRound) a game's **home** pair
 * always belongs to the matchup's `teamA` and the **away** pair to `teamB`, so
 * `scoreHome ↔ teamA` and `scoreAway ↔ teamB`. Nothing here is stored: standings
 * are derived from finalized games at view time.
 */

export interface GameResultInput {
  matchupId: string;
  roundNo: number;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
}

export interface MatchupTeamsInput {
  id: string;
  teamAId: string;
  teamBId: string;
}

export interface TeamInput {
  id: string;
  name: string;
}

/** Game-win tally for one matchup (across all its matches). */
export interface MatchupResult {
  /** Game wins for the home side (teamA). */
  homeWins: number;
  /** Game wins for the away side (teamB). */
  awayWins: number;
  /** Finalized games counted so far. */
  finalGames: number;
  /** Total games this matchup will ever hold. */
  totalGames: number;
  /** Every game has a final score. */
  allFinal: boolean;
  /** All final and one side leads — `winner` is meaningful. */
  decided: boolean;
  /** All final but game wins are level (→ sudden death, US12). */
  tied: boolean;
  /** `"A"` (teamA/home) or `"B"` (teamB/away) when decided, else `null`. */
  winner: "A" | "B" | null;
}

/**
 * Tally a single matchup's game wins. `totalGames` is the number of games the
 * matchup is scheduled to hold (rounds_per_matchup × pairs_per_lineup); when it
 * is unknown, pass the count of games present.
 */
export function computeMatchupResult(games: GameResultInput[], totalGames?: number): MatchupResult {
  let homeWins = 0;
  let awayWins = 0;
  let finalGames = 0;
  for (const g of games) {
    if (g.status !== "final" || g.scoreHome === null || g.scoreAway === null) continue;
    finalGames++;
    if (g.scoreHome > g.scoreAway) homeWins++;
    else if (g.scoreAway > g.scoreHome) awayWins++;
  }
  const total = totalGames ?? games.length;
  const allFinal = total > 0 && finalGames === total;
  const tied = allFinal && homeWins === awayWins;
  const decided = allFinal && homeWins !== awayWins;
  const winner: "A" | "B" | null = decided ? (homeWins > awayWins ? "A" : "B") : null;
  return { homeWins, awayWins, finalGames, totalGames: total, allFinal, decided, tied, winner };
}

/** Points awarded per matchup outcome (round robin). A tie is possible whenever
 * games-per-matchup is even; sudden death is playoff-only, so RR draws stand. */
export const MATCHUP_POINTS = { win: 3, tie: 1, loss: 0 } as const;

/** Per-team standings row (US10). All quantities derived from finalized games. */
export interface StandingRow {
  teamId: string;
  teamName: string;
  matchupsPlayed: number;
  matchupsWon: number;
  matchupsLost: number;
  matchupsTied: number;
  /** League points: win 3, tie 1, loss 0. */
  points: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
}

interface MatchupResultInput extends MatchupTeamsInput {
  winnerTeamId: string | null;
  /** Matchup status; a `final` matchup with no winner is a draw. */
  status: string;
}

/**
 * Build ranked standings. A **completed** matchup (`status = final`) credits the
 * record: a winner → win/loss, no winner → a tie for both. **Games won/lost** and
 * **point differential** count every finalized game. Ranking: **league points
 * (W=3, T=1, L=0) → game differential → point differential → team name** (a
 * stable, deterministic final tiebreaker; an admin-defined one is deferred, US10).
 */
export function computeStandings(
  teams: TeamInput[],
  matchups: MatchupResultInput[],
  games: GameResultInput[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      matchupsPlayed: 0,
      matchupsWon: 0,
      matchupsLost: 0,
      matchupsTied: 0,
      points: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      rank: 0,
    });
  }

  const matchupById = new Map(matchups.map((m) => [m.id, m]));

  // Per-game: credit games won/lost and points to each side.
  for (const g of games) {
    if (g.status !== "final" || g.scoreHome === null || g.scoreAway === null) continue;
    const m = matchupById.get(g.matchupId);
    if (!m) continue;
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) continue;

    a.pointsFor += g.scoreHome;
    a.pointsAgainst += g.scoreAway;
    b.pointsFor += g.scoreAway;
    b.pointsAgainst += g.scoreHome;

    if (g.scoreHome > g.scoreAway) {
      a.gamesWon++;
      b.gamesLost++;
    } else if (g.scoreAway > g.scoreHome) {
      b.gamesWon++;
      a.gamesLost++;
    }
  }

  // Per-matchup: only completed matchups count toward the record. A finalized
  // matchup with no winner is a draw (both teams get a tie).
  for (const m of matchups) {
    if (m.status !== "final") continue;
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) continue;
    a.matchupsPlayed++;
    b.matchupsPlayed++;
    if (!m.winnerTeamId) {
      a.matchupsTied++;
      b.matchupsTied++;
    } else {
      const winner = m.winnerTeamId === m.teamAId ? a : b;
      const loser = m.winnerTeamId === m.teamAId ? b : a;
      winner.matchupsWon++;
      loser.matchupsLost++;
    }
  }

  const ordered = [...rows.values()];
  for (const r of ordered) {
    r.points = r.matchupsWon * MATCHUP_POINTS.win + r.matchupsTied * MATCHUP_POINTS.tie;
    r.gameDiff = r.gamesWon - r.gamesLost;
    r.pointDiff = r.pointsFor - r.pointsAgainst;
  }

  ordered.sort(
    (x, y) =>
      y.points - x.points ||
      y.gameDiff - x.gameDiff ||
      y.pointDiff - x.pointDiff ||
      x.teamName.localeCompare(y.teamName),
  );
  ordered.forEach((r, i) => {
    r.rank = i + 1;
  });
  return ordered;
}
