import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../domain/errors.js";
import { describeLineupProblem, pairKey, validateLineup } from "../domain/lineup.js";
import { assignPairs, type Rng } from "../domain/randomAssign.js";
import type {
  CourtRepo,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  MatchupRecord,
  MatchupRepo,
  MembershipRepo,
  PublicUser,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
  UserRepo,
} from "../ports/index.js";

// --- Read-model shapes (what the captain UI consumes) ----------------------

export interface PlayerView {
  id: string;
  displayName: string;
}

export interface PairView {
  slot: number;
  players: PlayerView[];
}

export interface TeamSideView {
  id: string;
  name: string;
  roster: PlayerView[];
  /** True once this side's lineup for the round is locked. */
  locked: boolean;
  /** Pairs, shown only to the owning captain, admins, or once revealed. */
  pairs: PairView[] | null;
}

export interface RevealedGameView {
  id: string;
  roundNo: number;
  courtLabel: string | null;
  status: string;
  homePlayers: PlayerView[];
  awayPlayers: PlayerView[];
}

export interface RoundView {
  roundNo: number;
  revealed: boolean;
  teamA: TeamSideView;
  teamB: TeamSideView;
  games: RevealedGameView[];
}

export interface LineupContext {
  matchupId: string;
  stage: string;
  status: string;
  roundsPerMatchup: number;
  pairsPerLineup: number;
  pairSize: number;
  isAdmin: boolean;
  /** Team the caller may edit (their captained side), or null. */
  myTeamId: string | null;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  rounds: RoundView[];
  /** Pairs this caller's team has fielded before (informational, US6). */
  pastPairings: PairView[];
}

export interface MyMatchupView {
  id: string;
  roundIndex: number | null;
  stage: string;
  status: string;
  teamAName: string;
  teamBName: string;
  myTeamId: string | null;
}

// --- Service ----------------------------------------------------------------

export interface LineupServiceDeps {
  tournaments: TournamentRepo;
  matchups: MatchupRepo;
  teams: TeamRepo;
  memberships: MembershipRepo;
  users: UserRepo;
  courts: CourtRepo;
  lineups: LineupRepo;
  games: GameRepo;
  uow: UnitOfWork;
  rng?: Rng;
}

export interface SubmitLineupInput {
  matchupId: string;
  teamId: string;
  roundNo: number;
  pairs: string[][];
}

export interface LineupService {
  listMyMatchups(tournamentId: string, user: PublicUser): Promise<MyMatchupView[]>;
  getContext(tournamentId: string, user: PublicUser, matchupId: string): Promise<LineupContext>;
  submit(tournamentId: string, user: PublicUser, input: SubmitLineupInput): Promise<LineupWithPairs>;
  lock(
    tournamentId: string,
    user: PublicUser,
    args: { matchupId: string; teamId: string; roundNo: number },
  ): Promise<{ locked: boolean; assigned: boolean }>;
  unlock(
    tournamentId: string,
    user: PublicUser,
    args: { matchupId: string; teamId: string; roundNo: number },
  ): Promise<void>;
  /** Admin re-randomizes home↔away pairings on the locked lineups (US8/D12). */
  reshuffle(tournamentId: string, user: PublicUser, matchupId: string): Promise<void>;
}

export function makeLineupService(deps: LineupServiceDeps): LineupService {
  const rng = deps.rng ?? Math.random;

  async function requireTournament(tournamentId: string): Promise<TournamentDetail> {
    const t = await deps.tournaments.getDetail(tournamentId);
    if (!t) throw new ValidationError("No tournament exists yet");
    return t;
  }

  async function requireMatchup(id: string, tournamentId: string): Promise<MatchupRecord> {
    const m = await deps.matchups.findById(id);
    if (!m || m.tournamentId !== tournamentId) throw new NotFoundError("Matchup not found");
    return m;
  }

  /** Roster of a team as id → displayName, plus an ordered player list. */
  async function rosterOf(teamId: string): Promise<{ ids: string[]; players: PlayerView[] }> {
    const members = await deps.memberships.listByTeam(teamId);
    const players: PlayerView[] = [];
    for (const m of members) {
      const user = await deps.users.findById(m.userId);
      if (user) players.push({ id: user.id, displayName: user.displayName });
    }
    return { ids: players.map((p) => p.id), players };
  }

  /**
   * Authorize the caller to act for `teamId` in `matchup`: admins always,
   * otherwise the captain of that team. Returns whether the caller is admin.
   */
  async function authorizeForTeam(
    user: PublicUser,
    matchup: MatchupRecord,
    teamId: string,
    tournamentId: string,
  ): Promise<void> {
    if (teamId !== matchup.teamAId && teamId !== matchup.teamBId) {
      throw new ValidationError("That team is not in this matchup");
    }
    if (user.isAdmin) return;
    const membership = await deps.memberships.findByUserAndTournament(user.id, tournamentId);
    if (!membership || membership.teamId !== teamId || membership.role !== "captain") {
      throw new ForbiddenError("Only this team's captain or an admin can manage its lineup");
    }
  }

  /** Which participating team (if any) this caller captains. */
  async function captainedTeamId(
    user: PublicUser,
    matchup: MatchupRecord,
    tournamentId: string,
  ): Promise<string | null> {
    const membership = await deps.memberships.findByUserAndTournament(user.id, tournamentId);
    if (!membership || membership.role !== "captain") return null;
    if (membership.teamId === matchup.teamAId || membership.teamId === matchup.teamBId) {
      return membership.teamId;
    }
    return null;
  }

  function validateRound(roundNo: number, t: TournamentDetail): void {
    if (!Number.isInteger(roundNo) || roundNo < 1 || roundNo > t.roundsPerMatchup) {
      throw new ValidationError(`Match number must be between 1 and ${t.roundsPerMatchup}`);
    }
  }

  const pairIdsOf = (lineup: LineupWithPairs) =>
    [...lineup.pairs].sort((a, b) => a.slot - b.slot).map((p) => p.id);

  /** Randomly match one round's home pairs against its away pairs. */
  async function assignRound(
    matchupId: string,
    roundGames: { id: string }[],
    home: LineupWithPairs,
    away: LineupWithPairs,
  ): Promise<void> {
    const homePairIds = pairIdsOf(home);
    const awayPairIds = pairIdsOf(away);
    if (homePairIds.length !== roundGames.length || awayPairIds.length !== roundGames.length) {
      throw new ConflictError("Lineup pair count does not match the scheduled games for this round");
    }
    const assignment = assignPairs(homePairIds, awayPairIds, rng);
    await deps.games.assignPairs(
      assignment.map((a, i) => ({
        gameId: roundGames[i]!.id,
        homePairId: a.homePairId,
        awayPairId: a.awayPairId,
      })),
    );
  }

  /**
   * Randomize the matchup once **every** lineup (both teams, all rounds) is
   * locked — never per round. This keeps a captain from learning the opponent's
   * pairs (or the random matchup) for one match while another match is still
   * unlocked. Assigns only rounds whose games still await lineups, so re-locking
   * after an admin unlock re-randomizes just that round. No-op until fully locked.
   */
  async function maybeAssignMatchup(
    matchup: MatchupRecord,
    roundsPerMatchup: number,
  ): Promise<boolean> {
    const lineups = await deps.lineups.listByMatchup(matchup.id);
    const lineupFor = (teamId: string, roundNo: number) =>
      lineups.find((l) => l.teamId === teamId && l.roundNo === roundNo) ?? null;

    // Gate: all lineups locked before anything is revealed.
    for (let roundNo = 1; roundNo <= roundsPerMatchup; roundNo++) {
      const home = lineupFor(matchup.teamAId, roundNo);
      const away = lineupFor(matchup.teamBId, roundNo);
      if (!home?.locked || !away?.locked) return false;
    }

    const games = await deps.games.listByMatchup(matchup.id);
    let assignedAny = false;
    for (let roundNo = 1; roundNo <= roundsPerMatchup; roundNo++) {
      const roundGames = games.filter((g) => g.roundNo === roundNo);
      // Immutable once set (D12): only assign rounds still awaiting lineups.
      if (roundGames.length === 0 || roundGames.some((g) => g.status !== "awaiting_lineups")) {
        continue;
      }
      await assignRound(matchup.id, roundGames, lineupFor(matchup.teamAId, roundNo)!, lineupFor(matchup.teamBId, roundNo)!);
      assignedAny = true;
    }
    return assignedAny;
  }

  return {
    async listMyMatchups(tournamentId, user) {
      const t = await requireTournament(tournamentId);
      const all = await deps.matchups.listByTournament(t.id);
      const membership = await deps.memberships.findByUserAndTournament(user.id, t.id);
      const myTeamId = membership?.teamId ?? null;

      const visible = user.isAdmin
        ? all
        : all.filter((m) => m.teamAId === myTeamId || m.teamBId === myTeamId);

      return visible.map((m) => ({
        id: m.id,
        roundIndex: m.roundIndex,
        stage: m.stage,
        status: m.status,
        teamAName: m.teamAName,
        teamBName: m.teamBName,
        myTeamId:
          myTeamId && (m.teamAId === myTeamId || m.teamBId === myTeamId) && membership?.role === "captain"
            ? myTeamId
            : null,
      }));
    },

    async getContext(tournamentId, user, matchupId) {
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(matchupId, t.id);

      const [teamA, teamB] = await Promise.all([
        deps.teams.findById(matchup.teamAId),
        deps.teams.findById(matchup.teamBId),
      ]);
      if (!teamA || !teamB) throw new NotFoundError("Matchup team not found");

      const [rosterA, rosterB, courts, matchupLineups] = await Promise.all([
        rosterOf(teamA.id),
        rosterOf(teamB.id),
        deps.courts.listByTournament(t.id),
        deps.lineups.listByMatchup(matchupId),
      ]);
      const games = await deps.games.listByMatchup(matchupId);

      const myTeamId = user.isAdmin ? null : await captainedTeamId(user, matchup, t.id);
      const courtLabel = new Map(courts.map((c) => [c.id, c.label]));
      const nameOf = new Map<string, string>();
      for (const p of [...rosterA.players, ...rosterB.players]) nameOf.set(p.id, p.displayName);

      const lineupFor = (teamId: string, roundNo: number) =>
        matchupLineups.find((l) => l.teamId === teamId && l.roundNo === roundNo) ?? null;
      const pairById = new Map(matchupLineups.flatMap((l) => l.pairs).map((p) => [p.id, p]));

      const toPairViews = (lineup: LineupWithPairs | null): PairView[] =>
        (lineup?.pairs ?? []).map((p) => ({
          slot: p.slot,
          players: p.playerIds.map((id) => ({ id, displayName: nameOf.get(id) ?? id })),
        }));

      const playersOfPair = (pairId: string | null): PlayerView[] => {
        if (!pairId) return [];
        const pair = pairById.get(pairId);
        return (pair?.playerIds ?? []).map((id) => ({ id, displayName: nameOf.get(id) ?? id }));
      };

      const canSee = (teamId: string) => user.isAdmin || myTeamId === teamId;

      const rounds: RoundView[] = [];
      for (let roundNo = 1; roundNo <= t.roundsPerMatchup; roundNo++) {
        const lineupA = lineupFor(teamA.id, roundNo);
        const lineupB = lineupFor(teamB.id, roundNo);
        const roundGames = games.filter((g) => g.roundNo === roundNo);
        const revealed = roundGames.length > 0 && roundGames.every((g) => g.status !== "awaiting_lineups");

        const side = (
          team: { id: string; name: string },
          roster: PlayerView[],
          lineup: LineupWithPairs | null,
        ): TeamSideView => ({
          id: team.id,
          name: team.name,
          roster,
          locked: lineup?.locked ?? false,
          pairs: canSee(team.id) || revealed ? toPairViews(lineup) : null,
        });

        rounds.push({
          roundNo,
          revealed,
          teamA: side(teamA, rosterA.players, lineupA),
          teamB: side(teamB, rosterB.players, lineupB),
          games: roundGames.map((g) => ({
            id: g.id,
            roundNo: g.roundNo,
            courtLabel: g.courtId ? (courtLabel.get(g.courtId) ?? null) : null,
            status: g.status,
            homePlayers: revealed ? playersOfPair(g.homePairId) : [],
            awayPlayers: revealed ? playersOfPair(g.awayPairId) : [],
          })),
        });
      }

      // Past pairings for the caller's own team (across all matchups).
      let pastPairings: PairView[] = [];
      if (myTeamId) {
        const priorLineups = await deps.lineups.listByTeam(myTeamId);
        const seen = new Set<string>();
        for (const l of priorLineups) {
          for (const p of l.pairs) {
            const key = pairKey(p.playerIds);
            if (seen.has(key)) continue;
            seen.add(key);
            pastPairings.push({
              slot: p.slot,
              players: p.playerIds.map((id) => ({ id, displayName: nameOf.get(id) ?? id })),
            });
          }
        }
      }

      return {
        matchupId,
        stage: matchup.stage,
        status: matchup.status,
        roundsPerMatchup: t.roundsPerMatchup,
        pairsPerLineup: t.pairsPerLineup,
        pairSize: t.pairSize,
        isAdmin: user.isAdmin,
        myTeamId,
        teamA: { id: teamA.id, name: teamA.name },
        teamB: { id: teamB.id, name: teamB.name },
        rounds,
        pastPairings,
      };
    },

    async submit(tournamentId, user, input) {
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(input.matchupId, t.id);
      await authorizeForTeam(user, matchup, input.teamId, t.id);
      validateRound(input.roundNo, t);

      const existing = await deps.lineups.findByRound(input.matchupId, input.teamId, input.roundNo);
      if (existing?.locked) {
        throw new ConflictError("Lineup is locked — unlock it before editing");
      }

      const roster = await rosterOf(input.teamId);
      const otherRounds = (await deps.lineups.listByMatchup(input.matchupId)).filter(
        (l) => l.teamId === input.teamId && l.roundNo !== input.roundNo,
      );
      const usedPairKeys = otherRounds.flatMap((l) => l.pairs.map((p) => pairKey(p.playerIds)));

      const problems = validateLineup(
        { pairs: input.pairs },
        {
          pairsPerLineup: t.pairsPerLineup,
          pairSize: t.pairSize,
          rosterIds: roster.ids,
          usedPairKeys,
        },
      );
      if (problems.length > 0) {
        // Resolve ids to names so the message never exposes a raw player id.
        const nameOf = new Map(roster.players.map((p) => [p.id, p.displayName]));
        const message = problems
          .map((p) => describeLineupProblem(p, (id) => nameOf.get(id) ?? "Unknown player"))
          .join("; ");
        throw new ValidationError(message);
      }

      return deps.uow.run(() =>
        deps.lineups.save({
          matchupId: input.matchupId,
          teamId: input.teamId,
          roundNo: input.roundNo,
          submittedBy: user.id,
          pairs: input.pairs.map((playerIds, i) => ({ slot: i + 1, playerIds })),
        }),
      );
    },

    async lock(tournamentId, user, { matchupId, teamId, roundNo }) {
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(matchupId, t.id);
      await authorizeForTeam(user, matchup, teamId, t.id);
      validateRound(roundNo, t);

      const lineup = await deps.lineups.findByRound(matchupId, teamId, roundNo);
      if (!lineup) throw new ValidationError("Submit a lineup before locking it");
      if (lineup.pairs.length !== t.pairsPerLineup) {
        throw new ValidationError(`Lineup must have exactly ${t.pairsPerLineup} pairs before locking`);
      }

      return deps.uow.run(async () => {
        if (!lineup.locked) await deps.lineups.setLocked(lineup.id, true);
        const assigned = await maybeAssignMatchup(matchup, t.roundsPerMatchup);
        return { locked: true, assigned };
      });
    },

    async unlock(tournamentId, user, { matchupId, teamId, roundNo }) {
      if (!user.isAdmin) throw new ForbiddenError("Only an admin can unlock a lineup");
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(matchupId, t.id);
      if (teamId !== matchup.teamAId && teamId !== matchup.teamBId) {
        throw new ValidationError("That team is not in this matchup");
      }
      validateRound(roundNo, t);

      const lineup = await deps.lineups.findByRound(matchupId, teamId, roundNo);
      if (!lineup) throw new NotFoundError("Lineup not found");

      const roundGames = (await deps.games.listByMatchup(matchupId)).filter(
        (g) => g.roundNo === roundNo,
      );
      if (roundGames.some((g) => g.status === "final")) {
        throw new ConflictError("Cannot unlock a round that already has final results");
      }

      await deps.uow.run(async () => {
        // Undo any random assignment so the round can be re-picked and re-matched.
        await deps.games.clearAssignmentsForRound(matchupId, roundNo);
        await deps.lineups.setLocked(lineup.id, false);
      });
    },

    async reshuffle(tournamentId, user, matchupId) {
      if (!user.isAdmin) throw new ForbiddenError("Only an admin can re-randomize a matchup");
      const t = await requireTournament(tournamentId);
      const matchup = await requireMatchup(matchupId, t.id);

      const lineups = await deps.lineups.listByMatchup(matchupId);
      const games = await deps.games.listByMatchup(matchupId);
      if (games.length === 0) throw new ValidationError("This matchup has no games to match");
      if (games.some((g) => g.status === "final")) {
        throw new ConflictError("Cannot re-randomize a matchup that already has final results");
      }
      if (games.some((g) => g.status === "awaiting_lineups")) {
        throw new ConflictError("Both captains must lock every lineup before re-randomizing");
      }

      const lineupFor = (teamId: string, roundNo: number) =>
        lineups.find((l) => l.teamId === teamId && l.roundNo === roundNo) ?? null;

      await deps.uow.run(async () => {
        for (let roundNo = 1; roundNo <= t.roundsPerMatchup; roundNo++) {
          const roundGames = games.filter((g) => g.roundNo === roundNo);
          const home = lineupFor(matchup.teamAId, roundNo);
          const away = lineupFor(matchup.teamBId, roundNo);
          if (!home || !away || roundGames.length === 0) continue;
          await assignRound(matchupId, roundGames, home, away);
        }
      });
    },
  };
}
