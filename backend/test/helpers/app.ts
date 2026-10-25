import { createApp, type AppDeps } from "@/app";
import { createPrismaClient } from "@/shared/db";
import { createLogger } from "@/shared/logger";

export const TEST_ORIGIN = "http://localhost:5173";
export const FIXED_NOW = new Date("2026-01-01T12:00:00.000Z");

function testPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
  return createPrismaClient(databaseUrl, 2);
}

// Shallow merge: an overridden `config` replaces the whole object.
export function createTestDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    prisma: overrides.prisma ?? testPrisma(),
    clock: { now: () => FIXED_NOW },
    random: () => 0.5,
    logger: createLogger("silent"),
    config: {
      corsOrigins: [TEST_ORIGIN],
      trustProxy: false,
      jsonLimit: "100kb",
    },
    ...overrides,
  };
}

export function createTestApp(overrides: Partial<AppDeps> = {}) {
  const deps = createTestDeps(overrides);
  return { app: createApp(deps), deps };
}
