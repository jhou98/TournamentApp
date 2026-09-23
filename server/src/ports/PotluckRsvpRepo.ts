export interface PotluckRsvpRecord {
  id: string;
  tournamentId: string;
  userId: string;
  attending: boolean;
  item: string | null;
  updatedAt: Date;
}

export interface UpsertPotluckRsvp {
  tournamentId: string;
  userId: string;
  attending: boolean;
  item: string | null;
}

export interface PotluckRsvpRepo {
  findByUser(tournamentId: string, userId: string): Promise<PotluckRsvpRecord | null>;
  /** All RSVPs for a tournament (attending and declined alike). */
  listByTournament(tournamentId: string): Promise<PotluckRsvpRecord[]>;
  /** Create or replace the caller's RSVP for this tournament. */
  upsert(input: UpsertPotluckRsvp): Promise<PotluckRsvpRecord>;
}
