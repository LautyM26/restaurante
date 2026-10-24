import { describe, expect, it } from "vitest";
import http from "node:http";
import express from "express";
import { pinoHttp } from "pino-http";
import request from "supertest";
import {
  createLogger,
  redactSerializedReq,
  redactUrl,
} from "../../src/shared/logger.js";

function capture(): {
  lines: () => string;
  stream: { write(chunk: string): void };
} {
  let out = "";
  return {
    lines: () => out,
    stream: {
      write(chunk: string) {
        out += chunk;
      },
    },
  };
}

describe("logger redaction", () => {
  it("redacts authorization, cookie and set-cookie", () => {
    const cap = capture();
    const logger = createLogger("info", cap.stream);
    logger.info({
      req: {
        method: "GET",
        url: "/api/menu",
        headers: {
          authorization: "Bearer SECRET-AUTH",
          cookie: "sid=SECRET-COOKIE",
        },
      },
      res: {
        statusCode: 200,
        headers: { "set-cookie": ["sid=SECRET-SETCOOKIE"] },
      },
    });
    const out = cap.lines();
    expect(out).not.toContain("SECRET-AUTH");
    expect(out).not.toContain("SECRET-COOKIE");
    expect(out).not.toContain("SECRET-SETCOOKIE");
    expect(out).toContain("[REDACTED]");
  });

  it.each([
    [
      "first",
      "/ws?accessToken=SECRET-TOKEN&a=1&b=2",
      "/ws?accessToken=[REDACTED]&a=1&b=2",
    ],
    [
      "middle",
      "/ws?a=1&accessToken=SECRET-TOKEN&b=2",
      "/ws?a=1&accessToken=[REDACTED]&b=2",
    ],
    [
      "last",
      "/ws?a=1&b=2&accessToken=SECRET-TOKEN",
      "/ws?a=1&b=2&accessToken=[REDACTED]",
    ],
    ["only", "/ws?accessToken=SECRET-TOKEN", "/ws?accessToken=[REDACTED]"],
  ])("redacts accessToken when %s in the query", (_pos, url, expected) => {
    expect(redactUrl(url)).toBe(expected);

    const cap = capture();
    const logger = createLogger("info", cap.stream);
    logger.info({ req: { method: "GET", url, headers: {} } });
    const out = cap.lines();
    expect(out).not.toContain("SECRET-TOKEN");
    expect(out).toContain(expected);
  });

  it("leaves URLs without accessToken intact", () => {
    expect(redactUrl("/api/orders?status=pending&page=2")).toBe(
      "/api/orders?status=pending&page=2",
    );
  });

  it("respects the given level", () => {
    const cap = capture();
    createLogger("warn", cap.stream).info("hidden");
    expect(cap.lines()).toBe("");
  });

  it("redacts an encoded parameter name and keeps other params intact", () => {
    expect(redactUrl("/ws/orders?%61ccessToken=SECRET1&x=1")).toBe(
      "/ws/orders?%61ccessToken=[REDACTED]&x=1",
    );
    expect(redactUrl("/ws?access%54oken=SECRET1")).toBe(
      "/ws?access%54oken=[REDACTED]",
    );
    expect(redactUrl("/ws?other=SECRET1&%zz=2")).toBe(
      "/ws?other=SECRET1&%zz=2",
    );
  });

  it("returns non-string urls untouched", () => {
    expect(redactUrl(undefined)).toBeUndefined();
    expect(redactUrl(42)).toBe(42);
    const cap = capture();
    const logger = createLogger("info", cap.stream);
    expect(() =>
      logger.info({ req: { method: "GET", headers: {} } }),
    ).not.toThrow();
    expect(redactSerializedReq(null)).toBeNull();
  });

  it("redacts url and query with real pino-http, keeping other fields", async () => {
    const cap = capture();
    const logger = createLogger("info", cap.stream);
    const app = express();
    app.use(pinoHttp({ logger, serializers: { req: redactSerializedReq } }));
    app.get("/ws/orders", (_req, res) => {
      res.cookie("sid", "SECRET-SETCOOKIE");
      res.json({ ok: true });
    });
    const server = http.createServer(app);
    await request(server)
      .get(
        "/ws/orders?a=1&%61ccessToken=SECRET-TOKEN&accessToken=SECRET-TOKEN2",
      )
      .set("Authorization", "Bearer SECRET-AUTH")
      .set("Cookie", "sid=SECRET-COOKIE")
      .expect(200);
    await new Promise((r) => setTimeout(r, 20));
    const out = cap.lines();
    for (const secret of [
      "SECRET-TOKEN",
      "SECRET-TOKEN2",
      "SECRET-AUTH",
      "SECRET-COOKIE",
      "SECRET-SETCOOKIE",
    ]) {
      expect(out).not.toContain(secret);
    }
    const entry = JSON.parse(out.trim().split("\n")[0] ?? "{}") as {
      req: {
        url: string;
        query?: Record<string, unknown>;
        remoteAddress?: string;
        remotePort?: number;
      };
    };
    expect(entry.req.url).toContain("a=1");
    expect(entry.req.remoteAddress).toBeDefined();
    expect(entry.req.remotePort).toBeDefined();
    expect(entry.req.query?.["accessToken"]).toBe("[REDACTED]");
  });
});
