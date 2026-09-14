export type MembershipRole = "captain" | "member";

export interface MembershipRecord {
  id: string;
  userId: string;
  teamId: string;
  tournamentId: string;
  role: MembershipRole;
  createdAt: Date;
}

export interface MembershipRepo {
  findByUserAndTournament(userId: string, tournamentId: string): Promise<MembershipRecord | null>;
  /** Every membership for a user across tournaments (US28 — accessible-tournament set). */
  listByUser(userId: string): Promise<MembershipRecord[]>;
  listByTeam(teamId: string): Promise<MembershipRecord[]>;
  listByTournament(tournamentId: string): Promise<MembershipRecord[]>;
  /** Assign or move a user to a team within a tournament (one membership per user per tournament). */
  assign(
    userId: string,
    tournamentId: string,
    teamId: string,
    role: MembershipRole,
  ): Promise<MembershipRecord>;
  setRole(userId: string, tournamentId: string, role: MembershipRole): Promise<MembershipRecord>;
  removeByUserAndTournament(userId: string, tournamentId: string): Promise<void>;
}
