import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class RequestStateConflictError extends BaseError {
  constructor(requestId: string, currentStatus: string, attemptedAction: string) {
    super(
      `Cannot perform '${attemptedAction}' on request in status '${currentStatus}'`,
      'REQUEST_STATE_CONFLICT',
      HttpStatus.CONFLICT,
      { requestId, currentStatus, attemptedAction },
    );
  }
}
