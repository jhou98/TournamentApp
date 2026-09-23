/**
 * Potluck RSVP: a player says whether they're attending the potluck and, if
 * so, what they're bringing. Everyone sees the event details (date/time/
 * address, admin-editable) and the list of who's attending with what.
 */

import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { PotluckRsvpRepo, TournamentRepo, UserRepo } from "../ports/index.js";

export interface PotluckServiceDeps {
  rsvps: PotluckRsvpRepo;
  tournaments: TournamentRepo;
  users: UserRepo;
}

export interface PotluckSettingsView {
  /** ISO timestamp of the event, or null until the admin sets it. */
  eventAt: string | null;
  address: string | null;
}

export interface PotluckAttendeeView {
  displayName: string;
  item: string | null;
}

export interface MyRsvpView {
  attending: boolean;
  item: string | null;
}

export interface PotluckView {
  settings: PotluckSettingsView;
  /** The caller's own RSVP, or null if they haven't answered yet. */
  myRsvp: MyRsvpView | null;
  /** Everyone who said they're attending, alphabetical, with what they're bringing. */
  attendees: PotluckAttendeeView[];
}

export interface SetRsvpInput {
  attending: boolean;
  /** Required (non-blank) when attending; ignored otherwise. */
  item?: string;
}

export interface PotluckService {
  get(tournamentId: string, userId: string): Promise<PotluckView>;
  setRsvp(tournamentId: string, userId: string, input: SetRsvpInput): Promise<MyRsvpView>;
}

export function makePotluckService(deps: PotluckServiceDeps): PotluckService {
  return {
    async get(tournamentId, userId) {
      const [tournament, myRsvp, all] = await Promise.all([
        deps.tournaments.getDetail(tournamentId),
        deps.rsvps.findByUser(tournamentId, userId),
        deps.rsvps.listByTournament(tournamentId),
      ]);
      if (!tournament) throw new NotFoundError("Tournament not found");

      const attendees: PotluckAttendeeView[] = [];
      for (const r of all.filter((r) => r.attending)) {
        const user = await deps.users.findById(r.userId);
        if (!user) continue;
        attendees.push({ displayName: user.displayName, item: r.item });
      }
      attendees.sort((a, b) => a.displayName.localeCompare(b.displayName));

      return {
        settings: {
          eventAt: tournament.potluckEventAt ? tournament.potluckEventAt.toISOString() : null,
          address: tournament.potluckAddress,
        },
        myRsvp: myRsvp ? { attending: myRsvp.attending, item: myRsvp.item } : null,
        attendees,
      };
    },

    async setRsvp(tournamentId, userId, input) {
      if (input.attending) {
        const item = input.item?.trim();
        if (!item) throw new ValidationError("Tell us what you're bringing");
        const rec = await deps.rsvps.upsert({ tournamentId, userId, attending: true, item });
        return { attending: rec.attending, item: rec.item };
      }
      const rec = await deps.rsvps.upsert({ tournamentId, userId, attending: false, item: null });
      return { attending: rec.attending, item: rec.item };
    },
  };
}
