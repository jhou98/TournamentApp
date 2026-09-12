import type { Request } from "express";
import { ValidationError } from "../../../domain/errors.js";

export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) {
    throw new ValidationError(`Missing route parameter: ${name}`);
  }
  return value;
}
