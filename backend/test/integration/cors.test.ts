import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp, TEST_ORIGIN } from "../helpers/app";

const { app, deps } = createTestApp();
afterAll(() => deps.prisma.$disconnect());

describe("CORS", () => {
  it("allows a configured origin", async () => {
    const res = await request(app).get("/api/nope").set("Origin", TEST_ORIGIN);
    expect(res.headers["access-control-allow-origin"]).toBe(TEST_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("does not send Allow-Origin for an unknown origin", async () => {
    const res = await request(app)
      .get("/api/nope")
      .set("Origin", "http://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers the preflight with the methods and headers of section 16", async () => {
    const res = await request(app)
      .options("/api/orders")
      .set("Origin", TEST_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set(
        "Access-Control-Request-Headers",
        "Content-Type, Authorization, Idempotency-Key",
      );
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(TEST_ORIGIN);
    expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,PATCH");
    expect(res.headers["access-control-allow-headers"]).toBe(
      "Content-Type,Authorization,Idempotency-Key",
    );
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
