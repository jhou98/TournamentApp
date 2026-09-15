/**
 * Shared API view types (mirror the server's read models). Pages import these
 * instead of redeclaring them so the Home dashboard, Tournament Tracker and
 * future phases (economy, shop) agree on one shape.
 */

export type TournamentStatus = "setup" | "round_robin" | "playoffs" | "completed";
export type Stage = "round_robin" | "semifinal" | "final";

/* --- GET /api/schedule --------------------------------------------------- */

export interface ScheduleGameView {
  id: string;
  roundNo: number;
  courtId: string | null;
  courtLabel: string | null;
  status: string;
}

export interface ScheduleMatchupView {
  id: string;
  roundIndex: number | null;
  stage: Stage | string;
  status: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  games: ScheduleGameView[];
}

export interface ScheduleRoundView {
  /** Round-robin round number; playoff matchups are grouped under 0. */
  roundIndex: number;
  matchups: ScheduleMatchupView[];
}

export interface ScheduleView {
  status: TournamentStatus | string;
  courts: { id: string; label: string }[];
  rounds: ScheduleRoundView[];
}

/* --- GET /api/standings -------------------------------------------------- */

export interface StandingRow {
  teamId: string;
  teamName: string;
  matchupsPlayed: number;
  matchupsWon: number;
  matchupsLost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
}

export interface StandingsView {
  status: TournamentStatus | string;
  rows: StandingRow[];
}

/* --- GET /api/results ---------------------------------------------------- */

export interface PlayerView {
  id: string;
  displayName: string;
}

export interface ResultGameView {
  id: string;
  roundNo: number;
  courtLabel: string | null;
  status: string;
  homePlayers: PlayerView[];
  awayPlayers: PlayerView[];
  scoreHome: number | null;
  scoreAway: number | null;
  winner: "A" | "B" | null;
}

export interface ResultMatchView {
  roundNo: number;
  roundScore: { teamA: number; teamB: number };
  games: ResultGameView[];
}

export interface ResultMatchupView {
  id: string;
  stage: Stage | string;
  roundIndex: number | null;
  status: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
  matchupScore: { teamA: number; teamB: number };
  decided: boolean;
  tied: boolean;
  matches: ResultMatchView[];
}

export interface ResultsView {
  status: TournamentStatus | string;
  isAdmin: boolean;
  matchups: ResultMatchupView[];
}

/* --- GET /api/me/coins --------------------------------------------------- */

export type CoinReason =
  | "match_result"
  | "streak_bonus"
  | "mission"
  | "bounty"
  | "event"
  | "purchase"
  | "admin_adjust";

export interface CoinMatchDetail {
  matchupId: string;
  stage: Stage | string;
  roundIndex: number | null;
  roundNo: number;
  opponentTeamName: string;
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
}

export interface CoinTransactionView {
  id: string;
  delta: number;
  reason: CoinReason;
  note: string | null;
  gameId: string | null;
  createdAt: string;
  /** Match context for match_result rows; null for other reasons. */
  match: CoinMatchDetail | null;
}

export interface CoinSummaryView {
  balance: number;
  transactions: CoinTransactionView[];
}

/* --- GET /api/leaderboard ------------------------------------------------ */

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  balance: number;
  rank: number;
}

export interface LeaderboardView {
  rows: LeaderboardRow[];
}

/* --- GET /api/bounties (+ admin CRUD) ------------------------------------ */

export type BountyTargetType = "player" | "team";

export interface BountyView {
  id: string;
  targetType: BountyTargetType;
  /** True for an open bounty (first player/team to complete it wins). */
  open: boolean;
  targetId: string | null;
  /** Player/team name; the winner for an awarded open bounty; null if open & unresolved. */
  targetName: string | null;
  description: string;
  coinValue: number;
  active: boolean;
  awardedAt: string | null;
  createdAt: string;
}

/* --- GET/PATCH /api/admin/tournament/rules ------------------------------- */

export interface CoinRule {
  perWin: number;
  perLoss: number;
  perCloseLoss?: number;
  perPointDiff?: number;
  flatPerGame?: number;
  floor?: number;
  closeLossMargin?: number;
}

export interface StreakTier {
  after: number;
  bonus: number;
}

export interface StreakRule {
  direction: "loss" | "win" | "both";
  tiers: StreakTier[];
}

export interface EconomyRules {
  coinRule: CoinRule;
  streakRule: StreakRule;
}

/* --- helpers ------------------------------------------------------------- */

const COIN_REASON_LABEL: Record<CoinReason, string> = {
  match_result: "Match result",
  streak_bonus: "Streak bonus",
  mission: "Mission",
  bounty: "Bounty",
  event: "Event",
  purchase: "Purchase",
  admin_adjust: "Admin adjustment",
};

export function coinReasonLabel(reason: CoinReason): string {
  return COIN_REASON_LABEL[reason] ?? reason;
}


export function stageLabel(stage: string, roundIndex?: number | null): string {
  if (stage === "semifinal") return "Semifinal";
  if (stage === "final") return "Final";
  return roundIndex ? `Round ${roundIndex}` : "Round robin";
}

/** Round-robin rounds in order, with the playoff group (roundIndex 0) last. */
export function orderRounds<T extends { roundIndex: number }>(rounds: T[]): T[] {
  return [...rounds].sort((a, b) => (a.roundIndex || Infinity) - (b.roundIndex || Infinity));
}

export function fmtDiff(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
