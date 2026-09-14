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
  matchupsTied: number;
  points: number;
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

/* --- helpers ------------------------------------------------------------- */

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
