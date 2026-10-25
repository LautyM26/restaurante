import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { AppError } from "@/shared/errors";
import { createErrorHandler } from "@/shared/error-handler";
import { createLogger } from "@/shared/logger";

function makeApp() {
  let out = "";
  const logger = createLogger("info", {
    write(chunk: string) {
      out += chunk;
    },
  });
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/app-error", () => {
    throw new AppError("NOT_FOUND", 404, "Not found", { id: "x" });
  });
  app.get("/zod", () => {
    z.object({ a: z.string() }).parse({});
  });
  app.get("/boom", () => {
    throw new Error("secret db password in message");
  });
  app.use(createErrorHandler(logger));
  return { app, logs: () => out };
}

describe("error handler", () => {
  it("maps AppError to its status and body", async () => {
    const res = await request(makeApp().app).get("/app-error");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: "NOT_FOUND",
      message: "Not found",
      details: { id: "x" },
    });
  });

  it("maps ZodError to 400 VALIDATION with issues only", async () => {
    const res = await request(makeApp().app).get("/zod");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(res.body.details).toEqual({
      issues: [{ path: "a", code: "invalid_type" }],
    });
  });

  it("maps malformed JSON to 400 VALIDATION", async () => {
    const res = await request(makeApp().app)
      .post("/echo")
      .set("content-type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(JSON.stringify(res.body)).not.toMatch(/position|token|stack/i);
  });

  it("maps unsupported charset and encoding to 400 VALIDATION", async () => {
    const { app } = makeApp();
    const charset = await request(app)
      .post("/echo")
      .set("content-type", "application/json; charset=latin1")
      .send("{}");
    expect(charset.status).toBe(400);
    expect(charset.body).toEqual({
      code: "VALIDATION",
      message: "Invalid request",
    });
    const encoding = await request(app)
      .post("/echo")
      .set("content-type", "application/json")
      .set("content-encoding", "foo")
      .send("{}");
    expect(encoding.status).toBe(400);
    expect(encoding.body.code).toBe("VALIDATION");
  });

  it("maps an oversized body to 400 VALIDATION", async () => {
    const res = await request(makeApp().app)
      .post("/echo")
      .send({ big: "x".repeat(5000) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("answers 500 SERVER generic and logs the full error", async () => {
    const { app, logs } = makeApp();
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      code: "SERVER",
      message: "Internal server error",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/secret|stack/);
    expect(logs()).toContain("secret db password in message");
    expect(logs()).toContain("stack");
  });
});
