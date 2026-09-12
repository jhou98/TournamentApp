import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

/** Lazily-created singleton PrismaClient (one pool per process). */
export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}
