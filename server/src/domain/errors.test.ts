import { describe, expect, it } from "vitest";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./errors.js";

describe("domain errors", () => {
  it("map to the expected HTTP status codes", () => {
    expect(new ValidationError("x").status).toBe(400);
    expect(new UnauthorizedError("x").status).toBe(401);
    expect(new ForbiddenError("x").status).toBe(403);
    expect(new NotFoundError("x").status).toBe(404);
    expect(new ConflictError("x").status).toBe(409);
  });

  it("are instances of DomainError and Error", () => {
    const err = new NotFoundError("missing");
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("missing");
    expect(err.code).toBe("NOT_FOUND");
  });
});
