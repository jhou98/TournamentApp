import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_COIN_RULE,
  DEFAULT_STREAK_RULE,
  DEFAULT_SUDDEN_DEATH_RULE,
  DEFAULT_TOURNAMENT_CONFIG,
} from "../src/domain/tournamentDefaults.js";

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
      ...DEFAULT_TOURNAMENT_CONFIG,
      coinRule: DEFAULT_COIN_RULE,
      streakRule: DEFAULT_STREAK_RULE,
      suddenDeathRule: DEFAULT_SUDDEN_DEATH_RULE,
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

  // A ready-to-use admin for local dev (gated with the demo players so prod,
  // where SEED_DEMO_USERS is unset, still requires the bootstrap-code flow).
  const admin = await prisma.user.upsert({
    where: { username: "admin1" },
    update: {},
    create: {
      username: "admin1",
      displayName: "admin 1",
      passwordHash,
      isAdmin: true,
    },
  });
  console.log(`Seeded admin: ${admin.username} (${admin.displayName})`);

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
