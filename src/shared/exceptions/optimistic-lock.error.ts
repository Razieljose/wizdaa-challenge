import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class OptimisticLockError extends BaseError {
  constructor(entity: string, id: string) {
    super(
      `Optimistic lock conflict on ${entity} (id: ${id}). The record was modified by another process.`,
      'OPTIMISTIC_LOCK_CONFLICT',
      HttpStatus.CONFLICT,
      { entity, id },
    );
  }
}
