import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_TOURNAMENT_ID = "default-tournament";

/** Demo players seeded for local dev — all share the password "password". */
const DEMO_PLAYERS = Array.from({ length: 16 }, (_, i) => i + 1).map((n) => ({
  username: `player${n}`,
  displayName: `Player ${n}`,
}));

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
      roundRobinCycles: 1,
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

  // Demo players are gated behind SEED_DEMO_USERS so they only appear where you
  // opt in (local/testing) — never in prod unless the flag is explicitly set.
  if (process.env.SEED_DEMO_USERS !== "true") {
    console.log("Skipping demo players (set SEED_DEMO_USERS=true to seed them).");
    return;
  }

  // Idempotent by username; existing rows are left untouched so a re-seed never
  // rewrites a password someone already changed.
  const passwordHash = await bcrypt.hash("password", 10);
  for (const p of DEMO_PLAYERS) {
    const user = await prisma.user.upsert({
      where: { username: p.username },
      update: {},
      create: {
        username: p.username,
        displayName: p.displayName,
        passwordHash,
        isAdmin: false,
      },
    });
    console.log(`Seeded player: ${user.username} (${user.displayName})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
