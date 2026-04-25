import { BalanceService } from '../balance.service';
import { NotFoundError } from '../../../shared/exceptions';

describe('BalanceService', () => {
  let service: BalanceService;
  let mockBalanceReadRepo: any;
  let mockBalanceWriteRepo: any;
  let mockRequestReadRepo: any;

  beforeEach(() => {
    mockBalanceReadRepo = {
      findByEmployeeAndLocation: jest.fn(),
    };

    mockBalanceWriteRepo = {
      upsertBalance: jest.fn().mockResolvedValue({}),
    };

    mockRequestReadRepo = {
      sumPendingDeductions: jest.fn(),
    };

    service = new BalanceService(
      mockBalanceReadRepo,
      mockBalanceWriteRepo,
      mockRequestReadRepo,
    );
  });

  describe('getEffectiveBalance', () => {
    it('should calculate effective balance correctly', async () => {
      mockBalanceReadRepo.findByEmployeeAndLocation.mockResolvedValue({
        hcmBalance: 20,
        lastSyncedAt: '2026-01-01T00:00:00Z',
      });
      mockRequestReadRepo.sumPendingDeductions.mockResolvedValue(5);

      const result = await service.getEffectiveBalance('emp-1', 'loc-1');

      expect(result.hcmBalance).toBe(20);
      expect(result.pendingDeductions).toBe(5);
      expect(result.effectiveBalance).toBe(15);
      expect(mockRequestReadRepo.sumPendingDeductions).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('should return 0 deductions when no pending requests', async () => {
      mockBalanceReadRepo.findByEmployeeAndLocation.mockResolvedValue({
        hcmBalance: 10,
        lastSyncedAt: '2026-01-01T00:00:00Z',
      });
      mockRequestReadRepo.sumPendingDeductions.mockResolvedValue(0);

      const result = await service.getEffectiveBalance('emp-1', 'loc-1');
      expect(result.effectiveBalance).toBe(10);
      expect(result.pendingDeductions).toBe(0);
    });

    it('should throw NotFoundError when balance not found', async () => {
      mockBalanceReadRepo.findByEmployeeAndLocation.mockResolvedValue(null);
      await expect(service.getEffectiveBalance('emp-1', 'loc-1')).rejects.toThrow(NotFoundError);
      expect(mockRequestReadRepo.sumPendingDeductions).not.toHaveBeenCalled();
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
