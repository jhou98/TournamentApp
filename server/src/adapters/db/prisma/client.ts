import { PrismaClient, type Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

export type Db = PrismaClient | Prisma.TransactionClient;

let base: PrismaClient | undefined;
const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

function getBasePrisma(): PrismaClient {
  if (!base) {
    base = new PrismaClient();
  }
  return base;
}

/**
 * The active DB handle: the current transaction client when inside a
 * UnitOfWork, otherwise the base pool. Repos call this per operation so they
 * transparently join an open transaction.
 */
export function getDb(): Db {
  return txStorage.getStore() ?? getBasePrisma();
}

/** Runs `fn` inside a transaction, exposing the tx client via getDb(). Nesting reuses the outer tx. */
export function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (txStorage.getStore()) {
    return fn();
  }
  return getBasePrisma().$transaction((tx) => txStorage.run(tx, fn));
}
