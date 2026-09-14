import { describe, expect, it } from "vitest";
import { generateRoundRobin, roundRobinRoundCount } from "../../src/domain/roundRobin.js";

/** Canonical unordered key for a pairing, so team A/B order doesn't matter. */
const pairKey = (a: string, b: string) => [a, b].sort().join("-");

describe("generateRoundRobin", () => {
  it("schedules 4 teams as 3 rounds with every pairing exactly once", () => {
    const matchups = generateRoundRobin(["a", "b", "c", "d"]);
    expect(matchups).toHaveLength(6);

    const rounds = new Set(matchups.map((m) => m.roundIndex));
    expect([...rounds].sort()).toEqual([1, 2, 3]);

    // Exactly two matchups per round.
    for (const r of rounds) {
      expect(matchups.filter((m) => m.roundIndex === r)).toHaveLength(2);
    }

    // All six unique pairings appear once.
    const pairs = matchups.map((m) => pairKey(m.teamAId, m.teamBId));
    expect(new Set(pairs).size).toBe(6);
  });

  it("does not put a team in two matchups within the same round", () => {
    const matchups = generateRoundRobin(["a", "b", "c", "d", "e", "f"]);
    const byRound = new Map<number, string[]>();
    for (const m of matchups) {
      const teams = byRound.get(m.roundIndex) ?? [];
      teams.push(m.teamAId, m.teamBId);
      byRound.set(m.roundIndex, teams);
    }
    for (const teams of byRound.values()) {
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it("handles an odd team count with a rotating bye", () => {
    const matchups = generateRoundRobin(["a", "b", "c"]);
    // 3 teams -> 3 rounds, one matchup each (the third team rests).
    expect(new Set(matchups.map((m) => m.roundIndex)).size).toBe(3);
    expect(matchups).toHaveLength(3);
    // No phantom bye leaks into the output.
    const teams = matchups.flatMap((m) => [m.teamAId, m.teamBId]);
    expect(teams).not.toContain("__bye__");
    // Each real pairing appears once.
    expect(new Set(matchups.map((m) => pairKey(m.teamAId, m.teamBId))).size).toBe(3);
  });

  it("repeats the full round-robin for cycles > 1 with continuous round numbers", () => {
    const single = generateRoundRobin(["a", "b", "c", "d"], 1);
    const doubled = generateRoundRobin(["a", "b", "c", "d"], 2);

    expect(doubled).toHaveLength(single.length * 2);
    expect(new Set(doubled.map((m) => m.roundIndex)).size).toBe(6);

    // Every pairing is played exactly twice.
    const counts = new Map<string, number>();
    for (const m of doubled) {
      const k = pairKey(m.teamAId, m.teamBId);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it("returns nothing for fewer than two teams", () => {
    expect(generateRoundRobin([])).toEqual([]);
    expect(generateRoundRobin(["a"])).toEqual([]);
  });

  it("rejects a cycle count below 1", () => {
    expect(() => generateRoundRobin(["a", "b"], 0)).toThrow();
  });
});

describe("roundRobinRoundCount", () => {
  it("derives rounds from team count and cycles", () => {
    expect(roundRobinRoundCount(4)).toBe(3);
    expect(roundRobinRoundCount(4, 2)).toBe(6);
    expect(roundRobinRoundCount(6)).toBe(5);
    expect(roundRobinRoundCount(3)).toBe(3); // odd -> N rounds
    expect(roundRobinRoundCount(1)).toBe(0);
  });
});
