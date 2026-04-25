import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class GracePeriodExpiredError extends BaseError {
  constructor(requestId: string, action: string, deadline: string) {
    super(
      `Grace period expired for action '${action}'. Deadline was ${deadline}`,
      'GRACE_PERIOD_EXPIRED',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { requestId, action, deadline },
    );
  }
}
