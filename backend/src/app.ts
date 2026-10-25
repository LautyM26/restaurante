import cors from "cors";
import express, { type Express } from "express";
import { pinoHttp } from "pino-http";
import { createMenuRouter } from "@/modules/menu/menu.router";
import { createTablesRouter } from "@/modules/tables/tables.router";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Clock } from "@/shared/clock";
import { createErrorHandler } from "@/shared/error-handler";
import { AppError } from "@/shared/errors";
import { redactSerializedReq, type Logger } from "@/shared/logger";
import type { Random } from "@/shared/random";

export const ROUTE_NOT_FOUND_MESSAGE = "Route not found";

export interface AppDeps {
  prisma: PrismaClient;
  clock: Clock;
  random: Random;
  logger: Logger;
  config: {
    corsOrigins: string[];
    trustProxy: boolean | number;
    jsonLimit: "100kb";
  };
}

// Order: request logging first (logs every request, including CORS/parse
// failures), then CORS (so preflights end early), body parsing, routes,
// 404, and the error handler last.
export function createApp(deps: AppDeps): Express {
  const { logger, config } = deps;
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  app.use(pinoHttp({ logger, serializers: { req: redactSerializedReq } }));
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ["GET", "POST", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: config.jsonLimit }));

  const api = express.Router();
  api.use(createMenuRouter(deps.prisma));
  api.use(createTablesRouter(deps.prisma));
  app.use("/api", api);

  app.use((_req, _res, next) => {
    next(new AppError("NOT_FOUND", 404, ROUTE_NOT_FOUND_MESSAGE));
  });
  app.use(createErrorHandler(logger));

  return app;
}
