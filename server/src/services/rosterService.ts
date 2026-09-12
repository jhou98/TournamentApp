import { balancePlayers } from "../domain/autoBalance.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import type {
  InviteRecord,
  InviteRepo,
  MembershipRepo,
  MembershipRole,
  PublicUser,
  TeamRepo,
  TournamentRepo,
  UnitOfWork,
  UserRepo,
} from "../ports/index.js";

export interface TeamRosterMember {
  userId: string;
  username: string;
  displayName: string;
  role: MembershipRole;
}

export interface TeamWithRoster {
  id: string;
  name: string;
  members: TeamRosterMember[];
}

export interface RosterServiceDeps {
  users: UserRepo;
  teams: TeamRepo;
  memberships: MembershipRepo;
  invites: InviteRepo;
  tournaments: TournamentRepo;
  uow: UnitOfWork;
  generateCode: () => string;
}

export interface RosterService {
  listUsers(): Promise<PublicUser[]>;
  setAdmin(userId: string, isAdmin: boolean): Promise<PublicUser>;
  createInvite(input: { grantsAdmin: boolean; expiresAt: Date | null }, createdBy: string): Promise<InviteRecord>;
  listTeams(): Promise<TeamWithRoster[]>;
  createTeam(name: string): Promise<TeamWithRoster>;
  assignMember(userId: string, teamId: string, role?: MembershipRole): Promise<void>;
  removeMember(userId: string): Promise<void>;
  setCaptain(teamId: string, userId: string): Promise<void>;
  autoBalance(): Promise<TeamWithRoster[]>;
}

export function makeRosterService(deps: RosterServiceDeps): RosterService {
  async function requireTournamentId(): Promise<string> {
    const tournament = await deps.tournaments.getCurrent();
    if (!tournament) {
      throw new ValidationError("No tournament exists yet");
    }
    return tournament.id;
  }

  async function rosterForTeam(teamId: string, name: string): Promise<TeamWithRoster> {
    const memberships = await deps.memberships.listByTeam(teamId);
    const members: TeamRosterMember[] = [];
    for (const m of memberships) {
      const user = await deps.users.findById(m.userId);
      if (user) {
        members.push({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          role: m.role,
        });
      }
    }
    return { id: teamId, name, members };
  }

  return {
    async listUsers() {
      return deps.users.list();
    },

    async setAdmin(userId, isAdmin) {
      const user = await deps.users.findById(userId);
      if (!user) throw new NotFoundError("User not found");
      return deps.users.setAdmin(userId, isAdmin);
    },

    async createInvite(input, createdBy) {
      return deps.invites.create({
        code: deps.generateCode(),
        grantsAdmin: input.grantsAdmin,
        createdBy,
        expiresAt: input.expiresAt,
      });
    },

    async listTeams() {
      const tournamentId = await requireTournamentId();
      const teams = await deps.teams.listByTournament(tournamentId);
      return Promise.all(teams.map((t) => rosterForTeam(t.id, t.name)));
    },

    async createTeam(name) {
      const tournamentId = await requireTournamentId();
      const existing = await deps.teams.findByName(tournamentId, name);
      if (existing) throw new ConflictError("A team with that name already exists");
      const team = await deps.teams.create(tournamentId, name);
      return { id: team.id, name: team.name, members: [] };
    },

    async assignMember(userId, teamId, role = "member") {
      const tournamentId = await requireTournamentId();
      const user = await deps.users.findById(userId);
      if (!user) throw new NotFoundError("User not found");
      const team = await deps.teams.findById(teamId);
      if (!team || team.tournamentId !== tournamentId) throw new NotFoundError("Team not found");

      await deps.uow.run(async () => {
        await deps.memberships.assign(userId, tournamentId, teamId, "member");
        if (role === "captain") {
          await promoteCaptain(teamId, userId, tournamentId);
        }
      });
    },

    async removeMember(userId) {
      const tournamentId = await requireTournamentId();
      await deps.memberships.removeByUserAndTournament(userId, tournamentId);
    },

    async setCaptain(teamId, userId) {
      const tournamentId = await requireTournamentId();
      const team = await deps.teams.findById(teamId);
      if (!team || team.tournamentId !== tournamentId) throw new NotFoundError("Team not found");
      const membership = await deps.memberships.findByUserAndTournament(userId, tournamentId);
      if (!membership || membership.teamId !== teamId) {
        throw new ValidationError("User must be a member of this team before becoming captain");
      }

      await deps.uow.run(async () => {
        await promoteCaptain(teamId, userId, tournamentId);
      });
    },

    async autoBalance() {
      const tournamentId = await requireTournamentId();
      const teams = await deps.teams.listByTournament(tournamentId);
      if (teams.length === 0) throw new ValidationError("Create teams before auto-balancing");

      const users = await deps.users.list();
      const playerIds = users.filter((u) => !u.isAdmin).map((u) => u.id);
      const assignment = balancePlayers(
        playerIds,
        teams.map((t) => t.id),
      );

      await deps.uow.run(async () => {
        for (const [teamId, ids] of assignment) {
          for (const id of ids) {
            await deps.memberships.assign(id, tournamentId, teamId, "member");
          }
        }
      });

      return Promise.all(teams.map((t) => rosterForTeam(t.id, t.name)));
    },
  };

  /** Demote any existing captain of the team, then set the target as captain. */
  async function promoteCaptain(teamId: string, userId: string, tournamentId: string) {
    const members = await deps.memberships.listByTeam(teamId);
    for (const m of members) {
      if (m.role === "captain" && m.userId !== userId) {
        await deps.memberships.setRole(m.userId, tournamentId, "member");
      }
    }
    await deps.memberships.setRole(userId, tournamentId, "captain");
  }
}
