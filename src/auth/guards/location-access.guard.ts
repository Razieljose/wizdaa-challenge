import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { IActor } from '../../shared/interfaces';
import { Role } from '../../shared/types';
import { UnauthorizedLocationError } from '../../shared/exceptions';

/**
 * Guard that validates the actor has access to the target locationId.
 * Extracts locationId from request body, params, or query.
 * 
 * For EMPLOYEE: checks if locationId is in employeeLocationIds.
 * For MANAGER: checks if locationId is in managedLocationIds.
 */
@Injectable()
export class LocationAccessGuard implements CanActivate {
  private readonly logger = new Logger(LocationAccessGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actor: IActor = request.user;

    if (!actor) {
      throw new UnauthorizedLocationError('unknown', 'unknown');
    }

    // Extract locationId from multiple sources
    const locationId =
      request.body?.locationId ||
      request.params?.locationId ||
      request.query?.locationId;

    if (!locationId) {
      // If no locationId in request, skip location validation
      // (some endpoints may not require it)
      return true;
    }

    // Check if actor has any role in the target location
    const hasAccess = actor.roles.some((r) => r.locationId === locationId);

    if (!hasAccess) {
      this.logger.warn(
        `User ${actor.id} denied access to location ${locationId}`,
      );
      throw new UnauthorizedLocationError(actor.id, locationId);
    }

    return true;
  }
}
