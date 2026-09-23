import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors.js";
import {
  DEFAULT_COIN_RULE,
  DEFAULT_STREAK_RULE,
  DEFAULT_SUDDEN_DEATH_RULE,
  DEFAULT_TOURNAMENT_CONFIG,
} from "../domain/tournamentDefaults.js";
import type {
  MembershipRepo,
  PublicUser,
  TournamentConfig,
  TournamentDetail,
  TournamentRepo,
  TournamentSummary,
} from "../ports/index.js";

export interface CreateTournamentInput {
  name: string;
  config?: Partial<TournamentConfig>;
}

export interface TournamentServiceDeps {
  tournaments: TournamentRepo;
  memberships: MembershipRepo;
}

export interface TournamentService {
  /** Tournaments the caller may see: admins → all; others → those they're rostered in. */
  listAccessible(user: PublicUser): Promise<TournamentSummary[]>;
  /**
   * Resolve the request's active tournament id, enforcing access:
   * - a requested id must be in the accessible set (else 404);
   * - with no request, a single accessible tournament is used automatically;
   * - zero accessible → null (the endpoint decides whether that's an error);
   * - many accessible and none requested → the caller must pick (400).
   */
  resolveActive(user: PublicUser, requestedId?: string | null): Promise<string | null>;
  create(user: PublicUser, input: CreateTournamentInput): Promise<TournamentDetail>;
  /** Toggle the Shop/Inventory pre-release flag for captains/players (admins always see it). */
  setShopVisible(tournamentId: string, visible: boolean): Promise<TournamentDetail>;
  /** Set the potluck event's date/time and address. */
  setPotluckDetails(
    tournamentId: string,
    patch: { eventAt: Date | null; address: string | null },
  ): Promise<TournamentDetail>;
}

export function makeTournamentService(deps: TournamentServiceDeps): TournamentService {
  async function listAccessible(user: PublicUser): Promise<TournamentSummary[]> {
    if (user.isAdmin) return deps.tournaments.list();
    const memberships = await deps.memberships.listByUser(user.id);
    const ids = [...new Set(memberships.map((m) => m.tournamentId))];
    return deps.tournaments.listByIds(ids);
  }

  return {
    listAccessible,

    async resolveActive(user, requestedId) {
      const accessible = await listAccessible(user);
      if (requestedId) {
        const match = accessible.find((t) => t.id === requestedId);
        if (!match) throw new NotFoundError("Tournament not found");
        return match.id;
      }
      if (accessible.length === 1) return accessible[0]!.id;
      if (accessible.length === 0) return null;
      throw new ValidationError("Select a tournament");
    },

    async create(user, input) {
      if (!user.isAdmin) throw new ForbiddenError("Only an admin can create a tournament");
      const name = input.name?.trim();
      if (!name) throw new ValidationError("Tournament name is required");

      const config: TournamentConfig = { ...DEFAULT_TOURNAMENT_CONFIG, ...(input.config ?? {}) };
      for (const [key, value] of Object.entries(config)) {
        if (!Number.isInteger(value) || value < 1) {
          throw new ValidationError(`${key} must be a positive integer`);
        }
      }
      if (config.teamCount < 2) throw new ValidationError("teamCount must be at least 2");
      if (config.playoffQualifiers > config.teamCount) {
        throw new ValidationError("playoffQualifiers cannot exceed teamCount");
      }

      return deps.tournaments.create({
        name,
        ...config,
        coinRule: DEFAULT_COIN_RULE,
        streakRule: DEFAULT_STREAK_RULE,
        suddenDeathRule: DEFAULT_SUDDEN_DEATH_RULE,
      });
    },

    async setShopVisible(tournamentId, visible) {
      return deps.tournaments.setShopVisible(tournamentId, visible);
    },

    async setPotluckDetails(tournamentId, patch) {
      const address = patch.address?.trim() || null;
      return deps.tournaments.setPotluckDetails(tournamentId, { eventAt: patch.eventAt, address });
    },
  };
}
