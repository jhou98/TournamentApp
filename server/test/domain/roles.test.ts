import { describe, expect, it } from "vitest";
import { deriveRole } from "../../src/domain/roles.js";

describe("deriveRole", () => {
  it("returns admin when isAdmin, regardless of membership", () => {
    expect(deriveRole(true, null)).toBe("admin");
    expect(deriveRole(true, "captain")).toBe("admin");
  });

  it("returns captain for a captain membership", () => {
    expect(deriveRole(false, "captain")).toBe("captain");
  });

  it("returns player otherwise", () => {
    expect(deriveRole(false, "member")).toBe("player");
    expect(deriveRole(false, null)).toBe("player");
  });
});
