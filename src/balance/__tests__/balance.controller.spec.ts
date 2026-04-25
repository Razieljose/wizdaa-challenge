import { BalanceController } from '../balance.controller';

describe('BalanceController', () => {
  let controller: BalanceController;
  let mockBalanceService: any;

  beforeEach(() => {
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
    controller = new BalanceController(mockBalanceService);
  });

  describe('getEffectiveBalance', () => {
    it('should return effective balance for valid params', async () => {
      const result = await controller.getEffectiveBalance('emp-1', 'loc-1', {});

      expect(result.effectiveBalance).toBe(15);
      expect(result.hcmBalance).toBe(20);
      expect(result.pendingDeductions).toBe(5);
      expect(mockBalanceService.getEffectiveBalance).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('should propagate errors from service', async () => {
      mockBalanceService.getEffectiveBalance.mockRejectedValue(new Error('Not found'));
      await expect(controller.getEffectiveBalance('emp-1', 'loc-1', {})).rejects.toThrow('Not found');
    });
  });
});
