import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TOURNAMENT_ID = "default-tournament";

async function main() {
  const tournament = await prisma.tournament.upsert({
    where: { id: DEFAULT_TOURNAMENT_ID },
    update: {},
    create: {
      id: DEFAULT_TOURNAMENT_ID,
      name: "Friendsgiving Badminton Tournament",
      status: "setup",
      teamCount: 4,
      teamSize: 6,
      pairSize: 2,
      pairsPerLineup: 3,
      roundsPerMatchup: 2,
      playoffQualifiers: 4,
      courtCount: 6,
      coinRule: { perWin: 100, perCloseLoss: 75, perLoss: 50 },
      streakRule: {
        direction: "loss",
        tiers: [
          { after: 2, bonus: 25 },
          { after: 3, bonus: 50 },
          { after: 4, bonus: 75 },
        ],
      },
      suddenDeathRule: { first_to: 5, win_by: 2, cap: 7 },
    },
  });

  console.log(`Seeded default tournament: ${tournament.id} (${tournament.name})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
