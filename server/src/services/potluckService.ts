/**
 * Potluck RSVP: a player says whether they're attending the potluck and, if
 * so, what they're bringing. Everyone sees the event details (date/time/
 * address, admin-editable) and the list of who's attending with what.
 */

import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { PotluckRsvpRepo, PublicUser, TournamentRepo, UserRepo } from "../ports/index.js";

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
  /** Admin-only: names of everyone who explicitly said they're not attending. Null for non-admins. */
  declined: string[] | null;
}

export interface SetRsvpInput {
  attending: boolean;
  /** Required (non-blank) when attending; ignored otherwise. */
  item?: string;
}

export interface PotluckService {
  get(tournamentId: string, user: PublicUser): Promise<PotluckView>;
  setRsvp(tournamentId: string, userId: string, input: SetRsvpInput): Promise<MyRsvpView>;
}

export function makePotluckService(deps: PotluckServiceDeps): PotluckService {
  return {
    async get(tournamentId, user) {
      const [tournament, myRsvp, all] = await Promise.all([
        deps.tournaments.getDetail(tournamentId),
        deps.rsvps.findByUser(tournamentId, user.id),
        deps.rsvps.listByTournament(tournamentId),
      ]);
      if (!tournament) throw new NotFoundError("Tournament not found");

      const attendees: PotluckAttendeeView[] = [];
      for (const r of all.filter((r) => r.attending)) {
        const attendee = await deps.users.findById(r.userId);
        if (!attendee) continue;
        attendees.push({ displayName: attendee.displayName, item: r.item });
      }
      attendees.sort((a, b) => a.displayName.localeCompare(b.displayName));

      let declined: string[] | null = null;
      if (user.isAdmin) {
        declined = [];
        for (const r of all.filter((r) => !r.attending)) {
          const decliner = await deps.users.findById(r.userId);
          if (decliner) declined.push(decliner.displayName);
        }
        declined.sort((a, b) => a.localeCompare(b));
      }

      return {
        settings: {
          eventAt: tournament.potluckEventAt ? tournament.potluckEventAt.toISOString() : null,
          address: tournament.potluckAddress,
        },
        myRsvp: myRsvp ? { attending: myRsvp.attending, item: myRsvp.item } : null,
        attendees,
        declined,
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
