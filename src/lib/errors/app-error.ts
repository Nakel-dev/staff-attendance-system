export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "OPERATIONAL"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly isOperational: boolean;
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      status?: number;
      isOperational?: boolean;
      requestId?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = options.code || "OPERATIONAL";
    this.status = options.status || 400;
    this.isOperational = options.isOperational ?? true;
    this.requestId = options.requestId;
  }
}

export function toClientError(error: unknown): { error: string } {
  if (error instanceof AppError) {
    return { error: error.isOperational ? error.message : "Something went wrong. Please try again." };
  }
  return { error: "Something went wrong. Please try again." };
}

export function toLogPayload(error: unknown, requestId?: string) {
  if (error instanceof AppError) {
    return {
      requestId: requestId || error.requestId,
      code: error.code,
      message: error.message,
      operational: error.isOperational,
      stack: error.stack,
    };
  }
  if (error instanceof Error) {
    return {
      requestId,
      code: "INTERNAL",
      message: error.message,
      operational: false,
      stack: error.stack,
    };
  }
  return { requestId, code: "INTERNAL", message: "Unknown error", operational: false };
}
