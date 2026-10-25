import { describe, expect, it } from "vitest";
import { parseEnv } from "@/env";

const valid = {
  DATABASE_URL: "postgresql://user:secret-pass@host:5432/db",
  DIRECT_URL: "postgresql://user:secret-pass@host:5432/db",
  SUPABASE_URL: "https://abc.supabase.co",
  CORS_ORIGINS: "http://localhost:5173",
};

describe("parseEnv", () => {
  it("applies defaults for optional variables", () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.DB_POOL_MAX).toBe(10);
    expect(env.SEED_STAFF_USER_ID).toBeUndefined();
  });

  it("splits CORS_ORIGINS by commas", () => {
    const env = parseEnv({
      ...valid,
      CORS_ORIGINS: "http://a.com, http://b.com ,",
    });
    expect(env.CORS_ORIGINS).toEqual(["http://a.com", "http://b.com"]);
  });

  it.each([
    ["false", false],
    ["true", true],
    ["1", 1],
    ["2", 2],
  ])("accepts TRUST_PROXY=%s", (raw, expected) => {
    expect(parseEnv({ ...valid, TRUST_PROXY: raw }).TRUST_PROXY).toBe(expected);
  });

  it("rejects an invalid TRUST_PROXY", () => {
    expect(() => parseEnv({ ...valid, TRUST_PROXY: "maybe" })).toThrow(
      /TRUST_PROXY/,
    );
  });

  it.each(["DATABASE_URL", "DIRECT_URL", "SUPABASE_URL", "CORS_ORIGINS"])(
    "fails naming %s when it is missing",
    (name) => {
      const env: NodeJS.ProcessEnv = { ...valid };
      delete env[name];
      expect(() => parseEnv(env)).toThrow(name);
    },
  );

  it("does not leak the value of an invalid variable", () => {
    const bad = "not-a-url-secret-value";
    try {
      parseEnv({ ...valid, SUPABASE_URL: bad });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("SUPABASE_URL");
      expect(message).not.toContain(bad);
    }
  });

  it("parses explicit optional values and accepts an empty seed id", () => {
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    const env = parseEnv({
      ...valid,
      PORT: "4000",
      LOG_LEVEL: "debug",
      DB_POOL_MAX: "5",
      SEED_STAFF_USER_ID: uuid,
    });
    expect(env).toMatchObject({
      PORT: 4000,
      LOG_LEVEL: "debug",
      DB_POOL_MAX: 5,
      SEED_STAFF_USER_ID: uuid,
    });
    expect(
      parseEnv({ ...valid, SEED_STAFF_USER_ID: "" }).SEED_STAFF_USER_ID,
    ).toBeUndefined();
  });

  it("rejects a non-UUID SEED_STAFF_USER_ID", () => {
    expect(() => parseEnv({ ...valid, SEED_STAFF_USER_ID: "abc" })).toThrow(
      /SEED_STAFF_USER_ID/,
    );
  });

  it("accepts only https for SUPABASE_URL", () => {
    expect(
      parseEnv({ ...valid, SUPABASE_URL: "https://abc.supabase.co" })
        .SUPABASE_URL,
    ).toBe("https://abc.supabase.co");
    for (const bad of ["ftp://x", "foo:bar", "http://abc.supabase.co"]) {
      expect(() => parseEnv({ ...valid, SUPABASE_URL: bad })).toThrow(
        /SUPABASE_URL/,
      );
    }
  });

  it.each([
    ["PORT", 3000],
    ["LOG_LEVEL", "info"],
    ["TRUST_PROXY", false],
    ["DB_POOL_MAX", 10],
  ])("treats empty %s as absent and applies the default", (name, expected) => {
    const env = parseEnv({ ...valid, [name]: "" });
    expect(env[name as keyof typeof env]).toBe(expected);
  });
});
