import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IActor } from '../../shared/interfaces';

/**
 * Parameter decorator that extracts the authenticated IActor from the request.
 * Usage: @CurrentActor() actor: IActor
 */
export const CurrentActor = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IActor => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as IActor;
  },
);
