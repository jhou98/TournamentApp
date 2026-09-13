import { describe, expect, it } from "vitest";
import {
  describeLineupProblem,
  pairKey,
  validateLineup,
  type LineupProblem,
  type LineupRules,
} from "./lineup.js";

const roster = ["p1", "p2", "p3", "p4", "p5", "p6"];
const rules = (overrides: Partial<LineupRules> = {}): LineupRules => ({
  pairsPerLineup: 3,
  pairSize: 2,
  rosterIds: roster,
  ...overrides,
});
const kinds = (problems: LineupProblem[]) => problems.map((p) => p.kind);

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey(["p2", "p1"])).toBe(pairKey(["p1", "p2"]));
  });
});

describe("validateLineup", () => {
  it("accepts a valid 3-pair / 6-player lineup", () => {
    const problems = validateLineup(
      { pairs: [["p1", "p2"], ["p3", "p4"], ["p5", "p6"]] },
      rules(),
    );
    expect(problems).toEqual([]);
  });

  it("flags the wrong number of pairs", () => {
    const problems = validateLineup({ pairs: [["p1", "p2"], ["p3", "p4"]] }, rules());
    expect(kinds(problems)).toContain("pair_count");
  });

  it("flags a pair of the wrong size", () => {
    const problems = validateLineup(
      { pairs: [["p1", "p2", "p3"], ["p4", "p5"], ["p6", "p1"]] },
      rules(),
    );
    expect(kinds(problems)).toContain("pair_size");
  });

  it("flags a player used in two pairs the same round", () => {
    const problems = validateLineup(
      { pairs: [["p1", "p2"], ["p1", "p3"], ["p4", "p5"]] },
      rules(),
    );
    expect(kinds(problems)).toContain("player_reused");
  });

  it("flags a player appearing twice in one pair", () => {
    const problems = validateLineup(
      { pairs: [["p1", "p1"], ["p3", "p4"], ["p5", "p6"]] },
      rules(),
    );
    expect(kinds(problems)).toContain("duplicate_in_pair");
  });

  it("flags a player not on the roster", () => {
    const problems = validateLineup(
      { pairs: [["p1", "px"], ["p3", "p4"], ["p5", "p6"]] },
      rules(),
    );
    expect(kinds(problems)).toContain("not_on_roster");
  });

  it("flags a pairing already used earlier in the matchup", () => {
    const problems = validateLineup(
      { pairs: [["p1", "p2"], ["p3", "p4"], ["p5", "p6"]] },
      rules({ usedPairKeys: [pairKey(["p1", "p2"])] }),
    );
    expect(kinds(problems)).toContain("pairing_reused");
  });

  it("allows re-pairing players who were only paired differently before", () => {
    const problems = validateLineup(
      { pairs: [["p1", "p3"], ["p2", "p4"], ["p5", "p6"]] },
      rules({ usedPairKeys: [pairKey(["p1", "p2"])] }),
    );
    expect(problems).toEqual([]);
  });
});

describe("describeLineupProblem", () => {
  const nameOf = (id: string) => ({ p1: "Alice", p2: "Bob" })[id] ?? "Unknown player";

  it("renders player problems with names, never ids", () => {
    const msg = describeLineupProblem({ kind: "player_reused", playerId: "p1" }, nameOf);
    expect(msg).toBe("Alice is used in more than one pair this round");
    expect(msg).not.toContain("p1");
  });

  it("falls back to a name for an unknown id without leaking the id", () => {
    const msg = describeLineupProblem({ kind: "not_on_roster", playerId: "cabc123", pairIndex: 0 }, nameOf);
    expect(msg).toBe("Unknown player is not on this team");
    expect(msg).not.toContain("cabc123");
  });

  it("renders count/size problems with 1-based pair numbers", () => {
    expect(describeLineupProblem({ kind: "pair_count", expected: 3, actual: 2 }, nameOf)).toContain(
      "exactly 3 pairs",
    );
    expect(
      describeLineupProblem({ kind: "pair_size", pairIndex: 1, expected: 2, actual: 3 }, nameOf),
    ).toContain("Pair 2");
  });
});
