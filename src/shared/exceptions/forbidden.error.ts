import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class ForbiddenError extends BaseError {
  constructor(message: string = 'Access denied', details: Record<string, unknown> = {}) {
    super(
      message,
      'FORBIDDEN',
      HttpStatus.FORBIDDEN,
      details,
    );
  }
}
