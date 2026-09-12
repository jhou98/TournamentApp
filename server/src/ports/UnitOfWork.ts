/**
 * Runs a set of writes in a single transaction. Multi-step operations
 * (e.g. lock lineup -> assign pairs -> create games) go through here so they
 * stay atomic on one process now and across concurrent invocations later.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}
