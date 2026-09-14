import { describe, expect, it } from "vitest";
import { seedBracket } from "../../src/domain/playoffs.js";

const seeds = ["s1", "s2", "s3", "s4", "s5"];

describe("seedBracket", () => {
  it("seeds #1v#4 / #2v#3 feeding a final for 4 qualifiers", () => {
    const b = seedBracket(seeds, 4);
    expect(b.map((m) => m.slot)).toEqual(["SF1", "SF2", "F"]);
    const sf1 = b.find((m) => m.slot === "SF1")!;
    expect([sf1.teamAId, sf1.teamBId]).toEqual(["s1", "s4"]);
    const sf2 = b.find((m) => m.slot === "SF2")!;
    expect([sf2.teamAId, sf2.teamBId]).toEqual(["s2", "s3"]);
    const f = b.find((m) => m.slot === "F")!;
    expect(f.stage).toBe("final");
    expect([f.teamAId, f.teamBId]).toEqual([null, null]);
    expect([f.sourceA, f.sourceB]).toEqual(["SF1", "SF2"]);
  });

  it("collapses to a final only for 2 qualifiers", () => {
    const b = seedBracket(seeds, 2);
    expect(b).toHaveLength(1);
    expect(b[0]!.stage).toBe("final");
    expect([b[0]!.teamAId, b[0]!.teamBId]).toEqual(["s1", "s2"]);
  });

  it("rejects unsupported qualifier counts", () => {
    expect(() => seedBracket(seeds, 3)).toThrow();
    expect(() => seedBracket(seeds, 8)).toThrow();
  });

  it("rejects too few ranked teams", () => {
    expect(() => seedBracket(["s1", "s2"], 4)).toThrow();
  });
});
