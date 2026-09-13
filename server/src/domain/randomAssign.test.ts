import { describe, expect, it } from "vitest";
import { assignPairs, shuffle, type Rng } from "./randomAssign.js";

/** Deterministic RNG that replays a fixed sequence of [0,1) values. */
function seq(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("shuffle", () => {
  it("does not mutate the input", () => {
    const input = ["a", "b", "c"];
    shuffle(input, seq([0, 0, 0]));
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("keeps the same multiset of items", () => {
    const out = shuffle(["a", "b", "c", "d"], Math.random);
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("assignPairs", () => {
  it("pairs every home pair with exactly one distinct away pair", () => {
    const result = assignPairs(["h1", "h2", "h3"], ["a1", "a2", "a3"], Math.random);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.homePairId)).toEqual(["h1", "h2", "h3"]);
    expect(new Set(result.map((r) => r.awayPairId))).toEqual(new Set(["a1", "a2", "a3"]));
  });

  it("is deterministic under a fixed RNG", () => {
    // rng=0 at each step of Fisher–Yates rotates the away list predictably.
    const result = assignPairs(["h1", "h2", "h3"], ["a1", "a2", "a3"], seq([0, 0, 0]));
    const other = assignPairs(["h1", "h2", "h3"], ["a1", "a2", "a3"], seq([0, 0, 0]));
    expect(result).toEqual(other);
  });

  it("throws when the sides field different pair counts", () => {
    expect(() => assignPairs(["h1", "h2"], ["a1"], Math.random)).toThrow();
  });
});
