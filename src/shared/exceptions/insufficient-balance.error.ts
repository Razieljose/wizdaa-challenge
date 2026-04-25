import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class InsufficientBalanceError extends BaseError {
  constructor(employeeId: string, locationId: string, requested: number, available: number) {
    super(
      `Insufficient balance: requested ${requested} days but only ${available} available`,
      'INSUFFICIENT_BALANCE',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { employeeId, locationId, requested, available },
    );
  }
}
