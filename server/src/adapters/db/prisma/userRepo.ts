import { getDb } from "./client.js";
import { toPublicUser, type NewUser, type UserRecord, type UserRepo } from "../../../ports/index.js";

export function makePrismaUserRepo(): UserRepo {
  return {
    async create(user: NewUser): Promise<UserRecord> {
      return getDb().user.create({ data: user });
    },
    async findById(id) {
      return getDb().user.findUnique({ where: { id } });
    },
    async findByUsername(username) {
      return getDb().user.findUnique({ where: { username } });
    },
    async list() {
      const users = await getDb().user.findMany({ orderBy: { createdAt: "asc" } });
      return users.map(toPublicUser);
    },
    async setAdmin(id, isAdmin) {
      const user = await getDb().user.update({ where: { id }, data: { isAdmin } });
      return toPublicUser(user);
    },
    async setPassword(id, passwordHash) {
      await getDb().user.update({ where: { id }, data: { passwordHash } });
    },
  };
}
