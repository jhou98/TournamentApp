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

export interface ResetPasswordCommand {
  username: string;
  /** The shared registration code (or bootstrap admin code, for an admin account). */
  code: string;
  newPassword: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
  role: AppRole;
}

export interface MeProfile {
  user: PublicUser;
  role: AppRole;
  /** The active tournament this profile was resolved for (US28), or null. */
  tournamentId: string | null;
  team: { id: string; name: string } | null;
  captain: { id: string; username: string; displayName: string } | null;
}

export interface AuthServiceDeps {
  users: UserRepo;
  invites: InviteRepo;
  memberships: MembershipRepo;
  teams: TeamRepo;
  hasher: PasswordHasher;
  tokens: TokenService;
  bootstrapAdminCode: string;
  /** Shared code required for self-serve signup (anti-spam gate). */
  registrationCode: string;
}

export interface AuthService {
  signup(cmd: SignupCommand): Promise<AuthResult>;
  login(cmd: LoginCommand): Promise<AuthResult>;
  /**
   * Self-serve password reset (no email/identity verification — gated by the
   * same shared code used for signup; an admin account requires the bootstrap
   * admin code instead, so resetting one isn't as easy as knowing a username).
   */
  resetPassword(cmd: ResetPasswordCommand): Promise<void>;
  me(userId: string, tournamentId: string | null): Promise<MeProfile>;
}

export function makeAuthService(deps: AuthServiceDeps): AuthService {
  async function membershipInTournament(userId: string, tournamentId: string | null) {
    if (!tournamentId) return null;
    return deps.memberships.findByUserAndTournament(userId, tournamentId);
  }

  return {
    async signup(cmd) {
      const existing = await deps.users.findByUsername(cmd.username);
      if (existing) {
        throw new ConflictError("Username is already taken");
      }

      // Every signup must present a code (anti-spam gate): the admin bootstrap
      // code, the shared registration code, or a valid single-use invite.
      const code = cmd.inviteCode?.trim();
      if (!code) {
        throw new ValidationError("A registration code is required to sign up");
      }

      let isAdmin = false;
      let inviteIdToConsume: string | null = null;

      if (code === deps.bootstrapAdminCode) {
        isAdmin = true;
      } else if (code === deps.registrationCode) {
        isAdmin = false;
      } else {
        const invite = await deps.invites.findByCode(code);
        if (!invite || invite.usedBy) {
          throw new ValidationError("Invalid or already-used code");
        }
        if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
          throw new ValidationError("Code has expired");
        }
        isAdmin = invite.grantsAdmin;
        inviteIdToConsume = invite.id;
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

      // Login doesn't yet know which tournament is active — role there is refined
      // per active tournament by `me` (US28). Admin is admin everywhere.
      return {
        user: toPublicUser(user),
        token: deps.tokens.sign({ userId: user.id }),
        role: deriveRole(user.isAdmin, null),
      };
    },

    async resetPassword({ username, code, newPassword }) {
      const user = await deps.users.findByUsername(username);
      // Generic failure either way — don't reveal whether the username exists.
      const invalid = () => new ValidationError("Invalid username or code");
      if (!user) throw invalid();

      // An admin account needs the bootstrap admin code; everyone else needs
      // the shared registration code — same gate as signup, keyed by role.
      const requiredCode = user.isAdmin ? deps.bootstrapAdminCode : deps.registrationCode;
      if (code.trim() !== requiredCode) throw invalid();

      const passwordHash = await deps.hasher.hash(newPassword);
      await deps.users.setPassword(user.id, passwordHash);
    },

    async me(userId, tournamentId) {
      const user = await deps.users.findById(userId);
      if (!user) {
        throw new UnauthorizedError("User no longer exists");
      }

      const membership = await membershipInTournament(userId, tournamentId);

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
        tournamentId,
        team,
        captain,
      };
    },
  };
}
