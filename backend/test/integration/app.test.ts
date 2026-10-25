import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { ROUTE_NOT_FOUND_MESSAGE } from "@/app";
import { BODY_TOO_LARGE_MESSAGE } from "@/shared/error-handler";
import { createTestApp } from "../helpers/app";

const { app, deps } = createTestApp();
afterAll(() => deps.prisma.$disconnect());

describe("createApp", () => {
  it("does not send X-Powered-By", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns 404 NOT_FOUND for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: "NOT_FOUND",
      message: ROUTE_NOT_FOUND_MESSAGE,
    });
  });

  it("returns 400 VALIDATION for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("returns 400 VALIDATION for a body over 100 KB", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ note: "x".repeat(101 * 1024) });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: "VALIDATION",
      message: BODY_TOO_LARGE_MESSAGE,
    });
  });
});
