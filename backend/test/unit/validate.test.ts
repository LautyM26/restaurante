import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "@/shared/validate";
import { createErrorHandler } from "@/shared/error-handler";
import { createLogger } from "@/shared/logger";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.post(
    "/items/:id",
    validate({
      body: z.object({
        name: z.string(),
        items: z.array(z.object({ quantity: z.number().int().min(1) })),
      }),
      query: z.object({ page: z.coerce.number().int() }),
      params: z.object({ id: z.uuid() }),
      headers: z.object({ "x-key": z.string() }),
    }),
    (_req, res) => {
      res.json(res.locals["input"]);
    },
  );
  app.use(createErrorHandler(createLogger("silent")));
  return app;
}

const ID = "3f2b8c1e-5a4d-4c3b-9e1f-7a6b5c4d3e2f";

describe("validate", () => {
  it("leaves parsed data in res.locals.input", async () => {
    const res = await request(makeApp())
      .post(`/items/${ID}?page=2`)
      .set("x-key", "k")
      .send({ name: "a", items: [{ quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      body: { name: "a", items: [{ quantity: 1 }] },
      query: { page: 2 },
      params: { id: ID },
      headers: { "x-key": "k" },
    });
  });

  it("matches a mixed-case header against a lowercase schema key", async () => {
    const app = express();
    app.get(
      "/h",
      validate({ headers: z.object({ "idempotency-key": z.string() }) }),
      (_req, res) => {
        res.json(res.locals["input"]);
      },
    );
    const res = await request(app).get("/h").set("Idempotency-Key", "abc");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ headers: { "idempotency-key": "abc" } });
  });

  it("reports all issues with prefixed dotted paths and no Zod text", async () => {
    const res = await request(makeApp())
      .post("/items/not-a-uuid?page=x")
      .send({ items: [{ quantity: 1 }, { quantity: 1 }, { quantity: 0 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(Object.keys(res.body).sort()).toEqual([
      "code",
      "details",
      "message",
    ]);
    const issues = res.body.details.issues as { path: string; code: string }[];
    const paths = issues.map((i) => i.path).sort();
    expect(paths).toEqual([
      "headers.x-key",
      "items.2.quantity",
      "name",
      "params.id",
      "query.page",
    ]);
    for (const issue of issues) {
      expect(Object.keys(issue).sort()).toEqual(["code", "path"]);
    }
    expect(issues.find((i) => i.path === "items.2.quantity")?.code).toBe(
      "too_small",
    );
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/expected|invalid input|Too small|Required/i);
  });
});
