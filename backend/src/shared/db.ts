import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export function createPrismaClient(
  databaseUrl: string,
  poolMax: number,
): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl, max: poolMax });
  return new PrismaClient({ adapter });
}
