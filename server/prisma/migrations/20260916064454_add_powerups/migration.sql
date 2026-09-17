-- CreateTable
CREATE TABLE "powerup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "powerup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "powerup_tournamentId_idx" ON "powerup"("tournamentId");

-- AddForeignKey
ALTER TABLE "powerup" ADD CONSTRAINT "powerup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
