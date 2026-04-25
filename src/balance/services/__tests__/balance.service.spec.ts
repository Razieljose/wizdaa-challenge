import { BalanceService } from '../balance.service';
import { RequestStatus } from '../../../shared/types';
import { NotFoundError } from '../../../shared/exceptions';

describe('BalanceService', () => {
  let service: BalanceService;
  let mockBalanceReadRepo: any;
  let mockBalanceWriteRepo: any;
  let mockRequestRepo: any;

  beforeEach(() => {
    mockBalanceReadRepo = {
      findByEmployeeAndLocation: jest.fn(),
    };

    mockBalanceWriteRepo = {
      upsertBalance: jest.fn().mockResolvedValue({}),
    };

    mockRequestRepo = {
      createQueryBuilder: jest.fn(),
    };

    service = new BalanceService(
      mockBalanceReadRepo,
      mockBalanceWriteRepo,
      mockRequestRepo,
    );
  });

  describe('getEffectiveBalance', () => {
    it('should calculate effective balance correctly', async () => {
      mockBalanceReadRepo.findByEmployeeAndLocation.mockResolvedValue({
        hcmBalance: 20,
        lastSyncedAt: '2026-01-01T00:00:00Z',
      });

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '5' }),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getEffectiveBalance('emp-1', 'loc-1');

      expect(result.hcmBalance).toBe(20);
      expect(result.pendingDeductions).toBe(5);
      expect(result.effectiveBalance).toBe(15);
    });

    it('should return 0 deductions when no pending requests', async () => {
      mockBalanceReadRepo.findByEmployeeAndLocation.mockResolvedValue({
        hcmBalance: 10,
        lastSyncedAt: '2026-01-01T00:00:00Z',
      });

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getEffectiveBalance('emp-1', 'loc-1');
      expect(result.effectiveBalance).toBe(10);
      expect(result.pendingDeductions).toBe(0);
    });

    it('should throw NotFoundError when balance not found', async () => {
      mockBalanceReadRepo.findByEmployeeAndLocation.mockResolvedValue(null);
      await expect(service.getEffectiveBalance('emp-1', 'loc-1')).rejects.toThrow(NotFoundError);
    });

    it('should exclude CANCELLED and FAILED from deductions', async () => {
      mockBalanceReadRepo.findByEmployeeAndLocation.mockResolvedValue({
        hcmBalance: 20,
        lastSyncedAt: '2026-01-01T00:00:00Z',
      });

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '3' }),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getEffectiveBalance('emp-1', 'loc-1');

      // Verify the query only includes PENDING, APPROVED, IN_SYNC
      const andWhereCalls = mockQb.andWhere.mock.calls;
      const statusCall = andWhereCalls.find(
        (call: any) => call[0]?.includes?.('status IN'),
      );
      expect(statusCall).toBeDefined();
      const statuses = statusCall[1].statuses;
      expect(statuses).toContain(RequestStatus.PENDING);
      expect(statuses).toContain(RequestStatus.APPROVED);
      expect(statuses).toContain(RequestStatus.IN_SYNC);
      expect(statuses).not.toContain(RequestStatus.CANCELLED);
      expect(statuses).not.toContain(RequestStatus.FAILED);
      expect(statuses).not.toContain(RequestStatus.COMPLETED);
    });
  });

  describe('updateHcmBalance', () => {
    it('should call upsert on write repo', async () => {
      await service.updateHcmBalance('emp-1', 'loc-1', 25, 1700000000);
      expect(mockBalanceWriteRepo.upsertBalance).toHaveBeenCalledWith(
        'emp-1', 'loc-1', 25, 1700000000,
      );
    });
  });
});
