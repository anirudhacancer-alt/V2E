/**
 * Thrown when persisted data violates FK / master-data expectations.
 * Handlers should map this to HTTP 500 with code `DATA_INTEGRITY`.
 */
export class DataIntegrityError extends Error {
  readonly code = "DATA_INTEGRITY" as const;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DataIntegrityError";
  }
}

export function isDataIntegrityError(e: unknown): e is DataIntegrityError {
  return e instanceof DataIntegrityError;
}

/**
 * Phase B error codes for validation failures.
 */
export type PhaseBErrorCode =
  | "PROJECT_SCOPE_MISMATCH"
  | "DEPENDENCY_CYCLE_DETECTED"
  | "DEPENDENCY_INVALID_EDGE"
  | "COMMITMENT_INVALID_STATE_TRANSITION"
  | "DEPENDENCY_OVERRIDE_REQUIRES_REASON";

/**
 * Thrown when validation fails with a specific Phase B error code.
 * Handlers should map this to HTTP 400/409 with the specific code.
 */
export class ValidationError extends Error {
  constructor(
    readonly code: PhaseBErrorCode | string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isValidationError(e: unknown): e is ValidationError {
  return e instanceof ValidationError;
}
