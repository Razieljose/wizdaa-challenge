import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class OverlapConflictError extends BaseError {
  constructor(employeeId: string, startDate: string, endDate: string, conflictingRequestId: string) {
    super(
      `Time-off request overlaps with existing request ${conflictingRequestId}`,
      'OVERLAP_CONFLICT',
      HttpStatus.CONFLICT,
      { employeeId, startDate, endDate, conflictingRequestId },
    );
  }
}
