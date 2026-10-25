import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { TABLE_NOT_FOUND_MESSAGE } from "@/modules/tables/tables.service";
import { createTestApp } from "../helpers/app";
import { createRestaurant, createTable } from "../helpers/factories";

const { app, deps } = createTestApp();
const { prisma } = deps;
afterAll(() => prisma.$disconnect());

const NOT_FOUND = { code: "NOT_FOUND", message: TABLE_NOT_FOUND_MESSAGE };

describe("GET /api/tables/:tableId", () => {
  it("returns 200 { id } for an active table, no auth", async () => {
    const restaurant = await createRestaurant(prisma);
    await createTable(prisma, restaurant.id, 7);
    const res = await request(app).get(
      `/api/tables/7?restaurant=${restaurant.slug}`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7 });
  });

  it("accepts the maximum tableId", async () => {
    const restaurant = await createRestaurant(prisma);
    await createTable(prisma, restaurant.id, 2147483647);
    const res = await request(app).get(
      `/api/tables/2147483647?restaurant=${restaurant.slug}`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 2147483647 });
  });

  it("returns 404 for a missing table", async () => {
    const restaurant = await createRestaurant(prisma);
    const res = await request(app).get(
      `/api/tables/9?restaurant=${restaurant.slug}`,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it("returns 404 for an inactive table", async () => {
    const restaurant = await createRestaurant(prisma);
    await createTable(prisma, restaurant.id, 3, false);
    const res = await request(app).get(
      `/api/tables/3?restaurant=${restaurant.slug}`,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it("returns 404 for a table of another restaurant", async () => {
    const one = await createRestaurant(prisma);
    const two = await createRestaurant(prisma);
    await createTable(prisma, one.id, 4);
    const res = await request(app).get(`/api/tables/4?restaurant=${two.slug}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it("returns 404 for an unknown restaurant", async () => {
    const res = await request(app).get(
      "/api/tables/1?restaurant=no-such-place",
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it.each([
    ["zero", "0"],
    ["negative", "-1"],
    ["decimal", "1.5"],
    ["text", "abc"],
    ["leading zero", "01"],
    ["plus sign", "%2B1"],
    ["above max", "2147483648"],
    ["huge", "99999999999999999999"],
  ])("returns 400 VALIDATION for tableId (%s)", async (_n, id) => {
    const restaurant = await createRestaurant(prisma);
    const res = await request(app).get(
      `/api/tables/${id}?restaurant=${restaurant.slug}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("returns 400 VALIDATION when restaurant is missing", async () => {
    const res = await request(app).get("/api/tables/1");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(res.body.details.issues).toEqual([
      { path: "query.restaurant", code: "invalid_type" },
    ]);
  });

  it("reports both issues when tableId and restaurant are invalid", async () => {
    const res = await request(app).get("/api/tables/0");
    expect(res.status).toBe(400);
    expect(res.body.details.issues).toHaveLength(2);
  });
});
