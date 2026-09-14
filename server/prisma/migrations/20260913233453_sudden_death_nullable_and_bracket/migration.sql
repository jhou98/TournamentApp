-- DropForeignKey
ALTER TABLE "sudden_death" DROP CONSTRAINT "sudden_death_teamARep_fkey";

-- DropForeignKey
ALTER TABLE "sudden_death" DROP CONSTRAINT "sudden_death_teamBRep_fkey";

-- DropForeignKey
ALTER TABLE "sudden_death" DROP CONSTRAINT "sudden_death_winnerTeamId_fkey";

-- AlterTable
ALTER TABLE "sudden_death" ALTER COLUMN "teamARep" DROP NOT NULL,
ALTER COLUMN "teamBRep" DROP NOT NULL,
ALTER COLUMN "scoreA" DROP NOT NULL,
ALTER COLUMN "scoreB" DROP NOT NULL,
ALTER COLUMN "winnerTeamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_teamARep_fkey" FOREIGN KEY ("teamARep") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_teamBRep_fkey" FOREIGN KEY ("teamBRep") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudden_death" ADD CONSTRAINT "sudden_death_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
