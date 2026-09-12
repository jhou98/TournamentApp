import { runInTransaction } from "./client.js";
import type { UnitOfWork } from "../../../ports/index.js";

export function makePrismaUnitOfWork(): UnitOfWork {
  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      return runInTransaction(work);
    },
  };
}
