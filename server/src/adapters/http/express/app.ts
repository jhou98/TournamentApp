import express, { type Express, Router } from "express";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import type { Container } from "../../../config/container.js";
import { errorMiddleware } from "./errorMiddleware.js";
import { healthRouter } from "./routes/health.js";

export function createApp(container: Container): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  const api = Router();
  api.use("/health", healthRouter(container.services.health));
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
