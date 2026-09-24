export interface GamePowerupUseRepo {
  /**
   * Atomically claim a player's own powerup slot for a game (US21) if they
   * haven't already used one this game — race-safe (double-clicking Use
   * can't claim twice). Returns false if they'd already used one.
   */
  claim(gameId: string, userId: string): Promise<boolean>;
}
