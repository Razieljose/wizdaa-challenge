import { LocationAccessGuard } from '../location-access.guard';
import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedLocationError } from '../../../shared/exceptions';
import { Role } from '../../../shared/types';

describe('LocationAccessGuard', () => {
  let guard: LocationAccessGuard;

  beforeEach(() => {
    guard = new LocationAccessGuard();
  });

  const createContext = (user: any, locationId?: string, source: 'body' | 'params' | 'query' = 'body'): ExecutionContext => {
    const request: any = { user, body: {}, params: {}, query: {} };
    if (locationId) {
      request[source].locationId = locationId;
    }
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  it('should allow access when actor has role in location', () => {
    const user = {
      id: 'user1',
      roles: [{ locationId: 'loc1', role: Role.EMPLOYEE }],
    };
    const ctx = createContext(user, 'loc1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access when actor has no role in location', () => {
    const user = {
      id: 'user1',
      roles: [{ locationId: 'loc1', role: Role.EMPLOYEE }],
    };
    const ctx = createContext(user, 'loc2');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedLocationError);
  });

  it('should skip validation when no locationId in request', () => {
    const user = {
      id: 'user1',
      roles: [{ locationId: 'loc1', role: Role.EMPLOYEE }],
    };
    const ctx = createContext(user);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should read locationId from params', () => {
    const user = {
      id: 'user1',
      roles: [{ locationId: 'loc1', role: Role.EMPLOYEE }],
    };
    const ctx = createContext(user, 'loc1', 'params');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should read locationId from query', () => {
    const user = {
      id: 'user1',
      roles: [{ locationId: 'loc1', role: Role.EMPLOYEE }],
    };
    const ctx = createContext(user, 'loc1', 'query');
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
