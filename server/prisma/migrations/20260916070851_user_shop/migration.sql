-- CreateTable
CREATE TABLE "purchase" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "powerupId" TEXT NOT NULL,
    "costPaid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_tournamentId_userId_idx" ON "purchase"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_userId_powerupId_key" ON "purchase"("userId", "powerupId");

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_powerupId_fkey" FOREIGN KEY ("powerupId") REFERENCES "powerup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
