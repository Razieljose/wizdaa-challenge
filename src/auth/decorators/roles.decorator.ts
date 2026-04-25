import { SetMetadata } from '@nestjs/common';
import { Role } from '../../shared/types';

export const ROLES_KEY = 'roles';

/**
 * Decorator that sets required roles metadata for RolesGuard.
 * Usage: @Roles(Role.MANAGER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
