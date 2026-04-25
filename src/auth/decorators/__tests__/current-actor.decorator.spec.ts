import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentActor } from '../current-actor.decorator';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '../../../shared/types';
import { IActor } from '../../../shared/interfaces';

describe('CurrentActor Decorator', () => {
  // Helper to extract decorator factory from parameter decorator metadata
  function getParamDecoratorFactory() {
    class TestController {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      testRoute(@CurrentActor() _actor: any) {
        // noop
      }
    }
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'testRoute');
    return args[Object.keys(args)[0]].factory;
  }

  it('should extract user from request as IActor', () => {
    const mockActor: IActor = {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test',
      roles: [{ locationId: 'loc-1', role: Role.EMPLOYEE }],
      employeeLocationIds: ['loc-1'],
      managedLocationIds: [],
    };

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockActor }),
      }),
    } as unknown as ExecutionContext;

    const factory = getParamDecoratorFactory();
    const result = factory(null, ctx);

    expect(result).toEqual(mockActor);
  });

  it('should return undefined when no user on request', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const factory = getParamDecoratorFactory();
    const result = factory(null, ctx);

    expect(result).toBeUndefined();
  });
});
