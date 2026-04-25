import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { RequestReadRepository } from '../repositories/request.read.repository';
import { IActor } from '../../shared/interfaces';
import { NotFoundError, UnauthorizedLocationError } from '../../shared/exceptions';

/**
 * Defense-in-depth guard applied to mutations on /requests/:id.
 * Resolves the request by ID and verifies the actor has any role at its location.
 *
 * This complements the service-level check (validateManagerAccess) by rejecting
 * at the controller edge, before any business logic runs.
 */
@Injectable()
export class RequestLocationGuard implements CanActivate {
  private readonly logger = new Logger(RequestLocationGuard.name);

  constructor(private readonly requestReadRepo: RequestReadRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const actor: IActor | undefined = req.user;
    const requestId: string | undefined = req.params?.id;

    // No :id path param → nothing to guard here.
    if (!requestId) {
      return true;
    }

    if (!actor) {
      throw new UnauthorizedLocationError('unknown', 'unknown');
    }

    const timeOffRequest = await this.requestReadRepo.findById(requestId);
    if (!timeOffRequest) {
      throw new NotFoundError('TimeOffRequest', requestId);
    }

    const hasAccess = actor.roles.some((r) => r.locationId === timeOffRequest.locationId);
    if (!hasAccess) {
      this.logger.warn(
        `User ${actor.id} denied access to request ${requestId} (location ${timeOffRequest.locationId})`,
      );
      throw new UnauthorizedLocationError(actor.id, timeOffRequest.locationId);
    }

    return true;
  }
}
