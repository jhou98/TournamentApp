import jwt from "jsonwebtoken";
import type { TokenPayload, TokenService } from "../../ports/index.js";

const EXPIRES_IN = "7d";

export function makeJwtTokenService(secret: string): TokenService {
  return {
    sign(payload) {
      return jwt.sign({ userId: payload.userId }, secret, { expiresIn: EXPIRES_IN });
    },
    verify(token) {
      try {
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === "object" && decoded !== null && typeof decoded.userId === "string") {
          return { userId: decoded.userId } satisfies TokenPayload;
        }
        return null;
      } catch {
        return null;
      }
    },
  };
}
