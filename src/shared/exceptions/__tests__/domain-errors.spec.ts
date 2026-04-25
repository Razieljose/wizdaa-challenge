import { HttpStatus } from '@nestjs/common';
import {
  InsufficientBalanceError,
  UnauthorizedLocationError,
  HcmUnavailableError,
  RequestStateConflictError,
  GracePeriodExpiredError,
  HcmRollbackFailedError,
  NotFoundError,
  ForbiddenError,
  InvalidDateRangeError,
  OptimisticLockError,
  OverlapConflictError,
  BaseError,
} from '../index';

describe('Domain Errors', () => {
  it('InsufficientBalanceError should have correct fields', () => {
    const error = new InsufficientBalanceError('emp1', 'loc1', 5, 3);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.code).toBe('INSUFFICIENT_BALANCE');
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.details.requested).toBe(5);
    expect(error.details.available).toBe(3);
  });

  it('UnauthorizedLocationError should return 403', () => {
    const error = new UnauthorizedLocationError('user1', 'loc1');
    expect(error.httpStatus).toBe(HttpStatus.FORBIDDEN);
    expect(error.code).toBe('UNAUTHORIZED_LOCATION');
  });

  it('HcmUnavailableError should return 503', () => {
    const error = new HcmUnavailableError({ reason: 'timeout' });
    expect(error.httpStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(error.code).toBe('HCM_UNAVAILABLE');
  });

  it('RequestStateConflictError should return 409', () => {
    const error = new RequestStateConflictError('req1', 'COMPLETED', 'approve');
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
    expect(error.code).toBe('REQUEST_STATE_CONFLICT');
    expect(error.details.currentStatus).toBe('COMPLETED');
  });

  it('GracePeriodExpiredError should return 422', () => {
    const error = new GracePeriodExpiredError('req1', 'approve', '2026-01-01T00:00:00Z');
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.code).toBe('GRACE_PERIOD_EXPIRED');
  });

  it('HcmRollbackFailedError should return 422', () => {
    const error = new HcmRollbackFailedError('req1', 'hcm-ref-1');
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.code).toBe('HCM_ROLLBACK_FAILED');
  });

  it('NotFoundError should return 404', () => {
    const error = new NotFoundError('User', 'abc');
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('ForbiddenError should return 403', () => {
    const error = new ForbiddenError('Nope');
    expect(error.httpStatus).toBe(HttpStatus.FORBIDDEN);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('InvalidDateRangeError should return 400', () => {
    const error = new InvalidDateRangeError('2026-02-01', '2026-01-01');
    expect(error.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(error.code).toBe('INVALID_DATE_RANGE');
  });

  it('OptimisticLockError should return 409', () => {
    const error = new OptimisticLockError('Balance', 'id1');
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
    expect(error.code).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  it('OverlapConflictError should return 409', () => {
    const error = new OverlapConflictError('emp1', '2026-01-01', '2026-01-05', 'req-existing');
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
    expect(error.code).toBe('OVERLAP_CONFLICT');
  });
});
