export interface TournamentRef {
  id: string;
  name: string;
}

export interface TournamentRepo {
  /** The single active tournament (Part 0 seeds one; D6 = one tournament for now). */
  getCurrent(): Promise<TournamentRef | null>;
}
