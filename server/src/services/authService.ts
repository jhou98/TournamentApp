import { ConflictError, UnauthorizedError, ValidationError } from "../domain/errors.js";
import { deriveRole, type AppRole } from "../domain/roles.js";
import {
  toPublicUser,
  type InviteRepo,
  type MembershipRepo,
  type PasswordHasher,
  type PublicUser,
  type TeamRepo,
  type TokenService,
  type TournamentRepo,
  type UserRepo,
} from "../ports/index.js";

export interface SignupCommand {
  username: string;
  password: string;
  displayName: string;
  inviteCode?: string;
}

export interface LoginCommand {
  username: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
  role: AppRole;
}

export interface MeProfile {
  user: PublicUser;
  role: AppRole;
  team: { id: string; name: string } | null;
  captain: { id: string; username: string; displayName: string } | null;
}

export interface AuthServiceDeps {
  users: UserRepo;
  invites: InviteRepo;
  memberships: MembershipRepo;
  teams: TeamRepo;
  tournaments: TournamentRepo;
  hasher: PasswordHasher;
  tokens: TokenService;
  bootstrapAdminCode: string;
}

export interface AuthService {
  signup(cmd: SignupCommand): Promise<AuthResult>;
  login(cmd: LoginCommand): Promise<AuthResult>;
  me(userId: string): Promise<MeProfile>;
}

export function makeAuthService(deps: AuthServiceDeps): AuthService {
  async function currentMembershipRole(userId: string) {
    const tournament = await deps.tournaments.getCurrent();
    if (!tournament) return { tournamentId: null, membership: null };
    const membership = await deps.memberships.findByUserAndTournament(userId, tournament.id);
    return { tournamentId: tournament.id, membership };
  }

  return {
    async signup(cmd) {
      const existing = await deps.users.findByUsername(cmd.username);
      if (existing) {
        throw new ConflictError("Username is already taken");
      }

      let isAdmin = false;
      let inviteIdToConsume: string | null = null;

      if (cmd.inviteCode) {
        if (cmd.inviteCode === deps.bootstrapAdminCode) {
          isAdmin = true;
        } else {
          const invite = await deps.invites.findByCode(cmd.inviteCode);
          if (!invite || invite.usedBy) {
            throw new ValidationError("Invalid or already-used invite code");
          }
          if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
            throw new ValidationError("Invite code has expired");
          }
          isAdmin = invite.grantsAdmin;
          inviteIdToConsume = invite.id;
        }
      }

      const passwordHash = await deps.hasher.hash(cmd.password);
      const user = await deps.users.create({
        username: cmd.username,
        displayName: cmd.displayName,
        passwordHash,
        isAdmin,
      });

      if (inviteIdToConsume) {
        await deps.invites.markUsed(inviteIdToConsume, user.id);
      }

      return {
        user: toPublicUser(user),
        token: deps.tokens.sign({ userId: user.id }),
        role: deriveRole(user.isAdmin, null),
      };
    },

    async login(cmd) {
      const user = await deps.users.findByUsername(cmd.username);
      if (!user) {
        throw new UnauthorizedError("Invalid username or password");
      }
      const ok = await deps.hasher.verify(cmd.password, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedError("Invalid username or password");
      }

      const { membership } = await currentMembershipRole(user.id);
      return {
        user: toPublicUser(user),
        token: deps.tokens.sign({ userId: user.id }),
        role: deriveRole(user.isAdmin, membership?.role ?? null),
      };
    },

    async me(userId) {
      const user = await deps.users.findById(userId);
      if (!user) {
        throw new UnauthorizedError("User no longer exists");
      }

      const { membership } = await currentMembershipRole(userId);

      let team: MeProfile["team"] = null;
      let captain: MeProfile["captain"] = null;

      if (membership) {
        const teamRecord = await deps.teams.findById(membership.teamId);
        if (teamRecord) {
          team = { id: teamRecord.id, name: teamRecord.name };
          const teamMembers = await deps.memberships.listByTeam(teamRecord.id);
          const captainMembership = teamMembers.find((m) => m.role === "captain");
          if (captainMembership) {
            const captainUser = await deps.users.findById(captainMembership.userId);
            if (captainUser) {
              captain = {
                id: captainUser.id,
                username: captainUser.username,
                displayName: captainUser.displayName,
              };
            }
          }
        }
      }

      return {
        user: toPublicUser(user),
        role: deriveRole(user.isAdmin, membership?.role ?? null),
        team,
        captain,
      };
    },
  };
}
