import { describe, expect, it } from "vitest";
import { pairKey, validateLineup, type LineupRules } from "./lineup.js";

const roster = ["p1", "p2", "p3", "p4", "p5", "p6"];
const rules = (overrides: Partial<LineupRules> = {}): LineupRules => ({
  pairsPerLineup: 3,
  pairSize: 2,
  rosterIds: roster,
  ...overrides,
});

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey(["p2", "p1"])).toBe(pairKey(["p1", "p2"]));
  });
});

describe("validateLineup", () => {
  it("accepts a valid 3-pair / 6-player lineup", () => {
    const errors = validateLineup(
      { pairs: [["p1", "p2"], ["p3", "p4"], ["p5", "p6"]] },
      rules(),
    );
    expect(errors).toEqual([]);
  });

  it("rejects the wrong number of pairs", () => {
    const errors = validateLineup({ pairs: [["p1", "p2"], ["p3", "p4"]] }, rules());
    expect(errors.some((e) => e.includes("exactly 3 pairs"))).toBe(true);
  });

  it("rejects a pair of the wrong size", () => {
    const errors = validateLineup(
      { pairs: [["p1", "p2", "p3"], ["p4", "p5"], ["p6", "p1"]] },
      rules(),
    );
    expect(errors.some((e) => e.includes("exactly 2 players"))).toBe(true);
  });

  it("rejects a player used in two pairs the same round", () => {
    const errors = validateLineup(
      { pairs: [["p1", "p2"], ["p1", "p3"], ["p4", "p5"]] },
      rules(),
    );
    expect(errors.some((e) => e.includes("more than one pair"))).toBe(true);
  });

  it("rejects a player not on the roster", () => {
    const errors = validateLineup(
      { pairs: [["p1", "px"], ["p3", "p4"], ["p5", "p6"]] },
      rules(),
    );
    expect(errors.some((e) => e.includes("not on this team"))).toBe(true);
  });

  it("rejects the same pair listed twice in one lineup", () => {
    const errors = validateLineup(
      { pairs: [["p1", "p2"], ["p2", "p1"], ["p3", "p4"]] },
      rules(),
    );
    // duplicate-pair-in-lineup surfaces via the shared-player rule and/or the
    // duplicate-key rule; either way it must not be accepted.
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a pairing already used earlier in the matchup", () => {
    const errors = validateLineup(
      { pairs: [["p1", "p2"], ["p3", "p4"], ["p5", "p6"]] },
      rules({ usedPairKeys: [pairKey(["p1", "p2"])] }),
    );
    expect(errors.some((e) => e.includes("already used earlier"))).toBe(true);
  });

  it("allows re-pairing players who were only paired differently before", () => {
    const errors = validateLineup(
      { pairs: [["p1", "p3"], ["p2", "p4"], ["p5", "p6"]] },
      rules({ usedPairKeys: [pairKey(["p1", "p2"])] }),
    );
    expect(errors).toEqual([]);
  });
});
