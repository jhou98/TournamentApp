/**
 * Player-facing shop (US20/US21, scoped down for now): browse the powerup
 * catalog, buy one with coins, see what's owned, and use one. A player can
 * own at most one *active* copy of a given powerup at a time — using it
 * deletes the purchase (consumed for good, free to rebuy) and claims that
 * player's own "one powerup per game" slot instead. No activation window yet.
 */

import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors.js";
import type {
  CoinLedgerRepo,
  GamePowerupUseRepo,
  GameRecord,
  GameRepo,
  LineupRepo,
  MatchupRepo,
  MembershipRepo,
  PowerupRepo,
  PublicUser,
  PurchaseRecord,
  PurchaseRepo,
  TournamentRepo,
  UnitOfWork,
} from "../ports/index.js";

export interface ShopServiceDeps {
  powerups: PowerupRepo;
  purchases: PurchaseRepo;
  coinLedger: CoinLedgerRepo;
  memberships: MembershipRepo;
  games: GameRepo;
  gamePowerupUses: GamePowerupUseRepo;
  matchups: MatchupRepo;
  lineups: LineupRepo;
  tournaments: TournamentRepo;
  uow: UnitOfWork;
}

/** Chronological ordering for "current game" lookup: stage, then round, then id. */
const STAGE_RANK: Record<string, number> = { round_robin: 0, semifinal: 1, third_place: 2, final: 2 };

/** A catalog powerup as a player sees it: buyable, or already owned. */
export interface ShopPowerupView {
  id: string;
  name: string;
  description: string;
  cost: number;
  owned: boolean;
}

/** An owned powerup, for the player's inventory. */
export interface InventoryItemView {
  id: string;
  powerupId: string;
  name: string;
  description: string;
  cost: number;
  purchasedAt: string;
}

export interface PurchaseResult {
  purchase: InventoryItemView;
  balance: number;
}

/** The result of using a powerup: which one, and which game it was applied to. */
export interface UsePowerupResult {
  powerupId: string;
  name: string;
  gameId: string;
}

export interface ShopService {
  listForUser(tournamentId: string, user: PublicUser): Promise<ShopPowerupView[]>;
  listInventory(tournamentId: string, user: PublicUser): Promise<InventoryItemView[]>;
  purchase(tournamentId: string, user: PublicUser, powerupId: string): Promise<PurchaseResult>;
  /**
   * Use an owned powerup (US21, scoped down — no activation window yet). Auto-
   * detects "the current game": the player's own earliest assigned-but-unscored
   * game. Claims that player's own one-per-game slot (race-safe) and consumes
   * the purchase for good — the player is free to buy another copy later.
   */
  use(tournamentId: string, user: PublicUser, purchaseId: string): Promise<UsePowerupResult>;
}

export function makeShopService(deps: ShopServiceDeps): ShopService {
  /**
   * Pre-release gate: captains/players are blocked while a tournament's
   * shopVisible flag is off. Admins always pass through.
   */
  async function requireVisible(tournamentId: string, user: PublicUser): Promise<void> {
    if (user.isAdmin) return;
    const t = await deps.tournaments.getDetail(tournamentId);
    if (!t || !t.shopVisible) throw new ForbiddenError("The shop isn't open yet");
  }

  /** The player's own earliest assigned-but-unscored game. */
  async function findCurrentGame(
    tournamentId: string,
    userId: string,
    teamId: string,
  ): Promise<GameRecord | null> {
    const lineups = await deps.lineups.listByTeam(teamId);
    const myPairIds = new Set(
      lineups.flatMap((l) => l.pairs.filter((p) => p.playerIds.includes(userId)).map((p) => p.id)),
    );
    if (myPairIds.size === 0) return null;

    const [games, matchups] = await Promise.all([
      deps.games.listByTournament(tournamentId),
      deps.matchups.listByTournament(tournamentId),
    ]);
    const matchupById = new Map(matchups.map((m) => [m.id, m]));

    const candidates = games
      .filter(
        (g) =>
          g.status === "assigned" &&
          ((g.homePairId && myPairIds.has(g.homePairId)) || (g.awayPairId && myPairIds.has(g.awayPairId))),
      )
      .map((g) => ({ game: g, matchup: matchupById.get(g.matchupId) }))
      .filter((c): c is { game: GameRecord; matchup: NonNullable<typeof c.matchup> } => !!c.matchup);

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const stageDiff = (STAGE_RANK[a.matchup.stage] ?? 0) - (STAGE_RANK[b.matchup.stage] ?? 0);
      if (stageDiff !== 0) return stageDiff;
      const roundDiff = (a.matchup.roundIndex ?? 0) - (b.matchup.roundIndex ?? 0);
      if (roundDiff !== 0) return roundDiff;
      const roundNoDiff = a.game.roundNo - b.game.roundNo;
      if (roundNoDiff !== 0) return roundNoDiff;
      return a.game.id < b.game.id ? -1 : a.game.id > b.game.id ? 1 : 0;
    });

    return candidates[0]!.game;
  }

  return {
    async listForUser(tournamentId, user) {
      await requireVisible(tournamentId, user);
      const [catalog, owned] = await Promise.all([
        deps.powerups.listByTournament(tournamentId),
        deps.purchases.listByUser(tournamentId, user.id),
      ]);
      const ownedPowerupIds = new Set(owned.map((p) => p.powerupId));
      return catalog.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        cost: p.cost,
        owned: ownedPowerupIds.has(p.id),
      }));
    },

    async listInventory(tournamentId, user) {
      await requireVisible(tournamentId, user);
      const owned = await deps.purchases.listByUser(tournamentId, user.id);
      const items: InventoryItemView[] = [];
      for (const purchase of owned) {
        const powerup = await deps.powerups.findById(purchase.powerupId);
        if (!powerup) continue; // deleted since purchase (cascades in practice, defensive here)
        items.push({
          id: purchase.id,
          powerupId: powerup.id,
          name: powerup.name,
          description: powerup.description,
          cost: purchase.costPaid,
          purchasedAt: purchase.createdAt.toISOString(),
        });
      }
      return items;
    },

    async purchase(tournamentId, user, powerupId) {
      await requireVisible(tournamentId, user);
      const userId = user.id;
      const powerup = await deps.powerups.findById(powerupId);
      if (!powerup || powerup.tournamentId !== tournamentId) {
        throw new NotFoundError("Powerup not found");
      }

      const already = await deps.purchases.findByUserAndPowerup(userId, powerupId);
      if (already) throw new ValidationError("You already own this powerup");

      const balance = await deps.coinLedger.sumByUser(tournamentId, userId);
      if (balance < powerup.cost) throw new ValidationError("Not enough coins to buy this powerup");

      let purchase!: PurchaseRecord;
      await deps.uow.run(async () => {
        purchase = await deps.purchases.create({
          tournamentId,
          userId,
          powerupId,
          costPaid: powerup.cost,
        });
        await deps.coinLedger.create({
          tournamentId,
          userId,
          delta: -powerup.cost,
          reason: "purchase",
          purchaseId: purchase.id,
          note: powerup.name,
        });
      });

      const newBalance = await deps.coinLedger.sumByUser(tournamentId, userId);
      return {
        purchase: {
          id: purchase.id,
          powerupId: powerup.id,
          name: powerup.name,
          description: powerup.description,
          cost: purchase.costPaid,
          purchasedAt: purchase.createdAt.toISOString(),
        },
        balance: newBalance,
      };
    },

    async use(tournamentId, user, purchaseId) {
      await requireVisible(tournamentId, user);
      const userId = user.id;
      const purchase = await deps.purchases.findById(purchaseId);
      if (!purchase || purchase.tournamentId !== tournamentId || purchase.userId !== userId) {
        throw new NotFoundError("Powerup not found in your inventory");
      }

      const membership = await deps.memberships.findByUserAndTournament(userId, tournamentId);
      if (!membership) throw new NotFoundError("You are not part of this tournament");

      const game = await findCurrentGame(tournamentId, userId, membership.teamId);
      if (!game) {
        throw new ValidationError("You don't have a game in progress to use a powerup on right now");
      }

      const powerup = await deps.powerups.findById(purchase.powerupId);

      let claimed = false;
      await deps.uow.run(async () => {
        claimed = await deps.gamePowerupUses.claim(game.id, userId);
        if (!claimed) return;
        await deps.purchases.delete(purchase.id);
      });

      if (!claimed) throw new ValidationError("You've already used a powerup in this game");

      return { powerupId: purchase.powerupId, name: powerup?.name ?? "Powerup", gameId: game.id };
    },
  };
}
