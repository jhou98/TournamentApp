import type { Request, RequestHandler } from "express";
import { ValidationError } from "../../../../domain/errors.js";
import type { TournamentService } from "../../../../services/tournamentService.js";

export const TOURNAMENT_HEADER = "X-Tournament-Id";

/** The tournament the client asked for, from the header or a `?tournament=` query. */
export function requestedTournamentId(req: Request): string | undefined {
  const fromHeader = req.header(TOURNAMENT_HEADER);
  const fromQuery = typeof req.query.tournament === "string" ? req.query.tournament : undefined;
  const value = (fromHeader ?? fromQuery ?? "").trim();
  return value.length > 0 ? value : undefined;
}

/**
 * Resolve the active tournament for a request and gate access to it (US28).
 * Requires a resolvable tournament — a bad/inaccessible id or an unresolved
 * choice (multiple accessible, none picked) is an error. Runs after requireAuth.
 */
export function makeResolveTournament(tournaments: TournamentService): RequestHandler {
  return (req, _res, next) => {
    tournaments
      .resolveActive(req.user!, requestedTournamentId(req))
      .then((id) => {
        if (!id) {
          next(new ValidationError("No tournament selected"));
          return;
        }
        req.tournamentId = id;
        next();
      })
      .catch(next);
  };
}
