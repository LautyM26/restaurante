import type { RequestHandler } from "express";
import type { ZodError, ZodType } from "zod";
import { AppError } from "@/shared/errors";

export const VALIDATION_MESSAGE = "Invalid request";

type Source = "body" | "query" | "params" | "headers";

export type ValidationSchemas = Partial<Record<Source, ZodType>>;

export interface ValidationIssue {
  path: string;
  code: string;
}

// Node delivers header names in lowercase, so `headers` schemas must use
// lowercase keys (e.g. `idempotency-key`).
const SOURCES: readonly Source[] = ["body", "query", "params", "headers"];

// Zod issues reduced to { path, code }: no Zod messages leave the server (D-100).
export function toIssues(error: ZodError, source?: Source): ValidationIssue[] {
  const prefix = source === undefined || source === "body" ? [] : [source];
  return error.issues.map((issue) => ({
    path: [...prefix, ...issue.path].map(String).join("."),
    code: issue.code,
  }));
}

export function validationError(
  issues: ValidationIssue[],
): AppError<"VALIDATION"> {
  return new AppError("VALIDATION", 400, VALIDATION_MESSAGE, { issues });
}

/**
 * Parses each given source with its Zod schema and leaves the result in
 * `res.locals.input` (Express 5: `req.query` is read-only, D-101). Reports
 * the issues of every source at once.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    const input: Partial<Record<Source, unknown>> = {};
    const issues: ValidationIssue[] = [];
    for (const source of SOURCES) {
      const schema = schemas[source];
      if (schema === undefined) continue;
      const result = schema.safeParse(req[source]);
      if (result.success) {
        input[source] = result.data;
      } else {
        issues.push(...toIssues(result.error, source));
      }
    }
    if (issues.length > 0) {
      next(validationError(issues));
      return;
    }
    res.locals["input"] = input;
    next();
  };
}
