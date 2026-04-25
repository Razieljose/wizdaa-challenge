import { HttpStatus } from '@nestjs/common';

/**
 * Base error class for the application.
 * Java-style exception hierarchy with code, details, and httpStatus.
 * All domain exceptions must extend this class.
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;
  public readonly httpStatus: number;

  constructor(
    message: string,
    code: string,
    httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes the error to a JSON-friendly format for HTTP responses.
   */
  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
