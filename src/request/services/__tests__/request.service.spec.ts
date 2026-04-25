import { RequestService } from '../request.service';
import { RequestStateMachine } from '../request-state-machine';
import { RequestStatus, Role } from '../../../shared/types';
import { IActor } from '../../../shared/interfaces';
import {
  ForbiddenError,
  InsufficientBalanceError,
  InvalidDateRangeError,
  OverlapConflictError,
  GracePeriodExpiredError,
  NotFoundError,
  HcmUnavailableError,
} from '../../../shared/exceptions';

describe('RequestService', () => {
  let service: RequestService;
  let mockReadRepo: any;
  let mockAuditRepo: any;
  let mockBalanceService: any;
  let mockHcmClient: any;
  let mockConfigService: any;
  let mockDataSource: any;
  let stateMachine: RequestStateMachine;
  let savedRequests: any[] = [];
  let savedAudits: any[] = [];

  const employeeActor: IActor = {
    id: 'emp-1',
    email: 'emp@test.com',
    name: 'Employee',
    roles: [{ locationId: 'loc-1', role: Role.EMPLOYEE }],
    employeeLocationIds: ['loc-1'],
    managedLocationIds: [],
  };

  const managerActor: IActor = {
    id: 'mgr-1',
    email: 'mgr@test.com',
    name: 'Manager',
    roles: [{ locationId: 'loc-1', role: Role.MANAGER }],
    employeeLocationIds: [],
    managedLocationIds: ['loc-1'],
  };

  const futureDate = (daysFromNow: number) =>
    new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    stateMachine = new RequestStateMachine();
    savedRequests = [];
    savedAudits = [];

    mockReadRepo = {
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      findOverlapping: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    };

    mockAuditRepo = {
      buildEntity: jest.fn((requestId, actorId, prev, next, action, reason) => ({
        id: 'audit-id',
        requestId,
        actorId,
        previousStatus: prev,
        newStatus: next,
        action,
        reason: reason || '',
      })),
    };

    mockBalanceService = {
      getEffectiveBalance: jest.fn().mockResolvedValue({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        hcmBalance: 20,
        pendingDeductions: 5,
        effectiveBalance: 15,
        lastSyncedAt: '2026-01-01T00:00:00Z',
      }),
    };

    mockHcmClient = {
      cancelTimeOff: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(24),
    };

    const mockManager = {
      save: jest.fn(async (entityOrClass: any, entity?: any) => {
        const actualEntity = entity ?? entityOrClass;
        if (actualEntity?.action) {
          savedAudits.push(actualEntity);
        } else {
          savedRequests.push(actualEntity);
        }
        return actualEntity;
      }),
    };

    mockDataSource = {
      transaction: jest.fn(async (cb: any) => cb(mockManager)),
    };

    service = new RequestService(
      mockReadRepo,
      mockAuditRepo,
      stateMachine,
      mockBalanceService,
      mockHcmClient,
      mockConfigService,
      mockDataSource,
    );
  });

  describe('submit', () => {
    const validInput = () => ({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      daysRequested: 3,
      startDate: futureDate(30),
      endDate: futureDate(33),
      idempotencyKey: 'key-1',
    });

    it('creates a PENDING request and logs submit audit atomically', async () => {
      const result = await service.submit(validInput(), employeeActor);

      expect(result.status).toBe(RequestStatus.PENDING);
      expect(result.employeeId).toBe('emp-1');
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(savedRequests).toHaveLength(1);
      expect(savedAudits).toHaveLength(1);
      expect(savedAudits[0].action).toBe('submit');
      expect(savedAudits[0].previousStatus).toBe('NONE');
      expect(savedAudits[0].newStatus).toBe(RequestStatus.PENDING);
    });

    it('returns existing request on idempotent hit without saving', async () => {
      const existing = {
        id: 'req-existing',
        status: RequestStatus.PENDING,
        daysRequested: 3,
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2026-01-01',
        endDate: '2026-01-03',
        idempotencyKey: 'key-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      mockReadRepo.findByIdempotencyKey.mockResolvedValue(existing);

      const result = await service.submit(validInput(), employeeActor);

      expect(result.id).toBe('req-existing');
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects submit for another employee', async () => {
      const otherActor = { ...employeeActor, id: 'other' };
      await expect(service.submit(validInput(), otherActor)).rejects.toThrow(ForbiddenError);
    });

    it('rejects submit for location actor does not belong to', async () => {
      const input = { ...validInput(), locationId: 'loc-2' };
      await expect(service.submit(input, employeeActor)).rejects.toThrow(ForbiddenError);
    });

    it('rejects invalid date range', async () => {
      const input = { ...validInput(), startDate: '2026-12-05', endDate: '2026-12-01' };
      await expect(service.submit(input, employeeActor)).rejects.toThrow(InvalidDateRangeError);
    });

    it('rejects when effective balance is insufficient', async () => {
      mockBalanceService.getEffectiveBalance.mockResolvedValue({ effectiveBalance: 1 });
      const input = { ...validInput(), daysRequested: 5 };
      await expect(service.submit(input, employeeActor)).rejects.toThrow(InsufficientBalanceError);
    });

    it('rejects when an overlapping request exists', async () => {
      mockReadRepo.findOverlapping.mockResolvedValue([{ id: 'conflict-req' }]);
      await expect(service.submit(validInput(), employeeActor)).rejects.toThrow(OverlapConflictError);
    });
  });

  describe('approve', () => {
    const buildRequest = (overrides: Partial<any> = {}) => ({
      id: 'req-1',
      status: RequestStatus.PENDING,
      locationId: 'loc-1',
      employeeId: 'emp-1',
      startDate: futureDate(7),
      ...overrides,
    });

    it('transitions PENDING → APPROVED with audit in one transaction', async () => {
      mockReadRepo.findById.mockResolvedValue(buildRequest());

      const result = await service.approve('req-1', managerActor);

      expect(result.newStatus).toBe(RequestStatus.APPROVED);
      expect(result.previousStatus).toBe(RequestStatus.PENDING);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(savedAudits[0].action).toBe('approve');
    });

    it('throws NotFoundError when request does not exist', async () => {
      mockReadRepo.findById.mockResolvedValue(null);
      await expect(service.approve('req-1', managerActor)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-manager actor', async () => {
      mockReadRepo.findById.mockResolvedValue(buildRequest());
      await expect(service.approve('req-1', employeeActor)).rejects.toThrow(ForbiddenError);
    });

    it('throws GracePeriodExpiredError when inside grace window', async () => {
      mockReadRepo.findById.mockResolvedValue(
        buildRequest({ startDate: new Date(Date.now() + 3_600_000).toISOString() }),
      );
      await expect(service.approve('req-1', managerActor)).rejects.toThrow(GracePeriodExpiredError);
    });

    it('throws state conflict when approving already-APPROVED request', async () => {
      mockReadRepo.findById.mockResolvedValue(buildRequest({ status: RequestStatus.APPROVED }));
      await expect(service.approve('req-1', managerActor)).rejects.toThrow();
    });
  });

  describe('reject', () => {
    it('transitions PENDING → CANCELLED with reason', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
        locationId: 'loc-1',
      });
      const result = await service.reject('req-1', 'Not appropriate time', managerActor);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
      expect(savedAudits[0].action).toBe('reject');
      expect(savedAudits[0].reason).toBe('Not appropriate time');
    });

    it('uses default reason when none is provided', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
        locationId: 'loc-1',
      });
      await service.reject('req-1', '', managerActor);
      expect(savedRequests[0].rejectionReason).toBe('Rejected by manager');
    });

    it('throws ForbiddenError for non-manager actor', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
        locationId: 'loc-1',
      });
      await expect(service.reject('req-1', 'r', employeeActor)).rejects.toThrow(ForbiddenError);
    });

    it('throws state conflict for non-PENDING request', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.COMPLETED,
        locationId: 'loc-1',
      });
      await expect(service.reject('req-1', 'reason', managerActor)).rejects.toThrow();
    });
  });

  describe('cancel', () => {
    it('owner can cancel PENDING request', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
        locationId: 'loc-1',
        employeeId: 'emp-1',
      });
      const result = await service.cancel('req-1', employeeActor);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
    });

    it('manager can cancel APPROVED request inside grace period', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.APPROVED,
        locationId: 'loc-1',
        employeeId: 'emp-1',
        startDate: futureDate(7),
      });
      const result = await service.cancel('req-1', managerActor);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
    });

    it('manager override: can cancel APPROVED past grace period', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.APPROVED,
        locationId: 'loc-1',
        employeeId: 'emp-1',
        startDate: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const result = await service.cancel('req-1', managerActor);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
    });

    it('owner cannot cancel APPROVED past grace period', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.APPROVED,
        locationId: 'loc-1',
        employeeId: 'emp-1',
        startDate: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await expect(service.cancel('req-1', employeeActor)).rejects.toThrow(GracePeriodExpiredError);
    });

    it('third party cannot cancel', async () => {
      const other: IActor = {
        id: 'other',
        email: 'o@t.com',
        name: 'Other',
        roles: [{ locationId: 'loc-2', role: Role.EMPLOYEE }],
        employeeLocationIds: ['loc-2'],
        managedLocationIds: [],
      };
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
        locationId: 'loc-1',
        employeeId: 'emp-1',
      });
      await expect(service.cancel('req-1', other)).rejects.toThrow(ForbiddenError);
    });

    it('cannot cancel FAILED request (terminal state)', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.FAILED,
        locationId: 'loc-1',
        employeeId: 'emp-1',
      });
      await expect(service.cancel('req-1', employeeActor)).rejects.toThrow();
    });

    // COMPLETED → CANCELLED with HCM reversal
    describe('COMPLETED cancellation branch', () => {
      it('calls HCM cancelTimeOff and transitions to CANCELLED on success', async () => {
        mockHcmClient.cancelTimeOff.mockResolvedValue({ status: 'CONFIRMED' });
        mockReadRepo.findById.mockResolvedValue({
          id: 'req-1',
          status: RequestStatus.COMPLETED,
          locationId: 'loc-1',
          employeeId: 'emp-1',
          hcmReferenceId: 'HCM-REF-001',
        });

        const result = await service.cancel('req-1', managerActor);

        expect(mockHcmClient.cancelTimeOff).toHaveBeenCalledWith('HCM-REF-001');
        expect(result.newStatus).toBe(RequestStatus.CANCELLED);
        expect(result.previousStatus).toBe(RequestStatus.COMPLETED);
        expect(savedAudits[0].action).toBe('cancel');
      });

      it('sets manualReviewReason and throws when HCM reversal fails', async () => {
        mockHcmClient.cancelTimeOff.mockRejectedValue(
          new HcmUnavailableError({ originalError: 'connection refused' }),
        );
        const request = {
          id: 'req-1',
          status: RequestStatus.COMPLETED,
          locationId: 'loc-1',
          employeeId: 'emp-1',
          hcmReferenceId: 'HCM-REF-001',
        };
        mockReadRepo.findById.mockResolvedValue(request);

        await expect(service.cancel('req-1', managerActor)).rejects.toThrow(ForbiddenError);

        // Flag persisted
        expect(savedRequests).toHaveLength(1);
        expect(savedRequests[0].manualReviewReason).toMatch(/^HCM_REVERSAL_REJECTED:/);
        // Status unchanged (still COMPLETED)
        expect(savedRequests[0].status).toBe(RequestStatus.COMPLETED);
        // Audit logged with cancel_attempt_failed
        expect(savedAudits[0].action).toBe('cancel_attempt_failed');
        expect(savedAudits[0].previousStatus).toBe(RequestStatus.COMPLETED);
        expect(savedAudits[0].newStatus).toBe(RequestStatus.COMPLETED);
      });
    });
  });

  describe('findById', () => {
    it('returns RequestOutput with manualReviewReason exposed', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 3,
        status: RequestStatus.COMPLETED,
        startDate: '2026-01-01',
        endDate: '2026-01-03',
        manualReviewReason: 'HCM_REVERSAL_REJECTED:timeout',
        idempotencyKey: 'k',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const result = await service.findById('req-1');
      expect(result.manualReviewReason).toBe('HCM_REVERSAL_REJECTED:timeout');
    });

    it('throws NotFoundError when request not found', async () => {
      mockReadRepo.findById.mockResolvedValue(null);
      await expect(service.findById('req-x')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findByEmployee', () => {
    it('filters by locationId when provided', async () => {
      mockReadRepo.findMany.mockResolvedValue([]);
      await service.findByEmployee('emp-1', 'loc-1');
      expect(mockReadRepo.findMany).toHaveBeenCalledWith({ employeeId: 'emp-1', locationId: 'loc-1' });
    });

    it('queries without locationId when omitted', async () => {
      mockReadRepo.findMany.mockResolvedValue([]);
      await service.findByEmployee('emp-1');
      expect(mockReadRepo.findMany).toHaveBeenCalledWith({ employeeId: 'emp-1' });
    });
  });

  describe('internal transitions (used by SyncService)', () => {
    it('transitionToInSync: APPROVED → IN_SYNC', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.APPROVED,
        locationId: 'loc-1',
      });
      const result = await service.transitionToInSync('req-1');
      expect(result.status).toBe(RequestStatus.IN_SYNC);
      expect(savedAudits[0].action).toBe('sync');
      expect(savedAudits[0].actorId).toBe('SYSTEM');
    });

    it('transitionToCompleted: IN_SYNC → COMPLETED with hcmReferenceId', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.IN_SYNC,
        locationId: 'loc-1',
      });
      const result = await service.transitionToCompleted('req-1', 'HCM-001');
      expect(result.status).toBe(RequestStatus.COMPLETED);
      expect(result.hcmReferenceId).toBe('HCM-001');
    });

    it('transitionToFailed: IN_SYNC → FAILED with reason', async () => {
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.IN_SYNC,
        locationId: 'loc-1',
      });
      const result = await service.transitionToFailed('req-1', 'HCM rejected');
      expect(result.status).toBe(RequestStatus.FAILED);
      expect(result.rejectionReason).toBe('HCM rejected');
    });
  });

  describe('transaction rollback semantics', () => {
    it('propagates error from transaction callback (state not saved)', async () => {
      mockDataSource.transaction.mockImplementation(async () => {
        throw new Error('DB write failed');
      });
      mockReadRepo.findById.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
        locationId: 'loc-1',
        employeeId: 'emp-1',
      });

      await expect(service.cancel('req-1', employeeActor)).rejects.toThrow('DB write failed');
    });
  });
});
