import { getDb } from "./client.js";
import type { SystemPort } from "../../../ports/index.js";

export function makePrismaSystemRepo(): SystemPort {
  return {
    async ping() {
      await getDb().$queryRaw`SELECT 1`;
      return true;
    },
  };
}
