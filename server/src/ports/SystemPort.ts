export interface SystemPort {
  /** Round-trips to the datastore; resolves true if reachable. */
  ping(): Promise<boolean>;
}
