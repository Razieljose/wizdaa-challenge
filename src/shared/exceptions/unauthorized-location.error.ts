import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class UnauthorizedLocationError extends BaseError {
  constructor(userId: string, locationId: string) {
    super(
      `User does not have access to location ${locationId}`,
      'UNAUTHORIZED_LOCATION',
      HttpStatus.FORBIDDEN,
      { userId, locationId },
    );
  }
}
