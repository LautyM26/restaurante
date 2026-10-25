import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

afterAll(() => pool.end());

describe("row level security", () => {
  it("is enabled on every table in public", async () => {
    const { rows } = await pool.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(rows.map((r) => r.relname)).toContain("_prisma_migrations");
    expect(rows.filter((r) => !r.relrowsecurity)).toEqual([]);
  });
});
