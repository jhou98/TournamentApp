import { beforeEach, describe, expect, it } from "vitest";
import { makePlayoffsService, type PlayoffsService } from "../../src/services/playoffsService.js";
import { ConflictError } from "../../src/domain/errors.js";
import { DEFAULT_COIN_RULE, DEFAULT_STREAK_RULE } from "../../src/domain/tournamentDefaults.js";
import type {
  CourtRepo,
  GameRecord,
  GameRepo,
  MatchupRepo,
  MatchupView,
  NewMatchup,
  PublicUser,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
} from "../../src/ports/index.js";

const TID = "t1";
const passthroughUow: UnitOfWork = { run: (work) => work() };
const TEAMS = ["A", "B", "C", "D"];

function detail(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
  return {
    id: TID,
    name: "Test",
    status: "round_robin",
    teamCount: 4,
    teamSize: 6,
    pairSize: 2,
    pairsPerLineup: 1,
    roundsPerMatchup: 1,
    roundRobinCycles: 1,
    playoffQualifiers: 4,
    courtCount: 2,
    coinRule: DEFAULT_COIN_RULE,
    streakRule: DEFAULT_STREAK_RULE,
    shopVisible: true,
    potluckEventAt: null,
    potluckAddress: null,
    ...overrides,
  };
}

interface Stores {
  tournament: TournamentDetail;
  matchups: MatchupView[];
  games: GameRecord[];
}

let mSeq = 0;
let gSeq = 0;

function rrMatchup(id: string, a: string, b: string, winner: string): MatchupView {
  return {
    id,
    tournamentId: TID,
    stage: "round_robin",
    roundIndex: 1,
    bracketSlot: null,
    teamAId: a,
    teamBId: b,
    status: "final",
    winnerTeamId: winner,
    teamAName: a,
    teamBName: b,
    games: [],
  };
}

function rrGame(matchupId: string, scoreHome: number, scoreAway: number): GameRecord {
  return {
    id: `g${++gSeq}`,
    matchupId,
    roundNo: 1,
    courtId: "court1",
    homePairId: "ph",
    awayPairId: "pa",
    scoreHome,
    scoreAway,
    winnerPairId: "ph",
    status: "final",
  };
}

/** A finished round robin where A > B > C > D. */
function finishedRoundRobin(): Stores {
  const matchups: MatchupView[] = [
    rrMatchup("m-ab", "A", "B", "A"),
    rrMatchup("m-ac", "A", "C", "A"),
    rrMatchup("m-ad", "A", "D", "A"),
    rrMatchup("m-bc", "B", "C", "B"),
    rrMatchup("m-bd", "B", "D", "B"),
    rrMatchup("m-cd", "C", "D", "C"),
  ];
  const games = matchups.map((m) =>
    rrGame(m.id, m.winnerTeamId === m.teamAId ? 21 : 5, m.winnerTeamId === m.teamAId ? 5 : 21),
  );
  return { tournament: detail(), matchups, games };
}

function buildService(stores: Stores): PlayoffsService {
  const tournaments: TournamentRepo = {
    async getDetail(id) {
      return id === TID ? { ...stores.tournament } : null;
    },
    async list() {
      const { id, name, status, shopVisible } = stores.tournament;
      return [{ id, name, status, shopVisible }];
    },
    async listByIds(ids) {
      const { id, name, status, shopVisible } = stores.tournament;
      return ids.includes(id) ? [{ id, name, status, shopVisible }] : [];
    },
    async create() {
      throw new Error("not used");
    },
    async setStatus(_id, status) {
      stores.tournament.status = status;
    },
    async updateConfig() {
      throw new Error("not used");
    },
    async updateRules() {
      throw new Error("not used");
    },
    async setShopVisible() {
      throw new Error("not used");
    },
    async setPotluckDetails() {
      throw new Error("not used");
    },
  };

  const matchups: MatchupRepo = {
    async createMany(tournamentId, news: NewMatchup[]) {
      return news.map((m) => {
        const view: MatchupView = {
          id: `pm${++mSeq}`,
          tournamentId,
          stage: m.stage,
          roundIndex: m.roundIndex,
          bracketSlot: m.bracketSlot ?? null,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          status: "scheduled",
          winnerTeamId: null,
          teamAName: m.teamAId,
          teamBName: m.teamBId,
          games: [],
        };
        stores.matchups.push(view);
        return view;
      });
    },
    async listByTournament() {
      return stores.matchups.map((m) => ({ ...m }));
    },
    async findById(id) {
      return stores.matchups.find((m) => m.id === id) ?? null;
    },
    async updateTeams() {
      throw new Error("not used");
    },
    async setResult(id, result) {
      const m = stores.matchups.find((x) => x.id === id)!;
      m.status = result.status;
      m.winnerTeamId = result.winnerTeamId;
      return m;
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  const teams: TeamRepo = {
    async create() {
      throw new Error("not used");
    },
    async findById(id) {
      return { id, tournamentId: TID, name: id, createdAt: new Date() };
    },
    async findByName() {
      return null;
    },
    async listByTournament() {
      return TEAMS.map((id) => ({ id, tournamentId: TID, name: id, createdAt: new Date() }));
    },
    async delete() {
      throw new Error("not used");
    },
  };

  const games: GameRepo = {
    async createMany(news) {
      for (const g of news) {
        stores.games.push({
          id: `g${++gSeq}`,
          homePairId: null,
          awayPairId: null,
          scoreHome: null,
          scoreAway: null,
          winnerPairId: null,
          status: "awaiting_lineups",
          ...g,
        });
      }
    },
    async findById(id) {
      return stores.games.find((g) => g.id === id) ?? null;
    },
    async listByMatchup(matchupId) {
      return stores.games.filter((g) => g.matchupId === matchupId);
    },
    async listByTournament() {
      return stores.games.map((g) => ({ ...g }));
    },
    async setCourt() {
      throw new Error("not used");
    },
    async setScore() {
      throw new Error("not used");
    },
    async assignPairs() {
      throw new Error("not used");
    },
    async clearAssignmentsForRound() {
      throw new Error("not used");
    },
    async countByStatus() {
      return 0;
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  const courts: CourtRepo = {
    async listByTournament(tid) {
      return [1, 2].map((n) => ({ id: `court${n}`, tournamentId: tid, label: `Court ${n}` }));
    },
    async findById() {
      return null;
    },
    async createMany() {
      throw new Error("not used");
    },
    async rename() {
      throw new Error("not used");
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  return makePlayoffsService({ tournaments, matchups, teams, games, courts, uow: passthroughUow });
}

const admin: PublicUser = {
  id: "admin1",
  username: "admin1",
  displayName: "Admin",
  isAdmin: true,
  createdAt: new Date(),
};

describe("playoffsService.seed", () => {
  let stores: Stores;
  let service: PlayoffsService;

  beforeEach(() => {
    mSeq = 0;
    gSeq = 0;
    stores = finishedRoundRobin();
    service = buildService(stores);
  });

  it("seeds #1v#4 and #2v#3 from final standings and moves to playoffs", async () => {
    await service.seed(TID, admin);
    const semis = stores.matchups.filter((m) => m.stage === "semifinal");
    expect(semis).toHaveLength(2);
    const sf1 = semis.find((m) => m.bracketSlot === "SF1")!;
    const sf2 = semis.find((m) => m.bracketSlot === "SF2")!;
    expect([sf1.teamAId, sf1.teamBId]).toEqual(["A", "D"]);
    expect([sf2.teamAId, sf2.teamBId]).toEqual(["B", "C"]);
    // No final yet (fed by semis).
    expect(stores.matchups.some((m) => m.stage === "final")).toBe(false);
    expect(stores.tournament.status).toBe("playoffs");
    // Games were created for both semis (1 game each here).
    expect(stores.games.filter((g) => g.matchupId === sf1.id)).toHaveLength(1);
  });

  it("refuses to seed until every round-robin game is final", async () => {
    stores.games[0]!.status = "assigned";
    await expect(service.seed(TID, admin)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("playoffsService.sync", () => {
  let stores: Stores;
  let service: PlayoffsService;

  beforeEach(() => {
    mSeq = 0;
    gSeq = 0;
    stores = finishedRoundRobin();
    service = buildService(stores);
  });

  it("creates the final once both semifinals are decided", async () => {
    await service.seed(TID, admin);
    // Decide both semifinals.
    for (const slot of ["SF1", "SF2"]) {
      const sf = stores.matchups.find((m) => m.bracketSlot === slot)!;
      sf.status = "final";
      sf.winnerTeamId = sf.teamAId; // higher seed wins
    }
    await service.sync(TID);
    const final = stores.matchups.find((m) => m.stage === "final");
    expect(final).toBeTruthy();
    expect([final!.teamAId, final!.teamBId]).toEqual(["A", "B"]);
    expect(stores.games.filter((g) => g.matchupId === final!.id)).toHaveLength(1);
  });

  it("creates the third-place game between the two semifinal losers alongside the final", async () => {
    await service.seed(TID, admin);
    // SF1: A(seed1) v D(seed4) -> A wins, D loses. SF2: B(seed2) v C(seed3) -> B wins, C loses.
    for (const slot of ["SF1", "SF2"]) {
      const sf = stores.matchups.find((m) => m.bracketSlot === slot)!;
      sf.status = "final";
      sf.winnerTeamId = sf.teamAId;
    }
    await service.sync(TID);
    const thirdPlace = stores.matchups.find((m) => m.stage === "third_place");
    expect(thirdPlace).toBeTruthy();
    expect([thirdPlace!.teamAId, thirdPlace!.teamBId]).toEqual(["D", "C"]);
    expect(stores.games.filter((g) => g.matchupId === thirdPlace!.id)).toHaveLength(1);
  });

  it("completes the tournament once the final is decided", async () => {
    await service.seed(TID, admin);
    for (const slot of ["SF1", "SF2"]) {
      const sf = stores.matchups.find((m) => m.bracketSlot === slot)!;
      sf.status = "final";
      sf.winnerTeamId = sf.teamAId;
    }
    await service.sync(TID); // creates final
    const final = stores.matchups.find((m) => m.stage === "final")!;
    final.status = "final";
    final.winnerTeamId = "A";
    await service.sync(TID);
    expect(stores.tournament.status).toBe("completed");
  });

  it("re-opens a completed tournament if the final is edited back to undecided", async () => {
    await service.seed(TID, admin);
    for (const slot of ["SF1", "SF2"]) {
      const sf = stores.matchups.find((m) => m.bracketSlot === slot)!;
      sf.status = "final";
      sf.winnerTeamId = sf.teamAId;
    }
    await service.sync(TID);
    const final = stores.matchups.find((m) => m.stage === "final")!;
    final.status = "final";
    final.winnerTeamId = "A";
    await service.sync(TID);
    expect(stores.tournament.status).toBe("completed");

    // Final edited to a tie: no winner, matchup back to in_progress.
    final.status = "in_progress";
    final.winnerTeamId = null;
    await service.sync(TID);
    expect(stores.tournament.status).toBe("playoffs");
  });
});
