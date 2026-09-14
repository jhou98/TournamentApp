import type { TournamentConfig } from "../ports/index.js";

/**
 * The reference-tournament defaults (§4): 4 teams of 6, 3-round round robin,
 * doubles pairs, 6 courts. Shared by the seed and by admin "create tournament"
 * so a new event starts from the same shape. All of it is config — editable
 * while a tournament is in setup.
 */
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  teamCount: 4,
  teamSize: 6,
  pairSize: 2,
  pairsPerLineup: 3,
  roundsPerMatchup: 2,
  roundRobinCycles: 1,
  playoffQualifiers: 4,
  courtCount: 6,
};

export const DEFAULT_COIN_RULE = { perWin: 100, perCloseLoss: 75, perLoss: 50 };

export const DEFAULT_STREAK_RULE = {
  direction: "loss",
  tiers: [
    { after: 2, bonus: 25 },
    { after: 3, bonus: 50 },
    { after: 4, bonus: 75 },
  ],
};

export const DEFAULT_SUDDEN_DEATH_RULE = { first_to: 5, win_by: 2, cap: 7 };
