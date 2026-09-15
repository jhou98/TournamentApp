/**
 * Coin leaderboard ranking (US17) — pure logic.
 *
 * Ranks the players of a tournament by their coin balance, highest first.
 * Ties share a rank (competition ranking: 1, 2, 2, 4), broken for display
 * order by display name. Balances are tournament-scoped (D6) — the caller
 * supplies one balance per player, defaulting absent players to 0.
 */

export interface LeaderboardPlayerInput {
  userId: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  balance: number;
}

export interface LeaderboardRow extends LeaderboardPlayerInput {
  rank: number;
}

export function computeCoinLeaderboard(players: LeaderboardPlayerInput[]): LeaderboardRow[] {
  const sorted = [...players].sort(
    (a, b) => b.balance - a.balance || a.displayName.localeCompare(b.displayName),
  );

  const rows: LeaderboardRow[] = [];
  let rank = 0;
  let seen = 0;
  let prevBalance: number | null = null;
  for (const p of sorted) {
    seen += 1;
    if (prevBalance === null || p.balance !== prevBalance) {
      rank = seen; // first player at this balance takes the current position
      prevBalance = p.balance;
    }
    rows.push({ ...p, rank });
  }
  return rows;
}
