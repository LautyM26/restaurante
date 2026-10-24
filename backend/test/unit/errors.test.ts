import { describe, expect, it } from "vitest";
import { systemClock } from "@/shared/clock";
import { AppError, ERROR_STATUS, type ErrorCode } from "@/shared/errors";
import { systemRandom } from "@/shared/random";

describe("error codes", () => {
  it("maps the 11 codes to their HTTP status", () => {
    expect(ERROR_STATUS).toEqual({
      VALIDATION: 400,
      UNAUTHORIZED: 401,
      NOT_FOUND: 404,
      IDEMPOTENCY_CONFLICT: 409,
      PRICE_CHANGED: 409,
      STATUS_CONFLICT: 409,
      INVALID_TRANSITION: 409,
      INVALID_TABLE: 422,
      LINES_REJECTED: 422,
      RATE_LIMITED: 429,
      SERVER: 500,
    });
    expect(Object.keys(ERROR_STATUS)).toHaveLength(11);
  });
});

describe("AppError", () => {
  it("keeps code, status, message and details", () => {
    const issues = [{ path: "items.2.quantity", code: "too_big" }];
    const error = new AppError("VALIDATION", 400, "Invalid request", {
      issues,
    });
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.code).toBe("VALIDATION");
    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid request");
    expect(error.details).toEqual({ issues });
  });

  it("serializes to { code, message, details? } without details when absent", () => {
    const error = new AppError(
      "NOT_FOUND",
      ERROR_STATUS.NOT_FOUND,
      "Not found",
    );
    expect(error.toBody()).toEqual({ code: "NOT_FOUND", message: "Not found" });
    expect("details" in error.toBody()).toBe(false);
  });

  it("includes details in the body when present", () => {
    const code: ErrorCode = "PRICE_CHANGED";
    const details = { totalCents: 1200, priceLines: [] };
    const body = new AppError(
      code,
      ERROR_STATUS[code],
      "Price changed",
      details,
    ).toBody();
    expect(body).toEqual({ code, message: "Price changed", details });
  });
});

describe("AppError typing", () => {
  it("rejects a status that does not match the code", () => {
    // @ts-expect-error NOT_FOUND must be 404
    const invalid = new AppError("NOT_FOUND", 500, "x");
    expect(invalid.code).toBe("NOT_FOUND");
  });
});

describe("injectable dependencies", () => {
  it("provides system defaults", () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
    const value = systemRandom();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
