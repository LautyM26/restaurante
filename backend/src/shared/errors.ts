export const ERROR_STATUS = {
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
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type ErrorDetails = Record<string, unknown>;

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: ErrorDetails;
}

export class AppError<C extends ErrorCode = ErrorCode> extends Error {
  readonly code: C;
  readonly status: (typeof ERROR_STATUS)[C];
  readonly details?: ErrorDetails;

  constructor(
    code: C,
    status: (typeof ERROR_STATUS)[C],
    message: string,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }

  toBody(): ErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}
