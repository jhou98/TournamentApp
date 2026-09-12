/**
 * Distribute players across teams as evenly as possible (round-robin).
 * Pure: returns a teamId -> playerIds[] map; persistence is the caller's job.
 */
export function balancePlayers(
  playerIds: string[],
  teamIds: string[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const teamId of teamIds) {
    result.set(teamId, []);
  }
  if (teamIds.length === 0) return result;

  playerIds.forEach((playerId, i) => {
    const teamId = teamIds[i % teamIds.length]!;
    result.get(teamId)!.push(playerId);
  });

  return result;
}
