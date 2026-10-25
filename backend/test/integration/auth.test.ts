import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  requireStaff,
  resolveStaff,
  UNAUTHORIZED_MESSAGE,
} from "@/modules/staff/staff-auth";
import {
  createLocalTokenVerifier,
  type TokenVerifier,
} from "@/modules/staff/token-verifier";
import { createErrorHandler } from "@/shared/error-handler";
import { createLogger } from "@/shared/logger";
import { createTestDeps } from "../helpers/app";
import { createRestaurant, createStaffMember } from "../helpers/factories";
import {
  createTestKeys,
  signTestToken,
  TEST_SUPABASE_URL,
  type TestKeys,
} from "../helpers/jwt";

const { prisma } = createTestDeps();
afterAll(() => prisma.$disconnect());

let keys: TestKeys;
beforeAll(async () => {
  keys = await createTestKeys();
});

function buildApp(tokenVerifier: TokenVerifier) {
  const app = express();
  app.get(
    "/protected",
    requireStaff({ prisma, tokenVerifier }),
    (_req, res) => {
      res.json(res.locals["staff"]);
    },
  );
  app.use(createErrorHandler(createLogger("silent")));
  return app;
}

function realApp() {
  return buildApp(createLocalTokenVerifier(TEST_SUPABASE_URL, keys.jwks));
}

const UNAUTHORIZED = { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE };

describe("requireStaff", () => {
  it("sets res.locals.staff for a valid token of a StaffMember", async () => {
    const restaurant = await createRestaurant(prisma);
    const member = await createStaffMember(prisma, restaurant.id);
    const token = await signTestToken(keys, { sub: member.userId });
    const res = await request(realApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId: member.userId,
      restaurantId: restaurant.id,
    });
  });

  it("accepts the scheme case-insensitively", async () => {
    const restaurant = await createRestaurant(prisma);
    const member = await createStaffMember(prisma, restaurant.id);
    const token = await signTestToken(keys, { sub: member.userId });
    const res = await request(realApp())
      .get("/protected")
      .set("Authorization", `bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(realApp()).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it.each([
    "Basic abc",
    "Bearer",
    "Bearer ",
    "Bearer  tok",
    "Bearer a b",
    "tok",
  ])("returns 401 for malformed header %j", async (header) => {
    const res = await request(realApp())
      .get("/protected")
      .set("Authorization", header);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it("returns 401 for an invalid token", async () => {
    const res = await request(realApp())
      .get("/protected")
      .set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it("returns 401 for an expired token", async () => {
    const restaurant = await createRestaurant(prisma);
    const member = await createStaffMember(prisma, restaurant.id);
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = await signTestToken(keys, {
      sub: member.userId,
      iat: past - 3600,
      exp: past,
    });
    const res = await request(realApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it("returns 401 for a valid token without StaffMember", async () => {
    const token = await signTestToken(keys);
    const res = await request(realApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it("returns 401 for a valid token whose sub is not a UUID", async () => {
    const token = await signTestToken(keys, { sub: "not-a-uuid" });
    const res = await request(realApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it("does not turn a verifier infrastructure error into 401", async () => {
    const failing: TokenVerifier = {
      verify: () => Promise.reject(new Error("jwks unreachable")),
    };
    const res = await request(buildApp(failing))
      .get("/protected")
      .set("Authorization", "Bearer some.token.value");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("SERVER");
  });
});

// The WS maps these reasons to 4401 / 4403 (§7.3); REST answers 401 for both.
describe("resolveStaff", () => {
  const deps = () => ({
    prisma,
    tokenVerifier: createLocalTokenVerifier(TEST_SUPABASE_URL, keys.jwks),
  });

  it("returns the staff context and exp for a StaffMember", async () => {
    const restaurant = await createRestaurant(prisma);
    const member = await createStaffMember(prisma, restaurant.id);
    const exp = Math.floor(Date.now() / 1000) + 600;
    const token = await signTestToken(keys, { sub: member.userId, exp });
    expect(await resolveStaff(deps(), token)).toEqual({
      ok: true,
      staff: { userId: member.userId, restaurantId: restaurant.id },
      exp,
    });
  });

  it("returns invalid_token for a token that does not verify", async () => {
    expect(await resolveStaff(deps(), "not-a-jwt")).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("returns not_staff for a valid token without StaffMember", async () => {
    const token = await signTestToken(keys, { sub: randomUUID() });
    expect(await resolveStaff(deps(), token)).toEqual({
      ok: false,
      reason: "not_staff",
    });
  });
});
