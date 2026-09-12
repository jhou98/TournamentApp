import { getDb } from "./client.js";
import type { InviteRepo } from "../../../ports/index.js";

export function makePrismaInviteRepo(): InviteRepo {
  return {
    async create(input) {
      return getDb().signupInvite.create({ data: input });
    },
    async findByCode(code) {
      return getDb().signupInvite.findUnique({ where: { code } });
    },
    async markUsed(id, usedBy) {
      await getDb().signupInvite.update({
        where: { id },
        data: { usedBy, usedAt: new Date() },
      });
    },
  };
}
