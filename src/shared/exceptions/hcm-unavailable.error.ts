import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class HcmUnavailableError extends BaseError {
  constructor(details: Record<string, unknown> = {}) {
    super(
      'HCM system is currently unavailable',
      'HCM_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}
