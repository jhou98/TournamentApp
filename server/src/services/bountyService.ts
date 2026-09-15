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
  targetId: string;
  /** Player display name or team name; null if the target no longer exists. */
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
  targetId: string;
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
  award(tournamentId: string, bountyId: string): Promise<AwardBountyResult>;
  remove(tournamentId: string, bountyId: string): Promise<void>;
}

export function makeBountyService(deps: BountyServiceDeps): BountyService {
  /** Resolve target names for a batch of bounties (players + teams) in few reads. */
  async function toViews(tournamentId: string, bounties: BountyRecord[]): Promise<BountyView[]> {
    const teams = await deps.teams.listByTournament(tournamentId);
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    const playerIds = [
      ...new Set(bounties.filter((b) => b.targetType === "player").map((b) => b.targetId)),
    ];
    const nameByUser = new Map<string, string>();
    for (const id of playerIds) {
      const user = await deps.users.findById(id);
      if (user) nameByUser.set(id, user.displayName);
    }

    return bounties.map((b) => ({
      id: b.id,
      targetType: b.targetType,
      targetId: b.targetId,
      targetName:
        b.targetType === "team" ? (teamNameById.get(b.targetId) ?? null) : (nameByUser.get(b.targetId) ?? null),
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

      // The target must belong to this tournament (coins are tournament-scoped, D6).
      if (targetType === "player") {
        const membership = await deps.memberships.findByUserAndTournament(targetId, tournamentId);
        if (!membership) throw new NotFoundError("Player is not a member of this tournament");
      } else {
        const team = await deps.teams.findById(targetId);
        if (!team || team.tournamentId !== tournamentId) {
          throw new NotFoundError("Team is not part of this tournament");
        }
      }

      const bounty = await deps.bounties.create({
        tournamentId,
        targetType,
        targetId,
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

    async award(tournamentId, bountyId) {
      const bounty = await requireBounty(tournamentId, bountyId);
      if (!bounty.active) throw new ValidationError("This bounty has already been awarded");

      // Resolve the recipients now (a team's roster can change over time).
      let recipientIds: string[];
      if (bounty.targetType === "player") {
        const membership = await deps.memberships.findByUserAndTournament(bounty.targetId, tournamentId);
        if (!membership) throw new ValidationError("The bounty's player is no longer in this tournament");
        recipientIds = [bounty.targetId];
      } else {
        const members = await deps.memberships.listByTeam(bounty.targetId);
        recipientIds = members.map((m) => m.userId);
        if (recipientIds.length === 0) throw new ValidationError("The bounty's team has no players to credit");
      }

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
        updated = await deps.bounties.markAwarded(bounty.id);
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
