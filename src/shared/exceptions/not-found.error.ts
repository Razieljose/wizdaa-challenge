import { HttpStatus } from '@nestjs/common';
import { BaseError } from './base.error';

export class NotFoundError extends BaseError {
  constructor(entity: string, identifier: string) {
    super(
      `${entity} not found: ${identifier}`,
      'NOT_FOUND',
      HttpStatus.NOT_FOUND,
      { entity, identifier },
    );
  }
}
