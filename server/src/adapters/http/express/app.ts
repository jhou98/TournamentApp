import "./types.js";
import express, { type Express, Router } from "express";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import type { Container } from "../../../config/container.js";
import { errorMiddleware } from "./errorMiddleware.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { adminRouter } from "./routes/admin.js";
import { scheduleRouter } from "./routes/schedule.js";
import { matchupsRouter } from "./routes/matchups.js";
import { resultsRouter } from "./routes/results.js";
import { tournamentsRouter } from "./routes/tournaments.js";

export function createApp(container: Container): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  const api = Router();
  api.use("/health", healthRouter(container.services.health));
  api.use("/auth", authRouter(container.services.auth));
  api.use(
    "/me",
    meRouter(
      container.services.auth,
      container.services.tournaments,
      container.services.economy,
      container.authMiddleware,
    ),
  );
  api.use(
    "/tournaments",
    tournamentsRouter(container.services.tournaments, container.authMiddleware),
  );
  api.use(
    "/admin",
    adminRouter(
      container.services.roster,
      container.services.schedule,
      container.services.results,
      container.services.playoffs,
      container.services.suddenDeath,
      container.services.tournaments,
      container.authMiddleware,
    ),
  );
  api.use(
    "/schedule",
    scheduleRouter(container.services.schedule, container.services.tournaments, container.authMiddleware),
  );
  api.use(
    "/matchups",
    matchupsRouter(
      container.services.lineups,
      container.services.suddenDeath,
      container.services.tournaments,
      container.authMiddleware,
    ),
  );
  api.use(resultsRouter(container.services.results, container.services.tournaments, container.authMiddleware));
  app.use("/api", api);

  // Serve the built SPA in production, with history fallback for client routes.
  const clientDist = path.resolve(process.cwd(), "../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorMiddleware);

  return app;
}
