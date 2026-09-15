/**
 * Bounties (US16): an admin puts a coin reward on a player or a team with a
 * description of what earns it. Bounties stack (many can be active at once) and
 * can be added mid-tournament. Completion is admin-driven for now (D17) — the
 * admin "awards" a bounty, which credits the target with `bounty` coin-ledger
 * rows (one per player, or one per current team member) and marks it awarded.
 *
 * Award rows are non-derived, so — like admin adjustments — they survive ledger
 * recompute and stay in each player's history (the note carries the description).
 */

import { NotFoundError, ValidationError } from "../domain/errors.js";
import { MAX_COIN_ADJUSTMENT } from "../domain/coinRule.js";
import type {
  BountyRecord,
  BountyRepo,
  BountyTargetType,
  CoinLedgerRepo,
  MembershipRepo,
  NewCoinTransaction,
  TeamRepo,
  TournamentRepo,
  UnitOfWork,
  UserRepo,
} from "../ports/index.js";

export interface BountyServiceDeps {
  bounties: BountyRepo;
  coinLedger: CoinLedgerRepo;
  tournaments: TournamentRepo;
  teams: TeamRepo;
  memberships: MembershipRepo;
  users: UserRepo;
  uow: UnitOfWork;
}

/** A bounty shaped for the client, with the target's name resolved. */
export interface BountyView {
  id: string;
  targetType: BountyTargetType;
  /** True for an open bounty (first player/team to complete it wins). */
  open: boolean;
  targetId: string | null;
  /** Player/team name; the winner for an awarded open bounty; null if open & unresolved. */
  targetName: string | null;
  description: string;
  coinValue: number;
  active: boolean;
  awardedAt: string | null;
  createdAt: string;
}

export interface CreateBountyInput {
  tournamentId: string;
  targetType: BountyTargetType;
  /** Omit (or null) to create an OPEN bounty scoped by targetType. */
  targetId?: string | null;
  description: string;
  coinValue: number;
}

export interface AwardBountyResult {
  bounty: BountyView;
  /** How many players were credited (1 for a player target, N for a team). */
  recipients: number;
}

export interface BountyService {
  create(input: CreateBountyInput): Promise<BountyView>;
  /** All of a tournament's bounties, newest first (target names resolved). */
  listByTournament(tournamentId: string): Promise<BountyView[]>;
  /** Only the still-active bounties (what players see). */
  listActive(tournamentId: string): Promise<BountyView[]>;
  /**
   * Award a bounty. For an open bounty, `winnerId` is required and names the
   * winning player/team (per the bounty's targetType); for a directed bounty it
   * is ignored (the preset target is credited).
   */
  award(tournamentId: string, bountyId: string, winnerId?: string): Promise<AwardBountyResult>;
  remove(tournamentId: string, bountyId: string): Promise<void>;
}

export function makeBountyService(deps: BountyServiceDeps): BountyService {
  /** Resolve target names for a batch of bounties (players + teams) in few reads. */
  async function toViews(tournamentId: string, bounties: BountyRecord[]): Promise<BountyView[]> {
    const teams = await deps.teams.listByTournament(tournamentId);
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    const playerIds = [
      ...new Set(
        bounties
          .filter((b) => b.targetType === "player" && b.targetId)
          .map((b) => b.targetId as string),
      ),
    ];
    const nameByUser = new Map<string, string>();
    for (const id of playerIds) {
      const user = await deps.users.findById(id);
      if (user) nameByUser.set(id, user.displayName);
    }

    return bounties.map((b) => ({
      id: b.id,
      targetType: b.targetType,
      open: b.open,
      targetId: b.targetId,
      targetName: !b.targetId
        ? null
        : b.targetType === "team"
          ? (teamNameById.get(b.targetId) ?? null)
          : (nameByUser.get(b.targetId) ?? null),
      description: b.description,
      coinValue: b.coinValue,
      active: b.active,
      awardedAt: b.awardedAt ? b.awardedAt.toISOString() : null,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async function requireBounty(tournamentId: string, bountyId: string): Promise<BountyRecord> {
    const bounty = await deps.bounties.findById(bountyId);
    if (!bounty || bounty.tournamentId !== tournamentId) {
      throw new NotFoundError("Bounty not found");
    }
    return bounty;
  }

  /** Verify a target exists in the tournament (throws NotFound otherwise). */
  async function validateTarget(
    tournamentId: string,
    targetType: BountyTargetType,
    targetId: string,
  ): Promise<void> {
    if (targetType === "player") {
      const membership = await deps.memberships.findByUserAndTournament(targetId, tournamentId);
      if (!membership) throw new NotFoundError("Player is not a member of this tournament");
    } else {
      const team = await deps.teams.findById(targetId);
      if (!team || team.tournamentId !== tournamentId) {
        throw new NotFoundError("Team is not part of this tournament");
      }
    }
  }

  /** The user ids credited when a target wins: the player, or every team member. */
  async function resolveRecipients(
    tournamentId: string,
    targetType: BountyTargetType,
    targetId: string,
  ): Promise<string[]> {
    if (targetType === "player") {
      const membership = await deps.memberships.findByUserAndTournament(targetId, tournamentId);
      if (!membership) throw new ValidationError("That player is no longer in this tournament");
      return [targetId];
    }
    const members = await deps.memberships.listByTeam(targetId);
    if (members.length === 0) throw new ValidationError("That team has no players to credit");
    return members.map((m) => m.userId);
  }

  return {
    async create({ tournamentId, targetType, targetId, description, coinValue }) {
      const desc = description.trim();
      if (!desc) throw new ValidationError("A bounty needs a description");
      if (!Number.isInteger(coinValue) || coinValue <= 0) {
        throw new ValidationError("Coin value must be a positive whole number");
      }
      if (coinValue > MAX_COIN_ADJUSTMENT) {
        throw new ValidationError(`Coin value must be at most ${MAX_COIN_ADJUSTMENT}`);
      }

      // An open bounty has no preset target (first to complete wins); a directed
      // bounty's target must belong to this tournament (coins are scoped, D6).
      const open = !targetId;
      if (!open) await validateTarget(tournamentId, targetType, targetId!);

      const bounty = await deps.bounties.create({
        tournamentId,
        targetType,
        open,
        targetId: open ? null : targetId!,
        description: desc,
        coinValue,
      });
      const [view] = await toViews(tournamentId, [bounty]);
      return view!;
    },

    async listByTournament(tournamentId) {
      return toViews(tournamentId, await deps.bounties.listByTournament(tournamentId));
    },

    async listActive(tournamentId) {
      const all = await deps.bounties.listByTournament(tournamentId);
      return toViews(
        tournamentId,
        all.filter((b) => b.active),
      );
    },

    async award(tournamentId, bountyId, winnerId) {
      const bounty = await requireBounty(tournamentId, bountyId);
      if (!bounty.active) throw new ValidationError("This bounty has already been awarded");

      // Who won? An open bounty is decided by the winnerId the admin supplies;
      // a directed bounty uses its preset target.
      let recipientTargetId: string;
      if (bounty.open) {
        if (!winnerId) throw new ValidationError("Choose the player or team that won this open bounty");
        await validateTarget(tournamentId, bounty.targetType, winnerId);
        recipientTargetId = winnerId;
      } else {
        recipientTargetId = bounty.targetId!;
      }

      // Resolve the recipients now (a team's roster can change over time).
      const recipientIds = await resolveRecipients(tournamentId, bounty.targetType, recipientTargetId);

      const rows: NewCoinTransaction[] = recipientIds.map((userId) => ({
        tournamentId,
        userId,
        delta: bounty.coinValue,
        reason: "bounty",
        bountyId: bounty.id,
        note: bounty.description,
      }));

      let updated!: BountyRecord;
      await deps.uow.run(async () => {
        await deps.coinLedger.createMany(rows);
        // Record the winner on an open bounty so the history shows who earned it.
        updated = await deps.bounties.markAwarded(bounty.id, bounty.open ? recipientTargetId : undefined);
      });

      const [view] = await toViews(tournamentId, [updated]);
      return { bounty: view!, recipients: recipientIds.length };
    },

    async remove(tournamentId, bountyId) {
      await requireBounty(tournamentId, bountyId);
      await deps.bounties.delete(bountyId);
    },
  };
}
