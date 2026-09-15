-- CreateEnum
CREATE TYPE "BountyTargetType" AS ENUM ('player', 'team');

-- CreateTable
CREATE TABLE "bounty" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "targetType" "BountyTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coinValue" INTEGER NOT NULL,
    "conditionMeta" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "awardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bounty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bounty_tournamentId_idx" ON "bounty"("tournamentId");

-- AddForeignKey
ALTER TABLE "bounty" ADD CONSTRAINT "bounty_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
