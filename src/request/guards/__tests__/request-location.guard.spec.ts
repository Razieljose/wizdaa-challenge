import { ExecutionContext } from '@nestjs/common';
import { RequestLocationGuard } from '../request-location.guard';
import { NotFoundError, UnauthorizedLocationError } from '../../../shared/exceptions';
import { IActor } from '../../../shared/interfaces';
import { Role } from '../../../shared/types';

describe('RequestLocationGuard', () => {
  let guard: RequestLocationGuard;
  let mockRepo: any;

  const mgrActor: IActor = {
    id: 'mgr-1',
    email: 'mgr@test.com',
    name: 'Manager',
    roles: [{ locationId: 'loc-1', role: Role.MANAGER }],
    employeeLocationIds: [],
    managedLocationIds: ['loc-1'],
  };

  const buildContext = (req: any): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

  beforeEach(() => {
    mockRepo = { findById: jest.fn() };
    guard = new RequestLocationGuard(mockRepo);
  });

  it('allows requests without :id (defers to other validation)', async () => {
    const result = await guard.canActivate(buildContext({ params: {}, user: mgrActor }));
    expect(result).toBe(true);
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedLocationError when actor is absent', async () => {
    await expect(
      guard.canActivate(buildContext({ params: { id: 'req-1' }, user: undefined })),
    ).rejects.toBeInstanceOf(UnauthorizedLocationError);
  });

  it('throws NotFoundError when request does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      guard.canActivate(buildContext({ params: { id: 'req-x' }, user: mgrActor })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws UnauthorizedLocationError when actor has no role at request location', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'req-1', locationId: 'loc-2' });
    await expect(
      guard.canActivate(buildContext({ params: { id: 'req-1' }, user: mgrActor })),
    ).rejects.toBeInstanceOf(UnauthorizedLocationError);
  });

  it('allows actor with any role at request location', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'req-1', locationId: 'loc-1' });
    const result = await guard.canActivate(
      buildContext({ params: { id: 'req-1' }, user: mgrActor }),
    );
    expect(result).toBe(true);
  });
});
