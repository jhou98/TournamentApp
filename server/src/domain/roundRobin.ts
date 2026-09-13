/**
 * Round-robin schedule generation via the circle method.
 *
 * Pure: given team ids, returns the matchups (team A vs team B) grouped into
 * rounds where every team plays every other exactly once per cycle. `cycles`
 * replays the whole round-robin (a double round-robin = 2), so admins can add
 * repeats without unbalancing the schedule. Persistence is the caller's job.
 *
 * - Even team count -> `teamCount - 1` rounds per cycle.
 * - Odd team count  -> `teamCount` rounds per cycle, one team resting each round
 *   (paired against a phantom "bye" that is dropped from the output).
 *
 * `teamAId`/`teamBId` are only a stored ordering — home/away is decided later by
 * random pair assignment — so repeated cycles intentionally reproduce the same
 * pairings.
 */

const BYE = "__bye__";

export interface RoundRobinMatchup {
  /** 1-based round number, continuous across cycles. */
  roundIndex: number;
  teamAId: string;
  teamBId: string;
}

export function generateRoundRobin(teamIds: string[], cycles = 1): RoundRobinMatchup[] {
  if (cycles < 1) throw new Error("cycles must be >= 1");
  if (teamIds.length < 2) return [];

  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(BYE);

  const n = teams.length;
  const roundsPerCycle = n - 1;
  const half = n / 2;

  const result: RoundRobinMatchup[] = [];
  let roundIndex = 0;

  for (let cycle = 0; cycle < cycles; cycle++) {
    // Reset the rotation each cycle so pairings repeat identically.
    const rotation = [...teams];
    for (let r = 0; r < roundsPerCycle; r++) {
      roundIndex++;
      for (let i = 0; i < half; i++) {
        const a = rotation[i]!;
        const b = rotation[n - 1 - i]!;
        if (a !== BYE && b !== BYE) {
          result.push({ roundIndex, teamAId: a, teamBId: b });
        }
      }
      // Circle method: keep position 0 fixed, rotate the rest clockwise.
      const fixed = rotation[0]!;
      const rest = rotation.slice(1);
      rest.unshift(rest.pop()!);
      rotation.splice(0, rotation.length, fixed, ...rest);
    }
  }

  return result;
}

/** Rounds produced for a given team count and cycle count (derived, never stored). */
export function roundRobinRoundCount(teamCount: number, cycles = 1): number {
  if (teamCount < 2) return 0;
  const perCycle = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  return perCycle * cycles;
}
