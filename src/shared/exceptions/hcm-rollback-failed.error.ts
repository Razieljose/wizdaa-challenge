import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class HcmRollbackFailedError extends BaseError {
  constructor(requestId: string, hcmReferenceId: string, details: Record<string, unknown> = {}) {
    super(
      `HCM rollback failed for request ${requestId} (HCM ref: ${hcmReferenceId}). Manual review required.`,
      'HCM_ROLLBACK_FAILED',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { requestId, hcmReferenceId, ...details },
    );
  }
}
