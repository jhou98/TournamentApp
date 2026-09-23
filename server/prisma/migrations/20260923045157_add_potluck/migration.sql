-- AlterTable
ALTER TABLE "tournament" ADD COLUMN     "potluckAddress" TEXT,
ADD COLUMN     "potluckEventAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "potluck_rsvp" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attending" BOOLEAN NOT NULL,
    "item" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "potluck_rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "potluck_rsvp_tournamentId_userId_key" ON "potluck_rsvp"("tournamentId", "userId");

-- AddForeignKey
ALTER TABLE "potluck_rsvp" ADD CONSTRAINT "potluck_rsvp_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potluck_rsvp" ADD CONSTRAINT "potluck_rsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
