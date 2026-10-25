import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import pg from "pg";
import { assertTestDatabaseUrl } from "./helpers/test-db-guard";

export default async function setup() {
  // Guard first: nothing below may run against a non-test database.
  try {
    assertTestDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
    assertTestDatabaseUrl("DIRECT_URL", process.env.DIRECT_URL);
  } catch (error) {
    // Vitest can hide the message of startup errors; print it explicitly.
    console.error(`
[global-setup] ${(error as Error).message}
`);
    throw error;
  }

  const prismaCli = createRequire(import.meta.url).resolve(
    "prisma/build/index.js",
  );
  try {
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      env: process.env,
      stdio: "pipe",
    });
  } catch (error) {
    // Surface what Prisma printed; stdio "pipe" would otherwise hide it.
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    console.error(`${stdout?.toString() ?? ""}${stderr?.toString() ?? ""}`);
    throw error;
  }

  const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      const list = rows
        .map((r) => `"public"."${r.tablename.replaceAll('"', '""')}"`)
        .join(", ");
      await client.query(`TRUNCATE ${list} CASCADE`);
    }
  } finally {
    await client.end();
  }
}
