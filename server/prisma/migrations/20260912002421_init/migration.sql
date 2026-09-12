-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('setup', 'round_robin', 'playoffs', 'completed');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('captain', 'member');

-- CreateEnum
CREATE TYPE "MatchupStage" AS ENUM ('round_robin', 'semifinal', 'final');

-- CreateEnum
CREATE TYPE "MatchupStatus" AS ENUM ('scheduled', 'in_progress', 'final');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('awaiting_lineups', 'assigned', 'final');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grantsAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "signup_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'setup',
    "teamCount" INTEGER NOT NULL,
    "teamSize" INTEGER NOT NULL,
    "pairSize" INTEGER NOT NULL,
    "pairsPerLineup" INTEGER NOT NULL,
    "roundsPerMatchup" INTEGER NOT NULL,
    "playoffQualifiers" INTEGER NOT NULL,
    "courtCount" INTEGER NOT NULL,
    "coinRule" JSONB NOT NULL,
    "streakRule" JSONB NOT NULL,
    "suddenDeathRule" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matchup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stage" "MatchupStage" NOT NULL,
    "roundIndex" INTEGER,
    "bracketSlot" TEXT,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "status" "MatchupStatus" NOT NULL DEFAULT 'scheduled',
    "winnerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineup" (
    "id" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pair" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "pair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pair_player" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotInPair" INTEGER NOT NULL,

    CONSTRAINT "pair_player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game" (
    "id" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "courtId" TEXT,
    "homePairId" TEXT,
    "awayPairId" TEXT,
    "scoreHome" INTEGER,
    "scoreAway" INTEGER,
    "winnerPairId" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'awaiting_lineups',
    "finalizedBy" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sudden_death" (
    "id" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "teamARep" TEXT NOT NULL,
    "teamBRep" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "scoreA" INTEGER NOT NULL,
    "scoreB" INTEGER NOT NULL,
    "winnerTeamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sudden_death_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "signup_invite_code_key" ON "signup_invite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "team_tournamentId_name_key" ON "team"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "membership_userId_tournamentId_key" ON "membership"("userId", "tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "lineup_matchupId_teamId_roundNo_key" ON "lineup"("matchupId", "teamId", "roundNo");

-- CreateIndex
CREATE UNIQUE INDEX "pair_lineupId_slot_key" ON "pair"("lineupId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "pair_player_pairId_userId_key" ON "pair_player"("pairId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "pair_player_pairId_slotInPair_key" ON "pair_player"("pairId", "slotInPair");

-- CreateIndex
CREATE UNIQUE INDEX "sudden_death_matchupId_key" ON "sudden_death"("matchupId");

-- AddForeignKey
ALTER TABLE "signup_invite" ADD CONSTRAINT "signup_invite_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signup_invite" ADD CONSTRAINT "signup_invite_usedBy_fkey" FOREIGN KEY ("usedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court" ADD CONSTRAINT "court_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup" ADD CONSTRAINT "lineup_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "matchup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup" ADD CONSTRAINT "lineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup" ADD CONSTRAINT "lineup_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair" ADD CONSTRAINT "pair_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "lineup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_player" ADD CONSTRAINT "pair_player_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_player" ADD CONSTRAINT "pair_player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "matchup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_homePairId_fkey" FOREIGN KEY ("homePairId") REFERENCES "pair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_awayPairId_fkey" FOREIGN KEY ("awayPairId") REFERENCES "pair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_winnerPairId_fkey" FOREIGN KEY ("winnerPairId") REFERENCES "pair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_finalizedBy_fkey" FOREIGN KEY ("finalizedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "matchup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_teamARep_fkey" FOREIGN KEY ("teamARep") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_teamBRep_fkey" FOREIGN KEY ("teamBRep") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
