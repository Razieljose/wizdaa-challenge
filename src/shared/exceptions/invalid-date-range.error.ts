import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class InvalidDateRangeError extends BaseError {
  constructor(startDate: string, endDate: string) {
    super(
      `Invalid date range: startDate (${startDate}) must be before or equal to endDate (${endDate})`,
      'INVALID_DATE_RANGE',
      HttpStatus.BAD_REQUEST,
      { startDate, endDate },
    );
  }
}
