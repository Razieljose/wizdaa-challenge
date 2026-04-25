import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../shared/types';
import { IActor } from '../../shared/interfaces';
import { ForbiddenError } from '../../shared/exceptions';

/**
 * RBAC guard that checks if the actor has at least one of the required roles.
 * Used in conjunction with @Roles() decorator.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actor: IActor = request.user;

    if (!actor) {
      throw new ForbiddenError('No authenticated user found');
    }

    const actorRoles = new Set(actor.roles.map((r) => r.role));
    const hasRole = requiredRoles.some((role) => actorRoles.has(role));

    if (!hasRole) {
      this.logger.warn(
        `User ${actor.id} does not have required roles: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenError('Insufficient role permissions', {
        requiredRoles,
        userRoles: Array.from(actorRoles),
      });
    }

    return true;
  }
}
