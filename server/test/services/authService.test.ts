import { beforeEach, describe, expect, it } from "vitest";
import { makeAuthService, type AuthService } from "../../src/services/authService.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../../src/domain/errors.js";
import type {
  InviteRecord,
  InviteRepo,
  MembershipRecord,
  MembershipRepo,
  PasswordHasher,
  TeamRepo,
  TokenService,
  UserRecord,
  UserRepo,
} from "../../src/ports/index.js";

const BOOTSTRAP = "bootstrap-code";
const REGISTRATION = "registration-code";

function fakeUserRepo(): UserRepo & { store: UserRecord[] } {
  const store: UserRecord[] = [];
  let seq = 0;
  return {
    store,
    async create(u) {
      const rec: UserRecord = { id: `u${++seq}`, createdAt: new Date(), ...u };
      store.push(rec);
      return rec;
    },
    async findById(id) {
      return store.find((u) => u.id === id) ?? null;
    },
    async findByUsername(username) {
      return store.find((u) => u.username === username) ?? null;
    },
    async list() {
      return store.map(({ passwordHash: _hash, ...rest }) => rest);
    },
    async setAdmin(id, isAdmin) {
      const u = store.find((x) => x.id === id)!;
      u.isAdmin = isAdmin;
      const { passwordHash: _hash, ...rest } = u;
      return rest;
    },
  };
}

function fakeInviteRepo(seed: InviteRecord[] = []): InviteRepo & { store: InviteRecord[] } {
  const store = [...seed];
  return {
    store,
    async create(input) {
      const rec: InviteRecord = { id: `i${store.length + 1}`, usedBy: null, usedAt: null, ...input };
      store.push(rec);
      return rec;
    },
    async findByCode(code) {
      return store.find((i) => i.code === code) ?? null;
    },
    async markUsed(id, usedBy) {
      const i = store.find((x) => x.id === id)!;
      i.usedBy = usedBy;
      i.usedAt = new Date();
    },
  };
}

const noMemberships: MembershipRepo = {
  async findByUserAndTournament() {
    return null;
  },
  async listByUser() {
    return [];
  },
  async listByTeam() {
    return [];
  },
  async listByTournament() {
    return [];
  },
  async assign() {
    throw new Error("not used");
  },
  async setRole() {
    throw new Error("not used");
  },
  async removeByUserAndTournament() {},
};

const noTeams: TeamRepo = {
  async create() {
    throw new Error("not used");
  },
  async findById() {
    return null;
  },
  async findByName() {
    return null;
  },
  async listByTournament() {
    return [];
  },
  async delete() {
    throw new Error("not used");
  },
};

const fakeHasher: PasswordHasher = {
  async hash(plain) {
    return `hashed:${plain}`;
  },
  async verify(plain, hash) {
    return hash === `hashed:${plain}`;
  },
};

const fakeTokens: TokenService = {
  sign({ userId }) {
    return `tok:${userId}`;
  },
  verify(token) {
    return token.startsWith("tok:") ? { userId: token.slice(4) } : null;
  },
};

function build(overrides?: {
  users?: UserRepo;
  invites?: InviteRepo;
  memberships?: MembershipRepo;
  teams?: TeamRepo;
}): AuthService {
  return makeAuthService({
    users: overrides?.users ?? fakeUserRepo(),
    invites: overrides?.invites ?? fakeInviteRepo(),
    memberships: overrides?.memberships ?? noMemberships,
    teams: overrides?.teams ?? noTeams,
    hasher: fakeHasher,
    tokens: fakeTokens,
    bootstrapAdminCode: BOOTSTRAP,
    registrationCode: REGISTRATION,
  });
}

describe("authService.signup", () => {
  let users: ReturnType<typeof fakeUserRepo>;

  beforeEach(() => {
    users = fakeUserRepo();
  });

  it("creates a normal user with the registration code", async () => {
    const auth = build({ users });
    const result = await auth.signup({
      username: "alice",
      password: "password123",
      displayName: "Alice",
      inviteCode: REGISTRATION,
    });
    expect(result.role).toBe("player");
    expect(result.user.isAdmin).toBe(false);
    expect(result.token).toBe(`tok:${result.user.id}`);
    expect(users.store[0]!.passwordHash).toBe("hashed:password123");
  });

  it("rejects a signup with no code (anti-spam gate)", async () => {
    const auth = build({ users });
    await expect(
      auth.signup({ username: "bot", password: "password123", displayName: "Bot" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(users.store).toHaveLength(0);
  });

  it("creates an admin with the bootstrap code", async () => {
    const auth = build({ users });
    const result = await auth.signup({
      username: "boss",
      password: "password123",
      displayName: "Boss",
      inviteCode: BOOTSTRAP,
    });
    expect(result.role).toBe("admin");
    expect(result.user.isAdmin).toBe(true);
  });

  it("consumes an admin-granting invite", async () => {
    const invites = fakeInviteRepo([
      { id: "i1", code: "ADMIN1", grantsAdmin: true, createdBy: "u0", expiresAt: null, usedBy: null, usedAt: null },
    ]);
    const auth = build({ users, invites });
    const result = await auth.signup({
      username: "vip",
      password: "password123",
      displayName: "VIP",
      inviteCode: "ADMIN1",
    });
    expect(result.user.isAdmin).toBe(true);
    expect(invites.store[0]!.usedBy).toBe(result.user.id);
  });

  it("rejects a duplicate username", async () => {
    const auth = build({ users });
    await auth.signup({ username: "dup", password: "password123", displayName: "Dup", inviteCode: REGISTRATION });
    await expect(
      auth.signup({ username: "dup", password: "password123", displayName: "Dup2", inviteCode: REGISTRATION }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects an unknown invite code", async () => {
    const auth = build({ users });
    await expect(
      auth.signup({ username: "x", password: "password123", displayName: "X", inviteCode: "nope" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an expired invite", async () => {
    const invites = fakeInviteRepo([
      {
        id: "i1",
        code: "OLD",
        grantsAdmin: true,
        createdBy: "u0",
        expiresAt: new Date(Date.now() - 1000),
        usedBy: null,
        usedAt: null,
      },
    ]);
    const auth = build({ users, invites });
    await expect(
      auth.signup({ username: "x", password: "password123", displayName: "X", inviteCode: "OLD" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("authService.login", () => {
  it("returns a token on valid credentials", async () => {
    const users = fakeUserRepo();
    const auth = build({ users });
    await auth.signup({ username: "alice", password: "password123", displayName: "Alice", inviteCode: REGISTRATION });
    const result = await auth.login({ username: "alice", password: "password123" });
    expect(result.user.username).toBe("alice");
    expect(result.token).toBe(`tok:${result.user.id}`);
  });

  it("rejects a wrong password", async () => {
    const users = fakeUserRepo();
    const auth = build({ users });
    await auth.signup({ username: "alice", password: "password123", displayName: "Alice", inviteCode: REGISTRATION });
    await expect(auth.login({ username: "alice", password: "wrong" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects an unknown user", async () => {
    const auth = build();
    await expect(auth.login({ username: "ghost", password: "password123" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("authService.me", () => {
  it("returns team and captain for a member", async () => {
    const users = fakeUserRepo();
    const captain = await users.create({
      username: "cap",
      displayName: "Cap",
      passwordHash: "x",
      isAdmin: false,
    });
    const player = await users.create({
      username: "plr",
      displayName: "Player",
      passwordHash: "x",
      isAdmin: false,
    });

    const memberships: MembershipRepo = {
      ...noMemberships,
      async findByUserAndTournament(userId) {
        return {
          id: "m",
          userId,
          teamId: "team1",
          tournamentId: "t1",
          role: userId === captain.id ? "captain" : "member",
          createdAt: new Date(),
        } satisfies MembershipRecord;
      },
      async listByTeam() {
        return [
          { id: "mc", userId: captain.id, teamId: "team1", tournamentId: "t1", role: "captain", createdAt: new Date() },
        ];
      },
    };
    const teams: TeamRepo = {
      ...noTeams,
      async findById(id) {
        return { id, tournamentId: "t1", name: "Team One", createdAt: new Date() };
      },
    };

    const auth = build({ users, memberships, teams });
    const profile = await auth.me(player.id, "t1");
    expect(profile.team).toEqual({ id: "team1", name: "Team One" });
    expect(profile.captain?.username).toBe("cap");
    expect(profile.role).toBe("player");
  });
});
