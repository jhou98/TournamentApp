/**
 * Shop catalog (US19, scoped down for now): an admin creates power-ups with a
 * name, description and coin cost. Stock is unlimited at this stage — no
 * purchasing, activation timing or playoff-only flag yet (see artifact.md §7
 * for where this is headed). Powerups can be edited and removed at any time.
 */

import { NotFoundError, ValidationError } from "../domain/errors.js";
import { MAX_COIN_ADJUSTMENT } from "../domain/coinRule.js";
import type { PowerupRecord, PowerupRepo } from "../ports/index.js";

export interface PowerupServiceDeps {
  powerups: PowerupRepo;
}

/** A powerup shaped for the client. */
export interface PowerupView {
  id: string;
  name: string;
  description: string;
  cost: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePowerupInput {
  tournamentId: string;
  name: string;
  description: string;
  cost: number;
}

export interface UpdatePowerupInput {
  name?: string;
  description?: string;
  cost?: number;
}

export interface PowerupService {
  create(input: CreatePowerupInput): Promise<PowerupView>;
  listByTournament(tournamentId: string): Promise<PowerupView[]>;
  update(tournamentId: string, powerupId: string, patch: UpdatePowerupInput): Promise<PowerupView>;
  remove(tournamentId: string, powerupId: string): Promise<void>;
}

function toView(p: PowerupRecord): PowerupView {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    cost: p.cost,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError("A powerup needs a name");
  return trimmed;
}

function cleanDescription(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) throw new ValidationError("A powerup needs a description");
  return trimmed;
}

function checkCost(cost: number): void {
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new ValidationError("Cost must be a positive whole number");
  }
  if (cost > MAX_COIN_ADJUSTMENT) {
    throw new ValidationError(`Cost must be at most ${MAX_COIN_ADJUSTMENT}`);
  }
}

export function makePowerupService(deps: PowerupServiceDeps): PowerupService {
  async function requirePowerup(tournamentId: string, powerupId: string): Promise<PowerupRecord> {
    const powerup = await deps.powerups.findById(powerupId);
    if (!powerup || powerup.tournamentId !== tournamentId) {
      throw new NotFoundError("Powerup not found");
    }
    return powerup;
  }

  return {
    async create({ tournamentId, name, description, cost }) {
      const cleanedName = cleanName(name);
      const cleanedDescription = cleanDescription(description);
      checkCost(cost);
      const powerup = await deps.powerups.create({
        tournamentId,
        name: cleanedName,
        description: cleanedDescription,
        cost,
      });
      return toView(powerup);
    },

    async listByTournament(tournamentId) {
      return (await deps.powerups.listByTournament(tournamentId)).map(toView);
    },

    async update(tournamentId, powerupId, patch) {
      await requirePowerup(tournamentId, powerupId);
      const update: { name?: string; description?: string; cost?: number } = {};
      if (patch.name !== undefined) update.name = cleanName(patch.name);
      if (patch.description !== undefined) update.description = cleanDescription(patch.description);
      if (patch.cost !== undefined) {
        checkCost(patch.cost);
        update.cost = patch.cost;
      }
      return toView(await deps.powerups.update(powerupId, update));
    },

    async remove(tournamentId, powerupId) {
      await requirePowerup(tournamentId, powerupId);
      await deps.powerups.delete(powerupId);
    },
  };
}
