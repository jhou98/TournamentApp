import { ConflictError, ForbiddenError, ValidationError } from "../domain/errors.js";
import { seedBracket } from "../domain/playoffs.js";
import { layoutGames } from "../domain/scheduleLayout.js";
import { computeStandings, type GameResultInput } from "../domain/standings.js";
import type {
  CourtRepo,
  GameRepo,
  MatchupRepo,
  MatchupRecord,
  NewGame,
  NewMatchup,
  PublicUser,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
} from "../ports/index.js";

// Synthetic round-robin "round" value so the court layout spreads concurrent
// playoff games across courts (semifinals run at the same time).
const PLAYOFF_ROUND_INDEX = 1;

export interface PlayoffsService {
  /** Admin seeds the bracket from final standings; status → playoffs (US11). */
  seed(user: PublicUser): Promise<void>;
  /** Idempotent advancement: build the final from decided semis; complete on a decided final. */
  sync(): Promise<void>;
}

export interface PlayoffsServiceDeps {
  tournaments: TournamentRepo;
  matchups: MatchupRepo;
  teams: TeamRepo;
  games: GameRepo;
  courts: CourtRepo;
  uow: UnitOfWork;
}

export function makePlayoffsService(deps: PlayoffsServiceDeps): PlayoffsService {
  async function requireTournament(): Promise<TournamentDetail> {
    const t = await deps.tournaments.getCurrentDetail();
    if (!t) throw new ValidationError("No tournament exists yet");
    return t;
  }

  /** Build the game rows for freshly-created playoff matchups, spread over courts. */
  async function createGames(
    created: MatchupRecord[],
    t: TournamentDetail,
    courtIds: string[],
  ): Promise<void> {
    const slots = layoutGames({
      matchups: created.map(() => ({ roundIndex: PLAYOFF_ROUND_INDEX })),
      roundsPerMatchup: t.roundsPerMatchup,
      pairsPerLineup: t.pairsPerLineup,
      courtCount: courtIds.length,
    });
    const newGames: NewGame[] = slots.map((s) => ({
      matchupId: created[s.matchupIndex]!.id,
      roundNo: s.roundNo,
      courtId: courtIds[s.courtIndex]!,
    }));
    await deps.games.createMany(newGames);
  }

  return {
    async seed(user) {
      if (!user.isAdmin) throw new ForbiddenError("Only an admin can seed the playoffs");
      const t = await requireTournament();
      if (t.status !== "round_robin") {
        throw new ConflictError("Playoffs can only be seeded from a running round robin");
      }

      const [teams, matchupViews, allGames, courts] = await Promise.all([
        deps.teams.listByTournament(t.id),
        deps.matchups.listByTournament(t.id),
        deps.games.listByTournament(t.id),
        deps.courts.listByTournament(t.id),
      ]);
      if (courts.length < 1) throw new ValidationError("At least one court is required");

      const rrMatchups = matchupViews.filter((m) => m.stage === "round_robin");
      const rrMatchupIds = new Set(rrMatchups.map((m) => m.id));
      const rrGames = allGames.filter((g) => rrMatchupIds.has(g.matchupId));
      if (rrGames.length === 0) throw new ValidationError("Generate and play the round robin first");
      if (rrGames.some((g) => g.status !== "final")) {
        throw new ConflictError("Enter every round-robin result before seeding the playoffs");
      }

      const standings = computeStandings(
        teams.map((team) => ({ id: team.id, name: team.name })),
        rrMatchups.map((m) => ({
          id: m.id,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          winnerTeamId: m.winnerTeamId,
          status: m.status,
        })),
        rrGames as GameResultInput[],
      );

      let bracket;
      try {
        bracket = seedBracket(
          standings.map((r) => r.teamId),
          t.playoffQualifiers,
        );
      } catch (err) {
        throw new ValidationError(err instanceof Error ? err.message : "Cannot seed the bracket");
      }

      // Only create the matches whose teams are known now (first round). A final
      // fed by semifinals is created later by sync() once its teams are decided.
      const seedable = bracket.filter((b) => b.teamAId && b.teamBId);
      const newMatchups: NewMatchup[] = seedable.map((b) => ({
        stage: b.stage,
        roundIndex: null,
        bracketSlot: b.slot,
        teamAId: b.teamAId!,
        teamBId: b.teamBId!,
      }));

      await deps.uow.run(async () => {
        const created = await deps.matchups.createMany(t.id, newMatchups);
        await createGames(
          created,
          t,
          courts.map((c) => c.id),
        );
        await deps.tournaments.setStatus(t.id, "playoffs");
      });
    },

    async sync() {
      const t = await requireTournament();
      // Run during playoffs, and also when already completed so a final edited
      // back to undecided can re-open the tournament.
      if (t.status !== "playoffs" && t.status !== "completed") return;

      const matchupViews = await deps.matchups.listByTournament(t.id);
      const bySlot = new Map(matchupViews.filter((m) => m.bracketSlot).map((m) => [m.bracketSlot!, m]));
      const final = bySlot.get("F");

      // Create the final once both semifinals are decided (4-qualifier bracket).
      if (!final) {
        const sf1 = bySlot.get("SF1");
        const sf2 = bySlot.get("SF2");
        if (sf1?.winnerTeamId && sf2?.winnerTeamId) {
          const courts = await deps.courts.listByTournament(t.id);
          await deps.uow.run(async () => {
            const created = await deps.matchups.createMany(t.id, [
              {
                stage: "final",
                roundIndex: null,
                bracketSlot: "F",
                teamAId: sf1.winnerTeamId!,
                teamBId: sf2.winnerTeamId!,
              },
            ]);
            await createGames(
              created,
              t,
              courts.map((c) => c.id),
            );
          });
        }
        return;
      }

      // Final exists — complete the tournament once it has a winner, or re-open
      // it if a decided final was later edited back to undecided (e.g. to a tie).
      if (final.winnerTeamId) {
        await deps.tournaments.setStatus(t.id, "completed");
      } else if (t.status === "completed") {
        await deps.tournaments.setStatus(t.id, "playoffs");
      }
    },
  };
}
