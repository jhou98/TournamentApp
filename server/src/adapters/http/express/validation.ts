import { z } from "zod";
import { ValidationError } from "../../../domain/errors.js";
import { containsControlChars, containsUnsafeMarkup } from "../../../domain/security.js";

/** Parse a request payload against a zod schema, mapping failures to a 400. */
export function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

/**
 * A trimmed free-text field with an XSS-hardened character policy: no control
 * characters and no HTML/script markup. Use this for any user-entered string
 * that gets stored and later rendered (names, labels, descriptions, notes).
 */
export function safeText({ min = 1, max }: { min?: number; max: number }) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !containsControlChars(v), {
      message: "Text may not contain control characters",
    })
    .refine((v) => !containsUnsafeMarkup(v), {
      message: "Text may not contain HTML or script markup",
    });
}
