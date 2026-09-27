/**
 * Missions (US23, scoped down for now): an admin writes a mission and a prize
 * description, and assigns it to one player. The player does the mission in
 * person and shows the commissioner, who awards coins manually via the
 * existing coin-adjustment tool — completing a mission here just removes it
 * from the player's list (no automatic coin credit, status, or expiration
 * yet). Missions are only ever shown to the assigned player and to admins.
 */

import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { MembershipRepo, MissionRecord, MissionRepo, UserRepo } from "../ports/index.js";

export interface MissionServiceDeps {
  missions: MissionRepo;
  memberships: MembershipRepo;
  users: UserRepo;
}

/** A mission shaped for the admin view, with the assignee's name resolved. */
export interface MissionView {
  id: string;
  userId: string;
  playerName: string;
  description: string;
  prize: string;
  createdAt: string;
}

/** A mission shaped for the assigned player — no need to name themselves. */
export interface MyMissionView {
  id: string;
  description: string;
  prize: string;
  createdAt: string;
}

export interface CreateMissionInput {
  tournamentId: string;
  userId: string;
  description: string;
  prize: string;
}

export interface MissionService {
  create(input: CreateMissionInput): Promise<MissionView>;
  listByTournament(tournamentId: string): Promise<MissionView[]>;
  listForUser(tournamentId: string, userId: string): Promise<MyMissionView[]>;
  /** Admin cancels/removes a mission outright. */
  remove(tournamentId: string, missionId: string): Promise<void>;
  /** The assigned player marks it done (shown the commissioner in person) — deletes it. */
  complete(tournamentId: string, userId: string, missionId: string): Promise<void>;
}

export function makeMissionService(deps: MissionServiceDeps): MissionService {
  async function toView(m: MissionRecord): Promise<MissionView> {
    const user = await deps.users.findById(m.userId);
    return {
      id: m.id,
      userId: m.userId,
      playerName: user?.displayName ?? "(removed)",
      description: m.description,
      prize: m.prize,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async function requireMission(tournamentId: string, missionId: string): Promise<MissionRecord> {
    const mission = await deps.missions.findById(missionId);
    if (!mission || mission.tournamentId !== tournamentId) {
      throw new NotFoundError("Mission not found");
    }
    return mission;
  }

  return {
    async create({ tournamentId, userId, description, prize }) {
      const desc = description.trim();
      if (!desc) throw new ValidationError("A mission needs a description");
      const cleanPrize = prize.trim();
      if (!cleanPrize) throw new ValidationError("A mission needs a prize");

      const membership = await deps.memberships.findByUserAndTournament(userId, tournamentId);
      if (!membership) throw new NotFoundError("Player is not a member of this tournament");

      const mission = await deps.missions.create({ tournamentId, userId, description: desc, prize: cleanPrize });
      return toView(mission);
    },

    async listByTournament(tournamentId) {
      const missions = await deps.missions.listByTournament(tournamentId);
      return Promise.all(missions.map(toView));
    },

    async listForUser(tournamentId, userId) {
      const missions = await deps.missions.listByUser(tournamentId, userId);
      return missions.map((m) => ({
        id: m.id,
        description: m.description,
        prize: m.prize,
        createdAt: m.createdAt.toISOString(),
      }));
    },

    async remove(tournamentId, missionId) {
      await requireMission(tournamentId, missionId);
      await deps.missions.delete(missionId);
    },

    async complete(tournamentId, userId, missionId) {
      const mission = await requireMission(tournamentId, missionId);
      if (mission.userId !== userId) throw new NotFoundError("Mission not found");
      await deps.missions.delete(missionId);
    },
  };
}
