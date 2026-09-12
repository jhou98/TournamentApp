import { describe, expect, it } from "vitest";
import { balancePlayers } from "./autoBalance.js";

describe("balancePlayers", () => {
  it("distributes players evenly round-robin", () => {
    const result = balancePlayers(["p1", "p2", "p3", "p4"], ["a", "b"]);
    expect(result.get("a")).toEqual(["p1", "p3"]);
    expect(result.get("b")).toEqual(["p2", "p4"]);
  });

  it("handles an uneven split by giving earlier teams the extra", () => {
    const result = balancePlayers(["p1", "p2", "p3"], ["a", "b"]);
    expect(result.get("a")).toEqual(["p1", "p3"]);
    expect(result.get("b")).toEqual(["p2"]);
  });

  it("returns empty rosters for every team when there are no players", () => {
    const result = balancePlayers([], ["a", "b"]);
    expect(result.get("a")).toEqual([]);
    expect(result.get("b")).toEqual([]);
  });

  it("returns an empty map when there are no teams", () => {
    const result = balancePlayers(["p1"], []);
    expect(result.size).toBe(0);
  });
});
