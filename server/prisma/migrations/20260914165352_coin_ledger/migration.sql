-- CreateEnum
CREATE TYPE "CoinReason" AS ENUM ('match_result', 'streak_bonus', 'mission', 'bounty', 'event', 'purchase', 'admin_adjust');

-- CreateTable
CREATE TABLE "coin_transaction" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CoinReason" NOT NULL,
    "gameId" TEXT,
    "bountyId" TEXT,
    "missionId" TEXT,
    "purchaseId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coin_transaction_tournamentId_userId_idx" ON "coin_transaction"("tournamentId", "userId");

-- AddForeignKey
ALTER TABLE "coin_transaction" ADD CONSTRAINT "coin_transaction_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transaction" ADD CONSTRAINT "coin_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
