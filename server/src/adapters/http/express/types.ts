import type { PublicUser } from "../../../ports/index.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
      /** Active tournament resolved per request (US28); set by resolveTournament. */
      tournamentId?: string;
    }
  }
}

export {};
