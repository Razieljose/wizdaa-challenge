import { RolesGuard } from '../roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '../../../shared/types';
import { ForbiddenError } from '../../../shared/exceptions';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user: any, requiredRoles?: Role[]): ExecutionContext => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    if (requiredRoles) {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
    } else {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    }

    return context;
  };

  it('should allow access when no roles required', () => {
    const context = createMockContext({});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    const user = {
      id: 'user1',
      roles: [{ locationId: 'loc1', role: Role.MANAGER }],
    };
    const context = createMockContext(user, [Role.MANAGER]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user lacks required role', () => {
    const user = {
      id: 'user1',
      roles: [{ locationId: 'loc1', role: Role.EMPLOYEE }],
    };
    const context = createMockContext(user, [Role.MANAGER]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it('should deny access when no user is present', () => {
    const context = createMockContext(null, [Role.MANAGER]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });
});
