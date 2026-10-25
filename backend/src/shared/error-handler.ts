import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors";
import type { Logger } from "@/shared/logger";
import {
  VALIDATION_MESSAGE,
  toIssues,
  validationError,
} from "@/shared/validate";

export const BODY_TOO_LARGE_MESSAGE = "Request body too large";
export const INVALID_JSON_MESSAGE = "Malformed JSON body";
export const SERVER_ERROR_MESSAGE = "Internal server error";

function bodyParserType(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const type = (err as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return validationError(toIssues(err));
  const type = bodyParserType(err);
  if (type === "entity.parse.failed") {
    return new AppError("VALIDATION", 400, INVALID_JSON_MESSAGE);
  }
  if (type === "charset.unsupported" || type === "encoding.unsupported") {
    return new AppError("VALIDATION", 400, VALIDATION_MESSAGE);
  }
  if (type === "entity.too.large") {
    return new AppError("VALIDATION", 400, BODY_TOO_LARGE_MESSAGE);
  }
  return undefined;
}

// Central error handler (design 13.1). Never exposes stacks or internals.
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const known = toAppError(err);
    if (known !== undefined) {
      res.status(known.status).json(known.toBody());
      return;
    }
    logger.error({ err, method: req.method }, "unhandled error");
    res
      .status(500)
      .json(new AppError("SERVER", 500, SERVER_ERROR_MESSAGE).toBody());
  };
}
