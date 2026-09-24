/*
  Warnings:

  - You are about to drop the column `teamAPowerupUsedBy` on the `game` table. All the data in the column will be lost.
  - You are about to drop the column `teamBPowerupUsedBy` on the `game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "game" DROP COLUMN "teamAPowerupUsedBy",
DROP COLUMN "teamBPowerupUsedBy";

-- CreateTable
CREATE TABLE "game_powerup_use" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_powerup_use_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_powerup_use_gameId_userId_key" ON "game_powerup_use"("gameId", "userId");

-- AddForeignKey
ALTER TABLE "game_powerup_use" ADD CONSTRAINT "game_powerup_use_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_powerup_use" ADD CONSTRAINT "game_powerup_use_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
